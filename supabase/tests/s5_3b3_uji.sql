-- s5_3b3_uji.sql
-- Uji S5.3b-3 (PRD A35; V44) untuk 028_ubah_jadwal.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 028 dijalankan.
--
-- Cara kerja sama dengan s5_3b2_uji.sql:
--   - Akun, lapak, jadwal, dan sesi uji memakai id tetap (awalan ...53b3...), lalu dihapus lagi di akhir.
--   - Pemilik, pelanggan, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel dihitung sebagai postgres, di luar pg_temp.nilai().
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Seluruh blok adalah satu transaksi: kalau ada galat tak terduga, semua data uji ikut dibatalkan.
--   - Sesi buka yang berjalan disiapkan langsung sebagai postgres; aplikasi tetap tidak pernah menulis sesi_buka.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T1 (P1, tayang)        : jadwal lama Senin 06.00–14.00 dan Selasa 06.00–14.00; sesi buka sedang berjalan
--   T2 (P2, tayang)        : jadwal Rabu 10.00–12.00 (lapak lain, tidak boleh tersentuh)
--   D3 (P3, draf)          : untuk memastikan lapak draf tidak bisa diubah lewat fungsi ini
--   H4 (P4, disembunyikan) : tanpa jadwal
-- Q pelanggan.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

-- Jalankan sql sebagai pengguna uid (atau tamu kalau null). Mengembalikan 'OK' atau pesan galat.
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

