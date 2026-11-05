-- s4_4_uji.sql
-- Uji S4.4 (PRD bagian 10, Sprint 4: "Cari "bakso" menemukan lapak lewat nama dan deskripsi, termasuk yang tutup").
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 019. S4.4 tidak punya migrasi baru.
--
-- Query di sini setara dengan yang dikirim aplikasi lewat PostgREST (src/lib/cari.ts dan beranda.ts):
--   or(nama.ilike.*kata*, deskripsi.ilike.*kata*) + saringan wilayah, dijalankan sebagai anon.
-- Kata uji dibuat acak supaya tidak bertabrakan dengan lapak sungguhan.
--
-- Lapak A (tayang, Kec. Sragen): kata di NAMA (huruf besar), tanpa sesi = Tutup, jadwal mulai 2 jam lagi.
-- Lapak B (tayang, Kec. Masaran): kata di DESKRIPSI, sesi aktif = Lagi buka.
-- Lapak C (tayang, Kab. Karanganyar): kata di nama, di luar Kab. Sragen.
-- Lapak D (draf) dan E (disembunyikan): kata di nama, tidak boleh ditemukan.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

do $$
declare
  v_kata    text := 'bakso' || substr(md5(random()::text), 1, 8);
  v_pola    text;
  v_a       uuid := gen_random_uuid();
  v_b       uuid := gen_random_uuid();
  v_c       uuid := gen_random_uuid();
  v_d       uuid := gen_random_uuid();
  v_e       uuid := gen_random_uuid();
  v_usaha   uuid;
  v_lapak_a uuid;
  v_lapak_b uuid;
  v_lapak_c uuid;
  v_lapak_d uuid;
  v_lapak_e uuid;
  v_tb      uuid;
  v_sragen  uuid;
  v_masaran uuid;
  v_kra     uuid;
  v_mulai   timestamp;  -- jam dinding WIB
  v_n       int;
  v_m       int;
  v_teks    text;
  v_t       timestamptz;
  w constant text := 'Asia/Jakarta';
