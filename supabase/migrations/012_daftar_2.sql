-- 012_daftar_2.sql
-- Daftar 2: satu tempat dengan titik GPS dan kabupaten/kecamatan (S2.2, A30, A33, A34).
-- Tabel tempat, RLS "tempat kelola pemilik", dan batas 10 tempat (trigger batas_tempat) sudah ada sejak 005.
-- Tempel link Google Maps (Edge Function cek link) belum termasuk.

-- ------------------------------------------------------------
-- 1. Aturan data tempat
-- ------------------------------------------------------------

alter table public.tempat drop constraint if exists tempat_nama_terisi;
alter table public.tempat add constraint tempat_nama_terisi
  check (char_length(btrim(nama)) > 0);

-- Titik boleh kosong (A33), tetapi lat dan lng selalu berpasangan dan dalam rentang yang sah
alter table public.tempat drop constraint if exists tempat_titik_sah;
alter table public.tempat add constraint tempat_titik_sah
  check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  );

-- ------------------------------------------------------------
-- 2. Fungsi simpan Daftar 2
-- ------------------------------------------------------------
-- Tempat ditulis lewat fungsi ini, bukan langsung dari aplikasi. Selama daftar, lapak punya satu
-- tempat: disimpan ulang berarti tempat itu diperbarui. Link Google Maps dibuat di sini dari titik.
-- p_selesai = true (Simpan dan lanjut): kecamatan wajib, langkah_daftar naik ke 3.
-- p_selesai = false (Lanjutkan nanti): isian disimpan, langkah tidak berubah (A31).
-- Status tetap draf; tayang dan slug dibuat di S2.4 (A30, A36).

create or replace function public.simpan_daftar_2(
  p_nama text,
  p_lat double precision,
  p_lng double precision,
  p_kecamatan_id uuid,
  p_selesai boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_lapak  public.lapak%rowtype;
  v_tempat uuid;
  v_link   text;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;

  select * into v_lapak from public.lapak where pemilik_id = v_uid;
  if not found then
    raise exception 'Isi profil lapak dulu';
  end if;
  if v_lapak.status_tayang <> 'draf' then
    raise exception 'Lapak sudah terdaftar';
  end if;
  if v_lapak.langkah_daftar < 2 then
    raise exception 'Selesaikan langkah 1 dulu';
  end if;

  if p_nama is null or btrim(p_nama) = '' then
    raise exception 'Nama tempat wajib diisi';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Titik lokasi tidak lengkap';
  end if;
  -- A34: kecamatan dipilih manual dan harus benar-benar kecamatan
  if p_kecamatan_id is not null and not exists (
    select 1 from public.wilayah w where w.id = p_kecamatan_id and w.tingkat = 'kecamatan' and w.aktif
  ) then
    raise exception 'Kecamatan tidak dikenal';
  end if;
  if p_selesai and p_kecamatan_id is null then
    raise exception 'Pilih kecamatan dulu';
  end if;

  if p_lat is not null then
    v_link := 'https://www.google.com/maps?q=' || p_lat || ',' || p_lng;
  end if;

  select t.id into v_tempat from public.tempat t
  where t.lapak_id = v_lapak.id
  order by t.dibuat_pada
  limit 1;

  if v_tempat is null then
    -- Batas 10 tempat per lapak tetap dijaga trigger batas_tempat
    insert into public.tempat (lapak_id, nama, lat, lng, link_maps, kecamatan_id)
    values (v_lapak.id, btrim(p_nama), p_lat, p_lng, v_link, p_kecamatan_id)
    returning id into v_tempat;
  else
    update public.tempat set
      nama = btrim(p_nama),
      lat = p_lat,
      lng = p_lng,
      link_maps = v_link,
      kecamatan_id = p_kecamatan_id
    where id = v_tempat;
  end if;

  update public.lapak set
    langkah_daftar = case when p_selesai then greatest(langkah_daftar, 3) else langkah_daftar end,
    diubah_pada = now()
  where id = v_lapak.id;

  return v_tempat;
end;
$$;

-- ------------------------------------------------------------
-- 3. Hak akses (RLS tetap membatasi baris)
-- ------------------------------------------------------------

revoke all on function public.simpan_daftar_2(text, double precision, double precision, uuid, boolean) from public, anon;
grant execute on function public.simpan_daftar_2(text, double precision, double precision, uuid, boolean) to authenticated;

-- Membaca tempat milik sendiri untuk mengisi ulang Daftar 2 (kebijakan "tempat kelola pemilik")
grant select on public.tempat to authenticated;

-- Pilihan kabupaten dan kecamatan; sudah diberikan di 008, diulang agar migrasi ini berdiri sendiri
grant select on public.wilayah to anon, authenticated;
-- Membaca lapak sendiri (langkah_daftar); sudah diberikan di 010
grant select on public.lapak to authenticated;
