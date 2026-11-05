-- 013_daftar_3.sql
-- Daftar 3: jadwal tujuh hari, beberapa sesi per hari, boleh lewat tengah malam (S2.3, A30, A35).
-- Tabel jadwal dan RLS "jadwal kelola pemilik" sudah ada sejak 005:
--   hari 0 = Minggu ... 6 = Sabtu; jam_mulai dan jam_selesai jam dinding WIB (Asia/Jakarta).
--   Jam selesai lebih kecil dari jam mulai = lewat tengah malam, sesi milik hari mulainya.
-- sesi_buka (sesi Mulai buka) tidak disentuh; itu Sprint 3.

-- ------------------------------------------------------------
-- 1. Aturan data jadwal
-- ------------------------------------------------------------

-- Satu sesi kurang dari 24 jam (PRD bagian 5): jam mulai tidak boleh sama dengan jam selesai
alter table public.jadwal drop constraint if exists jadwal_jam_beda;
alter table public.jadwal add constraint jadwal_jam_beda
  check (jam_mulai <> jam_selesai);

-- ------------------------------------------------------------
-- 2. Fungsi simpan Daftar 3
-- ------------------------------------------------------------
-- p_jadwal: array JSON [{ "hari": 1, "mulai": "08:00", "selesai": "14:00" }, ...]
-- Array kosong = tanpa jadwal ("Lewati, jadwal saya tidak tetap"); mulai buka berakhir 4 jam kemudian.
-- Jadwal lama lapak dihapus lalu diganti seluruhnya. Sesi yang bertumpuk ditolak, termasuk sesi
-- lewat tengah malam yang menabrak sesi hari berikutnya (Sabtu ke Minggu juga dihitung).
-- Status tetap draf; tayang dan slug dibuat di S2.4 (A30, A36).

create or replace function public.simpan_daftar_3(p_jadwal jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_lapak  public.lapak%rowtype;
  v_nama   text[] := array['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  v_pola   text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  v_el     jsonb;
  v_hari   int;
  v_a      int;
  v_b      int;
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
  if v_lapak.langkah_daftar < 3 then
    raise exception 'Selesaikan langkah 2 dulu';
  end if;

  if p_jadwal is null or jsonb_typeof(p_jadwal) <> 'array' then
    raise exception 'Format jadwal salah';
  end if;

  -- Periksa setiap sesi sebelum menulis apa pun
  for v_el in select * from jsonb_array_elements(p_jadwal) loop
    -- coalesce: elemen tanpa kunci hari (atau bukan objek) memberi NULL dan harus ikut ditolak
    if coalesce(jsonb_typeof(v_el->'hari'), '') <> 'number'
       or (v_el->>'hari')::numeric not in (0, 1, 2, 3, 4, 5, 6) then
      raise exception 'Hari tidak dikenal';
    end if;
    v_hari := (v_el->>'hari')::int;
    if coalesce(v_el->>'mulai', '') !~ v_pola or coalesce(v_el->>'selesai', '') !~ v_pola then
      raise exception 'Format jam salah di hari %', v_nama[v_hari + 1];
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

  delete from public.jadwal where lapak_id = v_lapak.id;

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  select v_lapak.id, (el->>'hari')::int, (el->>'mulai')::time, (el->>'selesai')::time
  from jsonb_array_elements(p_jadwal) as el;

  update public.lapak set
    langkah_daftar = greatest(langkah_daftar, 3),
    diubah_pada = now()
  where id = v_lapak.id;
end;
$$;

-- ------------------------------------------------------------
-- 3. Hak akses (RLS tetap membatasi baris)
-- ------------------------------------------------------------

revoke all on function public.simpan_daftar_3(jsonb) from public, anon;
grant execute on function public.simpan_daftar_3(jsonb) to authenticated;

-- Membaca jadwal milik sendiri untuk mengisi ulang Daftar 3 (kebijakan "jadwal kelola pemilik").
-- Tulis hanya lewat simpan_daftar_3.
grant select on public.jadwal to authenticated;
-- Membaca lapak sendiri (langkah_daftar); sudah diberikan di 010
grant select on public.lapak to authenticated;
