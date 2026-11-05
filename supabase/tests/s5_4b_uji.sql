-- s5_4b_uji.sql
-- Uji S5.4 bagian 2 (PRD A46, A47; V19, V35) untuk 023_admin_semua_disembunyikan.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 023 dijalankan.
--
-- Cara kerja sama dengan s5_4_uji.sql:
--   - Akun, lapak, tempat, laporan, dan riwayat uji memakai id tetap, lalu dihapus lagi di akhir.
--   - Pelanggan, admin, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel laporan, tindakan_admin, tempat, atau wilayah dihitung sebagai postgres,
--     di luar pg_temp.nilai(). Peran authenticated memang tidak boleh membaca tabel laporan langsung.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T1 (P1, tayang, dibuat 3 hari lalu)        : "Uji54b Bakso Satu", dua tempat; yang terakhir dipakai di kecamatan K2
--   T2 (P2, tayang, dibuat 1 hari lalu)        : "Uji54b Soto 100%_x", tanpa tempat
--   H1 (P3, disembunyikan, dibuat 5 hari lalu) : sembunyikan (catatan lama) -> tampilkan -> sembunyikan (catatan terbaru);
--                                                laporan ditindak 2x Tempat salah, 1x Lainnya; diabaikan 2x Konten tidak pantas
--   H2 (P4, disembunyikan, dibuat 6 hari lalu) : tanpa riwayat tindakan dan tanpa laporan
--   D  (P5, draf, dibuat sekarang)             : tidak boleh muncul di kedua tab
-- Pelapor: pelanggan Q, R, S. A adalah admin.

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

-- Jejak isi tabel uji, untuk memastikan fungsi tidak menulis apa pun
create or replace function pg_temp.jejak(p_lapak uuid[]) returns text
language sql as $$
  select coalesce((select md5(string_agg(r::text, '|' order by r.id)) from public.laporan r where r.lapak_id = any(p_lapak)), '-')
      || coalesce((select md5(string_agg(l::text, '|' order by l.id)) from public.lapak l where l.id = any(p_lapak)), '-')
      || coalesce((select md5(string_agg(t::text, '|' order by t.id)) from public.tindakan_admin t where t.lapak_id = any(p_lapak)), '-')
      || coalesce((select md5(string_agg(t::text, '|' order by t.id)) from public.tempat t where t.lapak_id = any(p_lapak)), '-');
$$;

do $$
declare
  v_a   uuid := '00000000-0000-0000-0000-00000054b0a1';
  v_q   uuid := '00000000-0000-0000-0000-00000054b0b1';
  v_r   uuid := '00000000-0000-0000-0000-00000054b0c1';
  v_s   uuid := '00000000-0000-0000-0000-00000054b0d1';
  v_p1  uuid := '00000000-0000-0000-0000-00000054b011';
  v_p2  uuid := '00000000-0000-0000-0000-00000054b012';
  v_p3  uuid := '00000000-0000-0000-0000-00000054b013';
  v_p4  uuid := '00000000-0000-0000-0000-00000054b014';
  v_p5  uuid := '00000000-0000-0000-0000-00000054b015';
  v_t1  uuid := '00000000-0000-0000-0000-00000054b021';
  v_t2  uuid := '00000000-0000-0000-0000-00000054b022';
  v_h1  uuid := '00000000-0000-0000-0000-00000054b023';
  v_h2  uuid := '00000000-0000-0000-0000-00000054b024';
  v_d   uuid := '00000000-0000-0000-0000-00000054b025';
  v_k1  uuid;
  v_k2  uuid;
  v_semua uuid[];
  v_daftar_semua text;
  v_daftar_sembunyi text;
  v_sebelum text;
  v_harap text;
  v_n   text;
