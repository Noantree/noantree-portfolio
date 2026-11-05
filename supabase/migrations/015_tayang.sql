-- 015_tayang.sql
-- Tayang dengan slug unik (S2.4, A30, A36, A39) dan Lanjutkan nanti di Daftar 1 (A31).
-- Tidak ada kolom baru: status banner V47 dan ajakan pasang V30 disimpan di HP (localStorage).
-- Tampilan publik tetap hanya lewat view lapak_publik (005), yang menampilkan lapak berstatus 'tayang'.

-- ------------------------------------------------------------
-- 1. Daftar 1: Lanjutkan nanti menyimpan isian (A31)
-- ------------------------------------------------------------
-- simpan_daftar_1 dari 011 selalu mewajibkan izin dan menaikkan langkah ke 2. Diganti dengan versi
-- yang punya p_selesai, sama seperti simpan_daftar_2:
--   p_selesai = true (Lanjut): izin wajib, langkah_daftar naik ke 2. Sama dengan perilaku 011.
--   p_selesai = false (Lanjutkan nanti): isian disimpan tanpa wajib izin, langkah tidak berubah.
-- Draf tidak tampil untuk umum, dan izin tetap wajib sebelum tayang (cek lapak_izin_saat_tayang dari 011).
-- Fungsi lama dihapus dulu supaya panggilan dengan 4 argumen tidak ambigu; p_selesai default true.

drop function if exists public.simpan_daftar_1(text, text, text, boolean);

create or replace function public.simpan_daftar_1(
  p_nama text,
  p_deskripsi text,
  p_foto_url text,
  p_izin boolean,
  p_selesai boolean default true
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
  if p_selesai and p_izin is not true then
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
      izin_tampil_pada = case when p_izin then coalesce(izin_tampil_pada, now()) end,
      langkah_daftar = case when p_selesai then greatest(langkah_daftar, 2) else langkah_daftar end,
      diubah_pada = now()
    where id = v_lapak.id;
    update public.usaha set nama = btrim(p_nama) where id = v_lapak.usaha_id;
    return v_lapak.id;
  end if;

  insert into public.usaha (pemilik_id, nama) values (v_uid, btrim(p_nama))
  returning id into v_usaha;

  insert into public.lapak (usaha_id, pemilik_id, nama, deskripsi, foto_url, izin_tampil_pada, langkah_daftar)
  values (
    v_usaha, v_uid, btrim(p_nama), nullif(btrim(p_deskripsi), ''), p_foto_url,
    case when p_izin then now() end,
    case when p_selesai then 2 else 1 end
  )
  returning id into v_lapak.id;

  return v_lapak.id;
end;
$$;

revoke all on function public.simpan_daftar_1(text, text, text, boolean, boolean) from public, anon;
grant execute on function public.simpan_daftar_1(text, text, text, boolean, boolean) to authenticated;

-- ------------------------------------------------------------
-- 2. Tayangkan lapak (A30, A36, A39)
-- ------------------------------------------------------------
-- Dipanggil setelah Daftar 3 ("Simpan dan selesai" atau "Lewati"). Syarat: lapak masih draf,
-- langkah_daftar sudah 3, ada minimal 1 tempat, dan izin tampil umum sudah dicentang.
-- Slug dari nama lapak: huruf kecil, spasi jadi tanda hubung, karakter lain dibuang.
-- Jika sudah dipakai lapak lain atau sama dengan nama rute aplikasi, tambah angka (-2, -3, ...).
-- Slug hanya dibuat di sini, saat pertama tayang, dan tidak berubah walau nama diganti.
-- Mengembalikan slug untuk layar V25.

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
       and not exists (select 1 from public.lapak l where l.slug = v_slug and l.id <> v_lapak.id) then
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
