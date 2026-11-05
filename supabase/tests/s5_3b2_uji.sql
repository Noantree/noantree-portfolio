-- s5_3b2_uji.sql
-- Uji S5.3b-2 (PRD A33, A34, A39; V43, V31) untuk 027_kelola_tempat.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 027 dijalankan.
--
-- Cara kerja sama dengan s5_3b1_uji.sql:
--   - Akun, lapak, tempat, dan sesi uji memakai id tetap (awalan ...53b2...), lalu dihapus lagi di akhir.
--   - Pemilik, pelanggan, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel dihitung sebagai postgres, di luar pg_temp.nilai().
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Seluruh blok adalah satu transaksi: kalau ada galat tak terduga, semua data uji ikut dibatalkan.
--   - Data uji tertentu (tempat ke-4 sampai ke-10, mengakhiri sesi) disiapkan langsung sebagai postgres,
--     bukan lewat aplikasi; aplikasi tetap tidak pernah menulis sesi_buka.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T1 (P1, tayang, slug uji-s53b2-satu) : tempat A (sedang dipakai sesi buka yang berjalan) dan B
--   T2 (P2, tayang, slug uji-s53b2-dua)  : satu-satunya tempat C
--   D3 (P3, draf)                        : satu tempat
--   H4 (P4, disembunyikan)               : satu tempat
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

do $$
declare
  v_q   uuid := '00000000-0000-0000-0000-00000053b2b1';
  v_p1  uuid := '00000000-0000-0000-0000-00000053b211';
  v_p2  uuid := '00000000-0000-0000-0000-00000053b212';
  v_p3  uuid := '00000000-0000-0000-0000-00000053b213';
  v_p4  uuid := '00000000-0000-0000-0000-00000053b214';
  v_u1  uuid := '00000000-0000-0000-0000-00000053b231';
  v_u2  uuid := '00000000-0000-0000-0000-00000053b232';
  v_u3  uuid := '00000000-0000-0000-0000-00000053b233';
  v_u4  uuid := '00000000-0000-0000-0000-00000053b234';
  v_t1  uuid := '00000000-0000-0000-0000-00000053b221';
  v_t2  uuid := '00000000-0000-0000-0000-00000053b222';
  v_d3  uuid := '00000000-0000-0000-0000-00000053b223';
  v_h4  uuid := '00000000-0000-0000-0000-00000053b224';
  v_ta  uuid := '00000000-0000-0000-0000-00000053b241';  -- tempat A milik T1 (sedang dipakai buka)
  v_tb  uuid := '00000000-0000-0000-0000-00000053b242';  -- tempat B milik T1
  v_tc  uuid := '00000000-0000-0000-0000-00000053b243';  -- tempat C milik T2 (satu-satunya)
  v_s1  uuid := '00000000-0000-0000-0000-00000053b251';  -- sesi buka T1 di tempat A
  v_k1  uuid;
  v_k2  uuid;
  v_kab uuid;
  v_akun uuid[];
  v_n   text;
  v_akhir timestamptz;
  v_batas timestamptz;
