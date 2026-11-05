-- 027_kelola_tempat.sql
-- Tempat baru (V43) dan Ubah tempat (V31) untuk lapak yang sudah tayang atau disembunyikan (A33, A34, A39).
-- Dijalankan setelah 026. Fungsi di 001 sampai 026 tidak diubah.
--
-- Kenapa perlu fungsi: pemilik hanya punya hak SELECT pada tabel tempat (012). simpan_daftar_2 hanya untuk lapak draf
-- dan selalu mengubah tempat pertama. Jadi menambah, mengubah, dan menghapus tempat lapak yang sudah terdaftar
-- dilakukan lewat tiga fungsi di bawah. Semuanya:
--   - security definer, search_path = public, dicabut dari public dan anon, diberikan ke authenticated
--   - memeriksa pemilik lewat cek_pemilik_lapak (005); tamu dan orang lain ditolak
--   - menolak lapak draf (draf tetap lewat Daftar 2)
--   - mengunci baris lapak selama transaksi, supaya dua simpan bersamaan tidak melewati batas
--   - tidak menyentuh slug, status lapak, atau sesi_buka (sesi hanya dibaca)
-- Isi tempat sama dengan simpan_daftar_2: nama wajib, titik lat dan lng berpasangan atau kosong (A33),
-- kecamatan dipilih manual dan wajib (A34), link Google Maps dibuat dari titik. Tempel link Google Maps belum ada
-- (Edge Function cek link dengan kuota 10 per hari WIB menyusul), jadi tidak ada jalur yang melewati kuota itu.
--
-- Hapus tempat (A39): ditolak kalau itu satu-satunya tempat, atau kalau tempat itu dipakai sesi buka yang sedang
-- berjalan (belum diakhiri dan belum lewat berakhir_pada, sama dengan sesi aktif di lapak_publik).
-- Riwayat sesi lama yang menunjuk tempat yang dihapus tetap ada: sesi_buka.tempat_id memakai on delete set null (005).

-- ============================================================
-- 1. PEMERIKSAAN ISI TEMPAT (dipakai tambah dan ubah)
-- ============================================================

create or replace function public.inti_cek_isi_tempat(
  p_nama text,
  p_lat double precision,
  p_lng double precision,
  p_kecamatan_id uuid
) returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if char_length(btrim(coalesce(p_nama, ''))) = 0 then
    raise exception 'Isi nama tempat dulu';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Titik lokasi tidak lengkap';
  end if;
  if p_kecamatan_id is null then
    raise exception 'Pilih kecamatan dulu';
  end if;
  -- A34: kecamatan dipilih manual dan harus benar-benar kecamatan
  if not exists (
    select 1 from public.wilayah w where w.id = p_kecamatan_id and w.tingkat = 'kecamatan' and w.aktif
  ) then
    raise exception 'Kecamatan tidak dikenal';
  end if;
end;
$$;

-- Lapak dikunci dan harus sudah terdaftar (tayang atau disembunyikan)
create or replace function public.inti_kunci_lapak_terdaftar(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  select status_tayang into v_status from public.lapak where id = p_lapak for update;
  if v_status = 'draf' then
    raise exception 'Selesaikan daftar lapak dulu';
  end if;
end;
$$;

-- ============================================================
-- 2. TAMBAH TEMPAT (V43)
-- ============================================================

create or replace function public.tambah_tempat(
  p_lapak uuid,
  p_nama text,
  p_lat double precision,
  p_lng double precision,
  p_kecamatan_id uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tempat uuid;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.inti_kunci_lapak_terdaftar(p_lapak);
  perform public.inti_cek_isi_tempat(p_nama, p_lat, p_lng, p_kecamatan_id);

  -- Maks. 10 tempat per lapak; trigger batas_tempat (005) tetap jadi penjaga terakhir
  if (select count(*) from public.tempat where lapak_id = p_lapak) >= 10 then
    raise exception 'Maksimal 10 tempat per lapak';
  end if;

  insert into public.tempat (lapak_id, nama, lat, lng, link_maps, kecamatan_id)
  values (
    p_lapak, btrim(p_nama), p_lat, p_lng,
    case when p_lat is not null then 'https://www.google.com/maps?q=' || p_lat || ',' || p_lng end,
    p_kecamatan_id
  )
  returning id into v_tempat;
  return v_tempat;
end;
$$;

-- ============================================================
-- 3. UBAH TEMPAT (V31)
-- ============================================================

create or replace function public.ubah_tempat(
  p_lapak uuid,
  p_tempat uuid,
  p_nama text,
  p_lat double precision,
  p_lng double precision,
  p_kecamatan_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.inti_kunci_lapak_terdaftar(p_lapak);
  -- Tempat milik lapak lain dijawab sama dengan tempat yang tidak ada
  if not exists (select 1 from public.tempat t where t.id = p_tempat and t.lapak_id = p_lapak) then
    raise exception 'Tempat tidak ditemukan';
  end if;
  perform public.inti_cek_isi_tempat(p_nama, p_lat, p_lng, p_kecamatan_id);

  update public.tempat set
    nama = btrim(p_nama),
    lat = p_lat,
    lng = p_lng,
    link_maps = case when p_lat is not null then 'https://www.google.com/maps?q=' || p_lat || ',' || p_lng end,
    kecamatan_id = p_kecamatan_id
  where id = p_tempat and lapak_id = p_lapak;
end;
$$;

-- ============================================================
-- 4. HAPUS TEMPAT (V31, A39)
-- ============================================================

create or replace function public.hapus_tempat(p_lapak uuid, p_tempat uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  perform public.inti_kunci_lapak_terdaftar(p_lapak);
  if not exists (select 1 from public.tempat t where t.id = p_tempat and t.lapak_id = p_lapak) then
    raise exception 'Tempat tidak ditemukan';
  end if;
  if (select count(*) from public.tempat where lapak_id = p_lapak) <= 1 then
    raise exception 'Lapakmu harus punya minimal 1 tempat';
  end if;
  -- Sesi yang sedang berjalan hanya dibaca di sini; sesi_buka tidak pernah ditulis
  if exists (
    select 1 from public.sesi_buka s
     where s.lapak_id = p_lapak and s.tempat_id = p_tempat
       and s.diakhiri_pada is null and s.berakhir_pada > now()
  ) then
    raise exception 'Lapakmu sedang buka di tempat ini. Selesaikan dulu, baru tempat ini bisa dihapus.';
  end if;

  delete from public.tempat where id = p_tempat and lapak_id = p_lapak;
end;
$$;

-- ============================================================
-- 5. HAK AKSES
-- ============================================================

revoke all on function public.inti_cek_isi_tempat(text, double precision, double precision, uuid) from public, anon, authenticated;
revoke all on function public.inti_kunci_lapak_terdaftar(uuid) from public, anon, authenticated;

revoke all on function public.tambah_tempat(uuid, text, double precision, double precision, uuid) from public, anon;
grant execute on function public.tambah_tempat(uuid, text, double precision, double precision, uuid) to authenticated;

revoke all on function public.ubah_tempat(uuid, uuid, text, double precision, double precision, uuid) from public, anon;
grant execute on function public.ubah_tempat(uuid, uuid, text, double precision, double precision, uuid) to authenticated;

revoke all on function public.hapus_tempat(uuid, uuid) from public, anon;
grant execute on function public.hapus_tempat(uuid, uuid) to authenticated;
