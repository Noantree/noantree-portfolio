-- s5_3b1_uji.sql
-- Uji S5.3b-1 (PRD A36, A37, A40; V42) untuk 026_ubah_profil_lapak.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 026 dijalankan.
--
-- Cara kerja sama dengan s5_5a_uji.sql:
--   - Akun, lapak, dan foto uji memakai id tetap (awalan ...53b1...), lalu dihapus lagi di akhir.
--   - Pemilik, pelanggan, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel dihitung sebagai postgres, di luar pg_temp.nilai().
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Seluruh blok adalah satu transaksi: kalau ada galat tak terduga, semua data uji ikut dibatalkan.
--   - Alamat foto hanya teks contoh; tidak ada file yang diunggah ke Storage.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T1 (P1, tayang, slug uji-s53b1-satu) : foto profil dan 2 foto lapak
--   D2 (P2, draf)                        : untuk memastikan lapak draf tidak bisa diubah lewat fungsi ini
--   H3 (P3, disembunyikan, slug uji-s53b1-tiga) : 1 foto lapak
-- Q pelanggan.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

-- Jalankan sql sebagai pengguna uid (atau tamu kalau null). Mengembalikan 'OK' atau pesan galat.
-- Galat membatalkan semua yang dikerjakan sql itu (subtransaksi), jadi bisa dipakai untuk menguji atomik.
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
  v_q   uuid := '00000000-0000-0000-0000-00000053b1b1';
  v_p1  uuid := '00000000-0000-0000-0000-00000053b111';
  v_p2  uuid := '00000000-0000-0000-0000-00000053b112';
  v_p3  uuid := '00000000-0000-0000-0000-00000053b113';
  v_u1  uuid := '00000000-0000-0000-0000-00000053b131';
  v_u2  uuid := '00000000-0000-0000-0000-00000053b132';
  v_u3  uuid := '00000000-0000-0000-0000-00000053b133';
  v_t1  uuid := '00000000-0000-0000-0000-00000053b121';
  v_d2  uuid := '00000000-0000-0000-0000-00000053b122';
  v_h3  uuid := '00000000-0000-0000-0000-00000053b123';
  v_f1  uuid := '00000000-0000-0000-0000-00000053b141';  -- foto T1 urutan 1
  v_f2  uuid := '00000000-0000-0000-0000-00000053b142';  -- foto T1 urutan 2
  v_f3  uuid := '00000000-0000-0000-0000-00000053b143';  -- foto H3
  v_dasar text := 'https://contoh.supabase.co/storage/v1/object/public/foto-lapak/';
  v_akun  uuid[];
  v_n     text;
  v_sql   text;
