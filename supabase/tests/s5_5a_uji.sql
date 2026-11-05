-- s5_5a_uji.sql
-- Uji S5.5a (PRD A28, A29, A36; V32, V27) untuk 025_tutup_lapak_hapus_akun.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 025 dijalankan.
--
-- Cara kerja sama dengan s5_4c_uji.sql:
--   - Akun, lapak, dan data uji memakai id tetap (awalan ...55a...), lalu dihapus lagi di akhir.
--     Tes ini menghapus akun lewat hapus_akun_saya, dan hanya untuk akun uji dengan id tetap di bawah.
--   - Pemilik, pelanggan, admin, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel (laporan, tindakan_admin, lapak, dan lainnya) dihitung sebagai postgres,
--     di luar pg_temp.nilai(). Peran authenticated memang tidak boleh membaca tabel laporan langsung.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Seluruh blok adalah satu transaksi: kalau ada galat tak terduga, semua data uji ikut dibatalkan.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T1 (P1, tayang, slug uji-s55a-satu) : 2 tempat, 1 jadwal, 1 foto, sesi berjalan, diikuti Q dan R. P1 sendiri mengikuti T2.
--   T2 (P2, tayang, slug uji-s55a-dua)  : diikuti Q; 1 laporan dari R.
--   T3 (P3, tayang, slug uji-s55a-tiga) : sesi berjalan, diikuti Q dan R; 1 laporan dari Q; 1 riwayat tindakan admin A.
--   D4 (P4, draf siap tayang)           : bernama "Uji S55a Satu", untuk menguji slug yang dicadangkan.
-- Pelanggan Q dan R. A adalah admin.

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
  v_a   uuid := '00000000-0000-0000-0000-000000055aa1';
  v_q   uuid := '00000000-0000-0000-0000-000000055ab1';
  v_r   uuid := '00000000-0000-0000-0000-000000055ac1';
  v_p1  uuid := '00000000-0000-0000-0000-000000055a11';
  v_p2  uuid := '00000000-0000-0000-0000-000000055a12';
  v_p3  uuid := '00000000-0000-0000-0000-000000055a13';
  v_p4  uuid := '00000000-0000-0000-0000-000000055a14';
  v_u1  uuid := '00000000-0000-0000-0000-000000055a31';
  v_u2  uuid := '00000000-0000-0000-0000-000000055a32';
  v_u3  uuid := '00000000-0000-0000-0000-000000055a33';
  v_u4  uuid := '00000000-0000-0000-0000-000000055a34';
  v_t1  uuid := '00000000-0000-0000-0000-000000055a21';
  v_t2  uuid := '00000000-0000-0000-0000-000000055a22';
  v_t3  uuid := '00000000-0000-0000-0000-000000055a23';
  v_d4  uuid := '00000000-0000-0000-0000-000000055a24';
  v_lq  uuid := '00000000-0000-0000-0000-000000055a41';  -- laporan Q tentang T3
  v_lr  uuid := '00000000-0000-0000-0000-000000055a42';  -- laporan R tentang T2
  v_ta  uuid := '00000000-0000-0000-0000-000000055a51';  -- riwayat tindakan A tentang T3
  v_semua uuid[];
  v_akun  uuid[];
  v_n   text;
