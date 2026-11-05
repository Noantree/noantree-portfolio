-- 011_daftar_1.sql
-- Daftar 1: profil lapak sebagai draf (S2.1, A30, A32, A36, A37, A40).

-- ------------------------------------------------------------
-- 1. Kolom dan aturan lapak
-- ------------------------------------------------------------

-- A36: slug dibuat saat pertama tayang, jadi boleh kosong selama draf
alter table public.lapak alter column slug drop not null;
alter table public.lapak drop constraint if exists lapak_slug_saat_tayang;
alter table public.lapak add constraint lapak_slug_saat_tayang
  check (status_tayang = 'draf' or slug is not null);

-- A32: izin nama, foto, dan tempat tampil untuk umum; lapak tidak bisa tayang tanpa izin
alter table public.lapak add column if not exists izin_tampil_pada timestamptz;
alter table public.lapak drop constraint if exists lapak_izin_saat_tayang;
alter table public.lapak add constraint lapak_izin_saat_tayang
  check (status_tayang = 'draf' or izin_tampil_pada is not null);

-- A37: deskripsi maks. 300 karakter (larangan link sudah ada sejak 005)
alter table public.lapak drop constraint if exists lapak_deskripsi_maks;
alter table public.lapak add constraint lapak_deskripsi_maks
  check (deskripsi is null or char_length(deskripsi) <= 300);

alter table public.lapak drop constraint if exists lapak_nama_terisi;
alter table public.lapak add constraint lapak_nama_terisi
  check (char_length(btrim(nama)) > 0);

-- MVP: 1 akun = 1 usaha = 1 lapak (PRD bagian 5)
create unique index if not exists usaha_satu_per_pemilik on public.usaha (pemilik_id);
create unique index if not exists lapak_satu_per_pemilik on public.lapak (pemilik_id);

-- ------------------------------------------------------------
-- 2. Fungsi simpan Daftar 1
-- ------------------------------------------------------------
-- Lapak tidak diberi hak tulis langsung supaya pemilik tidak bisa mengubah status_tayang
-- atau slug sendiri (misal menampilkan lagi lapak yang disembunyikan admin, A47).

create or replace function public.simpan_daftar_1(
  p_nama text,
  p_deskripsi text,
  p_foto_url text,
  p_izin boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_lapak public.lapak%rowtype;
  v_usaha uuid;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  if p_izin is not true then
    raise exception 'Izin tampil untuk umum wajib dicentang';
  end if;

  select * into v_lapak from public.lapak where pemilik_id = v_uid;

  if found then
    if v_lapak.status_tayang <> 'draf' then
      raise exception 'Lapak sudah terdaftar';
    end if;
    update public.lapak set
      nama = btrim(p_nama),
      deskripsi = nullif(btrim(p_deskripsi), ''),
      foto_url = p_foto_url,
      izin_tampil_pada = coalesce(izin_tampil_pada, now()),
      langkah_daftar = greatest(langkah_daftar, 2),
      diubah_pada = now()
    where id = v_lapak.id;
    update public.usaha set nama = btrim(p_nama) where id = v_lapak.usaha_id;
    return v_lapak.id;
  end if;

  insert into public.usaha (pemilik_id, nama) values (v_uid, btrim(p_nama))
  returning id into v_usaha;

  insert into public.lapak (usaha_id, pemilik_id, nama, deskripsi, foto_url, izin_tampil_pada, langkah_daftar)
  values (v_usaha, v_uid, btrim(p_nama), nullif(btrim(p_deskripsi), ''), p_foto_url, now(), 2)
  returning id into v_lapak.id;

  return v_lapak.id;
end;
$$;

revoke all on function public.simpan_daftar_1(text, text, text, boolean) from public, anon;
grant execute on function public.simpan_daftar_1(text, text, text, boolean) to authenticated;

-- Foto lapak (maks. 4, trigger batas_foto sejak 005): pemilik menambah dan menghapus sendiri
grant select, insert, delete on public.foto_lapak to authenticated;
grant select on public.usaha to authenticated;

-- ------------------------------------------------------------
-- 3. Storage foto lapak (A40)
-- ------------------------------------------------------------
-- Path: <user_id>/profil-<waktu>.jpg (foto profil lapak, 512 px) dan <user_id>/<waktu>.jpg (foto lapak, 1600 px)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-lapak', 'foto-lapak', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "foto lapak baca publik" on storage.objects;
create policy "foto lapak baca publik"
  on storage.objects for select
  using (bucket_id = 'foto-lapak');

drop policy if exists "foto lapak unggah pemilik" on storage.objects;
create policy "foto lapak unggah pemilik"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'foto-lapak' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "foto lapak ubah pemilik" on storage.objects;
create policy "foto lapak ubah pemilik"
  on storage.objects for update to authenticated
  using (bucket_id = 'foto-lapak' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "foto lapak hapus pemilik" on storage.objects;
create policy "foto lapak hapus pemilik"
  on storage.objects for delete to authenticated
  using (bucket_id = 'foto-lapak' and (storage.foldername(name))[1] = auth.uid()::text);
