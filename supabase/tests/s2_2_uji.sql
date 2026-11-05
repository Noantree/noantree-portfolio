-- s2_2_uji.sql
-- Uji S2.2 sisa (PRD A33): batas cek link Google Maps 10 per pemilik per hari WIB, untuk 029_cek_link_maps.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 029 dijalankan.
--
-- Cara kerja sama dengan s5_3b3_uji.sql:
--   - Akun dan baris cek_link uji memakai id tetap (awalan ...22c...), lalu dihapus lagi di akhir.
--   - Pemilik ditiru dengan request.jwt.claims dan "set local role authenticated"; Edge Function ditiru dengan
--     "set local role service_role" (peran yang dipakai kunci service role).
--   - Nilai pembanding yang membaca tabel cek_link dihitung sebagai postgres.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Seluruh blok adalah satu transaksi: kalau ada galat tak terduga, semua data uji ikut dibatalkan.
--
-- P1: 3 cek kemarin pukul 23.30 WIB (tidak boleh ikut terhitung), lalu 10 cek hari ini diterima, cek ke-11 ditolak.
-- P2: pemilik lain dengan 5 cek hari ini; cek P1 tidak memengaruhi P2.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

-- Jalankan sql sebagai pengguna uid dengan peran authenticated. Mengembalikan 'OK' atau pesan galat.
create or replace function pg_temp.jalan(p_uid uuid, p_sql text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    execute 'reset role';
    return 'OK';
  exception when others then
    execute 'reset role';
    return sqlerrm;
  end;
end;
$$;

-- Jalankan sql sebagai service_role (seperti Edge Function) dan kembalikan satu nilai teks, atau 'ERR: ...'
create or replace function pg_temp.layanan(p_sql text) returns text
language plpgsql as $$
declare
  v_hasil text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
  begin
    execute p_sql into v_hasil;
    execute 'reset role';
    return coalesce(v_hasil, '');
  exception when others then
    execute 'reset role';
    return 'ERR: ' || sqlerrm;
  end;
end;
$$;

do $$
declare
  v_p1   uuid := '00000000-0000-0000-0000-0000000022c1';
  v_p2   uuid := '00000000-0000-0000-0000-0000000022c2';
  v_asing uuid := '00000000-0000-0000-0000-0000000022cf';  -- tidak ada di profil
  v_akun uuid[];
  v_awal timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_hasil text[] := '{}';
  v_n    text;
  i      int;
begin
  v_akun := array[v_p1, v_p2];

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji22-' || right(u::text, 4) || '@contoh.invalid'
    from unnest(v_akun) as u;

  -- Kemarin pukul 23.30 WIB = 30 menit sebelum awal hari ini WIB
  insert into public.cek_link (pemilik_id, dibuat_pada)
  select v_p1, v_awal - interval '30 minutes' from generate_series(1, 3);
  -- P2 sudah memakai 5 cek hari ini
  insert into public.cek_link (pemilik_id, dibuat_pada)
  select v_p2, v_awal + interval '1 hour' from generate_series(1, 5);

  -- ==========================================================
  -- Hak akses
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'C1 Pemilik (authenticated) tidak bisa memanggil catat_cek_link langsung; tidak ada baris tercatat',
         pg_temp.jalan(v_p1, format('select public.catat_cek_link(%L)', v_p1)) like '%permission denied%'
         and (select count(*) from public.cek_link where pemilik_id = v_p1) = 3,
         pg_temp.jalan(v_p1, format('select public.catat_cek_link(%L)', v_p1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'C2 Hak execute: tidak untuk anon dan authenticated, ada untuk service_role',
         not has_function_privilege('anon', 'public.catat_cek_link(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.catat_cek_link(uuid)', 'execute')
         and has_function_privilege('service_role', 'public.catat_cek_link(uuid)', 'execute'),
         'authenticated ' || has_function_privilege('authenticated', 'public.catat_cek_link(uuid)', 'execute')::text;

  -- ==========================================================
  -- Batas 10 per hari WIB
  -- ==========================================================
  for i in 1..10 loop
    v_hasil := v_hasil || pg_temp.layanan(format('select public.catat_cek_link(%L)::text', v_p1));
  end loop;
  insert into hasil_uji (uji, lulus, catatan)
  select 'C3 Sepuluh cek hari ini diterima (3 cek kemarin 23.30 WIB tidak ikut terhitung)',
         v_hasil = array_fill('true'::text, array[10])
         and (select count(*) from public.cek_link where pemilik_id = v_p1 and dibuat_pada >= v_awal) = 10,
         array_to_string(v_hasil, ',');

  v_n := pg_temp.layanan(format('select public.catat_cek_link(%L)::text', v_p1));
  insert into hasil_uji (uji, lulus, catatan)
  select 'C4 Cek ke-11 hari ini ditolak (false) dan tidak dicatat',
         v_n = 'false'
         and (select count(*) from public.cek_link where pemilik_id = v_p1 and dibuat_pada >= v_awal) = 10,
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'C5 Cek kemarin pukul 23.30 WIB tetap ada dan tidak berubah',
         (select count(*) from public.cek_link where pemilik_id = v_p1 and dibuat_pada < v_awal) = 3,
         'kemarin: ' || (select count(*) from public.cek_link where pemilik_id = v_p1 and dibuat_pada < v_awal);

  v_n := pg_temp.layanan(format('select public.catat_cek_link(%L)::text', v_p2));
  insert into hasil_uji (uji, lulus, catatan)
  select 'C6 Pemilik lain (P2, 5 cek hari ini) tidak ikut terhitung batas P1: diterima, jadi 6',
         v_n = 'true'
         and (select count(*) from public.cek_link where pemilik_id = v_p2 and dibuat_pada >= v_awal) = 6,
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'C7 Akun yang tidak ada di profil: ditolak',
         pg_temp.layanan(format('select public.catat_cek_link(%L)::text', v_asing)) like 'ERR: Akun tidak dikenal%',
         pg_temp.layanan(format('select public.catat_cek_link(%L)::text', v_asing));

  -- ==========================================================
  -- Bersihkan data uji (hanya id tetap di atas)
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.cek_link where pemilik_id = any(v_akun);
  delete from auth.users where id = any(v_akun);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
