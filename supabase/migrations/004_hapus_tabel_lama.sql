-- 004_hapus_tabel_lama.sql
-- Menghapus tabel dan view dari rancangan lama. Semua tabel ini sudah dicek kosong (0 baris).
-- Tabel wilayah (003) tetap dipakai. Jalankan HANYA setelah 003 berhasil.

-- 1. View lama (harus dihapus dulu karena bergantung pada tabel)
drop view if exists public.v_jam_publik;
drop view if exists public.v_pedagang_publik;
drop view if exists public.v_status_aktif;

-- 2. Tabel lama
drop table if exists public.cek_link_log;
drop table if exists public.jam_operasional;
drop table if exists public.status_jualan;
drop table if exists public.lokasi;
drop table if exists public.pedagang;
drop table if exists public.admin_users;

-- 3. Tabel wilayah lama (sudah tersalin ke tabel wilayah)
drop table if exists public.kecamatan;
drop table if exists public.kabupaten;
drop table if exists public.provinsi;
