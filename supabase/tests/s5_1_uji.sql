-- s5_1_uji.sql
-- Uji S5.1 (PRD bagian 10, Sprint 5 butir pertama) untuk 020_ikuti.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 020 dijalankan.
--
-- Cara kerja sama dengan uji sebelumnya:
--   - Akun dan lapak uji dibuat lalu dihapus lagi di akhir (on delete cascade). Profil dibuat trigger 005.
--   - Pengguna yang masuk ditiru dengan request.jwt.claims dan "set local role authenticated", jadi hak tabel
--     dan RLS berlaku seperti dari aplikasi atau konsol browser. Tamu ditiru dengan role anon.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Pemilik P punya lapak T (tayang). Pemilik Q punya lapak D (draf), pemilik R punya lapak E (disembunyikan).
-- C1 dan C2 pelanggan tanpa lapak.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

do $$
declare
  v_p     uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_r     uuid := gen_random_uuid();
  v_c1    uuid := gen_random_uuid();
  v_c2    uuid := gen_random_uuid();
  v_usaha uuid;
  v_t     uuid;
  v_d     uuid;
  v_e     uuid;
  v_n     int;
  v_m     int;
  v_teks  text;
  v_teks2 text;
begin
  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s51-' || n || '@contoh.invalid'
  from (values (v_p, 'p'), (v_q, 'q'), (v_r, 'r'), (v_c1, 'c1'), (v_c2, 'c2')) x(u, n);

  insert into public.usaha (pemilik_id, nama) values (v_p, 'Uji P') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_p, 'Uji T', 'uji-s51-t-' || substr(v_p::text, 1, 8), 'tayang', 3, now()) returning id into v_t;
  insert into public.usaha (pemilik_id, nama) values (v_q, 'Uji Q') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar)
  values (v_usaha, v_q, 'Uji D', 'uji-s51-d-' || substr(v_q::text, 1, 8), 'draf', 2) returning id into v_d;
  insert into public.usaha (pemilik_id, nama) values (v_r, 'Uji R') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_r, 'Uji E', 'uji-s51-e-' || substr(v_r::text, 1, 8), 'disembunyikan', 3, now()) returning id into v_e;

  -- I1: pelanggan mengikuti lapak tayang; panggilan kedua tidak menambah baris; jumlah_pengikut naik
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.ikuti_lapak(v_t);
    perform public.ikuti_lapak(v_t);
    execute 'reset role';
    select count(*) into v_n from public.pengikut where pelanggan_id = v_c1 and lapak_id = v_t;
    select jumlah_pengikut into v_m from public.lapak_publik where id = v_t;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I1 Pelanggan mengikuti lapak tayang, dua kali tetap 1 baris; jumlah_pengikut 1',
      v_n = 1 and v_m = 1, 'baris ' || v_n || ', jumlah_pengikut ' || v_m);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I1 Ikuti lapak tayang', false, sqlerrm);
  end;

  -- I2: pemilik tidak bisa mengikuti lapaknya sendiri lewat fungsi
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.ikuti_lapak(v_t);
      v_teks := 'berhasil';
    exception when others then
      v_teks := sqlerrm;
    end;
    execute 'reset role';
    select count(*) into v_n from public.pengikut where pelanggan_id = v_p;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I2 Pemilik memanggil ikuti_lapak untuk lapak sendiri: ditolak',
      v_teks like 'Pemilik tidak bisa mengikuti%' and v_n = 0, v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I2 Ikuti lapak sendiri lewat fungsi', false, sqlerrm);
  end;

  -- I3: pemilik insert langsung ke pengikut (seperti dari konsol browser): ditolak.
  --     Pengaman kedua: insert sebagai postgres pun ditolak trigger ikuti_lapak_sendiri.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      insert into public.pengikut (pelanggan_id, lapak_id) values (v_p, v_t);
      v_teks := 'berhasil';
    exception when insufficient_privilege then
      v_teks := 'ditolak (hak tabel)';
    when others then
      v_teks := 'ditolak (' || sqlerrm || ')';
    end;
    execute 'reset role';
    begin
      insert into public.pengikut (pelanggan_id, lapak_id) values (v_p, v_t);
      v_teks2 := 'berhasil';
    exception when others then
      v_teks2 := 'ditolak (' || sqlerrm || ')';
    end;
    select count(*) into v_n from public.pengikut where pelanggan_id = v_p;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I3 Pemilik insert langsung ke pengikut: ditolak; trigger juga menolak sebagai postgres',
      v_teks like 'ditolak%' and v_teks2 like 'ditolak%Pemilik tidak bisa%' and v_n = 0,
      'konsol: ' || v_teks || '; postgres: ' || v_teks2);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I3 Insert langsung pemilik', false, sqlerrm);
  end;

  -- I4: pelanggan tidak bisa insert atau delete langsung; tulis hanya lewat fungsi
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      insert into public.pengikut (pelanggan_id, lapak_id) values (v_c2, v_t);
      v_teks := 'insert berhasil';
    exception when insufficient_privilege then
      v_teks := 'insert ditolak';
    end;
    begin
      delete from public.pengikut where lapak_id = v_t;
      v_teks := v_teks || ', delete berhasil';
    exception when insufficient_privilege then
      v_teks := v_teks || ', delete ditolak';
    end;
    execute 'reset role';
    select count(*) into v_n from public.pengikut where lapak_id = v_t;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I4 Pelanggan insert dan delete langsung ke pengikut: ditolak (baris C1 tetap)',
      v_teks = 'insert ditolak, delete ditolak' and v_n = 1, v_teks || '; baris T ' || v_n);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I4 Tulis langsung pelanggan', false, sqlerrm);
  end;

  -- I5: mengikuti lapak draf atau disembunyikan ditolak
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.ikuti_lapak(v_d);
      v_teks := 'draf berhasil';
    exception when others then
      v_teks := 'draf: ' || sqlerrm;
    end;
    begin
      perform public.ikuti_lapak(v_e);
      v_teks := v_teks || ' / disembunyikan berhasil';
    exception when others then
      v_teks := v_teks || ' / disembunyikan: ' || sqlerrm;
    end;
    execute 'reset role';
    select count(*) into v_n from public.pengikut where lapak_id in (v_d, v_e);
    insert into hasil_uji (uji, lulus, catatan) values (
      'I5 Ikuti lapak draf dan disembunyikan: ditolak',
      v_teks = 'draf: Lapak tidak tersedia / disembunyikan: Lapak tidak tersedia' and v_n = 0, v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I5 Draf dan disembunyikan', false, sqlerrm);
  end;

  -- I6: tamu (anon) tidak bisa memanggil fungsi ikuti dan tidak bisa membaca pengikut
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    execute 'set local role anon';
    begin
      perform public.ikuti_lapak(v_t);
      v_teks := 'ikuti terbuka';
    exception when insufficient_privilege then
      v_teks := 'ikuti ditolak';
    end;
    begin
      perform public.berhenti_ikuti(v_t);
      v_teks := v_teks || ', berhenti terbuka';
    exception when insufficient_privilege then
      v_teks := v_teks || ', berhenti ditolak';
    end;
    begin
      select count(*) into v_n from public.pengikut;
      v_teks := v_teks || ', baca terbuka';
    exception when insufficient_privilege then
      v_teks := v_teks || ', baca ditolak';
    end;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'I6 Tamu: ikuti_lapak, berhenti_ikuti, dan baca pengikut ditolak',
      v_teks = 'ikuti ditolak, berhenti ditolak, baca ditolak', v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I6 Hak tamu', false, sqlerrm);
  end;

  -- I7: berhenti_ikuti menghapus baris sendiri, dua kali tanpa galat; jumlah_pengikut turun
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.berhenti_ikuti(v_t);
    perform public.berhenti_ikuti(v_t);
    execute 'reset role';
    select count(*) into v_n from public.pengikut where pelanggan_id = v_c1;
    select jumlah_pengikut into v_m from public.lapak_publik where id = v_t;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I7 Berhenti mengikuti, dua kali tanpa galat; jumlah_pengikut 0',
      v_n = 0 and v_m = 0, 'baris ' || v_n || ', jumlah_pengikut ' || v_m);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I7 Berhenti mengikuti', false, sqlerrm);
  end;

  -- I8: C2 tidak bisa melihat atau menghapus baris pengikut milik C1
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.ikuti_lapak(v_t);
    select count(*) into v_m from public.pengikut;  -- C1 melihat barisnya sendiri
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.pengikut where lapak_id = v_t;
    perform public.berhenti_ikuti(v_t);
    execute 'reset role';
    select count(*) into v_teks from public.pengikut where pelanggan_id = v_c1 and lapak_id = v_t;
    insert into hasil_uji (uji, lulus, catatan) values (
      'I8 C2 tidak melihat baris C1 (RLS), dan berhenti_ikuti C2 tidak menghapus baris C1',
      v_m = 1 and v_n = 0 and v_teks = '1', 'C1 melihat ' || v_m || ', C2 melihat ' || v_n || ', baris C1 tersisa ' || v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('I8 Baris orang lain', false, sqlerrm);
  end;

  -- L1: pemilik tidak bisa melaporkan lapaknya sendiri (lapor_lapak dari 005)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      perform public.lapor_lapak(v_t, 'Lainnya', null);
      v_teks := 'berhasil';
    exception when others then
      v_teks := sqlerrm;
    end;
    execute 'reset role';
    select count(*) into v_n from public.laporan where lapak_id = v_t;
    insert into hasil_uji (uji, lulus, catatan) values (
      'L1 Pemilik memanggil lapor_lapak untuk lapak sendiri: ditolak',
      v_teks = 'Tidak bisa melaporkan lapak sendiri' and v_n = 0, v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('L1 Lapor lapak sendiri', false, sqlerrm);
  end;

  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (v_p, v_q, v_r, v_c1, v_c2);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
