-- 007_storage_foto_profil.sql
-- Bucket foto profil (A40): baca publik, tulis hanya pemilik ke folder miliknya sendiri.
-- Path file: <user_id>/profil.jpg

insert into storage.buckets (id, name, public)
values ('foto-profil', 'foto-profil', true)
on conflict (id) do nothing;

drop policy if exists "foto profil baca publik" on storage.objects;
create policy "foto profil baca publik"
  on storage.objects for select
  using (bucket_id = 'foto-profil');

drop policy if exists "foto profil unggah pemilik" on storage.objects;
create policy "foto profil unggah pemilik"
  on storage.objects for insert
  with check (bucket_id = 'foto-profil' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "foto profil ubah pemilik" on storage.objects;
create policy "foto profil ubah pemilik"
  on storage.objects for update
  using (bucket_id = 'foto-profil' and (storage.foldername(name))[1] = auth.uid()::text);
