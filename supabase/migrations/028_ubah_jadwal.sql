-- 028_ubah_jadwal.sql
-- Ubah jadwal (V44, A35) untuk lapak yang sudah tayang atau disembunyikan. Dijalankan setelah 027.
-- Fungsi di 001 sampai 027 tidak diubah.
--
-- Kenapa perlu fungsi: pemilik hanya punya hak SELECT pada tabel jadwal (013, 014). simpan_daftar_3 hanya untuk lapak
-- draf dan sekaligus menaikkan langkah daftar, jadi lapak yang sudah terdaftar tidak punya jalan untuk mengubah
-- jadwalnya. Dua fungsi di bawah:
--   - security definer, search_path = public, dicabut dari public dan anon, diberikan ke authenticated
--   - memeriksa pemilik lewat cek_pemilik_lapak (005); tamu dan orang lain ditolak
--   - menolak lapak draf (draf tetap lewat Daftar 3)
--   - mengunci baris lapak selama transaksi
--   - hanya menulis jadwal lapak itu; tidak menyentuh sesi_buka, slug, status_tayang, atau tempat
-- Sesi yang sedang berjalan tidak berubah: berakhir_pada sudah dihitung saat Mulai buka (A2), jadi perubahan jadwal
-- baru berlaku mulai sesi berikutnya.
--
-- Aturan jam sama dengan simpan_daftar_3 (014, A35): format HH:MM, menit kelipatan 5, jam mulai tidak sama dengan
-- jam selesai, dan sesi tidak bertumpuk termasuk sesi lewat tengah malam yang menabrak hari berikutnya
-- (Sabtu ke Minggu juga dihitung). Pesan galatnya sama dengan Daftar 3.

-- ============================================================
-- 1. PEMERIKSAAN ISI JADWAL (sama dengan 014)
-- ============================================================

create or replace function public.inti_cek_jadwal(p_jadwal jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_nama        text[] := array['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  v_pola_format text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  v_pola        text := '^([01][0-9]|2[0-3]):[0-5][05]$';
  v_el          jsonb;
  v_hari        int;
  v_a           int;
  v_b           int;
begin
  if p_jadwal is null or jsonb_typeof(p_jadwal) <> 'array' then
    raise exception 'Format jadwal salah';
  end if;

  for v_el in select * from jsonb_array_elements(p_jadwal) loop
    if coalesce(jsonb_typeof(v_el->'hari'), '') <> 'number'
       or (v_el->>'hari')::numeric not in (0, 1, 2, 3, 4, 5, 6) then
      raise exception 'Hari tidak dikenal';
    end if;
    v_hari := (v_el->>'hari')::int;
    if coalesce(v_el->>'mulai', '') !~ v_pola_format or coalesce(v_el->>'selesai', '') !~ v_pola_format then
      raise exception 'Format jam salah di hari %', v_nama[v_hari + 1];
    end if;
    if v_el->>'mulai' !~ v_pola or v_el->>'selesai' !~ v_pola then
      raise exception 'Menit harus kelipatan 5 di hari %', v_nama[v_hari + 1];
    end if;
    if v_el->>'mulai' = v_el->>'selesai' then
      raise exception 'Jam mulai dan jam selesai tidak boleh sama di hari %', v_nama[v_hari + 1];
    end if;
  end loop;

  -- Sesi sebagai rentang menit dalam seminggu; minggu berikutnya ikut dibandingkan (geser 10080 menit)
  with s as (
    select
      e.ord,
      (e.el->>'hari')::int as hari,
      (e.el->>'hari')::int * 1440 + extract(epoch from (e.el->>'mulai')::time)::int / 60 as awal,
      (e.el->>'mulai')::time as mulai,
      (e.el->>'selesai')::time as selesai
    from jsonb_array_elements(p_jadwal) with ordinality as e(el, ord)
  ), r as (
    select ord, hari, awal,
      awal + case when selesai > mulai
                  then extract(epoch from (selesai - mulai))::int / 60
                  else 1440 - extract(epoch from (mulai - selesai))::int / 60 end as akhir
    from s
  )
  select a.hari, b.hari into v_a, v_b
  from r a
  join r b on a.ord < b.ord
  where exists (
    select 1 from (values (-10080), (0), (10080)) as g(geser)
    where a.awal < b.akhir + g.geser and b.awal + g.geser < a.akhir
  )
  limit 1;

  if v_a is not null then
    if v_a = v_b then
      raise exception 'Jam sesi bertumpuk di hari %', v_nama[v_a + 1];
    end if;
    raise exception 'Jam sesi bertumpuk di hari % dan %', v_nama[v_a + 1], v_nama[v_b + 1];
  end if;
end;
$$;

-- ============================================================
-- 2. SIMPAN JADWAL (V44)
-- ============================================================
-- p_jadwal: array JSON [{ "hari": 1, "mulai": "08:00", "selesai": "14:00" }, ...], minimal 1 sesi.
-- Jadwal lama diganti seluruhnya dalam satu transaksi; kalau ada galat, jadwal lama tetap utuh.

create or replace function public.simpan_jadwal_saya(p_lapak uuid, p_jadwal jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  select status_tayang into v_status from public.lapak where id = p_lapak for update;
  if v_status = 'draf' then
    raise exception 'Selesaikan daftar lapak dulu';
  end if;

  perform public.inti_cek_jadwal(p_jadwal);
  if jsonb_array_length(p_jadwal) = 0 then
    raise exception 'Isi minimal 1 sesi, atau pakai Hapus jadwal';
  end if;

  delete from public.jadwal where lapak_id = p_lapak;
  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  select p_lapak, (el->>'hari')::int, (el->>'mulai')::time, (el->>'selesai')::time
  from jsonb_array_elements(p_jadwal) as el;
end;
$$;

-- ============================================================
-- 3. HAPUS JADWAL (V44): jualan tidak tetap
-- ============================================================
-- Tanpa jadwal, Mulai buka berakhir 4 jam kemudian dan tidak ada "Biasanya buka" (A35).

create or replace function public.hapus_jadwal_saya(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  perform public.cek_pemilik_lapak(p_lapak);
  select status_tayang into v_status from public.lapak where id = p_lapak for update;
  if v_status = 'draf' then
    raise exception 'Selesaikan daftar lapak dulu';
  end if;

  delete from public.jadwal where lapak_id = p_lapak;
end;
$$;

-- ============================================================
-- 4. HAK AKSES
-- ============================================================

revoke all on function public.inti_cek_jadwal(jsonb) from public, anon, authenticated;

revoke all on function public.simpan_jadwal_saya(uuid, jsonb) from public, anon;
grant execute on function public.simpan_jadwal_saya(uuid, jsonb) to authenticated;

revoke all on function public.hapus_jadwal_saya(uuid) from public, anon;
grant execute on function public.hapus_jadwal_saya(uuid) to authenticated;