begin
  v_semua := array[v_t1, v_t2, v_h1, v_h2, v_d];
  -- Daftar admin yang dibatasi ke lapak uji (basis data mungkin sudah berisi lapak lain)
  v_daftar_semua := 'with ordinality as d(lapak_id, slug, nama, foto_url, status_tayang, dibuat_pada, kecamatan_nama, n) '
    || format('where d.lapak_id = any(%L::uuid[])', v_semua);
  v_daftar_sembunyi := 'from public.admin_daftar_disembunyikan() with ordinality as d(lapak_id, slug, nama, foto_url, '
    || 'disembunyikan_pada, catatan_admin, alasan_terbanyak, n) '
    || format('where d.lapak_id = any(%L::uuid[])', v_semua);

  -- Dua kecamatan yang berbeda dari tabel wilayah (dibaca sebagai postgres)
  select id into v_k1 from public.wilayah where tingkat = 'kecamatan' order by kode limit 1;
  select id into v_k2 from public.wilayah where tingkat = 'kecamatan' order by kode limit 1 offset 1;

  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-a@contoh.invalid'),
    (v_q,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-q@contoh.invalid'),
    (v_r,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-r@contoh.invalid'),
    (v_s,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-s@contoh.invalid'),
    (v_p1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-p1@contoh.invalid'),
    (v_p2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-p2@contoh.invalid'),
    (v_p3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-p3@contoh.invalid'),
    (v_p4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-p4@contoh.invalid'),
    (v_p5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54b-p5@contoh.invalid');
  update public.profil set nama_tampilan = 'Uji54b A', is_admin = true where id = v_a;

  insert into public.usaha (id, pemilik_id, nama) values
    ('00000000-0000-0000-0000-00000054b031', v_p1, 'Uji54b P1'),
    ('00000000-0000-0000-0000-00000054b032', v_p2, 'Uji54b P2'),
    ('00000000-0000-0000-0000-00000054b033', v_p3, 'Uji54b P3'),
    ('00000000-0000-0000-0000-00000054b034', v_p4, 'Uji54b P4'),
    ('00000000-0000-0000-0000-00000054b035', v_p5, 'Uji54b P5');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada, dibuat_pada) values
    (v_t1, '00000000-0000-0000-0000-00000054b031', v_p1, 'Uji54b Bakso Satu',  'uji-s54b-t1', 'tayang',        3, now(), now() - interval '3 days'),
    (v_t2, '00000000-0000-0000-0000-00000054b032', v_p2, 'Uji54b Soto 100%_x', 'uji-s54b-t2', 'tayang',        3, now(), now() - interval '1 day'),
    (v_h1, '00000000-0000-0000-0000-00000054b033', v_p3, 'Uji54b Hilang Satu', 'uji-s54b-h1', 'disembunyikan', 3, now(), now() - interval '5 days'),
    (v_h2, '00000000-0000-0000-0000-00000054b034', v_p4, 'Uji54b Hilang Dua',  'uji-s54b-h2', 'disembunyikan', 3, now(), now() - interval '6 days');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, dibuat_pada) values
    (v_d,  '00000000-0000-0000-0000-00000054b035', v_p5, 'Uji54b Bakso Draf',  'uji-s54b-d',  'draf',          2, now());

  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai, dibuat_pada) values
    (v_t1, 'Tempat lama', v_k1, now() - interval '2 days', now() - interval '3 days'),
    (v_t1, 'Tempat baru', v_k2, now() - interval '1 hour', now() - interval '2 days');

  insert into public.tindakan_admin (lapak_id, admin_id, aksi, catatan, dibuat_pada) values
    (v_h1, v_a, 'sembunyikan', 'Catatan lama',    now() - interval '2 days'),
    (v_h1, v_a, 'tampilkan',   null,              now() - interval '36 hours'),
    (v_h1, v_a, 'sembunyikan', 'Catatan terbaru', now() - interval '1 hour');

  insert into public.laporan (lapak_id, pelapor_id, alasan, status, dibuat_pada, pernyataan_pada) values
    (v_h1, v_q, 'Tempat salah',        'ditindak',  now() - interval '3 hours', now() - interval '3 hours'),
    (v_h1, v_r, 'Tempat salah',        'ditindak',  now() - interval '4 hours', now() - interval '4 hours'),
    (v_h1, v_s, 'Lainnya',             'ditindak',  now() - interval '2 hours', now() - interval '2 hours'),
    (v_h1, v_q, 'Konten tidak pantas', 'diabaikan', now() - interval '3 days',  now() - interval '3 days'),
    (v_h1, v_r, 'Konten tidak pantas', 'diabaikan', now() - interval '3 days',  now() - interval '3 days');

  v_sebelum := pg_temp.jejak(v_semua);

  -- ==========================================================
  -- Hak akses (A46: hanya admin)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'B1 Pelanggan memanggil admin_daftar_semua_lapak: ditolak',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_semua_lapak()') like 'Hanya admin%',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_semua_lapak()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'B2 Pelanggan memanggil admin_daftar_disembunyikan: ditolak',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_disembunyikan()') like 'Hanya admin%',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_disembunyikan()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'B3 Tamu (authenticated tanpa sub) memanggil kedua fungsi: ditolak',
         pg_temp.jalan(null, 'select * from public.admin_daftar_semua_lapak()') like 'Hanya admin%'
         and pg_temp.jalan(null, 'select * from public.admin_daftar_disembunyikan()') like 'Hanya admin%',
         pg_temp.jalan(null, 'select * from public.admin_daftar_disembunyikan()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'B4 Peran anon tidak punya hak execute pada kedua fungsi; authenticated punya',
         not has_function_privilege('anon', 'public.admin_daftar_semua_lapak(text)', 'execute')
         and not has_function_privilege('anon', 'public.admin_daftar_disembunyikan()', 'execute')
         and has_function_privilege('authenticated', 'public.admin_daftar_semua_lapak(text)', 'execute')
         and has_function_privilege('authenticated', 'public.admin_daftar_disembunyikan()', 'execute'),
         'anon semua ' || has_function_privilege('anon', 'public.admin_daftar_semua_lapak(text)', 'execute')::text
         || ', anon sembunyi ' || has_function_privilege('anon', 'public.admin_daftar_disembunyikan()', 'execute')::text;

  -- ==========================================================
  -- Semua lapak (V19)
  -- ==========================================================
  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.n) from public.admin_daftar_semua_lapak() ' || v_daftar_semua);
  insert into hasil_uji (uji, lulus, catatan)
  values ('B5 Semua lapak: tayang dan disembunyikan, terbaru di atas (T2, T1, H1, H2); draf D tidak muncul',
          v_n = 'Uji54b Soto 100%_x,Uji54b Bakso Satu,Uji54b Hilang Satu,Uji54b Hilang Dua', v_n);

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.status_tayang, coalesce(d.kecamatan_nama, ''kosong'')) from public.admin_daftar_semua_lapak() '
    || v_daftar_semua || ' and d.lapak_id = %L', v_t1));
  select 'tayang/' || nama into v_harap from public.wilayah where id = v_k2;
  insert into hasil_uji (uji, lulus, catatan)
  values ('B6 T1: kecamatan dari tempat yang terakhir dipakai', v_n = v_harap, v_n || ' (harap ' || coalesce(v_harap, 'kosong') || ')');

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.status_tayang, coalesce(d.kecamatan_nama, ''kosong'')) from public.admin_daftar_semua_lapak() '
    || v_daftar_semua || ' and d.lapak_id = %L', v_h2));
  insert into hasil_uji (uji, lulus, catatan)
  values ('B7 H2: status disembunyikan, kecamatan kosong kalau belum ada tempat', v_n = 'disembunyikan/kosong', v_n);

  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.n) from public.admin_daftar_semua_lapak(''  bAKso '') ' || v_daftar_semua);
  insert into hasil_uji (uji, lulus, catatan)
  values ('B8 Cari "  bAKso ": hanya T1 (huruf besar kecil dan spasi diabaikan; draf tetap tidak muncul)', v_n = 'Uji54b Bakso Satu', v_n);

  v_n := pg_temp.nilai(v_a, 'select coalesce(string_agg(d.nama, '','' order by d.n), ''kosong'') from public.admin_daftar_semua_lapak(''%_'') ' || v_daftar_semua);
  insert into hasil_uji (uji, lulus, catatan)
  values ('B9 Cari "%_" bukan wildcard: hanya nama yang memuat %_ (T2)', v_n = 'Uji54b Soto 100%_x', v_n);

  v_n := pg_temp.nilai(v_a, 'select count(*)::text from public.admin_daftar_semua_lapak('''') ' || v_daftar_semua)
    || '/' || pg_temp.nilai(v_a, 'select count(*)::text from public.admin_daftar_semua_lapak(null) ' || v_daftar_semua);
  insert into hasil_uji (uji, lulus, catatan)
  values ('B10 Cari kosong dan null: semua lapak tayang dan disembunyikan', v_n = '4/4', v_n);

  -- ==========================================================
  -- Disembunyikan (V35)
  -- ==========================================================
  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.n) ' || v_daftar_sembunyi);
  insert into hasil_uji (uji, lulus, catatan)
  values ('B11 Disembunyikan: hanya H1 dan H2, yang terakhir disembunyikan di atas', v_n = 'Uji54b Hilang Satu,Uji54b Hilang Dua', v_n);

  -- Waktu pembanding dari tindakan_admin dihitung sebagai postgres
  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.disembunyikan_pada::text, d.catatan_admin, d.alasan_terbanyak) '
    || v_daftar_sembunyi || ' and d.lapak_id = %L', v_h1));
  select concat_ws('/', max(t.dibuat_pada)::text, 'Catatan terbaru', 'Tempat salah') into v_harap
    from public.tindakan_admin t where t.lapak_id = v_h1 and t.aksi = 'sembunyikan';
  insert into hasil_uji (uji, lulus, catatan)
  values ('B12 H1: waktu dan catatan dari sembunyikan terakhir; alasan terbanyak dari laporan ditindak',
          v_n = v_harap, v_n);

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', coalesce(d.disembunyikan_pada::text, ''kosong''), coalesce(d.catatan_admin, ''kosong''), coalesce(d.alasan_terbanyak, ''kosong'')) '
    || v_daftar_sembunyi || ' and d.lapak_id = %L', v_h2));
  insert into hasil_uji (uji, lulus, catatan)
  values ('B13 H2 tanpa riwayat dan laporan: waktu, catatan, dan alasan kosong', v_n = 'kosong/kosong/kosong', v_n);

  -- ==========================================================
  -- Hanya baca
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  values ('B14 Tabel laporan, lapak, tindakan_admin, dan tempat tidak berubah setelah semua query di atas',
          pg_temp.jejak(v_semua) = v_sebelum, 'sebelum ' || v_sebelum || ', sesudah ' || pg_temp.jejak(v_semua));

  -- ==========================================================
  -- Tampilkan lagi lewat admin_tindak_lapak (V35, A47)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'B15 Admin menampilkan lagi H1 lewat admin_tindak_lapak: berhasil',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_h1, 'tampilkan')) = 'OK',
         'aksi tampilkan';

  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.n) ' || v_daftar_sembunyi)
    || '|' || pg_temp.nilai(v_a, format('select d.status_tayang from public.admin_daftar_semua_lapak() ' || v_daftar_semua || ' and d.lapak_id = %L', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('B16 Setelah Tampilkan lagi: H1 keluar dari Disembunyikan dan tayang di Semua lapak', v_n = 'Uji54b Hilang Dua|tayang', v_n);

  -- ==========================================================
  -- Bersihkan data uji
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.tindakan_admin where lapak_id = any(v_semua);
  delete from public.laporan where lapak_id = any(v_semua);
  delete from public.lapak where id = any(v_semua);
  delete from auth.users where id in (v_a, v_q, v_r, v_s, v_p1, v_p2, v_p3, v_p4, v_p5);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
