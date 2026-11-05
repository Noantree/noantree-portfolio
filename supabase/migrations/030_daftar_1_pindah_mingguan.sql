-- 030: pertanyaan "Dalam 1 minggu, apakah lapakmu pindah ke tempat lain?" di Daftar 1 (V11, A52).
-- true = berpindah tempat dalam 1 minggu, false = tetap di satu tempat, null = belum dijawab (lapak lama).
-- Di MVP jadwal tetap per lapak; jawaban ini hanya data untuk memutuskan jadwal per tempat nanti.
-- Wajib dijawab saat Lanjut (p_selesai = true). "Lanjutkan nanti" boleh menyimpan tanpa jawaban.

alter table public.lapak add column if not exists pindah_mingguan boolean;

-- Parameter fungsi bertambah (p_pindah), jadi versi lama dihapus dulu supaya tidak ada dua versi yang bersaing.
drop function if exists public.simpan_daftar_1(text, text, text, boolean, boolean);

create or replace function public.simpan_daftar_1(
  p_nama text,
  p_deskripsi text,
  p_foto_url text,
  p_izin boolean,
  p_selesai boolean default true,
  p_pindah boolean default null
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
  if p_selesai and p_pindah is null then
    raise exception 'Jawab dulu: apakah lapakmu pindah tempat dalam 1 minggu';
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
      pindah_mingguan = coalesce(p_pindah, pindah_mingguan),
      langkah_daftar = case when p_selesai then greatest(langkah_daftar, 2) else langkah_daftar end,
      diubah_pada = now()
    where id = v_lapak.id;
    update public.usaha set nama = btrim(p_nama) where id = v_lapak.usaha_id;
    return v_lapak.id;
  end if;

  insert into public.usaha (pemilik_id, nama) values (v_uid, btrim(p_nama))
  returning id into v_usaha;

  insert into public.lapak (usaha_id, pemilik_id, nama, deskripsi, foto_url, izin_tampil_pada, pindah_mingguan, langkah_daftar)
  values (
    v_usaha, v_uid, btrim(p_nama), nullif(btrim(p_deskripsi), ''), p_foto_url,
    case when p_izin then now() end,
    p_pindah,
    case when p_selesai then 2 else 1 end
  )
  returning id into v_lapak.id;

  return v_lapak.id;
end;
$$;

revoke all on function public.simpan_daftar_1(text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.simpan_daftar_1(text, text, text, boolean, boolean, boolean) to authenticated;
