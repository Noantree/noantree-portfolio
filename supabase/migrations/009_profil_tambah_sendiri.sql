-- 009_profil_tambah_sendiri.sql
-- Akun saya memakai upsert pada tabel profil. Upsert juga memeriksa kebijakan INSERT,
-- dan migrasi 005 belum punya kebijakan itu, sehingga simpan nama ditolak (42501).
-- Kebijakan ini mengizinkan pengguna membuat baris profilnya sendiri, dengan is_admin = false.

drop policy if exists "profil tambah sendiri" on public.profil;
create policy "profil tambah sendiri"
  on public.profil for insert
  with check (id = auth.uid() and is_admin = false);
