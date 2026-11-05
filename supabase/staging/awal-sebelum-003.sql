-- awal-sebelum-003.sql: KHUSUS proyek staging yang masih kosong. JANGAN dijalankan di produksi.
--
-- Migrasi 003 menyalin wilayah dari tabel lama provinsi, kabupaten, dan kecamatan, yang dulu dibuat migrasi 001 dan 002
-- (tidak ada di repo). Berkas ini membuat ketiga tabel itu dalam keadaan KOSONG, supaya 003 sampai seterusnya bisa
-- dijalankan apa adanya di database baru: 003 tidak menyalin apa pun, 004 menghapus ketiga tabel ini lagi, dan 006
-- mengisi wilayah lengkap (38 provinsi, 514 kabupaten/kota, 7.285 kecamatan).
--
-- Dijalankan otomatis oleh `npm run db -- staging siapkan` (scripts/db.mjs) sebelum migrasi pertama.
-- Sengaja di luar supabase/migrations supaya tidak pernah ikut terkirim ke produksi.
create table if not exists public.provinsi (
  id uuid primary key default gen_random_uuid(),
  kode text, nama text, zona_waktu text
);
create table if not exists public.kabupaten (
  id uuid primary key default gen_random_uuid(),
  provinsi_id uuid, kode text, nama text
);
create table if not exists public.kecamatan (
  id uuid primary key default gen_random_uuid(),
  kabupaten_id uuid, kode text, nama text, aktif boolean default true
);