-- Sama seperti jalan, tetapi mengembalikan satu nilai teks dari sql.
create or replace function pg_temp.nilai(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_hasil text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
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

-- Jadwal satu lapak sebagai teks "hari mulai-selesai" berurutan, dibaca sebagai postgres
create or replace function pg_temp.jadwal_teks(p_lapak uuid) returns text
language sql as $$
  select coalesce(string_agg(hari || ' ' || to_char(jam_mulai, 'HH24:MI') || '-' || to_char(jam_selesai, 'HH24:MI'), ', '
                             order by hari, jam_mulai), 'kosong')
  from public.jadwal where lapak_id = p_lapak;
$$;

do $$
declare
  v_q   uuid := '00000000-0000-0000-0000-00000053b3b1';
  v_p1  uuid := '00000000-0000-0000-0000-00000053b311';
  v_p2  uuid := '00000000-0000-0000-0000-00000053b312';
  v_p3  uuid := '00000000-0000-0000-0000-00000053b313';
  v_p4  uuid := '00000000-0000-0000-0000-00000053b314';
  v_u1  uuid := '00000000-0000-0000-0000-00000053b331';
  v_u2  uuid := '00000000-0000-0000-0000-00000053b332';
  v_u3  uuid := '00000000-0000-0000-0000-00000053b333';
  v_u4  uuid := '00000000-0000-0000-0000-00000053b334';
  v_t1  uuid := '00000000-0000-0000-0000-00000053b321';
  v_t2  uuid := '00000000-0000-0000-0000-00000053b322';
  v_d3  uuid := '00000000-0000-0000-0000-00000053b323';
  v_h4  uuid := '00000000-0000-0000-0000-00000053b324';
  v_tp1 uuid := '00000000-0000-0000-0000-00000053b341';  -- tempat T1
  v_s1  uuid := '00000000-0000-0000-0000-00000053b351';  -- sesi buka T1 yang sedang berjalan
  v_akun  uuid[];
  v_sesi  text;
  v_lama  text;
  v_n     text;
  v_sql   text;
begin
  v_akun := array[v_q, v_p1, v_p2, v_p3, v_p4];

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji53b3-' || right(u::text, 4) || '@contoh.invalid'
    from unnest(v_akun) as u;

  insert into public.usaha (id, pemilik_id, nama) values
    (v_u1, v_p1, 'Uji S53b3 Satu'), (v_u2, v_p2, 'Uji S53b3 Dua'), (v_u3, v_p3, 'Uji S53b3 Tiga'), (v_u4, v_p4, 'Uji S53b3 Empat');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t1, v_u1, v_p1, 'Uji S53b3 Satu',  'uji-s53b3-satu',  'tayang',        3, now()),
    (v_t2, v_u2, v_p2, 'Uji S53b3 Dua',   'uji-s53b3-dua',   'tayang',        3, now()),
    (v_d3, v_u3, v_p3, 'Uji S53b3 Tiga',  null,              'draf',          3, now()),
    (v_h4, v_u4, v_p4, 'Uji S53b3 Empat', 'uji-s53b3-empat', 'disembunyikan', 3, now());
  insert into public.tempat (id, lapak_id, nama) values (v_tp1, v_t1, 'Tempat T1');
  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values
    (v_t1, 1, '06:00', '14:00'), (v_t1, 2, '06:00', '14:00'), (v_t2, 3, '10:00', '12:00');
  insert into public.sesi_buka (id, lapak_id, tempat_id, mulai_pada, berakhir_pada, dari_jadwal) values
    (v_s1, v_t1, v_tp1, now() - interval '1 hour', now() + interval '3 hours', true);
  select s::text into v_sesi from public.sesi_buka s where s.id = v_s1;

  -- ==========================================================
  -- Hak akses
  -- ==========================================================
  v_sql := format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":4,"mulai":"08:00","selesai":"10:00"}]');

  insert into hasil_uji (uji, lulus, catatan)
  select 'J1 Tamu menyimpan dan menghapus jadwal: ditolak',
         pg_temp.jalan(null, v_sql) like 'Bukan pemilik lapak ini%'
         and pg_temp.jalan(null, format('select public.hapus_jadwal_saya(%L)', v_t1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(null, v_sql);

  insert into hasil_uji (uji, lulus, catatan)
  select 'J2 Orang lain (pelanggan Q) menyimpan dan menghapus jadwal T1: ditolak, jadwal T1 tetap',
         pg_temp.jalan(v_q, v_sql) like 'Bukan pemilik lapak ini%'
         and pg_temp.jalan(v_q, format('select public.hapus_jadwal_saya(%L)', v_t1)) like 'Bukan pemilik lapak ini%'
         and pg_temp.jadwal_teks(v_t1) = '1 06:00-14:00, 2 06:00-14:00',
         pg_temp.jalan(v_q, v_sql);

  insert into hasil_uji (uji, lulus, catatan)
  select 'J3 Hak execute: dua fungsi tidak untuk anon; fungsi inti tidak untuk authenticated',
         not has_function_privilege('anon', 'public.simpan_jadwal_saya(uuid, jsonb)', 'execute')
         and not has_function_privilege('anon', 'public.hapus_jadwal_saya(uuid)', 'execute')
         and has_function_privilege('authenticated', 'public.simpan_jadwal_saya(uuid, jsonb)', 'execute')
         and has_function_privilege('authenticated', 'public.hapus_jadwal_saya(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.inti_cek_jadwal(jsonb)', 'execute'),
         'hak execute';

  insert into hasil_uji (uji, lulus, catatan)
  select 'J4 Pemilik tidak bisa menulis tabel jadwal langsung',
         pg_temp.jalan(v_p1, format('insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values (%L, 5, %L, %L)', v_t1, '08:00', '09:00')) <> 'OK',
         pg_temp.jalan(v_p1, format('insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values (%L, 5, %L, %L)', v_t1, '08:00', '09:00'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'J5 Lapak draf: simpan dan hapus jadwal ditolak (draf tetap lewat Daftar 3)',
         pg_temp.jalan(v_p3, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_d3, '[{"hari":1,"mulai":"08:00","selesai":"10:00"}]')) like 'Selesaikan daftar lapak dulu%'
         and pg_temp.jalan(v_p3, format('select public.hapus_jadwal_saya(%L)', v_d3)) like 'Selesaikan daftar lapak dulu%',
         pg_temp.jalan(v_p3, format('select public.hapus_jadwal_saya(%L)', v_d3));

  -- ==========================================================
  -- Aturan jam (A35), jadwal lama tetap utuh setiap kali ditolak
  -- ==========================================================
  v_lama := pg_temp.jadwal_teks(v_t1);

  insert into hasil_uji (uji, lulus, catatan)
  select 'J6 Menit bukan kelipatan 5: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":1,"mulai":"08:03","selesai":"10:00"}]')) like 'Menit harus kelipatan 5 di hari Senin%',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":1,"mulai":"08:03","selesai":"10:00"}]'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'J7 Jam mulai sama dengan jam selesai: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":2,"mulai":"09:00","selesai":"09:00"}]')) like 'Jam mulai dan jam selesai tidak boleh sama di hari Selasa%',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":2,"mulai":"09:00","selesai":"09:00"}]'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'J8 Dua sesi bertumpuk di hari yang sama: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":1,"mulai":"06:00","selesai":"10:00"},{"hari":1,"mulai":"09:00","selesai":"12:00"}]')) like 'Jam sesi bertumpuk di hari Senin%',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":1,"mulai":"06:00","selesai":"10:00"},{"hari":1,"mulai":"09:00","selesai":"12:00"}]'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'J9 Sesi lewat tengah malam menabrak hari berikutnya (Jumat ke Sabtu, dan Sabtu ke Minggu): ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":5,"mulai":"20:00","selesai":"02:00"},{"hari":6,"mulai":"01:00","selesai":"05:00"}]')) like 'Jam sesi bertumpuk di hari Jumat dan Sabtu%'
         and pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":6,"mulai":"22:00","selesai":"03:00"},{"hari":0,"mulai":"02:00","selesai":"06:00"}]')) like 'Jam sesi bertumpuk di hari Sabtu dan Minggu%',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":6,"mulai":"22:00","selesai":"03:00"},{"hari":0,"mulai":"02:00","selesai":"06:00"}]'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'J10 Format jam salah, hari tidak dikenal, dan array kosong: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":1,"mulai":"8:00","selesai":"10:00"}]')) like 'Format jam salah di hari Senin%'
         and pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[{"hari":7,"mulai":"08:00","selesai":"10:00"}]')) like 'Hari tidak dikenal%'
         and pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1, '[]')) like 'Isi minimal 1 sesi%',
         'format';

  insert into hasil_uji (uji, lulus, catatan)
  select 'J11 Simpan yang gagal di tengah (sesi pertama sah, sesi kedua bertumpuk) tidak mengubah jadwal lama (atomik)',
         pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":4,"mulai":"08:00","selesai":"12:00"},{"hari":4,"mulai":"11:00","selesai":"13:00"}]')) like 'Jam sesi bertumpuk%'
         and pg_temp.jadwal_teks(v_t1) = v_lama,
         pg_temp.jadwal_teks(v_t1);

  -- ==========================================================
  -- Pemilik menyimpan dan menghapus jadwal
  -- ==========================================================
  v_n := pg_temp.jalan(v_p1, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_t1,
           '[{"hari":1,"mulai":"07:00","selesai":"11:00"},{"hari":1,"mulai":"15:00","selesai":"20:00"},{"hari":6,"mulai":"22:00","selesai":"02:00"},{"hari":0,"mulai":"08:00","selesai":"12:00"}]'));
  insert into hasil_uji (uji, lulus, catatan)
  select 'J12 Pemilik menyimpan jadwal baru (dua sesi sehari, lewat tengah malam yang tidak menabrak): jadwal lama terganti',
         v_n = 'OK'
         and pg_temp.jadwal_teks(v_t1) = '0 08:00-12:00, 1 07:00-11:00, 1 15:00-20:00, 6 22:00-02:00',
         v_n || ' / ' || pg_temp.jadwal_teks(v_t1);

  insert into hasil_uji (uji, lulus, catatan)
  select 'J13 Sesi buka yang sedang berjalan tidak berubah sama sekali setelah jadwal diedit',
         (select s::text from public.sesi_buka s where s.id = v_s1) = v_sesi,
         coalesce((select coalesce(s.diakhiri_pada::text, 'berjalan') from public.sesi_buka s where s.id = v_s1), 'hilang');

  insert into hasil_uji (uji, lulus, catatan)
  select 'J14 Jadwal lapak lain (T2) tidak tersentuh; slug, status, dan tempat T1 tetap',
         pg_temp.jadwal_teks(v_t2) = '3 10:00-12:00'
         and (select slug || '/' || status_tayang from public.lapak where id = v_t1) = 'uji-s53b3-satu/tayang'
         and (select count(*) from public.tempat where lapak_id = v_t1) = 1,
         pg_temp.jadwal_teks(v_t2);

  v_n := pg_temp.jalan(v_p1, format('select public.hapus_jadwal_saya(%L)', v_t1));
  insert into hasil_uji (uji, lulus, catatan)
  select 'J15 Pemilik menghapus jadwal: berhasil, jadwal T1 kosong, sesi berjalan tetap tidak berubah',
         v_n = 'OK'
         and pg_temp.jadwal_teks(v_t1) = 'kosong'
         and (select s::text from public.sesi_buka s where s.id = v_s1) = v_sesi,
         v_n;

  v_n := pg_temp.jalan(v_p4, format('select public.simpan_jadwal_saya(%L, %L::jsonb)', v_h4, '[{"hari":3,"mulai":"16:00","selesai":"21:00"}]'));
  insert into hasil_uji (uji, lulus, catatan)
  select 'J16 Pemilik lapak disembunyikan boleh menyimpan jadwal; status tetap disembunyikan',
         v_n = 'OK'
         and pg_temp.jadwal_teks(v_h4) = '3 16:00-21:00'
         and (select status_tayang from public.lapak where id = v_h4) = 'disembunyikan',
         v_n;

  -- ==========================================================
  -- Bersihkan data uji (hanya id tetap di atas)
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.usaha where id in (v_u1, v_u2, v_u3, v_u4);
  delete from auth.users where id = any(v_akun);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
