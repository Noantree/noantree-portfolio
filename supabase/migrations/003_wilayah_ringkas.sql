-- 003_wilayah_ringkas.sql
-- Menggabungkan tabel provinsi, kabupaten, dan kecamatan menjadi satu tabel wilayah.
-- Aman dijalankan: tabel lama BELUM dihapus di file ini (dihapus di 004).

create table if not exists public.wilayah (
  id          uuid primary key default gen_random_uuid(),
  tingkat     text not null check (tingkat in ('provinsi', 'kabupaten', 'kecamatan')),
  kode        text not null,
  nama        text not null,
  kode_induk  text,            -- kode provinsi untuk kabupaten, kode kabupaten untuk kecamatan
  zona_waktu  text,            -- hanya untuk provinsi
  aktif       boolean not null default true,
  unique (tingkat, kode)
);

-- Salin data provinsi
insert into public.wilayah (tingkat, kode, nama, zona_waktu, aktif)
select 'provinsi', p.kode, p.nama, p.zona_waktu, true
from public.provinsi p
on conflict (tingkat, kode) do nothing;

-- Salin data kabupaten/kota, induknya adalah kode provinsi
insert into public.wilayah (tingkat, kode, nama, kode_induk, aktif)
select 'kabupaten', k.kode, k.nama, p.kode, true
from public.kabupaten k
join public.provinsi p on p.id = k.provinsi_id
on conflict (tingkat, kode) do nothing;

-- Salin data kecamatan, induknya adalah kode kabupaten/kota.
-- Kode kecamatan di tabel lama ada yang kosong, jadi diisi 'kec-<id>' sebagai pengganti sementara.
insert into public.wilayah (tingkat, kode, nama, kode_induk, aktif)
select 'kecamatan', coalesce(c.kode, 'kec-' || c.id::text), c.nama, k.kode, c.aktif
from public.kecamatan c
join public.kabupaten k on k.id = c.kabupaten_id
on conflict (tingkat, kode) do nothing;

-- Keamanan: data wilayah boleh dibaca siapa saja, hanya admin yang boleh mengubah
alter table public.wilayah enable row level security;

drop policy if exists "wilayah dibaca publik" on public.wilayah;
create policy "wilayah dibaca publik"
  on public.wilayah for select
  using (true);

-- Cek hasil (jalankan manual setelah file ini):
-- select tingkat, count(*) from public.wilayah group by tingkat;
-- Bandingkan dengan jumlah baris di provinsi, kabupaten, dan kecamatan.
