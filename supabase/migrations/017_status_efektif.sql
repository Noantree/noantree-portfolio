-- 017_status_efektif.sql
-- Status efektif lapak_publik, layar Berakhir V28 sekali, dan job tiap jam (S3.3, A5, A6, A7, PRD bagian 5).
--
-- 1. Status efektif dihitung di status_lapak_pada(p_lapak, p_now) supaya bisa diuji dengan waktu tiruan.
--    View lapak_publik memakai status_lapak(p_lapak), pembungkus yang selalu memakai now().
--    Perbaikan dari 005: sesi dihitung milik sesi jadwal hanya jika dari_jadwal dan akhir awalnya
--    (berakhir_pada - total_perpanjangan_menit) sama dengan akhir sesi jadwal itu. Jadi Mulai buka 05.30
--    untuk jadwal 06.00–14.00 lalu Selesai di tengah jadwal tetap Tutup, dan sesi jadwal berikutnya
--    kembali ke Biasanya buka tanpa tindakan pemilik.
-- 2. V28 sekali (A7): sesi_berakhir_belum_dilihat dan tandai_akhir_dilihat memakai kolom
--    akhir_dilihat_pemilik yang sudah ada sejak 005. Hanya sesi yang berakhir dalam 24 jam terakhir.
-- 3. Job tiap jam (A6) lewat pg_cron: tutup_sesi_semua().
--
-- Waktu: jam jadwal dihitung di WIB lewat jadwal_sekarang (005). now() hanya titik waktu pembanding.
-- Tabel tidak diubah.

create extension if not exists pg_cron with schema pg_catalog;

-- ------------------------------------------------------------
-- 1. Status efektif (PRD bagian 5, urutan pengecekan 1 sampai 4)
-- ------------------------------------------------------------

