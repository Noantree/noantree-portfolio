-- 025_tutup_lapak_hapus_akun.sql
-- Tutup lapak permanen (A29) dan hapus akun (A28; V32). Dijalankan setelah 024.
-- Semua waktu memakai now() (timestamptz); tidak ada logika jam lokal di sini.
--
-- 1. slug_dicadangkan: slug lapak yang sudah ditutup tidak pernah dipakai lagi, supaya QR dan link yang sudah
--    tersebar tetap membuka V27 dan tidak pernah membuka lapak orang lain. Hanya slug dan waktu, tanpa data pemilik.
-- 2. tayangkan_lapak (015) melewati slug yang dicadangkan (A36: tambah angka -2, -3, ...).
-- 3. inti_tutup_lapak: satu logika bersama untuk Tutup lapak dan Hapus akun. Sesi berjalan diakhiri, slug dicadangkan,
--    lalu baris usaha dihapus. Hapus usaha ikut menghapus lapak, dan lewat on delete cascade: tempat, jadwal,
--    foto_lapak, sesi_buka, pengikut, laporan, dan tindakan_admin tentang lapak itu.
--    Usaha ikut dihapus karena usaha_satu_per_pemilik (011): tanpa itu pemilik tidak bisa mendaftar lapak lagi.
-- 4. tutup_lapak_saya: wajib 'TUTUP'. Akun, profil, dan daftar Diikuti milik pemilik tetap (A29).
-- 5. hapus_akun_saya: wajib 'HAPUS'. Lapak milik akun ditutup dengan inti yang sama, lalu baris auth.users dihapus.
--    Lewat on delete cascade/set null:
--      profil (cascade dari auth.users) -> pengikut milik akun dan cek_link (cascade);
--      laporan.pelapor_id dan tindakan_admin.admin_id (set null sejak 021): laporan dan riwayat tetap, tanpa nama (A28).
--    Terhapus seketika, jadi memenuhi "paling lambat 30 hari".
-- 6. Storage: file foto dihapus oleh aplikasi lewat API Storage (folder <uid>/ di foto-lapak dan foto-profil).
--    Kebijakan hapus foto-lapak sudah ada (011); kebijakan hapus foto-profil ditambahkan di sini.
--
-- Semua fungsi berjalan dalam satu transaksi: kalau satu langkah gagal, tidak ada yang terhapus.

-- ============================================================
-- 1. SLUG YANG DICADANGKAN
-- ============================================================

create table if not exists public.slug_dicadangkan (
  slug              text primary key,
  dicadangkan_pada  timestamptz not null default now()
);

-- Tidak dibaca atau ditulis dari aplikasi; hanya lewat fungsi security definer di bawah
alter table public.slug_dicadangkan enable row level security;
revoke all on public.slug_dicadangkan from public, anon, authenticated;

-- ============================================================
-- 2. TAYANGKAN LAPAK: LEWATI SLUG YANG DICADANGKAN (A36)
-- ============================================================
-- Sama dengan 015, ditambah satu syarat: slug tidak ada di slug_dicadangkan.

create or replace function public.tayangkan_lapak()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_lapak  public.lapak%rowtype;
  v_rute   text[] := array['daftar', 'cari', 'lapakku', 'akun', 'diikuti', 'admin', 'komponen'];
  v_dasar  text;
  v_slug   text;
  v_angka  int := 1;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;

  -- Dikunci supaya dua ketukan bersamaan tidak menayangkan dua kali
  select * into v_lapak from public.lapak where pemilik_id = v_uid for update;
  if not found then
    raise exception 'Isi profil lapak dulu';
  end if;
  if v_lapak.status_tayang <> 'draf' then
    raise exception 'Lapak sudah terdaftar';
  end if;
  if v_lapak.langkah_daftar < 3 then
    raise exception 'Selesaikan langkah 2 dulu';
  end if;
  if not exists (select 1 from public.tempat t where t.lapak_id = v_lapak.id) then
    raise exception 'Isi tempat jualan dulu';
  end if;
  if v_lapak.izin_tampil_pada is null then
    raise exception 'Centang izin tampil untuk umum di langkah 1 dulu';
  end if;

  v_dasar := lower(btrim(v_lapak.nama));
  v_dasar := regexp_replace(v_dasar, '[^a-z0-9 -]', '', 'g');  -- karakter lain dibuang
  v_dasar := regexp_replace(v_dasar, '[ -]+', '-', 'g');        -- spasi jadi tanda hubung
  v_dasar := btrim(v_dasar, '-');
  if v_dasar = '' then
    v_dasar := 'lapak';  -- nama tanpa huruf atau angka latin sama sekali
  end if;

  loop
    v_slug := case when v_angka = 1 then v_dasar else v_dasar || '-' || v_angka end;
    if not (v_slug = any (v_rute))
       and not exists (select 1 from public.lapak l where l.slug = v_slug and l.id <> v_lapak.id)
       and not exists (select 1 from public.slug_dicadangkan s where s.slug = v_slug) then
      begin
        update public.lapak set
          slug = v_slug,
          status_tayang = 'tayang',
          diubah_pada = now()
        where id = v_lapak.id;
        return v_slug;
      exception when unique_violation then
        -- Lapak lain baru saja memakai slug yang sama; coba angka berikutnya
        null;
      end;
    end if;
    v_angka := v_angka + 1;
  end loop;
