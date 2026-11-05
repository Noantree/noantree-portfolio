-- 010_hak_baca_lapak.sql
-- Pengarah setelah masuk (A26, A27) perlu tahu apakah akun punya lapak, draf, atau belum.
-- Migrasi 005 belum memberi hak tabel lapak ke role authenticated (sama seperti profil di 008).
-- RLS "lapak kelola pemilik" tetap membatasi baris: pengguna hanya melihat lapaknya sendiri.
-- Hak tulis menyusul di Sprint 2 bersama alur Daftar.

grant select on public.lapak to authenticated;