-- 1. Lapak draf atau disembunyikan: null (tidak tampil ke publik; view juga hanya memuat lapak tayang).
-- 2. Ada sesi aktif (diakhiri_pada kosong, berakhir_pada masih di depan): 'buka' atau 'habis'.
-- 3. Sekarang di dalam sesi jadwal dan belum ada sesi milik sesi jadwal itu: 'biasanya_buka'.
--    Sesi milik sesi jadwal = dari_jadwal dan berakhir_pada - total_perpanjangan_menit = akhir sesi jadwal.
--    Selesai hanya berlaku untuk sesi jadwal itu.
-- 4. Selain itu: 'tutup'.
create or replace function public.status_lapak_pada(p_lapak uuid, p_now timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when l.status_tayang <> 'tayang' then null
    when sa.status is not null then sa.status
    when jw.mulai is not null and jw.mulai <= p_now
         and not exists (
           select 1 from public.sesi_buka s
           where s.lapak_id = l.id
             and s.dari_jadwal
             and s.berakhir_pada - make_interval(mins => s.total_perpanjangan_menit) = jw.selesai
         ) then 'biasanya_buka'
    else 'tutup'
  end
  from public.lapak l
  left join lateral (
    select s.status from public.sesi_buka s
    where s.lapak_id = l.id and s.diakhiri_pada is null and s.berakhir_pada > p_now
    limit 1
  ) sa on true
  left join lateral (
    select j.mulai, j.selesai from public.jadwal_sekarang(l.id, p_now) j limit 1
  ) jw on true
  where l.id = p_lapak;
$$;

create or replace function public.status_lapak(p_lapak uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select public.status_lapak_pada(p_lapak, now());
$$;

-- Kolom dan urutannya sama dengan 005; hanya cara menghitung status yang berubah
create or replace view public.lapak_publik as
select
  l.id,
  l.slug,
  l.nama,
  l.deskripsi,
  l.foto_url,
  public.status_lapak(l.id) as status,
  sa.berakhir_pada,
  tp.id          as tempat_id,
  tp.nama        as tempat_nama,
  tp.lat         as tempat_lat,
  tp.lng         as tempat_lng,
  tp.link_maps   as tempat_link_maps,
  (select count(*) from public.pengikut p where p.lapak_id = l.id) as jumlah_pengikut
from public.lapak l
left join lateral (
  select s.* from public.sesi_buka s
  where s.lapak_id = l.id and s.diakhiri_pada is null and s.berakhir_pada > now()
  limit 1
) sa on true
left join lateral (
  select t.* from public.tempat t
  where t.lapak_id = l.id
  order by (t.id = sa.tempat_id) desc nulls last, t.terakhir_dipakai desc nulls last
  limit 1
) tp on true
where l.status_tayang = 'tayang';

-- ------------------------------------------------------------
-- 2. Job tiap jam (A6)
-- ------------------------------------------------------------

-- Menandai semua sesi yang lewat berakhir_pada sebagai selesai otomatis. diakhiri_pada = berakhir_pada
-- supaya riwayat mencatat jam berakhir yang sebenarnya. Mengembalikan jumlah sesi yang ditutup.
create or replace function public.tutup_sesi_semua()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_jumlah integer;
begin
  update public.sesi_buka
     set diakhiri_pada = berakhir_pada, cara_akhir = 'otomatis'
   where diakhiri_pada is null and berakhir_pada <= now();
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

-- Jadwal cron memakai UTC. Aman: job hanya membandingkan timestamp absolut, bukan jam bisnis WIB.
-- cron.schedule dengan nama yang sama memperbarui job lama, jadi migrasi ini aman dijalankan ulang.
select cron.schedule('noantree-tutup-sesi', '0 * * * *', 'select public.tutup_sesi_semua()');

-- ------------------------------------------------------------
-- 3. Layar Berakhir V28 sekali (A6, A7)
-- ------------------------------------------------------------

-- Sesi terakhir yang berakhir otomatis dan belum dilihat pemilik. Kosong jika ada sesi aktif.
-- Sesi yang berakhir lebih dari 24 jam lalu langsung ditandai dilihat tanpa layar (PRD bagian 5).
create or replace function public.inti_sesi_berakhir_belum_dilihat(p_lapak uuid, p_now timestamptz)
returns table (
  id uuid,
  mulai_pada timestamptz,
  berakhir_pada timestamptz,
  tempat_id uuid,
  tempat_nama text,
  dari_jadwal boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  v_sesi public.sesi_buka%rowtype;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.tutup_sesi_lewat(p_lapak, p_now);

  if exists (select 1 from public.sesi_buka s where s.lapak_id = p_lapak and s.diakhiri_pada is null) then
    return;
  end if;

  select * into v_sesi from public.sesi_buka s
   where s.lapak_id = p_lapak
   order by s.mulai_pada desc
   limit 1;

  if v_sesi.id is null or v_sesi.cara_akhir is distinct from 'otomatis' or v_sesi.akhir_dilihat_pemilik is not null then
    return;
  end if;

  if v_sesi.berakhir_pada < p_now - interval '24 hours' then
    update public.sesi_buka set akhir_dilihat_pemilik = p_now where sesi_buka.id = v_sesi.id;
    return;
  end if;

  return query
    select v_sesi.id, v_sesi.mulai_pada, v_sesi.berakhir_pada, v_sesi.tempat_id, t.nama, v_sesi.dari_jadwal
    from (select 1) satu
    left join public.tempat t on t.id = v_sesi.tempat_id;
end;
$$;

-- Menandai semua sesi berakhir otomatis lapak ini sudah dilihat. Semua, bukan hanya yang terakhir,
-- karena "Buka lagi" memanggil mulai_buka dulu sehingga sesi baru sudah menjadi sesi terakhir.
create or replace function public.inti_tandai_akhir_dilihat(p_lapak uuid, p_now timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.tutup_sesi_lewat(p_lapak, p_now);

  update public.sesi_buka
     set akhir_dilihat_pemilik = p_now
   where lapak_id = p_lapak and cara_akhir = 'otomatis' and akhir_dilihat_pemilik is null;
end;
$$;

create or replace function public.sesi_berakhir_belum_dilihat(p_lapak uuid)
returns table (
  id uuid,
  mulai_pada timestamptz,
  berakhir_pada timestamptz,
  tempat_id uuid,
  tempat_nama text,
  dari_jadwal boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  return query select * from public.inti_sesi_berakhir_belum_dilihat(p_lapak, now());
end;
$$;

create or replace function public.tandai_akhir_dilihat(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.inti_tandai_akhir_dilihat(p_lapak, now());
end;
$$;

-- ------------------------------------------------------------
-- 4. Hak akses
-- ------------------------------------------------------------

-- Fungsi dengan waktu tiruan dan job: tidak bisa dipanggil dari aplikasi
revoke all on function public.status_lapak_pada(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.tutup_sesi_semua() from public, anon, authenticated;
revoke all on function public.inti_sesi_berakhir_belum_dilihat(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_tandai_akhir_dilihat(uuid, timestamptz) from public, anon, authenticated;

-- Postgres memeriksa hak eksekusi fungsi di dalam view sebagai pengguna yang membaca view,
-- jadi status_lapak harus bisa dipanggil tamu supaya lapak_publik tetap terbaca.
revoke all on function public.status_lapak(uuid) from public;
grant execute on function public.status_lapak(uuid) to anon, authenticated;

revoke all on function public.sesi_berakhir_belum_dilihat(uuid) from public, anon;
revoke all on function public.tandai_akhir_dilihat(uuid) from public, anon;
grant execute on function public.sesi_berakhir_belum_dilihat(uuid) to authenticated;
grant execute on function public.tandai_akhir_dilihat(uuid) to authenticated;

grant select on public.lapak_publik to anon, authenticated;
