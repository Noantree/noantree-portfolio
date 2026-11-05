-- 021_laporkan_admin.sql
-- Laporkan lapak dan admin (PRD A44, A46, A47; V9, V18, V55).
-- Dijalankan setelah 020. Semua waktu lokal memakai zona Asia/Jakarta (WIB).
--
-- 1. laporan: kolom pernyataan_pada (checklist "melihat sendiri", V9), batas alasan dan catatan.
-- 2. lapor_lapak: pernyataan wajib; satu akun hanya bisa melaporkan lapak yang sama sekali per 30 hari
--    (dihitung mundur dari sekarang, bukan per hari kalender). Lapak harus tayang; lapak sendiri ditolak.
-- 3. tindakan_admin: kolom laporan_id dan aksi 'abaikan' untuk riwayat per laporan.
-- 4. admin_tindak_lapak: Abaikan, Abaikan semua, Sembunyikan lapak, dan Tampilkan lagi dalam satu transaksi.
-- 5. admin_detail_laporan: daftar laporan satu lapak, termasuk email pelapor (hanya admin, A46).
-- 6. Admin boleh membaca tabel lapak (sebelumnya hanya bisa mengubah), supaya V18 dan V55 bisa menampilkan namanya.
-- 7. Hapus akun (A28): laporan dan riwayat admin tetap disimpan tanpa nama. Foreign key diubah ke on delete set null.
--
-- Aturan status laporan (baru, diabaikan, ditindak) dan efeknya ada di PRD A47.

-- ============================================================
-- 1. TABEL
-- ============================================================

alter table public.laporan
  add column if not exists pernyataan_pada timestamptz;

-- Batas isi sesuai PRD A44. Tabel masih kosong di produksi, karena S5.2 belum dirilis.
alter table public.laporan
  drop constraint if exists laporan_alasan_check;
alter table public.laporan
  add constraint laporan_alasan_check check (alasan in (
    'Lapak tidak ada / akun iseng',
    'Status tidak sesuai',
    'Tempat salah',
    'Konten tidak pantas',
    'Lainnya'
  ));
alter table public.laporan
  drop constraint if exists laporan_catatan_check;
alter table public.laporan
  add constraint laporan_catatan_check check (catatan is null or char_length(catatan) <= 200);

alter table public.tindakan_admin
  add column if not exists laporan_id uuid references public.laporan(id) on delete set null;

alter table public.tindakan_admin
  drop constraint if exists tindakan_admin_aksi_check;
alter table public.tindakan_admin
  add constraint tindakan_admin_aksi_check check (aksi in ('abaikan', 'sembunyikan', 'tampilkan'));

create index if not exists laporan_lapak_pelapor_idx
  on public.laporan (lapak_id, pelapor_id, dibuat_pada desc);

-- Hapus akun (A28): laporan yang pernah dikirim tetap disimpan tanpa nama, jadi pelapor_id dikosongkan,
-- bukan dihapus bersama akun. Riwayat admin juga tetap ada, dengan admin_id kosong setelah akunnya dihapus.
alter table public.laporan alter column pelapor_id drop not null;
alter table public.laporan drop constraint if exists laporan_pelapor_id_fkey;
alter table public.laporan add constraint laporan_pelapor_id_fkey
  foreign key (pelapor_id) references public.profil(id) on delete set null;

alter table public.tindakan_admin alter column admin_id drop not null;
alter table public.tindakan_admin drop constraint if exists tindakan_admin_admin_id_fkey;
alter table public.tindakan_admin add constraint tindakan_admin_admin_id_fkey
  foreign key (admin_id) references public.profil(id) on delete set null;

-- ============================================================
-- 2. LAPOR LAPAK (A44)
-- ============================================================

-- Fungsi lama (tiga parameter, aturan per hari) diganti. Belum ada pemanggil di produksi.
drop function if exists public.lapor_lapak(uuid, text, text);