begin
  v_akun := array[v_q, v_p1, v_p2, v_p3, v_p4];

  -- Dua kecamatan aktif dan satu kabupaten dari tabel wilayah (dibaca sebagai postgres)
  select id into v_k1 from public.wilayah where tingkat = 'kecamatan' and aktif order by kode limit 1;
  select id into v_k2 from public.wilayah where tingkat = 'kecamatan' and aktif order by kode limit 1 offset 1;
  select id into v_kab from public.wilayah where tingkat = 'kabupaten' order by kode limit 1;

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji53b2-' || right(u::text, 4) || '@contoh.invalid'
    from unnest(v_akun) as u;

  insert into public.usaha (id, pemilik_id, nama) values
    (v_u1, v_p1, 'Uji S53b2 Satu'), (v_u2, v_p2, 'Uji S53b2 Dua'), (v_u3, v_p3, 'Uji S53b2 Tiga'), (v_u4, v_p4, 'Uji S53b2 Empat');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t1, v_u1, v_p1, 'Uji S53b2 Satu',  'uji-s53b2-satu',  'tayang',        3, now()),
    (v_t2, v_u2, v_p2, 'Uji S53b2 Dua',   'uji-s53b2-dua',   'tayang',        3, now()),
    (v_d3, v_u3, v_p3, 'Uji S53b2 Tiga',  null,              'draf',          3, now()),
    (v_h4, v_u4, v_p4, 'Uji S53b2 Empat', 'uji-s53b2-empat', 'disembunyikan', 3, now());
  insert into public.tempat (id, lapak_id, nama, kecamatan_id) values
    (v_ta, v_t1, 'Tempat A', v_k1), (v_tb, v_t1, 'Tempat B', v_k1), (v_tc, v_t2, 'Tempat C', v_k1);
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_d3, 'Tempat draf', v_k1), (v_h4, 'Tempat H4', v_k1);
  insert into public.sesi_buka (id, lapak_id, tempat_id, mulai_pada, berakhir_pada) values
    (v_s1, v_t1, v_ta, now() - interval '1 hour', now() + interval '3 hours');
  select berakhir_pada into v_batas from public.sesi_buka where id = v_s1;

  -- ==========================================================
  -- Hak akses
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'V1 Tamu menambah tempat: ditolak',
         pg_temp.jalan(null, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Tempat tamu', v_k1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(null, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Tempat tamu', v_k1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'V2 Orang lain (pelanggan Q) menambah, mengubah, dan menghapus tempat T1: ditolak',
         pg_temp.jalan(v_q, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Tempat Q', v_k1)) like 'Bukan pemilik lapak ini%'
         and pg_temp.jalan(v_q, format('select public.ubah_tempat(%L, %L, %L, null, null, %L)', v_t1, v_tb, 'Diubah Q', v_k1)) like 'Bukan pemilik lapak ini%'
         and pg_temp.jalan(v_q, format('select public.hapus_tempat(%L, %L)', v_t1, v_tb)) like 'Bukan pemilik lapak ini%'
         and (select nama from public.tempat where id = v_tb) = 'Tempat B',
         pg_temp.jalan(v_q, format('select public.hapus_tempat(%L, %L)', v_t1, v_tb));

  insert into hasil_uji (uji, lulus, catatan)
  select 'V3 Hak execute: tiga fungsi tidak untuk anon; fungsi inti tidak untuk authenticated',
         not has_function_privilege('anon', 'public.tambah_tempat(uuid, text, double precision, double precision, uuid)', 'execute')
         and not has_function_privilege('anon', 'public.ubah_tempat(uuid, uuid, text, double precision, double precision, uuid)', 'execute')
         and not has_function_privilege('anon', 'public.hapus_tempat(uuid, uuid)', 'execute')
         and has_function_privilege('authenticated', 'public.tambah_tempat(uuid, text, double precision, double precision, uuid)', 'execute')
         and has_function_privilege('authenticated', 'public.ubah_tempat(uuid, uuid, text, double precision, double precision, uuid)', 'execute')
         and has_function_privilege('authenticated', 'public.hapus_tempat(uuid, uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.inti_cek_isi_tempat(text, double precision, double precision, uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.inti_kunci_lapak_terdaftar(uuid)', 'execute'),
         'hak execute';

  insert into hasil_uji (uji, lulus, catatan)
  select 'V4 Pemilik tidak bisa menulis tabel tempat langsung',
         pg_temp.jalan(v_p1, format('insert into public.tempat (lapak_id, nama) values (%L, %L)', v_t1, 'Langsung')) <> 'OK',
         pg_temp.jalan(v_p1, format('insert into public.tempat (lapak_id, nama) values (%L, %L)', v_t1, 'Langsung'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'V5 Lapak draf: tambah tempat ditolak (draf tetap lewat Daftar 2)',
         pg_temp.jalan(v_p3, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_d3, 'Tempat baru draf', v_k1)) like 'Selesaikan daftar lapak dulu%',
         pg_temp.jalan(v_p3, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_d3, 'Tempat baru draf', v_k1));

  -- ==========================================================
  -- Isi tempat (A33, A34)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'V6 Nama kosong, kecamatan kosong, kabupaten sebagai kecamatan, dan titik setengah: ditolak',
         pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, '   ', v_k1)) like 'Isi nama tempat dulu%'
         and pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, null, null, null)', v_t1, 'Tanpa kecamatan')) like 'Pilih kecamatan dulu%'
         and pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Salah wilayah', v_kab)) like 'Kecamatan tidak dikenal%'
         and pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, -7.4, null, %L)', v_t1, 'Setengah titik', v_k1)) like 'Titik lokasi tidak lengkap%'
         and (select count(*) from public.tempat where lapak_id = v_t1) = 2,
         'jumlah tempat T1: ' || (select count(*) from public.tempat where lapak_id = v_t1);

  v_n := pg_temp.nilai(v_p1, format('select public.tambah_tempat(%L, %L, -7.429, 111.019, %L)::text', v_t1, '  Alun-alun Sragen  ', v_k2));
  insert into hasil_uji (uji, lulus, catatan)
  select 'V7 Pemilik menambah tempat dengan titik: berhasil, nama dirapikan, link Maps dibuat dari titik',
         v_n not like 'ERR:%'
         and (select count(*) from public.tempat where lapak_id = v_t1) = 3
         and exists (select 1 from public.tempat where id::text = v_n and nama = 'Alun-alun Sragen' and kecamatan_id = v_k2
                     and link_maps = 'https://www.google.com/maps?q=-7.429,111.019'),
         v_n;

  v_n := pg_temp.jalan(v_p1, format('select public.ubah_tempat(%L, %L, %L, null, null, %L)', v_t1, v_tb, 'Tempat B Baru', v_k2));
  insert into hasil_uji (uji, lulus, catatan)
  select 'V8 Pemilik mengubah nama dan kecamatan tempat B, tanpa titik: berhasil, link Maps kosong',
         v_n = 'OK'
         and exists (select 1 from public.tempat where id = v_tb and nama = 'Tempat B Baru' and kecamatan_id = v_k2
                     and lat is null and lng is null and link_maps is null),
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'V9 Tempat milik lapak lain (C milik T2) tidak bisa diubah atau dihapus lewat T1',
         pg_temp.jalan(v_p1, format('select public.ubah_tempat(%L, %L, %L, null, null, %L)', v_t1, v_tc, 'Diambil P1', v_k1)) like 'Tempat tidak ditemukan%'
         and pg_temp.jalan(v_p1, format('select public.hapus_tempat(%L, %L)', v_t1, v_tc)) like 'Tempat tidak ditemukan%'
         and pg_temp.jalan(v_p1, format('select public.hapus_tempat(%L, %L)', v_t2, v_tc)) like 'Bukan pemilik lapak ini%'
         and (select nama from public.tempat where id = v_tc) = 'Tempat C',
         pg_temp.jalan(v_p1, format('select public.ubah_tempat(%L, %L, %L, null, null, %L)', v_t1, v_tc, 'Diambil P1', v_k1));

  -- ==========================================================
  -- Batas 10 tempat
  -- ==========================================================
  -- T1 punya 3 tempat; 7 tempat lagi disiapkan langsung sebagai postgres supaya genap 10
  insert into public.tempat (lapak_id, nama, kecamatan_id)
  select v_t1, 'Tempat isi ' || n, v_k1 from generate_series(4, 10) as n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'V10 Tempat ke-11: ditolak, jumlah tetap 10',
         pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Tempat ke-11', v_k1)) like 'Maksimal 10 tempat per lapak%'
         and (select count(*) from public.tempat where lapak_id = v_t1) = 10,
         pg_temp.jalan(v_p1, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_t1, 'Tempat ke-11', v_k1));

  -- ==========================================================
  -- Hapus tempat (A39)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'V11 Hapus satu-satunya tempat (C milik T2): ditolak, C tetap ada',
         pg_temp.jalan(v_p2, format('select public.hapus_tempat(%L, %L)', v_t2, v_tc)) like 'Lapakmu harus punya minimal 1 tempat%'
         and exists (select 1 from public.tempat where id = v_tc),
         pg_temp.jalan(v_p2, format('select public.hapus_tempat(%L, %L)', v_t2, v_tc));

  insert into hasil_uji (uji, lulus, catatan)
  select 'V12 Hapus tempat A yang sedang dipakai sesi buka yang berjalan: ditolak, A tetap ada',
         pg_temp.jalan(v_p1, format('select public.hapus_tempat(%L, %L)', v_t1, v_ta)) like 'Lapakmu sedang buka di tempat ini%'
         and exists (select 1 from public.tempat where id = v_ta),
         pg_temp.jalan(v_p1, format('select public.hapus_tempat(%L, %L)', v_t1, v_ta));

  insert into hasil_uji (uji, lulus, catatan)
  select 'V13 Fungsi tempat tidak menyentuh sesi_buka: sesi T1 masih berjalan, tidak berubah',
         exists (select 1 from public.sesi_buka where id = v_s1 and tempat_id = v_ta and diakhiri_pada is null and berakhir_pada = v_batas),
         'sesi: ' || coalesce((select coalesce(diakhiri_pada::text, 'berjalan') from public.sesi_buka where id = v_s1), 'hilang');

  -- Sesi diselesaikan langsung sebagai postgres (setara Selesai di aplikasi), lalu A boleh dihapus
  update public.sesi_buka set diakhiri_pada = now(), cara_akhir = 'manual' where id = v_s1;
  select diakhiri_pada into v_akhir from public.sesi_buka where id = v_s1;

  v_n := pg_temp.jalan(v_p1, format('select public.hapus_tempat(%L, %L)', v_t1, v_ta));
  insert into hasil_uji (uji, lulus, catatan)
  select 'V14 Setelah sesi selesai, tempat A boleh dihapus; riwayat sesi tetap ada dengan tempat kosong',
         v_n = 'OK'
         and not exists (select 1 from public.tempat where id = v_ta)
         and exists (select 1 from public.sesi_buka where id = v_s1 and tempat_id is null and diakhiri_pada = v_akhir and berakhir_pada = v_batas),
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'V15 Slug dan status lapak tidak berubah',
         (select slug || '/' || status_tayang from public.lapak where id = v_t1) = 'uji-s53b2-satu/tayang'
         and (select slug || '/' || status_tayang from public.lapak where id = v_t2) = 'uji-s53b2-dua/tayang',
         (select slug || '/' || status_tayang from public.lapak where id = v_t1);

  v_n := pg_temp.jalan(v_p4, format('select public.tambah_tempat(%L, %L, null, null, %L)', v_h4, 'Tempat baru H4', v_k1));
  insert into hasil_uji (uji, lulus, catatan)
  select 'V16 Pemilik lapak disembunyikan boleh menambah tempat; status tetap disembunyikan',
         v_n = 'OK'
         and (select count(*) from public.tempat where lapak_id = v_h4) = 2
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