begin
  v_pola := '%' || v_kata || '%';
  select id into v_sragen from public.wilayah where tingkat = 'kecamatan' and kode = '33.14.10';
  select id into v_masaran from public.wilayah where tingkat = 'kecamatan' and kode = '33.14.03';
  select id into v_kra from public.wilayah where tingkat = 'kecamatan' and kode like '33.13.%' order by kode limit 1;

  -- Jadwal lapak A: mulai 2 jam lagi (WIB, menit kelipatan 5), jadi sekarang Tutup dan buka_berikutnya terisi
  v_mulai := date_trunc('hour', (now() at time zone w) + interval '2 hours')
             + floor(extract(minute from (now() at time zone w)) / 5) * interval '5 minutes';

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s44-' || n || '@contoh.invalid'
  from (values (v_a, 'a'), (v_b, 'b'), (v_c, 'c'), (v_d, 'd'), (v_e, 'e')) x(u, n);

  insert into public.usaha (pemilik_id, nama) values (v_a, 'Uji A') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_a, 'Warung ' || upper(v_kata) || ' Pak Uji', 'uji-s44-a-' || substr(v_a::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_a;
  insert into public.usaha (pemilik_id, nama) values (v_b, 'Uji B') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, deskripsi, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_b, 'Mie Ayam Uji', 'Mie ayam dan ' || v_kata || ' urat', 'uji-s44-b-' || substr(v_b::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_b;
  insert into public.usaha (pemilik_id, nama) values (v_c, 'Uji C') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_c, v_kata || ' Karanganyar', 'uji-s44-c-' || substr(v_c::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_c;
  insert into public.usaha (pemilik_id, nama) values (v_d, 'Uji D') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar)
  values (v_usaha, v_d, v_kata || ' Draf', 'uji-s44-d-' || substr(v_d::text, 1, 8), 'draf', 2)
  returning id into v_lapak_d;
  insert into public.usaha (pemilik_id, nama) values (v_e, 'Uji E') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_e, v_kata || ' Sembunyi', 'uji-s44-e-' || substr(v_e::text, 1, 8), 'disembunyikan', 3, now())
  returning id into v_lapak_e;

  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_a, 'Depan Pasar', v_sragen);
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_b, 'Simpang', v_masaran) returning id into v_tb;
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_c, 'Alun-alun', v_kra);
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_d, 'Draf', v_sragen);
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_e, 'Sembunyi', v_sragen);

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  values (v_lapak_a, extract(dow from v_mulai)::int, v_mulai::time, (v_mulai + interval '1 hour')::time);

  insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak)
  values (v_lapak_b, v_tb, now() - interval '30 minutes', now() + interval '2 hours', 'buka', now() - interval '30 minutes');

  -- C1: di Kab. Sragen kata ditemukan lewat nama (A, Tutup, huruf besar) dan deskripsi (B, Lagi buka)
  begin
    execute 'set local role anon';
    select count(*), string_agg(status, ',' order by status) into v_n, v_teks
      from public.lapak_publik
     where (nama ilike v_pola or deskripsi ilike v_pola) and tempat_kabupaten_kode = '33.14';
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'C1 Cari di Kab. Sragen: lewat nama dan deskripsi, termasuk yang Tutup (2 lapak: buka, tutup)',
      v_n = 2 and v_teks = 'buka,tutup', v_n || ' lapak: ' || coalesce(v_teks, '-'));
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('C1 Cari di wilayah aktif', false, sqlerrm);
  end;

  -- C2: semua wilayah: 3 lapak (A, B, C), jadi "(+N)" untuk Kab. Sragen = 1; draf dan disembunyikan tidak ikut
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.lapak_publik where nama ilike v_pola or deskripsi ilike v_pola;
    select count(*) into v_m from public.lapak_publik
     where (nama ilike v_pola or deskripsi ilike v_pola) and id in (v_lapak_d, v_lapak_e);
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'C2 Semua wilayah: 3 lapak, di luar Kab. Sragen 1; draf dan disembunyikan 0',
      v_n = 3 and v_m = 0, 'semua ' || v_n || ', di luar ' || (v_n - 2) || ', draf+disembunyikan ' || v_m);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('C2 Semua wilayah', false, sqlerrm);
  end;

  -- C3: filter Masaran pada hasil cari hanya lapak dengan tempat di Masaran (B)
  begin
    execute 'set local role anon';
    select count(*), max(id::text) into v_n, v_teks from public.lapak_publik
     where (nama ilike v_pola or deskripsi ilike v_pola) and tempat_kecamatan_kode = '33.14.03';
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'C3 Cari dengan filter Masaran: hanya lapak B', v_n = 1 and v_teks = v_lapak_b::text, v_n || ' lapak');
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('C3 Filter Masaran', false, sqlerrm);
  end;

  -- C4: saran kata V54: frasa dua kata tanpa hasil, kata pertamanya punya hasil
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.lapak_publik
     where (nama ilike '%' || v_kata || ' tidakada%' or deskripsi ilike '%' || v_kata || ' tidakada%')
       and tempat_kabupaten_kode = '33.14';
    select count(*) into v_m from public.lapak_publik
     where (nama ilike v_pola or deskripsi ilike v_pola) and tempat_kabupaten_kode = '33.14';
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'C4 Saran V54: "' || v_kata || ' tidakada" 0 hasil, kata pertama punya hasil', v_n = 0 and v_m > 0,
      'frasa ' || v_n || ', kata pertama ' || v_m);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('C4 Saran kata', false, sqlerrm);
  end;

  -- K1: V20 di Kec. Sragen: lapak A ada tetapi Tutup; buka_berikutnya = awal jadwal 2 jam lagi
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.lapak_publik where id = v_lapak_a and tempat_kecamatan_kode = '33.14.10';
    select buka_berikutnya, status into v_t, v_teks from public.lapak_publik where id = v_lapak_a;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'K1 V20: lapak Tutup terlihat di wilayahnya, buka_berikutnya = jadwal berikutnya',
      v_n = 1 and v_teks = 'tutup' and v_t = v_mulai at time zone w,
      concat_ws(' ', v_teks, to_char(v_t at time zone w, 'Dy HH24.MI')));
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('K1 Ringkas wilayah V20', false, sqlerrm);
  end;

  delete from auth.users where id in (v_a, v_b, v_c, v_d, v_e);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
