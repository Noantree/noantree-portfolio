-- s5_4_uji.sql
-- Uji S5.4 bagian 1 (PRD A46, A47; V18) untuk 022_admin_dilaporkan.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 022 dijalankan.
--
-- Cara kerja sama dengan s5_2_uji.sql:
--   - Akun, lapak, dan laporan uji memakai id tetap, lalu dihapus lagi di akhir.
--   - Pelanggan, pemilik, admin, dan tamu ditiru dengan request.jwt.claims dan "set local role authenticated",
--     jadi hak fungsi dan RLS berlaku seperti dari aplikasi.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Satu akun hanya boleh punya satu lapak (lapak_satu_per_pemilik, 011), jadi setiap lapak punya pemilik sendiri.
--   L1 (pemilik P1, tayang)        : 2 baru "Status tidak sesuai", 1 diabaikan "Tempat salah"
--   L2 (pemilik P2, tayang)        : 1 baru "Konten tidak pantas" (lama), 2 diabaikan "Lainnya"
--   L5 (pemilik P5, tayang)        : 1 baru "Tempat salah" (lebih baru dari laporan baru L2)
--   L3 (pemilik P3, disembunyikan) : 2 ditindak "Lapak tidak ada / akun iseng"
--   L4 (pemilik P4, tayang)        : tanpa laporan
-- Pelapor: pelanggan Q, R, S. A adalah admin. Laporan uji ditulis langsung sebagai postgres,
-- supaya status dan waktunya bisa diatur; lapor_lapak sudah diuji di s5_2_uji.sql.

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

-- Jejak isi tabel laporan dan lapak uji, untuk memastikan fungsi tidak menulis apa pun
create or replace function pg_temp.jejak(p_lapak uuid[]) returns text
language sql as $$
  select coalesce((select md5(string_agg(r::text, '|' order by r.id)) from public.laporan r where r.lapak_id = any(p_lapak)), '-')
      || coalesce((select md5(string_agg(l::text, '|' order by l.id)) from public.lapak l where l.id = any(p_lapak)), '-')
      || (select count(*)::text from public.tindakan_admin t where t.lapak_id = any(p_lapak));
$$;

do $$
declare
  v_a   uuid := '00000000-0000-0000-0000-0000000054a1';
  v_q   uuid := '00000000-0000-0000-0000-0000000054b1';
  v_r   uuid := '00000000-0000-0000-0000-0000000054c1';
  v_s   uuid := '00000000-0000-0000-0000-0000000054d1';
  v_p1  uuid := '00000000-0000-0000-0000-000000005411';
  v_p2  uuid := '00000000-0000-0000-0000-000000005412';
  v_p3  uuid := '00000000-0000-0000-0000-000000005413';
  v_p4  uuid := '00000000-0000-0000-0000-000000005414';
  v_p5  uuid := '00000000-0000-0000-0000-000000005415';
  v_l1  uuid := '00000000-0000-0000-0000-000000005421';
  v_l2  uuid := '00000000-0000-0000-0000-000000005422';
  v_l3  uuid := '00000000-0000-0000-0000-000000005423';
  v_l4  uuid := '00000000-0000-0000-0000-000000005424';
  v_l5  uuid := '00000000-0000-0000-0000-000000005425';
  v_semua uuid[];
  v_daftar text;
  v_sebelum text;
  v_n   text;