begin
  v_akun := array[v_q, v_p1, v_p2, v_p3];

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji53b1-' || right(u::text, 4) || '@contoh.invalid'
    from unnest(v_akun) as u;

  insert into public.usaha (id, pemilik_id, nama) values
    (v_u1, v_p1, 'Uji S53b1 Satu'), (v_u2, v_p2, 'Uji S53b1 Dua'), (v_u3, v_p3, 'Uji S53b1 Tiga');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, deskripsi, foto_url, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t1, v_u1, v_p1, 'Uji S53b1 Satu', 'uji-s53b1-satu', 'Bakso lama', v_dasar || v_p1 || '/profil-lama.jpg', 'tayang', 3, now()),
    (v_d2, v_u2, v_p2, 'Uji S53b1 Dua',  null,             null,         null,                                   'draf',   2, now()),
    (v_h3, v_u3, v_p3, 'Uji S53b1 Tiga', 'uji-s53b1-tiga', null,         null,                                   'disembunyikan', 3, now());
  insert into public.foto_lapak (id, lapak_id, url, urutan) values
    (v_f1, v_t1, v_dasar || v_p1 || '/a.jpg', 1),
    (v_f2, v_t1, v_dasar || v_p1 || '/b.jpg', 2),
    (v_f3, v_h3, v_dasar || v_p3 || '/c.jpg', 1);

  -- ==========================================================
  -- Hak akses
  -- ==========================================================
  v_sql := format('select public.simpan_profil_lapak(%L, %L, %L, null)', v_t1, 'Nama Penyusup', 'Isi');

  insert into hasil_uji (uji, lulus, catatan)
  select 'U1 Tamu mengubah profil lapak: ditolak', pg_temp.jalan(null, v_sql) like 'Bukan pemilik lapak ini%', pg_temp.jalan(null, v_sql);

  insert into hasil_uji (uji, lulus, catatan)
  select 'U2 Orang lain (pelanggan Q) mengubah profil T1: ditolak, nama tetap',
         pg_temp.jalan(v_q, v_sql) like 'Bukan pemilik lapak ini%'
         and (select nama from public.lapak where id = v_t1) = 'Uji S53b1 Satu',
         pg_temp.jalan(v_q, v_sql);

  insert into hasil_uji (uji, lulus, catatan)
  select 'U3 Hak execute: tidak untuk anon, ada untuk authenticated',
         not has_function_privilege('anon', 'public.simpan_profil_lapak(uuid, text, text, text, uuid[], text[])', 'execute')
         and has_function_privilege('authenticated', 'public.simpan_profil_lapak(uuid, text, text, text, uuid[], text[])', 'execute'),
         'anon ' || has_function_privilege('anon', 'public.simpan_profil_lapak(uuid, text, text, text, uuid[], text[])', 'execute')::text;

  insert into hasil_uji (uji, lulus, catatan)
  select 'U4 Pemilik tidak bisa mengubah tabel lapak langsung (nama lewat update biasa ditolak atau tidak berefek)',
         pg_temp.jalan(v_p1, format('update public.lapak set nama = %L, slug = %L where id = %L', 'Langsung', 'slug-baru', v_t1)) <> 'OK'
         or (select slug from public.lapak where id = v_t1) = 'uji-s53b1-satu',
         pg_temp.jalan(v_p1, format('update public.lapak set nama = %L, slug = %L where id = %L', 'Langsung', 'slug-baru', v_t1));

  -- ==========================================================
  -- Validasi (A37, nama wajib, foto di folder sendiri)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'U5 Deskripsi berisi link http, HTTPS, atau www.: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', 'pesan di http://contoh.id', v_dasar || v_p1 || '/profil-lama.jpg')) like 'Keterangan tidak boleh berisi link%'
         and pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', 'HTTPS://contoh.id', v_dasar || v_p1 || '/profil-lama.jpg')) like 'Keterangan tidak boleh berisi link%'
         and pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', 'lihat www.contoh.id ya', v_dasar || v_p1 || '/profil-lama.jpg')) like 'Keterangan tidak boleh berisi link%',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', 'lihat www.contoh.id ya', v_dasar || v_p1 || '/profil-lama.jpg'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'U6 Deskripsi 301 karakter: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', repeat('a', 301), v_dasar || v_p1 || '/profil-lama.jpg')) like 'Keterangan maks. 300 karakter%',
         'panjang 301';

  insert into hasil_uji (uji, lulus, catatan)
  select 'U7 Nama kosong atau hanya spasi: ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, '   ', 'Isi', v_dasar || v_p1 || '/profil-lama.jpg')) like 'Isi nama lapak dulu%',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, '   ', 'Isi', v_dasar || v_p1 || '/profil-lama.jpg'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'U8 Foto dari luar folder sendiri (alamat luar atau folder akun lain): ditolak',
         pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L)', v_t1, 'Uji S53b1 Satu', 'Isi', 'https://iklan.invalid/a.jpg')) like 'Foto tidak dikenal%'
         and pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L, %L::uuid[], %L::text[])',
               v_t1, 'Uji S53b1 Satu', 'Isi', v_dasar || v_p1 || '/profil-lama.jpg', '{}', array[v_dasar || v_p3 || '/curian.jpg'])) like 'Foto tidak dikenal%',
         'foto luar';

  insert into hasil_uji (uji, lulus, catatan)
  select 'U9 Lapak draf tidak bisa diubah lewat fungsi ini',
         pg_temp.jalan(v_p2, format('select public.simpan_profil_lapak(%L, %L, %L, null)', v_d2, 'Draf Baru', 'Isi')) like 'Selesaikan daftar lapak dulu%',
         pg_temp.jalan(v_p2, format('select public.simpan_profil_lapak(%L, %L, %L, null)', v_d2, 'Draf Baru', 'Isi'));

  -- ==========================================================
  -- Pemilik mengubah profil
  -- ==========================================================
  -- Ganti nama, deskripsi 300 karakter (batas), foto profil baru, hapus foto a.jpg, tambah 2 foto: jadi 3 foto
  v_n := pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L, %L::uuid[], %L::text[])',
           v_t1, '  Uji S53b1 Nama Baru  ', repeat('b', 300), v_dasar || v_p1 || '/profil-baru.jpg',
           array[v_f1], array[v_dasar || v_p1 || '/d.jpg', v_dasar || v_p1 || '/e.jpg']));
  insert into hasil_uji (uji, lulus, catatan)
  select 'U10 Pemilik mengubah nama, deskripsi 300 karakter, foto profil, dan foto lapak: berhasil',
         v_n = 'OK'
         and (select nama from public.lapak where id = v_t1) = 'Uji S53b1 Nama Baru'
         and (select char_length(deskripsi) from public.lapak where id = v_t1) = 300
         and (select foto_url from public.lapak where id = v_t1) = v_dasar || v_p1 || '/profil-baru.jpg'
         and (select count(*) from public.foto_lapak where lapak_id = v_t1) = 3
         and not exists (select 1 from public.foto_lapak where id = v_f1),
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'U11 Slug dan status tidak berubah setelah ganti nama (A36)',
         (select slug from public.lapak where id = v_t1) = 'uji-s53b1-satu'
         and (select status_tayang from public.lapak where id = v_t1) = 'tayang',
         (select slug || ' / ' || status_tayang from public.lapak where id = v_t1);

  insert into hasil_uji (uji, lulus, catatan)
  select 'U12 Nama baru tampil di lapak_publik lewat slug lama',
         pg_temp.nilai(v_q, 'select nama from public.lapak_publik where slug = ''uji-s53b1-satu''') = 'Uji S53b1 Nama Baru',
         pg_temp.nilai(v_q, 'select nama from public.lapak_publik where slug = ''uji-s53b1-satu''');

  insert into hasil_uji (uji, lulus, catatan)
  select 'U13 Urutan foto dirapikan menjadi 1, 2, 3',
         (select string_agg(urutan::text, ',' order by urutan) from public.foto_lapak where lapak_id = v_t1) = '1,2,3',
         (select string_agg(urutan::text, ',' order by urutan) from public.foto_lapak where lapak_id = v_t1);

  -- Sudah 3 foto; menambah 2 sekaligus berarti foto kelima: ditolak dan tidak ada yang berubah
  v_n := pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L, %L::uuid[], %L::text[])',
           v_t1, 'Nama Gagal', 'Isi', v_dasar || v_p1 || '/profil-baru.jpg',
           '{}', array[v_dasar || v_p1 || '/f.jpg', v_dasar || v_p1 || '/g.jpg']));
  insert into hasil_uji (uji, lulus, catatan)
  select 'U14 Foto kelima: ditolak, nama dan jumlah foto tetap (atomik)',
         v_n like 'Maksimal 4 foto per lapak%'
         and (select count(*) from public.foto_lapak where lapak_id = v_t1) = 3
         and (select nama from public.lapak where id = v_t1) = 'Uji S53b1 Nama Baru',
         v_n;

  v_n := pg_temp.jalan(v_p1, format('select public.simpan_profil_lapak(%L, %L, %L, %L, %L::uuid[], %L::text[])',
           v_t1, 'Uji S53b1 Nama Baru', '', v_dasar || v_p1 || '/profil-baru.jpg',
           array[v_f3], array[v_dasar || v_p1 || '/f.jpg']));
  insert into hasil_uji (uji, lulus, catatan)
  select 'U15 Foto keempat boleh; deskripsi kosong disimpan kosong; foto lapak lain tidak ikut terhapus',
         v_n = 'OK'
         and (select count(*) from public.foto_lapak where lapak_id = v_t1) = 4
         and (select deskripsi from public.lapak where id = v_t1) is null
         and exists (select 1 from public.foto_lapak where id = v_f3),
         v_n;

  insert into hasil_uji (uji, lulus, catatan)
  select 'U16 Trigger batas_foto (005) tetap menolak insert langsung foto kelima',
         pg_temp.jalan(v_p1, format('insert into public.foto_lapak (lapak_id, url, urutan) values (%L, %L, 5)', v_t1, v_dasar || v_p1 || '/h.jpg')) like 'Maksimal 4 foto per lapak%',
         pg_temp.jalan(v_p1, format('insert into public.foto_lapak (lapak_id, url, urutan) values (%L, %L, 5)', v_t1, v_dasar || v_p1 || '/h.jpg'));

  v_n := pg_temp.jalan(v_p3, format('select public.simpan_profil_lapak(%L, %L, %L, null)', v_h3, 'Uji S53b1 Tiga Baru', 'Teks biasa'));
  insert into hasil_uji (uji, lulus, catatan)
  select 'U17 Pemilik lapak disembunyikan boleh mengubah profil; status dan slug tetap',
         v_n = 'OK'
         and (select nama from public.lapak where id = v_h3) = 'Uji S53b1 Tiga Baru'
         and (select status_tayang from public.lapak where id = v_h3) = 'disembunyikan'
         and (select slug from public.lapak where id = v_h3) = 'uji-s53b1-tiga',
         v_n;

  -- ==========================================================
  -- Bersihkan data uji (hanya id tetap di atas)
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.usaha where id in (v_u1, v_u2, v_u3);
  delete from auth.users where id = any(v_akun);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
