-- 018_lapak_publik_beranda.sql
-- Kolom tambahan lapak_publik untuk beranda pelanggan (S4.1, A10, A11, A18; dipakai lagi di S4.2 untuk A17–A20).
--
-- 1. Kode wilayah tempat yang tampil (tempat aktif atau tempat terakhir dipakai, sama dengan tempat_nama):
--    tempat_kecamatan_kode (33.14.03), tempat_kabupaten_kode (33.14), tempat_provinsi_kode (33).
--    Beranda menyaring Kabupaten Sragen (A18); filter Wilayah V21 nanti memakai kolom yang sama.
-- 2. Jam sesi jadwal yang sedang berlaku: jadwal_mulai dan jadwal_selesai, hanya terisi saat status
--    biasanya_buka, untuk kartu "Biasanya di [tempat] · jadwal 07.00–11.00" (V1). Tabel jadwal tetap
--    hanya bisa dibaca pemilik (RLS); lewat view hanya jam sesi yang sedang berlaku yang terbuka.
-- 3. Celah akses jadwal ditutup: jadwal_sekarang (005) tidak pernah dicabut dari PUBLIC, jadi siapa pun bisa
--    membaca jam jadwal lapak mana pun, termasuk lapak draf dan disembunyikan. Sekarang jadwal_sekarang dicabut
--    dari public, anon, dan authenticated. Tamu hanya lewat jadwal_publik(p_lapak), yang kosong kalau lapaknya
--    tidak tayang. Fungsi lain yang memakai jadwal_sekarang (status_lapak_pada, jadwal_untuk_mulai, dan
--    fungsi Mulai buka) berjalan sebagai security definer, jadi tidak terpengaruh.
--
-- Kolom lama dan urutannya sama dengan 017; kolom baru di ujung. Tabel tidak diubah.
-- Waktu: jam jadwal dihitung di WIB lewat jadwal_sekarang (005). now() hanya titik waktu pembanding.

-- Jam sesi jadwal yang sedang berlaku (WIB), hanya untuk lapak tayang. Lapak draf, disembunyikan,
-- atau tidak ada: kosong.
create or replace function public.jadwal_publik(p_lapak uuid)
returns table (mulai timestamptz, selesai timestamptz)
language sql stable security definer set search_path = public
as $$
  select j.mulai, j.selesai
  from public.lapak l
  cross join lateral public.jadwal_sekarang(l.id, now()) j
  where l.id = p_lapak and l.status_tayang = 'tayang';
$$;

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
  case when st.status = 'biasanya_buka' then jw.selesai end as jadwal_selesai
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
-- Sesi jadwal yang sama dengan yang dipakai status_lapak_pada (005: urut mulai, ambil satu)
left join lateral (
  select j.mulai, j.selesai from public.jadwal_publik(l.id) j limit 1
) jw on true
where l.status_tayang = 'tayang';

-- jadwal_sekarang tidak bisa dipanggil dari aplikasi (dulu terbuka untuk PUBLIC sejak 005)
revoke all on function public.jadwal_sekarang(uuid, timestamptz) from public, anon, authenticated;

-- Postgres memeriksa hak eksekusi fungsi di dalam view sebagai pengguna yang membaca view (lihat 017),
-- jadi jadwal_publik harus bisa dipanggil tamu supaya lapak_publik tetap terbaca.
revoke all on function public.jadwal_publik(uuid) from public;
grant execute on function public.jadwal_publik(uuid) to anon, authenticated;

grant select on public.lapak_publik to anon, authenticated;