begin
  v_semua := array[v_t1, v_t2, v_t3, v_d4];
  v_akun  := array[v_a, v_q, v_r, v_p1, v_p2, v_p3, v_p4];

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji55a-' || right(u::text, 4) || '@contoh.invalid'
    from unnest(v_akun) as u;
  update public.profil set nama_tampilan = 'Uji55a A', is_admin = true where id = v_a;

  insert into public.usaha (id, pemilik_id, nama) values
    (v_u1, v_p1, 'Uji S55a Satu'), (v_u2, v_p2, 'Uji S55a Dua'), (v_u3, v_p3, 'Uji S55a Tiga'), (v_u4, v_p4, 'Uji S55a Satu');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t1, v_u1, v_p1, 'Uji S55a Satu', 'uji-s55a-satu', 'tayang', 3, now()),
    (v_t2, v_u2, v_p2, 'Uji S55a Dua',  'uji-s55a-dua',  'tayang', 3, now()),
    (v_t3, v_u3, v_p3, 'Uji S55a Tiga', 'uji-s55a-tiga', 'tayang', 3, now()),
    (v_d4, v_u4, v_p4, 'Uji S55a Satu', null,            'draf',   3, now());

  insert into public.tempat (lapak_id, nama) values
    (v_t1, 'Tempat satu'), (v_t1, 'Tempat dua'), (v_t3, 'Tempat tiga'), (v_d4, 'Tempat empat');
  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values (v_t1, 1, '06:00', '14:00');
  insert into public.foto_lapak (lapak_id, url, urutan) values (v_t1, 'https://contoh.invalid/foto.jpg', 1);
  insert into public.sesi_buka (lapak_id, mulai_pada, berakhir_pada) values
    (v_t1, now() - interval '1 hour', now() + interval '3 hours'),
    (v_t3, now() - interval '1 hour', now() + interval '3 hours');
  insert into public.pengikut (pelanggan_id, lapak_id) values
    (v_q, v_t1), (v_r, v_t1), (v_p1, v_t2), (v_q, v_t2), (v_q, v_t3), (v_r, v_t3);
  insert into public.laporan (id, lapak_id, pelapor_id, alasan, status, pernyataan_pada) values
    (v_lq, v_t3, v_q, 'Status tidak sesuai', 'baru', now()),
    (v_lr, v_t2, v_r, 'Tempat salah',        'baru', now());
  insert into public.tindakan_admin (id, lapak_id, admin_id, aksi, catatan, laporan_id) values
    (v_ta, v_t3, v_a, 'abaikan', 'Uji riwayat admin', null);

  -- ==========================================================
  -- Hak akses dan konfirmasi
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'H1 Tamu menutup lapak dan menghapus akun: ditolak',
         pg_temp.jalan(null, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP')) like 'Harus masuk dulu%'
         and pg_temp.jalan(null, 'select public.hapus_akun_saya(''HAPUS'')') like 'Harus masuk dulu%',
         pg_temp.jalan(null, 'select public.hapus_akun_saya(''HAPUS'')');

  insert into hasil_uji (uji, lulus, catatan)
  select 'H2 Orang lain menutup lapak T1 dengan TUTUP: ditolak, T1 tetap ada',
         pg_temp.jalan(v_q, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP')) like 'Lapak tidak ditemukan%'
         and exists (select 1 from public.lapak where id = v_t1),
         pg_temp.jalan(v_q, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP'));

  insert into hasil_uji (uji, lulus, catatan)
  select 'H3 Konfirmasi salah (huruf kecil, kosong, null): ditolak di server',
         pg_temp.jalan(v_p1, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'tutup')) like 'Ketik TUTUP%'
         and pg_temp.jalan(v_p1, format('select public.tutup_lapak_saya(%L, null)', v_t1)) like 'Ketik TUTUP%'
         and pg_temp.jalan(v_q, 'select public.hapus_akun_saya(''hapus'')') like 'Ketik HAPUS%'
         and pg_temp.jalan(v_q, 'select public.hapus_akun_saya('''')') like 'Ketik HAPUS%'
         and exists (select 1 from public.lapak where id = v_t1)
         and exists (select 1 from auth.users where id = v_q),
         pg_temp.jalan(v_q, 'select public.hapus_akun_saya(''hapus'')');

  insert into hasil_uji (uji, lulus, catatan)
  select 'H4 Hak execute: inti_tutup_lapak tidak untuk authenticated; fungsi publik tidak untuk anon',
         not has_function_privilege('authenticated', 'public.inti_tutup_lapak(uuid)', 'execute')
         and not has_function_privilege('anon', 'public.inti_tutup_lapak(uuid)', 'execute')
         and not has_function_privilege('anon', 'public.tutup_lapak_saya(uuid, text)', 'execute')
         and not has_function_privilege('anon', 'public.hapus_akun_saya(text)', 'execute')
         and has_function_privilege('authenticated', 'public.tutup_lapak_saya(uuid, text)', 'execute')
         and has_function_privilege('authenticated', 'public.hapus_akun_saya(text)', 'execute'),
         'inti ' || has_function_privilege('authenticated', 'public.inti_tutup_lapak(uuid)', 'execute')::text;

  insert into hasil_uji (uji, lulus, catatan)
  select 'H5 Pemilik tidak bisa memanggil inti_tutup_lapak langsung dari konsol',
         pg_temp.jalan(v_p1, format('select public.inti_tutup_lapak(%L)', v_t1)) like '%permission denied%'
         and exists (select 1 from public.lapak where id = v_t1),
         pg_temp.jalan(v_p1, format('select public.inti_tutup_lapak(%L)', v_t1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'H6 Tabel slug_dicadangkan tidak bisa dibaca dari aplikasi',
         pg_temp.nilai(v_p1, 'select count(*)::text from public.slug_dicadangkan') like 'ERR:%',
         pg_temp.nilai(v_p1, 'select count(*)::text from public.slug_dicadangkan');

  -- ==========================================================
  -- Satu kegagalan di tengah: tidak ada yang setengah terhapus
  -- ==========================================================
  -- Pemicu sementara membuat penghapusan pengikut T3 gagal. Pengikut terhapus lewat cascade, setelah sesi diakhiri
  -- dan slug dicadangkan, jadi kegagalan ini terjadi di tengah inti_tutup_lapak.
  create function public.uji_s55a_gagal() returns trigger language plpgsql as $f$
  begin
    if old.lapak_id = '00000000-0000-0000-0000-000000055a23' then
      raise exception 'Uji gagal di tengah';
    end if;
    return old;
  end;
  $f$;
  create trigger uji_s55a_gagal before delete on public.pengikut
    for each row execute function public.uji_s55a_gagal();

  v_n := pg_temp.jalan(v_p3, format('select public.tutup_lapak_saya(%L, %L)', v_t3, 'TUTUP'));

  drop trigger uji_s55a_gagal on public.pengikut;
  drop function public.uji_s55a_gagal();

  insert into hasil_uji (uji, lulus, catatan)
  select 'H7 Gagal di tengah: lapak, usaha, tempat, pengikut, dan sesi berjalan T3 utuh; slug tidak dicadangkan',
         v_n like 'Uji gagal di tengah%'
         and exists (select 1 from public.lapak where id = v_t3)
         and exists (select 1 from public.usaha where id = v_u3)
         and (select count(*) from public.tempat where lapak_id = v_t3) = 1
         and (select count(*) from public.pengikut where lapak_id = v_t3) = 2
         and exists (select 1 from public.sesi_buka where lapak_id = v_t3 and diakhiri_pada is null)
         and not exists (select 1 from public.slug_dicadangkan where slug = 'uji-s55a-tiga'),
         v_n;

  -- ==========================================================
  -- Tutup lapak (A29)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'H8 Pemilik P1 menutup T1 dengan TUTUP: berhasil',
         pg_temp.jalan(v_p1, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP')) = 'OK',
         'tutup T1';

  insert into hasil_uji (uji, lulus, catatan)
  select 'H9 T1: lapak, usaha, tempat, jadwal, foto, sesi, dan pengikut terhapus',
         not exists (select 1 from public.lapak where id = v_t1)
         and not exists (select 1 from public.usaha where id = v_u1)
         and not exists (select 1 from public.tempat where lapak_id = v_t1)
         and not exists (select 1 from public.jadwal where lapak_id = v_t1)
         and not exists (select 1 from public.foto_lapak where lapak_id = v_t1)
         and not exists (select 1 from public.sesi_buka where lapak_id = v_t1)
         and not exists (select 1 from public.pengikut where lapak_id = v_t1),
         'sisa pengikut T1: ' || (select count(*) from public.pengikut where lapak_id = v_t1);

  insert into hasil_uji (uji, lulus, catatan)
  select 'H10 Akun, profil, dan daftar Diikuti P1 tetap ada',
         exists (select 1 from auth.users where id = v_p1)
         and exists (select 1 from public.profil where id = v_p1)
         and exists (select 1 from public.pengikut where pelanggan_id = v_p1 and lapak_id = v_t2),
         'pengikut P1: ' || (select count(*) from public.pengikut where pelanggan_id = v_p1);

  insert into hasil_uji (uji, lulus, catatan)
  select 'H11 Slug T1 dicadangkan dan tidak ada lagi di lapak_publik (link membuka V27)',
         exists (select 1 from public.slug_dicadangkan where slug = 'uji-s55a-satu')
         and not exists (select 1 from public.lapak where slug = 'uji-s55a-satu')
         and pg_temp.nilai(v_q, 'select count(*)::text from public.lapak_publik where slug = ''uji-s55a-satu''') = '0',
         'cadangan: ' || (select count(*) from public.slug_dicadangkan where slug = 'uji-s55a-satu');

  v_n := pg_temp.nilai(v_p4, 'select public.tayangkan_lapak()');
  insert into hasil_uji (uji, lulus, catatan)
  values ('H12 Lapak baru bernama sama mendapat slug lain (uji-s55a-satu-2), bukan slug yang dicadangkan',
          v_n = 'uji-s55a-satu-2', v_n);

  insert into hasil_uji (uji, lulus, catatan)
  select 'H13 Pemilik yang lapaknya sudah ditutup: menutup lagi ditolak',
         pg_temp.jalan(v_p1, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP')) like 'Lapak tidak ditemukan%',
         pg_temp.jalan(v_p1, format('select public.tutup_lapak_saya(%L, %L)', v_t1, 'TUTUP'));

  -- ==========================================================
  -- Hapus akun (A28)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'H14 Pelanggan Q (pelapor) menghapus akun dengan HAPUS: berhasil',
         pg_temp.jalan(v_q, 'select public.hapus_akun_saya(''HAPUS'')') = 'OK',
         'hapus Q';

  insert into hasil_uji (uji, lulus, catatan)
  select 'H15 Q: akun, profil, dan semua pengikutnya terhapus; laporannya tetap tanpa nama',
         not exists (select 1 from auth.users where id = v_q)
         and not exists (select 1 from public.profil where id = v_q)
         and not exists (select 1 from public.pengikut where pelanggan_id = v_q)
         and exists (select 1 from public.laporan where id = v_lq and pelapor_id is null),
         'laporan Q: ' || coalesce((select coalesce(pelapor_id::text, 'tanpa nama') from public.laporan where id = v_lq), 'hilang');

  insert into hasil_uji (uji, lulus, catatan)
  select 'H16 Pemilik P2 menghapus akun: berhasil',
         pg_temp.jalan(v_p2, 'select public.hapus_akun_saya(''HAPUS'')') = 'OK',
         'hapus P2';

  insert into hasil_uji (uji, lulus, catatan)
  select 'H17 P2: lapak T2 ikut ditutup (slug dicadangkan, pengikut dan laporan tentang T2 terhapus), akun terhapus',
         not exists (select 1 from auth.users where id = v_p2)
         and not exists (select 1 from public.lapak where id = v_t2)
         and not exists (select 1 from public.usaha where id = v_u2)
         and not exists (select 1 from public.pengikut where lapak_id = v_t2)
         and not exists (select 1 from public.laporan where id = v_lr)
         and exists (select 1 from public.slug_dicadangkan where slug = 'uji-s55a-dua'),
         'cadangan dua: ' || (select count(*) from public.slug_dicadangkan where slug = 'uji-s55a-dua');

  -- Panggilan dipisah dulu: urutan evaluasi "and" di SQL tidak dijamin
  v_n := pg_temp.jalan(v_a, 'select public.hapus_akun_saya(''HAPUS'')');
  insert into hasil_uji (uji, lulus, catatan)
  select 'H18 Admin A menghapus akunnya sendiri: berhasil, riwayat tindakannya tetap tanpa nama',
         v_n = 'OK'
         and not exists (select 1 from public.profil where id = v_a)
         and exists (select 1 from public.tindakan_admin where id = v_ta and admin_id is null),
         'riwayat A: ' || coalesce((select coalesce(admin_id::text, 'tanpa nama') from public.tindakan_admin where id = v_ta), 'hilang');

  insert into hasil_uji (uji, lulus, catatan)
  select 'H19 Akun lain tidak tersentuh: R, P1, P3, P4 dan lapak T3, D4 tetap; pengikut R di T3 tetap; sesi T3 masih berjalan',
         (select count(*) from auth.users where id in (v_r, v_p1, v_p3, v_p4)) = 4
         and (select count(*) from public.profil where id in (v_r, v_p1, v_p3, v_p4)) = 4
         and (select count(*) from public.lapak where id in (v_t3, v_d4)) = 2
         and exists (select 1 from public.pengikut where pelanggan_id = v_r and lapak_id = v_t3)
         and exists (select 1 from public.sesi_buka where lapak_id = v_t3 and diakhiri_pada is null),
         'akun tersisa: ' || (select count(*) from auth.users where id = any(v_akun));

  -- ==========================================================
  -- Bersihkan data uji (hanya id tetap di atas)
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.slug_dicadangkan where slug in ('uji-s55a-satu', 'uji-s55a-dua', 'uji-s55a-tiga', 'uji-s55a-satu-2');
  delete from public.tindakan_admin where id = v_ta or lapak_id = any(v_semua);
  delete from public.laporan where id in (v_lq, v_lr) or lapak_id = any(v_semua);
  delete from public.usaha where id in (v_u1, v_u2, v_u3, v_u4);
  delete from auth.users where id = any(v_akun);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
