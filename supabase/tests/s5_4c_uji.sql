-- s5_4c_uji.sql
-- Uji S5.4 bagian 3a (PRD A9, A47, A48; V17) untuk 024_info_disembunyikan_pemilik.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 024 dijalankan.
--
-- Cara kerja sama dengan s5_4b_uji.sql:
--   - Akun, lapak, laporan, dan riwayat uji memakai id tetap, lalu dihapus lagi di akhir.
--   - Pemilik, pelanggan, admin, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Nilai pembanding yang membaca tabel laporan atau tindakan_admin dihitung sebagai postgres,
--     di luar pg_temp.nilai(). Peran authenticated memang tidak boleh membaca tabel laporan langsung.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   T  (pemilik P1, tayang)         : tanpa laporan
--   H1 (pemilik P2, disembunyikan)  : riwayat sembunyikan lama dan terbaru (catatan terbaru "Catatan rahasia admin");
--                                     laporan ditindak 2x Tempat salah dan 1x Lainnya;
--                                     laporan diabaikan 2x Konten tidak pantas; laporan baru 1x Konten tidak pantas
--   H2 (pemilik P3, disembunyikan)  : tanpa riwayat tindakan dan tanpa laporan
--   H3 (pemilik P4, disembunyikan)  : laporan ditindak seri 1x Lainnya (lama) dan 1x Tempat salah (baru)
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
      || coalesce((select md5(string_agg(t::text, '|' order by t.id)) from public.tindakan_admin t where t.lapak_id = any(p_lapak)), '-');
$$;

do $$
declare
  v_a   uuid := '00000000-0000-0000-0000-00000054c0a1';
  v_q   uuid := '00000000-0000-0000-0000-00000054c0b1';
  v_r   uuid := '00000000-0000-0000-0000-00000054c0c1';
  v_s   uuid := '00000000-0000-0000-0000-00000054c0d1';
  v_p1  uuid := '00000000-0000-0000-0000-00000054c011';
  v_p2  uuid := '00000000-0000-0000-0000-00000054c012';
  v_p3  uuid := '00000000-0000-0000-0000-00000054c013';
  v_p4  uuid := '00000000-0000-0000-0000-00000054c014';
  v_t   uuid := '00000000-0000-0000-0000-00000054c021';
  v_h1  uuid := '00000000-0000-0000-0000-00000054c022';
  v_h2  uuid := '00000000-0000-0000-0000-00000054c023';
  v_h3  uuid := '00000000-0000-0000-0000-00000054c024';
  v_semua uuid[];
  v_sebelum text;
  v_harap text;
  v_n   text;