end;
$$;

revoke all on function public.tayangkan_lapak() from public, anon;
grant execute on function public.tayangkan_lapak() to authenticated;

-- ============================================================
-- 3. INTI TUTUP LAPAK (dipakai tutup_lapak_saya dan hapus_akun_saya)
-- ============================================================
-- Tidak memeriksa pemanggil: pemeriksaan ada di kedua fungsi publik. Tidak bisa dipanggil dari aplikasi.

create or replace function public.inti_tutup_lapak(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_lapak public.lapak%rowtype;
begin
  select * into v_lapak from public.lapak where id = p_lapak for update;
  if not found then
    raise exception 'Lapak tidak ditemukan';
  end if;

  -- Sesi yang sedang berjalan diakhiri dulu (A29)
  update public.sesi_buka
     set diakhiri_pada = now(), cara_akhir = 'manual'
   where lapak_id = v_lapak.id and diakhiri_pada is null;

  -- Slug dicadangkan permanen; lapak draf belum punya slug
  if v_lapak.slug is not null then
    insert into public.slug_dicadangkan (slug) values (v_lapak.slug)
    on conflict (slug) do nothing;
  end if;

  -- Usaha dihapus, lapak dan semua datanya ikut terhapus lewat on delete cascade
  delete from public.usaha where id = v_lapak.usaha_id;
end;
$$;

-- ============================================================
-- 4. TUTUP LAPAK SAYA (A29)
-- ============================================================

create or replace function public.tutup_lapak_saya(p_lapak uuid, p_konfirmasi text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  if p_konfirmasi is distinct from 'TUTUP' then
    raise exception 'Ketik TUTUP untuk menutup lapak';
  end if;
  -- Lapak milik orang lain dijawab sama dengan lapak yang tidak ada
  if not exists (select 1 from public.lapak l where l.id = p_lapak and l.pemilik_id = v_uid) then
    raise exception 'Lapak tidak ditemukan';
  end if;
  perform public.inti_tutup_lapak(p_lapak);
end;
$$;

-- ============================================================
-- 5. HAPUS AKUN SAYA (A28)
-- ============================================================

create or replace function public.hapus_akun_saya(p_konfirmasi text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_lapak uuid;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  if p_konfirmasi is distinct from 'HAPUS' then
    raise exception 'Ketik HAPUS untuk menghapus akun';
  end if;

  for v_lapak in select l.id from public.lapak l where l.pemilik_id = v_uid loop
    perform public.inti_tutup_lapak(v_lapak);
  end loop;

  -- Profil ikut terhapus (cascade); laporan dan riwayat admin tetap tanpa nama (set null, 021)
  delete from auth.users where id = v_uid;
  -- Jaga-jaga kalau baris auth.users sudah tidak ada tetapi profil masih ada
  delete from public.profil where id = v_uid;
end;
$$;

-- ============================================================
-- 6. HAK AKSES
-- ============================================================

revoke all on function public.inti_tutup_lapak(uuid) from public, anon, authenticated;

revoke all on function public.tutup_lapak_saya(uuid, text) from public, anon;
grant execute on function public.tutup_lapak_saya(uuid, text) to authenticated;

revoke all on function public.hapus_akun_saya(text) from public, anon;
grant execute on function public.hapus_akun_saya(text) to authenticated;

-- ============================================================
-- 7. STORAGE: PEMILIK BOLEH MENGHAPUS FOTO PROFILNYA SENDIRI
-- ============================================================
-- Dipakai saat hapus akun. Sama dengan "foto lapak hapus pemilik" (011): hanya folder <uid>/ milik sendiri.

drop policy if exists "foto profil hapus pemilik" on storage.objects;
create policy "foto profil hapus pemilik"
  on storage.objects for delete to authenticated
  using (bucket_id = 'foto-profil' and (storage.foldername(name))[1] = auth.uid()::text);
