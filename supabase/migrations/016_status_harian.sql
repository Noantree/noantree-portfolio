-- 016_status_harian.sql
-- Status harian pemilik (S3.1): mulai_buka, ubah_status, perpanjang, selesai, batalkan_selesai
-- dengan aturan durasi PRD bagian 5 (A2, A3, A4, A6, A8, A9, A30, A35).
--
-- Fungsi dari 005 diganti di sini. Perubahannya:
--   - Mulai buka hanya untuk lapak tayang; lapak disembunyikan ditolak (A9).
--   - Mulai lebih awal maks. 3 jam sebelum sesi jadwal; lebih awal dari itu dihitung di luar jadwal (bagian 5).
--   - Waktu tombol ditekan boleh dikirim dari HP untuk mulai buka saat offline (A8).
--   - Tempat harus milik lapak itu; kosong = tempat yang terakhir dipakai atau satu-satunya tempat (A2).
--   - Semua fungsi menutup dulu sesi yang lewat berakhir_pada dengan cara_akhir = otomatis (A6).
--   - Hak akses: revoke dari public dan anon, grant ke authenticated.
--
-- Waktu: hari dan jam jadwal dihitung di zona Asia/Jakarta (WIB). now() hanya dipakai sebagai titik waktu
-- pembanding; selisih dan penjumlahan durasi pada timestamptz tidak bergantung zona.
--
-- Logika ada di fungsi inti_* yang menerima p_now, supaya bisa diuji dengan waktu tiruan
-- (supabase/tests/s3_1_uji.sql). Fungsi inti_* tidak bisa dipanggil dari aplikasi; aplikasi memanggil
-- fungsi pembungkus yang selalu memakai now().
--
-- Belum di sini: job harian A6 dan perbaikan view lapak_publik (S3.3). Tabel tidak diubah.

-- ------------------------------------------------------------
-- 1. Pembantu
-- ------------------------------------------------------------

-- Sesi jadwal yang dipakai saat mulai buka pada p_waktu: sesi yang sedang berjalan, atau yang dimulai
-- paling lama 3 jam lagi. Jam jadwal adalah jam dinding WIB; sesi lewat tengah malam milik hari mulainya.
-- Kemarin, hari ini, dan besok (WIB) ikut diperiksa supaya sesi lewat tengah malam dan sesi dini hari
-- besok yang dimulai dalam 3 jam juga terhitung. jadwal_sekarang (005) tidak diubah karena dipakai view.
create or replace function public.jadwal_untuk_mulai(p_lapak uuid, p_waktu timestamptz)
returns table (mulai timestamptz, selesai timestamptz)
language sql stable security definer set search_path = public
as $$
  select s.mulai, s.selesai
  from (
    select
      (c.tgl + j.jam_mulai)::timestamp at time zone 'Asia/Jakarta' as mulai,
      (c.tgl + j.jam_selesai
         + case when j.jam_selesai <= j.jam_mulai then interval '1 day' else interval '0 day' end
      )::timestamp at time zone 'Asia/Jakarta' as selesai
    from public.jadwal j
    cross join lateral (
      select ((p_waktu at time zone 'Asia/Jakarta')::date + g) as tgl
      from generate_series(-1, 1) as g
    ) c
    where j.lapak_id = p_lapak
      and extract(dow from c.tgl)::int = j.hari
  ) s
  where p_waktu >= s.mulai - interval '3 hours'
    and p_waktu < s.selesai
  order by s.mulai
  limit 1;
$$;

-- A6: sesi aktif yang sudah lewat berakhir_pada dianggap selesai otomatis saat dibaca.
-- diakhiri_pada = berakhir_pada supaya riwayat mencatat jam berakhir yang sebenarnya.
create or replace function public.tutup_sesi_lewat(p_lapak uuid, p_now timestamptz)
returns void
language sql security definer set search_path = public
as $$
  update public.sesi_buka
     set diakhiri_pada = berakhir_pada, cara_akhir = 'otomatis'
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada <= p_now;
$$;

-- ------------------------------------------------------------
-- 2. Fungsi inti (p_now = waktu sekarang; hanya untuk pembungkus dan uji)
-- ------------------------------------------------------------