begin
  v_semua := array[v_l1, v_l2, v_l3, v_l4, v_l5];
  -- Daftar admin yang dibatasi ke lapak uji (basis data mungkin sudah berisi laporan lain)
  v_daftar := format(
    'from public.admin_daftar_dilaporkan() with ordinality as d(lapak_id, slug, nama, foto_url, status_tayang, '
    || 'laporan_aktif, laporan_total, alasan_terbanyak, laporan_baru_terakhir, n) where d.lapak_id = any(%L::uuid[])',
    v_semua);

  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-a@contoh.invalid'),
    (v_q,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-q@contoh.invalid'),
    (v_r,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-r@contoh.invalid'),
    (v_s,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-s@contoh.invalid'),
    (v_p1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-p1@contoh.invalid'),
    (v_p2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-p2@contoh.invalid'),
    (v_p3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-p3@contoh.invalid'),
    (v_p4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-p4@contoh.invalid'),
    (v_p5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji54-p5@contoh.invalid');
  update public.profil set nama_tampilan = 'Uji54 A', is_admin = true where id = v_a;

  insert into public.usaha (id, pemilik_id, nama) values
    ('00000000-0000-0000-0000-000000005431', v_p1, 'Uji54 P1'),
    ('00000000-0000-0000-0000-000000005432', v_p2, 'Uji54 P2'),
    ('00000000-0000-0000-0000-000000005433', v_p3, 'Uji54 P3'),
    ('00000000-0000-0000-0000-000000005434', v_p4, 'Uji54 P4'),
    ('00000000-0000-0000-0000-000000005435', v_p5, 'Uji54 P5');
  insert into public.lapak (id, usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada) values
    (v_l1, '00000000-0000-0000-0000-000000005431', v_p1, 'Uji54 L1', 'uji-s54-l1', 'tayang', 3, now()),
    (v_l2, '00000000-0000-0000-0000-000000005432', v_p2, 'Uji54 L2', 'uji-s54-l2', 'tayang', 3, now()),
    (v_l3, '00000000-0000-0000-0000-000000005433', v_p3, 'Uji54 L3', 'uji-s54-l3', 'disembunyikan', 3, now()),
    (v_l4, '00000000-0000-0000-0000-000000005434', v_p4, 'Uji54 L4', 'uji-s54-l4', 'tayang', 3, now()),
    (v_l5, '00000000-0000-0000-0000-000000005435', v_p5, 'Uji54 L5', 'uji-s54-l5', 'tayang', 3, now());

  insert into public.laporan (lapak_id, pelapor_id, alasan, catatan, status, dibuat_pada, pernyataan_pada) values
    (v_l1, v_q, 'Status tidak sesuai',          null,              'baru',      now() - interval '1 hour',  now() - interval '1 hour'),
    (v_l1, v_r, 'Status tidak sesuai',          'Tutup jam 10',    'baru',      now() - interval '2 hours', now() - interval '2 hours'),
    (v_l1, v_s, 'Tempat salah',                 null,              'diabaikan', now() - interval '3 days',  now() - interval '3 days'),
    (v_l2, v_q, 'Konten tidak pantas',          null,              'baru',      now() - interval '5 days',  now() - interval '5 days'),
    (v_l2, v_r, 'Lainnya',                      null,              'diabaikan', now() - interval '6 days',  now() - interval '6 days'),
    (v_l2, v_s, 'Lainnya',                      null,              'diabaikan', now() - interval '7 days',  now() - interval '7 days'),
    (v_l5, v_q, 'Tempat salah',                 null,              'baru',      now() - interval '1 day',   now() - interval '1 day'),
    (v_l3, v_q, 'Lapak tidak ada / akun iseng', null,              'ditindak',  now() - interval '9 days',  now() - interval '9 days'),
    (v_l3, v_r, 'Lapak tidak ada / akun iseng', null,              'ditindak',  now() - interval '10 days', now() - interval '10 days');

  v_sebelum := pg_temp.jejak(v_semua);

  -- ==========================================================
  -- Hak akses (A46: hanya admin)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  select 'D1 Pelanggan memanggil admin_daftar_dilaporkan: ditolak',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_dilaporkan()') like 'Hanya admin%',
         pg_temp.jalan(v_q, 'select * from public.admin_daftar_dilaporkan()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'D2 Pemilik lapak (bukan admin) memanggil: ditolak',
         pg_temp.jalan(v_p1, 'select * from public.admin_daftar_dilaporkan()') like 'Hanya admin%',
         pg_temp.jalan(v_p1, 'select * from public.admin_daftar_dilaporkan()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'D3 Tamu (authenticated tanpa sub) memanggil: ditolak',
         pg_temp.jalan(null, 'select * from public.admin_daftar_dilaporkan()') like 'Hanya admin%',
         pg_temp.jalan(null, 'select * from public.admin_daftar_dilaporkan()');

  insert into hasil_uji (uji, lulus, catatan)
  select 'D4 Peran anon tidak punya hak execute; authenticated punya',
         not has_function_privilege('anon', 'public.admin_daftar_dilaporkan()', 'execute')
         and has_function_privilege('authenticated', 'public.admin_daftar_dilaporkan()', 'execute'),
         'anon ' || has_function_privilege('anon', 'public.admin_daftar_dilaporkan()', 'execute')::text;

  -- ==========================================================
  -- Isi daftar
  -- ==========================================================
  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.nama) ' || v_daftar);
  insert into hasil_uji (uji, lulus, catatan)
  values ('D5 Lapak dengan laporan muncul (L1, L2, L3 disembunyikan, L5)', v_n = 'Uji54 L1,Uji54 L2,Uji54 L3,Uji54 L5', v_n);

  v_n := pg_temp.nilai(v_a, format('select count(*)::text ' || v_daftar || ' and d.lapak_id = %L', v_l4));
  insert into hasil_uji (uji, lulus, catatan)
  values ('D6 Lapak tanpa laporan (L4) tidak muncul', v_n = '0', 'baris L4: ' || v_n);

  v_n := pg_temp.nilai(v_a, 'select string_agg(d.nama, '','' order by d.n) ' || v_daftar);
  insert into hasil_uji (uji, lulus, catatan)
  values ('D7 Urutan: laporan aktif terbanyak di atas; seri dipecah laporan baru terbaru (L1, L5, L2, L3)',
          v_n = 'Uji54 L1,Uji54 L5,Uji54 L2,Uji54 L3', v_n);

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.laporan_aktif, d.laporan_total, d.alasan_terbanyak, d.status_tayang) ' || v_daftar || ' and d.lapak_id = %L', v_l1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('D8 L1: aktif 2, total 3, alasan terbanyak Status tidak sesuai', v_n = '2/3/Status tidak sesuai/tayang', v_n);

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.laporan_aktif, d.laporan_total, d.alasan_terbanyak) ' || v_daftar || ' and d.lapak_id = %L', v_l2));
  insert into hasil_uji (uji, lulus, catatan)
  values ('D9 L2: aktif 1, total 3, alasan terbanyak dihitung dari laporan baru (Konten tidak pantas)',
          v_n = '1/3/Konten tidak pantas', v_n);

  v_n := pg_temp.nilai(v_a, format('select concat_ws(''/'', d.laporan_aktif, d.laporan_total, d.alasan_terbanyak, d.status_tayang, coalesce(d.laporan_baru_terakhir::text, ''kosong'')) ' || v_daftar || ' and d.lapak_id = %L', v_l3));
  insert into hasil_uji (uji, lulus, catatan)
  values ('D10 L3 disembunyikan: aktif 0, total 2, alasan dari semua laporan, waktu laporan baru kosong',
          v_n = '0/2/Lapak tidak ada / akun iseng/disembunyikan/kosong', v_n);

  -- Nilai pembanding dihitung sebagai postgres: peran authenticated memang tidak boleh membaca tabel laporan langsung.
  v_n := pg_temp.nilai(v_a, format('select d.laporan_baru_terakhir::text ' || v_daftar || ' and d.lapak_id = %L', v_l1));
  insert into hasil_uji (uji, lulus, catatan)
  values ('D11 L1: waktu laporan baru terakhir = laporan baru paling baru',
          v_n = (select max(r.dibuat_pada)::text from public.laporan r where r.lapak_id = v_l1 and r.status = 'baru'),
          v_n);

  -- ==========================================================
  -- Hanya baca (A47: laporan tidak pernah dihapus; fungsi ini tidak menulis apa pun)
  -- ==========================================================
  insert into hasil_uji (uji, lulus, catatan)
  values ('D12 Tabel laporan, lapak, dan tindakan_admin tidak berubah setelah semua query di atas',
          pg_temp.jejak(v_semua) = v_sebelum, 'sebelum ' || v_sebelum || ', sesudah ' || pg_temp.jejak(v_semua));

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
