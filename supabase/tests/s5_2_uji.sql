-- s5_2_uji.sql
-- Uji S5.2 dan S5.4 (PRD bagian 10) untuk 021_laporkan_admin.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 021 dijalankan.
--
-- Cara kerja sama dengan uji sebelumnya:
--   - Akun dan lapak uji memakai id tetap, lalu dihapus lagi di akhir (on delete cascade).
--   - Pelanggan dan admin ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak tabel dan RLS berlaku seperti dari aplikasi.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Pemilik P punya lapak T (tayang). Pemilik S punya lapak D (draf); D tidak boleh milik P karena
-- lapak_satu_per_pemilik (011) hanya mengizinkan satu lapak per pemilik. Pelanggan Q dan R.
-- Pemilik X punya lapak Y (tayang).
-- A adalah admin.

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
  v_p  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_q  uuid := '00000000-0000-0000-0000-0000000000b1';
  v_r  uuid := '00000000-0000-0000-0000-0000000000c1';
  v_a  uuid := '00000000-0000-0000-0000-0000000000d1';
  v_x  uuid := '00000000-0000-0000-0000-0000000000e1';
  v_s  uuid := '00000000-0000-0000-0000-0000000000f1';
  v_t  uuid := '00000000-0000-0000-0000-0000000002a1';
  v_d  uuid := '00000000-0000-0000-0000-0000000002b1';
  v_y  uuid := '00000000-0000-0000-0000-0000000002e1';
  v_uh text;
  v_n  text;
  v_lr text;
  v_ly text;
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_p, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-p@contoh.invalid'),
    (v_q, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-q@contoh.invalid'),
    (v_r, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-r@contoh.invalid'),
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-a@contoh.invalid'),
    (v_x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-x@contoh.invalid'),
    (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s@contoh.invalid');
  update public.profil set nama_tampilan = 'Uji A', is_admin = true where id = v_a;
  update public.profil set nama_tampilan = 'Uji Q' where id = v_q;

  insert into public.usaha (id, pemilik_id, nama) values
    ('00000000-0000-0000-0000-0000000001a1', v_p, 'Uji P'),
    ('00000000-0000-0000-0000-0000000001e1', v_x, 'Uji X'),
    ('00000000-0000-0000-0000-0000000001f1', v_s, 'Uji S');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t, '00000000-0000-0000-0000-0000000001a1', v_p, 'Uji T', 'uji-s52-t', 'tayang', 3, now()),
    (v_y, '00000000-0000-0000-0000-0000000001e1', v_x, 'Uji Y', 'uji-s52-y', 'tayang', 3, now());
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar) values
    (v_d, '00000000-0000-0000-0000-0000000001f1', v_s, 'Uji D', 'uji-s52-d', 'draf', 2);

  -- ==========================================================
  -- Pelapor (A44, V9)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'L1 Tanpa centang pernyataan: ditolak',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,false)', v_t, 'Status tidak sesuai')) like 'Centang pernyataan%',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,false)', v_t, 'Status tidak sesuai'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'L2 Alasan di luar lima pilihan: ditolak',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Iseng saja')) like 'Pilih satu alasan%',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Iseng saja'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'L3 Catatan lebih dari 200 karakter: ditolak',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,%L,true)', v_t, 'Lainnya', repeat('a', 201))) like 'Catatan maks%',
         'panjang 201';

  insert into hasil_uji (uji, lulus, catatan)
  select 'L4 Lapak draf: ditolak sebagai tidak tersedia',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_d, 'Lainnya')) like 'Lapak tidak tersedia%',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_d, 'Lainnya'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'L5 Pemilik melapor lapaknya sendiri: ditolak',
         pg_temp.jalan(v_p, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Lainnya')) like 'Tidak bisa melaporkan lapak sendiri%',
         pg_temp.jalan(v_p, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Lainnya'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'L6 Pelanggan melapor lapak tayang dengan centang: berhasil',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,%L,true)', v_t, 'Status tidak sesuai', 'Katanya buka, ternyata tutup')) = 'OK',
         'Q1 dibuat';

  insert into hasil_uji (uji, lulus, catatan)
  select 'L7 Laporan kedua dari akun sama dalam 30 hari: ditolak',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Tempat salah')) like 'Sudah melapor lapak ini dalam 30 hari%',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Tempat salah'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'L8 Akun lain melapor lapak yang sama: berhasil',
         pg_temp.jalan(v_r, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Lapak tidak ada / akun iseng')) = 'OK',
         'R1 dibuat';

  insert into hasil_uji (uji, lulus, catatan)
  select 'L9 Akun sama melapor lapak lain: berhasil',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_y, 'Lainnya')) = 'OK',
         'Q melapor Y';

  -- Mundurkan laporan Q ke T 31 hari (sebagai postgres), lalu Q boleh melapor lagi
  update public.laporan set dibuat_pada = now() - interval '31 days'
   where pelapor_id = v_q and lapak_id = v_t;
  insert into hasil_uji (uji, lulus, catatan)
  select 'L10 Setelah 30 hari, akun yang sama boleh melapor lagi',
         pg_temp.jalan(v_q, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Status tidak sesuai')) = 'OK',
         'Q2 dibuat';

  insert into hasil_uji (uji, lulus, catatan)
  select 'L11 Tabel laporan tidak bisa diisi langsung dari konsol',
         pg_temp.jalan(v_q, format('insert into public.laporan (lapak_id, pelapor_id, alasan) values (%L,%L,%L)', v_t, v_q, 'Lainnya')) <> 'OK',
         pg_temp.jalan(v_q, format('insert into public.laporan (lapak_id, pelapor_id, alasan) values (%L,%L,%L)', v_t, v_q, 'Lainnya'));

  select count(*)::text into v_n from public.laporan where pernyataan_pada is null;
  insert into hasil_uji (uji, lulus, catatan)
  values ('L12 Setiap laporan menyimpan waktu pernyataan', v_n = '0', 'laporan tanpa pernyataan: ' || v_n);

  -- ==========================================================
  -- Admin (A46, A47; V18, V55)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'A1 Pelanggan tidak bisa menjalankan tindakan admin',
         pg_temp.jalan(v_q, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_t, 'abaikan')) = 'Hanya admin',
         'diuji sebagai Q';

  insert into hasil_uji (uji, lulus, catatan)
  select 'A2 Pelanggan tidak bisa membuka detail laporan',
         pg_temp.nilai(v_q, format('select count(*)::text from public.admin_detail_laporan(%L)', v_t)) like 'ERR: Hanya admin%',
         'diuji sebagai Q';

  -- Id laporan dibaca sebagai postgres: peran authenticated memang tidak boleh membaca tabel laporan langsung.
  select id::text into v_lr from public.laporan where pelapor_id = v_r and lapak_id = v_t;
  select id::text into v_ly from public.laporan where lapak_id = v_y limit 1;

  insert into hasil_uji (uji, lulus, catatan)
  select 'A3 Admin mengabaikan satu laporan: berhasil',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,%L::uuid,%L)',
                                    v_t, 'abaikan', v_lr, 'Dicek, tidak relevan')) = 'OK',
         'R1 diabaikan';

  select status into v_uh from public.laporan where pelapor_id = v_r and lapak_id = v_t;
  insert into hasil_uji (uji, lulus, catatan)
  values ('A3b Laporan R1 berstatus diabaikan', v_uh = 'diabaikan', 'status: ' || v_uh);

  insert into hasil_uji (uji, lulus, catatan)
  select 'A4 Mengabaikan laporan milik lapak lain: ditolak',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,%L::uuid,null)',
                                    v_t, 'abaikan', v_ly)) = 'Laporan tidak termasuk lapak ini',
         'laporan Y pada T';

  insert into hasil_uji (uji, lulus, catatan)
  select 'A5 Admin menyembunyikan lapak: berhasil',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,%L)', v_t, 'sembunyikan', 'Banyak laporan serupa')) = 'OK',
         'T disembunyikan';

  select status_tayang into v_uh from public.lapak where id = v_t;
  select count(*)::text into v_n from public.laporan where lapak_id = v_t and status = 'ditindak';
  insert into hasil_uji (uji, lulus, catatan)
  values ('A5b Lapak disembunyikan dan laporan baru menjadi ditindak (Q1 dan Q2)',
          v_uh = 'disembunyikan' and v_n = '2', 'status lapak ' || v_uh || ', ditindak ' || v_n);

  insert into hasil_uji (uji, lulus, catatan)
  select 'A6 Lapak yang sudah disembunyikan tidak bisa disembunyikan lagi',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_t, 'sembunyikan')) = 'Lapak tidak sedang tayang',
         'ulangi sembunyikan';

  select count(*)::text into v_n from public.lapak_publik where id = v_t;
  insert into hasil_uji (uji, lulus, catatan)
  values ('A7 Lapak disembunyikan tidak tampil di lapak_publik', v_n = '0', 'baris publik ' || v_n);

  insert into hasil_uji (uji, lulus, catatan)
  select 'A8 Pelapor tidak bisa melapor lapak yang disembunyikan',
         pg_temp.jalan(v_r, format('select public.lapor_lapak(%L,%L,null,true)', v_t, 'Lainnya')) = 'Lapak tidak tersedia',
         'lapor saat disembunyikan';

  insert into hasil_uji (uji, lulus, catatan)
  select 'A9 Admin menampilkan lagi: berhasil',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_t, 'tampilkan')) = 'OK',
         'T tayang lagi';

  select status_tayang into v_uh from public.lapak where id = v_t;
  select count(*)::text into v_n from public.laporan where lapak_id = v_t and status = 'ditindak';
  insert into hasil_uji (uji, lulus, catatan)
  values ('A9b Tampilkan lagi: lapak tayang dan laporan ditindak kembali diabaikan',
          v_uh = 'tayang' and v_n = '0', 'status lapak ' || v_uh || ', ditindak ' || v_n);

  insert into hasil_uji (uji, lulus, catatan)
  select 'A10 Menampilkan lapak yang sudah tayang: ditolak',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_t, 'tampilkan')) = 'Lapak tidak sedang disembunyikan',
         'ulangi tampilkan';

  insert into hasil_uji (uji, lulus, catatan)
  select 'A11 Abaikan semua laporan baru: lapak tetap tayang',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,%L)', v_t, 'abaikan', 'Tidak ada tindakan')) = 'OK'
         and (select status_tayang from public.lapak where id = v_t) = 'tayang',
         'abaikan semua';

  -- Detail laporan (V55): admin melihat identitas pelapor, termasuk email
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*)::text into v_n from public.admin_detail_laporan(v_t);
  insert into hasil_uji (uji, lulus, catatan)
  values ('A12 Detail laporan lapak T memuat tiga laporan (Q1, Q2, R1)', v_n = '3', 'jumlah baris ' || v_n);
  select count(*)::text into v_n from public.admin_detail_laporan(v_t) where pelapor_email = 'uji-q@contoh.invalid';
  insert into hasil_uji (uji, lulus, catatan)
  values ('A13 Detail laporan memuat email pelapor untuk admin', v_n = '2', 'baris dengan email Q: ' || v_n);

  insert into hasil_uji (uji, lulus, catatan)
  select 'A14 Riwayat tindakan tercatat per aksi (abaikan, sembunyikan, tampilkan, abaikan)',
         (select count(*) from public.tindakan_admin where lapak_id = v_t) = 4
         and (select count(*) from public.tindakan_admin where lapak_id = v_t and aksi = 'abaikan' and laporan_id is not null) = 1,
         'baris riwayat ' || (select count(*) from public.tindakan_admin where lapak_id = v_t);

  -- Admin bisa membaca lapak milik orang lain; pelanggan tidak
  insert into hasil_uji (uji, lulus, catatan)
  select 'A15 Admin bisa membaca baris lapak milik pemilik lain',
         pg_temp.nilai(v_a, format('select count(*)::text from public.lapak where id = %L', v_t)) = '1',
         'diuji sebagai A';
  insert into hasil_uji (uji, lulus, catatan)
  select 'A16 Pelanggan tidak bisa membaca baris lapak milik pemilik lain',
         pg_temp.nilai(v_q, format('select count(*)::text from public.lapak where id = %L', v_t)) = '0',
         'diuji sebagai Q';

  -- A28: menghapus akun pelapor tidak menghapus laporannya; laporan tinggal tanpa nama
  delete from auth.users where id = v_r;
  select count(*)::text into v_n from public.laporan where lapak_id = v_t and pelapor_id is null;
  insert into hasil_uji (uji, lulus, catatan)
  values ('A17 Hapus akun pelapor: laporannya tetap tersimpan tanpa nama (A28)', v_n = '1', 'laporan tanpa pelapor: ' || v_n);

  -- ==========================================================
  -- Bersihkan data uji
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.tindakan_admin where lapak_id in (v_t, v_y);
  delete from public.laporan where lapak_id in (v_t, v_y);
  delete from public.lapak where id in (v_t, v_y, v_d);
  delete from auth.users where id = v_q;
  delete from auth.users where id = v_a;
  delete from auth.users where id = v_p;
  delete from auth.users where id = v_x;
  delete from auth.users where id = v_s;
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