-- Mulai buka (A2, A8, A9, A30, A35, bagian 5).
-- p_waktu: waktu tombol ditekan (A8). Kosong = sekarang. Tidak boleh di masa depan (selisih jam HP sampai
-- 1 menit dianggap sekarang), maks. 1 jam ke belakang, dan tidak sebelum sesi terakhir diakhiri.
-- Dalam sesi jadwal atau maks. 3 jam sebelumnya: berakhir_pada = akhir sesi jadwal itu.
-- Di luar jadwal atau tanpa jadwal: berakhir_pada = mulai + 4 jam.
create or replace function public.inti_mulai_buka(
  p_lapak uuid,
  p_tempat uuid,
  p_waktu timestamptz,
  p_now timestamptz
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_status    text;
  v_mulai     timestamptz := coalesce(p_waktu, p_now);
  v_terakhir  timestamptz;
  v_jw        record;
  v_akhir     timestamptz;
  v_dari      boolean;
  v_tempat    uuid;
  v_id        uuid;
begin
  perform public.cek_pemilik_lapak(p_lapak);

  -- Baris lapak dikunci supaya dua ketukan Mulai buka bersamaan diproses satu per satu
  select status_tayang into v_status from public.lapak where id = p_lapak for update;
  if v_status = 'disembunyikan' then
    raise exception 'Lapakmu sedang disembunyikan, jadi belum bisa mulai buka';
  end if;
  if v_status <> 'tayang' then
    raise exception 'Selesaikan daftar lapak dulu';
  end if;

  perform public.tutup_sesi_lewat(p_lapak, p_now);

  if exists (select 1 from public.sesi_buka where lapak_id = p_lapak and diakhiri_pada is null) then
    raise exception 'Lapak sudah buka';
  end if;

  -- A8: waktu dari HP
  if v_mulai > p_now + interval '1 minute' then
    raise exception 'Waktu mulai buka tidak boleh di masa depan';
  end if;
  if v_mulai > p_now then
    v_mulai := p_now;
  end if;
  if v_mulai < p_now - interval '1 hour' then
    raise exception 'Mulai buka lebih dari 1 jam yang lalu tidak bisa dikirim lagi';
  end if;
  select max(diakhiri_pada) into v_terakhir from public.sesi_buka where lapak_id = p_lapak;
  if v_terakhir is not null and v_mulai < v_terakhir then
    raise exception 'Waktu mulai buka lebih awal dari sesi terakhir yang sudah selesai';
  end if;

  -- A2: tempat milik lapak ini; kosong = terakhir dipakai, atau satu-satunya tempat
  if p_tempat is not null then
    if not exists (select 1 from public.tempat where id = p_tempat and lapak_id = p_lapak) then
      raise exception 'Tempat tidak dikenal';
    end if;
    v_tempat := p_tempat;
  else
    select id into v_tempat from public.tempat
     where lapak_id = p_lapak
     order by terakhir_dipakai desc nulls last, dibuat_pada
     limit 1;
  end if;

  -- Aturan durasi (bagian 5)
  select * into v_jw from public.jadwal_untuk_mulai(p_lapak, v_mulai);
  if found then
    v_akhir := v_jw.selesai;
    v_dari  := true;
  else
    v_akhir := v_mulai + interval '4 hours';
    v_dari  := false;
  end if;

  -- Mulai buka offline yang sesinya sudah habis saat terkirim langsung dicatat selesai otomatis
  begin
    insert into public.sesi_buka (
      lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak, dari_jadwal,
      diakhiri_pada, cara_akhir
    ) values (
      p_lapak, v_tempat, v_mulai, v_akhir, 'buka', v_mulai, v_dari,
      case when v_akhir <= p_now then v_akhir end,
      case when v_akhir <= p_now then 'otomatis' end
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Lapak sudah buka';
  end;

  if v_tempat is not null then
    update public.tempat
       set terakhir_dipakai = greatest(coalesce(terakhir_dipakai, v_mulai), v_mulai)
     where id = v_tempat;
  end if;

  return v_id;
end;
$$;

-- Habis atau stok ada lagi (A1, A3, bagian 5). berakhir_pada tidak berubah.
-- Status yang sama dikirim ulang tidak mengubah status_sejak.
create or replace function public.inti_ubah_status(p_lapak uuid, p_status text, p_now timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  if p_status is null or p_status not in ('buka', 'habis') then
    raise exception 'Status tidak dikenal';
  end if;

  perform public.tutup_sesi_lewat(p_lapak, p_now);

  update public.sesi_buka
     set status = p_status,
         status_sejak = case when status <> p_status then p_now else status_sejak end
   where lapak_id = p_lapak and diakhiri_pada is null;

  if not found then
    raise exception 'Tidak ada sesi aktif';
  end if;
end;
$$;

-- Perpanjang +60 menit, hanya jika total_perpanjangan_menit + 60 <= 480 (A4, bagian 5).
-- Boleh kapan saja selama sesi aktif, juga saat Habis; warna tombol diatur layar.
create or replace function public.inti_perpanjang(p_lapak uuid, p_now timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_total integer;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.tutup_sesi_lewat(p_lapak, p_now);

  select id, total_perpanjangan_menit into v_id, v_total
    from public.sesi_buka
   where lapak_id = p_lapak and diakhiri_pada is null
   for update;

  if v_id is null then
    raise exception 'Tidak ada sesi aktif';
  end if;
  if v_total + 60 > 480 then
    raise exception 'Batas 8 jam per sesi sudah tercapai';
  end if;

  update public.sesi_buka
     set berakhir_pada = berakhir_pada + interval '60 minutes',
         total_perpanjangan_menit = total_perpanjangan_menit + 60
   where id = v_id;
end;
$$;

-- Selesai: diakhiri_pada = sekarang, cara_akhir = manual (A3, bagian 5)
create or replace function public.inti_selesai(p_lapak uuid, p_now timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.tutup_sesi_lewat(p_lapak, p_now);

  update public.sesi_buka
     set diakhiri_pada = p_now, cara_akhir = 'manual'
   where lapak_id = p_lapak and diakhiri_pada is null;

  if not found then
    raise exception 'Tidak ada sesi aktif';
  end if;
end;
$$;

-- Batalkan Selesai dalam 5 detik (A3). Hanya sesi Selesai manual, hanya jika belum ada sesi aktif lain,
-- dan hanya jika berakhir_pada sesi itu belum lewat.
create or replace function public.inti_batalkan_selesai(p_lapak uuid, p_now timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_akhir timestamptz;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.tutup_sesi_lewat(p_lapak, p_now);

  select id, berakhir_pada into v_id, v_akhir
    from public.sesi_buka
   where lapak_id = p_lapak and cara_akhir = 'manual'
     and diakhiri_pada > p_now - interval '5 seconds'
     and diakhiri_pada <= p_now
   order by diakhiri_pada desc
   limit 1;

  if v_id is null then
    raise exception 'Tidak bisa dibatalkan (lewat 5 detik)';
  end if;
  if exists (select 1 from public.sesi_buka where lapak_id = p_lapak and diakhiri_pada is null) then
    raise exception 'Lapak sudah buka lagi';
  end if;
  if v_akhir <= p_now then
    raise exception 'Sesi ini sudah berakhir';
  end if;

  update public.sesi_buka
     set diakhiri_pada = null, cara_akhir = null
   where id = v_id;
end;
$$;

-- ------------------------------------------------------------
-- 3. Fungsi untuk aplikasi (selalu memakai now())
-- ------------------------------------------------------------

-- Tanda tangan mulai_buka bertambah p_waktu (A8); yang lama dihapus supaya panggilan tidak ambigu
drop function if exists public.mulai_buka(uuid, uuid);

create or replace function public.mulai_buka(
  p_lapak uuid,
  p_tempat uuid default null,
  p_waktu timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  return public.inti_mulai_buka(p_lapak, p_tempat, p_waktu, now());
end;
$$;

create or replace function public.ubah_status(p_lapak uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.inti_ubah_status(p_lapak, p_status, now());
end;
$$;

create or replace function public.perpanjang(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.inti_perpanjang(p_lapak, now());
end;
$$;

create or replace function public.selesai(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.inti_selesai(p_lapak, now());
end;
$$;

create or replace function public.batalkan_selesai(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.inti_batalkan_selesai(p_lapak, now());
end;
$$;

-- ------------------------------------------------------------
-- 4. Hak akses
-- ------------------------------------------------------------

-- Pembantu dan fungsi inti: tidak bisa dipanggil dari aplikasi (p_now bisa dipalsukan)
revoke all on function public.cek_pemilik_lapak(uuid) from public, anon, authenticated;
revoke all on function public.jadwal_untuk_mulai(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.tutup_sesi_lewat(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_mulai_buka(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_ubah_status(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_perpanjang(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_selesai(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.inti_batalkan_selesai(uuid, timestamptz) from public, anon, authenticated;

revoke all on function public.mulai_buka(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.ubah_status(uuid, text) from public, anon;
revoke all on function public.perpanjang(uuid) from public, anon;
revoke all on function public.selesai(uuid) from public, anon;
revoke all on function public.batalkan_selesai(uuid) from public, anon;
grant execute on function public.mulai_buka(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.ubah_status(uuid, text) to authenticated;
grant execute on function public.perpanjang(uuid) to authenticated;
grant execute on function public.selesai(uuid) to authenticated;
grant execute on function public.batalkan_selesai(uuid) to authenticated;

-- Pemilik membaca sesinya sendiri untuk layar S3.2; RLS "sesi baca pemilik" (005) membatasi baris.
-- Tulis tetap hanya lewat fungsi di atas.
grant select on public.sesi_buka to authenticated;
