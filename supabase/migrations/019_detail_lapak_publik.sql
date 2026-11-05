-- 019_detail_lapak_publik.sql
-- Data publik untuk halaman detail lapak /:slug (S4.3, A1, A36, A37, A40; V2, V22, V23, V37, V27).
--
-- 1. View jadwal_lapak_publik: hari dan jam jadwal lapak tayang (kartu Jadwal di V2).
--    Tabel jadwal tetap tertutup untuk tamu; view hanya membuka lapak_id, hari, jam_mulai, jam_selesai.
-- 2. View foto_lapak_publik: maks. 4 foto lapak tayang (V2, V37). Tabel foto_lapak tetap tertutup.
-- 3. lapak_publik mendapat 5 kolom di ujung (kolom lama dan urutannya tidak berubah):
--    status_sejak          jam status sesi aktif berlaku ("Habis sejak 13.20", V23); kosong tanpa sesi aktif
--    terakhir_buka_pada    akhir sesi terakhir yang sudah selesai, hanya saat Tutup ("terakhir buka kemarin", V23)
--    buka_berikutnya       awal sesi jadwal pertama setelah sekarang, hanya saat Tutup ("Buka lagi besok 06.00", V23)
--    tempat_kecamatan_nama, tempat_kabupaten_nama   nama wilayah tempat yang tampil ("Kec. Sragen, Kab. Sragen", V2)
--
-- Lapak draf dan disembunyikan tidak ada di ketiga view (A47), jadi /:slug untuk lapak itu menampilkan V27.
-- Riwayat sesi, cara_akhir, perpanjangan, dan pemilik_id tidak dibuka.
--
-- Waktu: jam jadwal adalah jam dinding WIB (Asia/Jakarta). Logika buka_berikutnya ada di
-- inti_buka_berikutnya(p_lapak, p_now) supaya bisa diuji dengan waktu tiruan (supabase/tests/s4_3_uji.sql).
-- Fungsi inti tidak bisa dipanggil tamu; view memakai buka_berikutnya_publik yang memeriksa status tayang,
-- sama seperti jadwal_publik di 018.

-- ------------------------------------------------------------
-- 1. Jadwal dan foto untuk publik
-- ------------------------------------------------------------

create or replace view public.jadwal_lapak_publik as
select j.lapak_id, j.hari, j.jam_mulai, j.jam_selesai
from public.jadwal j
join public.lapak l on l.id = j.lapak_id
where l.status_tayang = 'tayang';

create or replace view public.foto_lapak_publik as
select f.lapak_id, f.url, f.urutan
from public.foto_lapak f
join public.lapak l on l.id = f.lapak_id
where l.status_tayang = 'tayang';

-- ------------------------------------------------------------
-- 2. Buka berikutnya menurut jadwal
-- ------------------------------------------------------------

-- Awal sesi jadwal pertama yang dimulai sesudah p_now, dicari dari hari ini sampai 7 hari ke depan (WIB).
-- Sesi yang sudah dimulai tidak dihitung, jadi sesudah Selesai di tengah jadwal hasilnya sesi berikutnya,
-- dan sesi lewat tengah malam yang sedang berjalan juga dilewati. Tanpa jadwal: null.
create or replace function public.inti_buka_berikutnya(p_lapak uuid, p_now timestamptz)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select min((c.tgl + j.jam_mulai)::timestamp at time zone 'Asia/Jakarta')
  from public.jadwal j
  cross join lateral (
    select ((p_now at time zone 'Asia/Jakarta')::date + g) as tgl
    from generate_series(0, 7) as g
  ) c
  where j.lapak_id = p_lapak
    and extract(dow from c.tgl)::int = j.hari
    and (c.tgl + j.jam_mulai)::timestamp at time zone 'Asia/Jakarta' > p_now;
$$;

-- Untuk view dan tamu: hanya lapak tayang, selalu memakai now()
create or replace function public.buka_berikutnya_publik(p_lapak uuid)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select public.inti_buka_berikutnya(l.id, now())
  from public.lapak l
  where l.id = p_lapak and l.status_tayang = 'tayang';
$$;

-- ------------------------------------------------------------
-- 3. lapak_publik: 18 kolom dari 018, lalu 5 kolom baru
-- ------------------------------------------------------------

create or replace view public.lapak_publik as
select
  l.id,
  l.slug,
  l.nama,
  l.deskripsi,
  l.foto_url,
  st.status,
  sa.berakhir_pada,
  tp.id          as tempat_id,
  tp.nama        as tempat_nama,
  tp.lat         as tempat_lat,
  tp.lng         as tempat_lng,
  tp.link_maps   as tempat_link_maps,
  (select count(*) from public.pengikut p where p.lapak_id = l.id) as jumlah_pengikut,
  kc.kode        as tempat_kecamatan_kode,
  kb.kode        as tempat_kabupaten_kode,
  kb.kode_induk  as tempat_provinsi_kode,
  case when st.status = 'biasanya_buka' then jw.mulai end   as jadwal_mulai,
  case when st.status = 'biasanya_buka' then jw.selesai end as jadwal_selesai,
  sa.status_sejak,
  case when st.status = 'tutup' then (
    select max(coalesce(s.diakhiri_pada, s.berakhir_pada))
    from public.sesi_buka s
    where s.lapak_id = l.id and (s.diakhiri_pada is not null or s.berakhir_pada <= now())
  ) end as terakhir_buka_pada,
  case when st.status = 'tutup' then public.buka_berikutnya_publik(l.id) end as buka_berikutnya,
  kc.nama        as tempat_kecamatan_nama,
  kb.nama        as tempat_kabupaten_nama
from public.lapak l
cross join lateral (select public.status_lapak(l.id) as status) st
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
left join public.wilayah kc on kc.id = tp.kecamatan_id and kc.tingkat = 'kecamatan'
left join public.wilayah kb on kb.tingkat = 'kabupaten' and kb.kode = kc.kode_induk
left join lateral (
  select j.mulai, j.selesai from public.jadwal_publik(l.id) j limit 1
) jw on true
where l.status_tayang = 'tayang';

-- ------------------------------------------------------------
-- 4. Hak akses
-- ------------------------------------------------------------

revoke all on function public.inti_buka_berikutnya(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.buka_berikutnya_publik(uuid) from public;
grant execute on function public.buka_berikutnya_publik(uuid) to anon, authenticated;

grant select on public.lapak_publik to anon, authenticated;
grant select on public.jadwal_lapak_publik to anon, authenticated;
grant select on public.foto_lapak_publik to anon, authenticated;
