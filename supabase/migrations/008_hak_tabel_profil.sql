-- 008_hak_tabel_profil.sql
-- Migrasi 005 membuat tabel tanpa memberi hak akses tabel ke role authenticated,
-- sehingga pengguna yang sudah login mendapat error 42501 "permission denied for table profil".
-- RLS tetap yang membatasi baris: pengguna hanya bisa baca dan ubah profilnya sendiri.
-- Kolom is_admin dijaga oleh kebijakan "profil ubah sendiri" dan hanya diubah lewat SQL.

grant select, insert, update on public.profil to authenticated;

-- Wilayah boleh dibaca siapa saja (termasuk tamu), sesuai kebijakan "wilayah dibaca publik"
grant select on public.wilayah to anon, authenticated;