begin
  v_semua := array[v_t, v_h1, v_h2, v_h3];

  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-a@contoh.invalid'),
    (v_q,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-q@contoh.invalid'),
    (v_r,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-r@contoh.invalid'),
    (v_s,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-s@contoh.invalid'),
    (v_p1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-p1@contoh.invalid'),
    (v_p2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-p2@contoh.invalid'),
    (v_p3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-p3@contoh.invalid'),
    (v_p4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54c-p4@contoh.invalid');
  update public.profil set nama_tampilan = 'Uji54c A', is_admin = true where id = v_a;

  insert into public.usaha (id, pemilik_id, nama) values
    ('00000000-0000-0000-0000-00000054c031', v_p1, 'Uji54c P1'),
    ('00000000-0000-0000-0000-00000054c032', v_p2, 'Uji54c P2'),
    ('00000000-0000-0000-0000-00000054c033', v_p3, 'Uji54c P3'),
    ('00000000-0000-0000-0000-00000054c034', v_p4, 'Uji54c P4');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_t,  '00000000-0000-0000-0000-00000054c031', v_p1, 'Uji54c Tayang',    'uji-s54c-t',  'tayang',        3, now()),
    (v_h1, '00000000-0000-0000-0000-00000054c032', v_p2, 'Uji54c Hilang Satu', 'uji-s54c-h1', 'disembunyikan', 3, now()),
    (v_h2, '00000000-0000-0000-0000-00000054c033', v_p3, 'Uji54c Hilang Dua',  'uji-s54c-h2', 'disembunyikan', 3, now()),
    (v_h3, '00000000-0000-0000-0000-00000054c034', v_p4, 'Uji54c Hilang Tiga', 'uji-s54c-h3', 'disembunyikan', 3, now());

  insert into public.tindakan_admin (lapak_id, admin_id, aksi, catatan, dibuat_pada) values
    (v_h1, v_a, 'sembunyikan', 'Catatan lama',          now() - interval '2 days'),
    (v_h1, v_a, 'tampilkan',   null,                    now() - interval '36 hours'),
    (v_h1, v_a, 'sembunyikan', 'Catatan rahasia admin', now() - interval '1 hour');

  insert into public.laporan (lapak_id, pelapor_id, alasan, status, dibuat_pada, pernyataan_pada) values
    (v_h1, v_q, 'Tempat salah',        'ditindak',  now() - interval '3 hours', now() - interval '3 hours'),
    (v_h1, v_r, 'Tempat salah',        'ditindak',  now() - interval '4 hours', now() - interval '4 hours'),
    (v_h1, v_s, 'Lainnya',             'ditindak',  now() - interval '2 hours', now() - interval '2 hours'),
    (v_h1, v_q, 'Konten tidak pantas', 'diabaikan', now() - interval '3 days',  now() - interval '3 days'),
    (v_h1, v_r, 'Konten tidak pantas', 'diabaikan', now() - interval '3 days',  now() - interval '3 days'),
    (v_h1, v_s, 'Konten tidak pantas', 'baru',      now() - interval '30 minutes', now() - interval '30 minutes'),
    (v_h3, v_q, 'Lainnya',             'ditindak',  now() - interval '5 hours', now() - interval '5 hours'),
    (v_h3, v_r, 'Tempat salah',        'ditindak',  now() - interval '1 hour',  now() - interval '1 hour');

  v_sebelum := pg_temp.jejak(v_semua);

  -- ==========================================================
  -- Hak akses (hanya pemilik lapak itu sendiri)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'C1 Tamu memanggil pemilik_info_disembunyikan: ditolak',
         pg_temp.jalan(null, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(null, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'C2 Pelanggan (bukan pemilik) memanggil: ditolak',
         pg_temp.jalan(v_q, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(v_q, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'C3 Pemilik lapak lain memanggil untuk lapak H1: ditolak',
         pg_temp.jalan(v_p1, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(v_p1, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'C4 Admin yang bukan pemilik memanggil: ditolak (admin memakai fungsi admin)',
         pg_temp.jalan(v_a, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1)) like 'Bukan pemilik lapak ini%',
         pg_temp.jalan(v_a, format('select * from public.pemilik_info_disembunyikan(%L)', v_h1));

  insert into hasil_uji (uji, lulus, catatan)
  select 'C5 Peran anon tidak punya hak execute; authenticated punya',
         not has_function_privilege('anon', 'public.pemilik_info_disembunyikan(uuid)', 'execute')
         and has_function_privilege('authenticated', 'public.pemilik_info_disembunyikan(uuid)', 'execute'),
         'anon ' || has_function_privilege('anon', 'public.pemilik_info_disembunyikan(uuid)', 'execute')::text;

  -- ==========================================================
  -- Isi hasil untuk pemilik
  -- ==========================================================
  v_n := pg_temp.nilai(v_p1, format('select count(*)::text from public.pemilik_info_disembunyikan(%L)', v_t));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C6 Pemilik lapak tayang: tidak ada baris', v_n = '0', 'baris: ' || v_n);

  v_harap := (select t.dibuat_pada::text from public.tindakan_admin t
               where t.lapak_id = v_h1 and t.aksi = 'sembunyikan' order by t.dibuat_pada desc limit 1)
             || '|Tempat salah';
  v_n := pg_temp.nilai(v_p2, format('select concat_ws(''|'', d.disembunyikan_pada::text, d.alasan) from public.pemilik_info_disembunyikan(%L) d', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C7 Pemilik H1: waktu sembunyikan terakhir dan alasan terbanyak (Tempat salah)', v_n = v_harap, v_n);

  v_n := pg_temp.nilai(v_p2, format('select count(*)::text from public.pemilik_info_disembunyikan(%L)', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C8 Pemilik H1: tepat satu baris', v_n = '1', 'baris: ' || v_n);

  v_n := pg_temp.nilai(v_p2, format('select d.alasan from public.pemilik_info_disembunyikan(%L) d', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C9 Alasan hanya dari laporan ditindak (3 laporan diabaikan dan baru Konten tidak pantas tidak ikut)',
          v_n = 'Tempat salah', v_n);

  v_n := pg_temp.nilai(v_p4, format('select d.alasan from public.pemilik_info_disembunyikan(%L) d', v_h3));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C10 Seri alasan dipecah oleh laporan terbaru (H3: Tempat salah, bukan Lainnya)', v_n = 'Tempat salah', v_n);

  v_n := pg_temp.nilai(v_p3, format('select count(*)::text || ''/'' || coalesce(bool_and(d.disembunyikan_pada is null and d.alasan is null)::text, ''-'') from public.pemilik_info_disembunyikan(%L) d', v_h2));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C11 Pemilik H2 (disembunyikan tanpa riwayat dan laporan): satu baris, waktu dan alasan kosong', v_n = '1/true', v_n);

  -- ==========================================================
  -- Tidak membocorkan data pelapor atau catatan admin
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'C12 Kolom hasil tidak memuat pelapor, email, catatan, jumlah, atau id laporan',
         pg_get_function_result('public.pemilik_info_disembunyikan(uuid)'::regprocedure) !~* 'pelapor|email|catatan|jumlah|laporan_id|admin',
         pg_get_function_result('public.pemilik_info_disembunyikan(uuid)'::regprocedure);

  v_n := pg_temp.nilai(v_p2, format('select count(*)::text from public.laporan where lapak_id = %L', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C13 Pemilik tidak bisa membaca tabel laporan langsung (ditolak atau 0 baris)',
          v_n = '0' or v_n like 'ERR: permission denied%', v_n);

  v_n := pg_temp.nilai(v_p2, format('select count(*)::text from public.tindakan_admin where lapak_id = %L', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C14 Pemilik tidak bisa membaca riwayat tindakan admin langsung (ditolak atau 0 baris)',
          v_n = '0' or v_n like 'ERR: permission denied%', v_n);

  -- ==========================================================
  -- A9: lapak disembunyikan tidak bisa Mulai buka
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'C15 Pemilik H1 menekan Mulai buka saat disembunyikan: ditolak (A9)',
         pg_temp.jalan(v_p2, format('select public.mulai_buka(%L)', v_h1)) like 'Lapakmu sedang disembunyikan%',
         pg_temp.jalan(v_p2, format('select public.mulai_buka(%L)', v_h1));

  -- ==========================================================
  -- Hanya baca
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  values ('C16 Tabel lapak, laporan, dan tindakan_admin tidak berubah setelah semua panggilan di atas',
          pg_temp.jejak(v_semua) = v_sebelum, 'sebelum ' || v_sebelum || ', sesudah ' || pg_temp.jejak(v_semua));

  -- ==========================================================
  -- Setelah Tampilkan lagi, V17 tidak muncul lagi
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'C17 Admin menampilkan lagi H1: berhasil',
         pg_temp.jalan(v_a, format('select public.admin_tindak_lapak(%L,%L,null,null)', v_h1, 'tampilkan')) = 'OK',
         'aksi tampilkan';

  v_n := pg_temp.nilai(v_p2, format('select count(*)::text from public.pemilik_info_disembunyikan(%L)', v_h1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('C18 Setelah Tampilkan lagi: pemilik H1 tidak mendapat baris (lapak tayang)', v_n = '0', 'baris: ' || v_n);

  -- ==========================================================
  -- Bersihkan data uji
  -- ==========================================================
  perform set_config('request.jwt.claims', '', true);
  delete from public.tindakan_admin where lapak_id = any(v_semua);
  delete from public.laporan where lapak_id = any(v_semua);
  delete from public.lapak where id = any(v_semua);
  delete from auth.users where id in (v_a, v_q, v_r, v_s, v_p1, v_p2, v_p3, v_p4);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