create or replace function public.lapor_lapak(
  p_lapak       uuid,
  p_alasan      text,
  p_catatan     text default null,
  p_pernyataan  boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  -- Hanya lapak yang tayang yang bisa dilaporkan (sama dengan ikuti_lapak)
  if not exists (select 1 from public.lapak l where l.id = p_lapak and l.status_tayang = 'tayang') then
    raise exception 'Lapak tidak tersedia';
  end if;
  if exists (select 1 from public.lapak l where l.id = p_lapak and l.pemilik_id = v_uid) then
    raise exception 'Tidak bisa melaporkan lapak sendiri';
  end if;
  if p_pernyataan is not true then
    raise exception 'Centang pernyataan dulu';
  end if;
  if p_alasan is null or p_alasan not in (
    'Lapak tidak ada / akun iseng', 'Status tidak sesuai', 'Tempat salah', 'Konten tidak pantas', 'Lainnya'
  ) then
    raise exception 'Pilih satu alasan';
  end if;
  if p_catatan is not null and char_length(p_catatan) > 200 then
    raise exception 'Catatan maks. 200 karakter';
  end if;
  -- 1 laporan per akun per lapak per 30 hari (dihitung dari laporan terakhir akun itu)
  if exists (
    select 1 from public.laporan
     where lapak_id = p_lapak and pelapor_id = v_uid
       and dibuat_pada > now() - interval '30 days'
  ) then
    raise exception 'Sudah melapor lapak ini dalam 30 hari terakhir';
  end if;

  insert into public.laporan (lapak_id, pelapor_id, alasan, catatan, pernyataan_pada)
  values (p_lapak, v_uid, p_alasan, nullif(trim(p_catatan), ''), now());
end;
$$;

-- ============================================================
-- 3. ADMIN: TINDAKAN ATAS LAPAK DAN LAPORAN (A46, A47)
-- ============================================================
-- p_aksi:
--   'abaikan'      : p_laporan diisi  -> hanya laporan itu, baru -> diabaikan
--                    p_laporan kosong -> semua laporan baru lapak -> diabaikan ("Abaikan semua", lapak tetap tayang)
--   'sembunyikan'  : lapak tayang -> disembunyikan; semua laporan baru -> ditindak
--   'tampilkan'    : lapak disembunyikan -> tayang; semua laporan ditindak -> diabaikan
-- Setiap tindakan dicatat di tindakan_admin beserta catatan admin.

create or replace function public.admin_tindak_lapak(
  p_lapak     uuid,
  p_aksi      text,
  p_laporan   uuid default null,
  p_catatan   text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  if p_aksi not in ('abaikan', 'sembunyikan', 'tampilkan') then
    raise exception 'Aksi tidak dikenal';
  end if;
  if p_catatan is not null and char_length(p_catatan) > 300 then
    raise exception 'Catatan admin maks. 300 karakter';
  end if;

  -- Kunci baris lapak selama transaksi supaya dua admin tidak menimpa keadaan yang sama
  select l.status_tayang into v_status from public.lapak l where l.id = p_lapak for update;
  if not found then
    raise exception 'Lapak tidak ditemukan';
  end if;
  if p_laporan is not null and not exists (
    select 1 from public.laporan r where r.id = p_laporan and r.lapak_id = p_lapak
  ) then
    raise exception 'Laporan tidak termasuk lapak ini';
  end if;

  if p_aksi = 'abaikan' then
    update public.laporan set status = 'diabaikan'
     where lapak_id = p_lapak and status = 'baru' and (p_laporan is null or id = p_laporan);

  elsif p_aksi = 'sembunyikan' then
    if v_status <> 'tayang' then
      raise exception 'Lapak tidak sedang tayang';
    end if;
    update public.lapak set status_tayang = 'disembunyikan' where id = p_lapak;
    update public.laporan set status = 'ditindak' where lapak_id = p_lapak and status = 'baru';

  elsif p_aksi = 'tampilkan' then
    if v_status <> 'disembunyikan' then
      raise exception 'Lapak tidak sedang disembunyikan';
    end if;
    update public.lapak set status_tayang = 'tayang' where id = p_lapak;
    update public.laporan set status = 'diabaikan' where lapak_id = p_lapak and status = 'ditindak';
  end if;

  insert into public.tindakan_admin (lapak_id, admin_id, aksi, catatan, laporan_id)
  values (p_lapak, auth.uid(), p_aksi, nullif(trim(p_catatan), ''), p_laporan);
end;
$$;

-- ============================================================
-- 4. ADMIN: DAFTAR LAPORAN SATU LAPAK (V55, A46)
-- ============================================================
-- Email pelapor ada di auth.users, yang tidak bisa dibaca langsung dari aplikasi.
-- Karena itu dibungkus fungsi yang hanya bisa dijalankan admin.

create or replace function public.admin_detail_laporan(p_lapak uuid)
returns table (
  laporan_id     uuid,
  alasan         text,
  catatan        text,
  status         text,
  dibuat_pada    timestamptz,
  pernyataan_pada timestamptz,
  pelapor_nama   text,
  pelapor_email  text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  return query
    select r.id, r.alasan, r.catatan, r.status, r.dibuat_pada, r.pernyataan_pada,
           coalesce(p.nama_tampilan, '(akun dihapus)'), u.email::text
      from public.laporan r
      left join public.profil p on p.id = r.pelapor_id
      left join auth.users u on u.id = r.pelapor_id
     where r.lapak_id = p_lapak
     order by r.dibuat_pada desc;
end;
$$;

-- ============================================================
-- 5. RLS
-- ============================================================

-- Admin bisa membaca lapak (V18, V55). Pemilik tetap hanya melihat miliknya lewat kebijakan yang sudah ada.
create policy "lapak baca admin" on public.lapak
  for select using (public.is_admin());

-- ============================================================
-- 6. HAK AKSES
-- ============================================================

revoke execute on function public.lapor_lapak(uuid, text, text, boolean) from public;
grant execute on function public.lapor_lapak(uuid, text, text, boolean) to authenticated;

revoke execute on function public.admin_tindak_lapak(uuid, text, uuid, text) from public;
grant execute on function public.admin_tindak_lapak(uuid, text, uuid, text) to authenticated;

revoke execute on function public.admin_detail_laporan(uuid) from public;
grant execute on function public.admin_detail_laporan(uuid) to authenticated;

-- Pemilik dan pelanggan tidak pernah membaca tindakan_admin atau laporan langsung (sudah di 005)
