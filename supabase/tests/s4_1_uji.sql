-- s4_1_uji.sql
-- Uji S4.1 (PRD bagian 5 dan 10, Sprint 4) untuk 018_lapak_publik_beranda.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 018 dijalankan.
--
-- Cara kerja sama dengan s3_3_uji.sql:
--   - Membuat akun dan lapak uji, lalu menghapusnya lagi di akhir (on delete cascade).
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Kalau blok DO gagal di tengah, semua perubahan dibatalkan otomatis.
--
-- View lapak_publik memakai now(), jadi jadwal uji dibuat di sekitar jam WIB saat skrip dijalankan:
-- sesi jadwal mulai 1 jam lalu dan selesai 1 jam lagi (dibulatkan ke 5 menit, A35).
-- Lapak A: dua tempat, Depan Pasar (Sragen, 33.14.10) dan Simpang (Masaran, 33.14.03); tanpa sesi = Biasanya buka.
-- Lapak B: sesi aktif di Simpang (Masaran) = Lagi buka.
-- Lapak C: tempat tanpa kecamatan, tanpa jadwal = Tutup.
-- Lapak D: masih draf = tidak ada di view. Lapak E: disembunyikan.
-- Lapak A, D, dan E punya jadwal yang sedang berlaku; jadwal_publik hanya mengembalikan jadwal lapak A (tayang).

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

do $$
declare
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
  v_ta1     uuid;
  v_ta2     uuid;
  v_tb1     uuid;
  v_tb2     uuid;
  v_masaran uuid;
  v_sragen  uuid;
  v_mulai   timestamp;  -- jam dinding WIB
  v_selesai timestamp;
  v_r       record;
  v_n       int;
  v_kolom   text;
begin
  -- ---------- Persiapan ----------
  select id into v_masaran from public.wilayah where tingkat = 'kecamatan' and kode = '33.14.03';
  select id into v_sragen from public.wilayah where tingkat = 'kecamatan' and kode = '33.14.10';

  -- Sesi jadwal: mulai 1 jam lalu, selesai 1 jam lagi (WIB), menit kelipatan 5
  v_mulai := date_trunc('hour', (now() at time zone 'Asia/Jakarta') - interval '1 hour')
             + floor(extract(minute from (now() at time zone 'Asia/Jakarta')) / 5) * interval '5 minutes';
  v_selesai := v_mulai + interval '2 hours';

  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s41-a@contoh.invalid'),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s41-b@contoh.invalid'),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s41-c@contoh.invalid'),
    (v_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s41-d@contoh.invalid'),
    (v_e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s41-e@contoh.invalid');

  insert into public.usaha (pemilik_id, nama) values (v_a, 'Uji A') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_a, 'Uji A', 'uji-s41-a-' || substr(v_a::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_a;
  insert into public.usaha (pemilik_id, nama) values (v_b, 'Uji B') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_b, 'Uji B', 'uji-s41-b-' || substr(v_b::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_b;
  insert into public.usaha (pemilik_id, nama) values (v_c, 'Uji C') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_c, 'Uji C', 'uji-s41-c-' || substr(v_c::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_c;
  insert into public.usaha (pemilik_id, nama) values (v_d, 'Uji D') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar)
  values (v_usaha, v_d, 'Uji D', 'uji-s41-d-' || substr(v_d::text, 1, 8), 'draf', 2)
  returning id into v_lapak_d;
  insert into public.usaha (pemilik_id, nama) values (v_e, 'Uji E') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_e, 'Uji E', 'uji-s41-e-' || substr(v_e::text, 1, 8), 'disembunyikan', 3, now())
  returning id into v_lapak_e;

  -- Lapak A: Depan Pasar terakhir dipakai, jadi itu tempat yang tampil
  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_a, 'Depan Pasar', v_sragen, now() - interval '1 day') returning id into v_ta1;
  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_a, 'Simpang', v_masaran, now() - interval '3 days') returning id into v_ta2;
  -- Lapak B: Depan Pasar terakhir dipakai, tetapi sesi aktif di Simpang
  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_b, 'Depan Pasar', v_sragen, now()) returning id into v_tb1;
  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_b, 'Simpang', v_masaran, now() - interval '3 days') returning id into v_tb2;
  insert into public.tempat (lapak_id, nama) values (v_lapak_c, 'Tanpa kecamatan');
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_d, 'Draf', v_sragen);
  insert into public.tempat (lapak_id, nama, kecamatan_id) values (v_lapak_e, 'Disembunyikan', v_sragen);

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  values
    (v_lapak_a, extract(dow from v_mulai)::int, v_mulai::time, v_selesai::time),
    (v_lapak_d, extract(dow from v_mulai)::int, v_mulai::time, v_selesai::time),
    (v_lapak_e, extract(dow from v_mulai)::int, v_mulai::time, v_selesai::time);

  insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak)
  values (v_lapak_b, v_tb2, now() - interval '30 minutes', now() + interval '2 hours', 'buka', now() - interval '30 minutes');

  -- ---------- Kolom ----------

  -- K1: 18 kolom dari 018 tetap di urutan yang sama, 5 kolom dari 019 di ujung (23 total)
  begin
    select string_agg(column_name, ',' order by ordinal_position) into v_kolom
      from information_schema.columns where table_schema = 'public' and table_name = 'lapak_publik';
    insert into hasil_uji (uji, lulus, catatan) values (
      'K1 Kolom lapak_publik: 18 lama tetap urut, 5 baru di ujung',
      v_kolom = 'id,slug,nama,deskripsi,foto_url,status,berakhir_pada,tempat_id,tempat_nama,tempat_lat,tempat_lng,'
             || 'tempat_link_maps,jumlah_pengikut,tempat_kecamatan_kode,tempat_kabupaten_kode,tempat_provinsi_kode,'
             || 'jadwal_mulai,jadwal_selesai,'
             || 'status_sejak,terakhir_buka_pada,buka_berikutnya,tempat_kecamatan_nama,tempat_kabupaten_nama',
      v_kolom);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('K1 Kolom lapak_publik', false, sqlerrm);
  end;

  -- ---------- Wilayah tempat yang tampil ----------

  -- W1: lapak A tanpa sesi: tempat terakhir dipakai (Depan Pasar, Sragen)
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values (
      'W1 Tanpa sesi: kode wilayah dari tempat terakhir dipakai (33.14.10, 33.14, 33)',
      v_r.tempat_nama = 'Depan Pasar' and v_r.tempat_kecamatan_kode = '33.14.10'
        and v_r.tempat_kabupaten_kode = '33.14' and v_r.tempat_provinsi_kode = '33',
      concat_ws(' ', v_r.tempat_nama, v_r.tempat_kecamatan_kode, v_r.tempat_kabupaten_kode, v_r.tempat_provinsi_kode));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('W1 Wilayah tanpa sesi', false, sqlerrm);
  end;

  -- W2: lapak B dengan sesi aktif: tempat sesi (Simpang, Masaran), bukan tempat terakhir dipakai
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_b;
    insert into hasil_uji (uji, lulus, catatan) values (
      'W2 Sesi aktif: kode wilayah dari tempat sesi (Masaran 33.14.03)',
      v_r.tempat_nama = 'Simpang' and v_r.tempat_kecamatan_kode = '33.14.03'
        and v_r.tempat_kabupaten_kode = '33.14' and v_r.tempat_provinsi_kode = '33',
      concat_ws(' ', v_r.tempat_nama, v_r.tempat_kecamatan_kode, v_r.tempat_kabupaten_kode, v_r.tempat_provinsi_kode));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('W2 Wilayah sesi aktif', false, sqlerrm);
  end;

  -- W3: tempat tanpa kecamatan: lapak tetap tampil, kode kosong
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_c;
    insert into hasil_uji (uji, lulus, catatan) values (
      'W3 Tempat tanpa kecamatan: tetap tampil, kode wilayah kosong',
      v_r.id is not null and v_r.tempat_kecamatan_kode is null and v_r.tempat_kabupaten_kode is null
        and v_r.tempat_provinsi_kode is null,
      coalesce(v_r.status, 'tidak ada'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('W3 Tanpa kecamatan', false, sqlerrm);
  end;

  -- W4: lapak draf tidak ada di view
  begin
    select count(*) into v_n from public.lapak_publik where id = v_lapak_d;
    insert into hasil_uji (uji, lulus, catatan) values ('W4 Lapak draf tidak ada di lapak_publik', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('W4 Lapak draf', false, sqlerrm);
  end;

  -- ---------- Jam jadwal untuk Biasanya buka ----------

  -- J1: Biasanya buka: jadwal_mulai dan jadwal_selesai = sesi jadwal yang sedang berlaku (WIB)
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J1 Biasanya buka: jam sesi jadwal yang berlaku terisi',
      v_r.status = 'biasanya_buka'
        and v_r.jadwal_mulai = v_mulai at time zone 'Asia/Jakarta'
        and v_r.jadwal_selesai = v_selesai at time zone 'Asia/Jakarta',
      concat_ws(' ', v_r.status, to_char(v_r.jadwal_mulai at time zone 'Asia/Jakarta', 'HH24.MI'),
                to_char(v_r.jadwal_selesai at time zone 'Asia/Jakarta', 'HH24.MI')));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J1 Jam jadwal Biasanya buka', false, sqlerrm);
  end;

  -- J2: Lagi buka: jam jadwal kosong, berakhir_pada terisi
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_b;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J2 Lagi buka: jadwal_mulai dan jadwal_selesai kosong, berakhir_pada terisi',
      v_r.status = 'buka' and v_r.jadwal_mulai is null and v_r.jadwal_selesai is null and v_r.berakhir_pada is not null,
      v_r.status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J2 Lagi buka', false, sqlerrm);
  end;

  -- J3: Selesai di tengah jadwal: Tutup, jam jadwal kosong
  begin
    insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak,
                                  diakhiri_pada, cara_akhir, dari_jadwal)
    values (v_lapak_a, v_ta1, now() - interval '30 minutes', v_selesai at time zone 'Asia/Jakarta', 'buka',
            now() - interval '30 minutes', now() - interval '5 minutes', 'manual', true);
    select * into v_r from public.lapak_publik where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J3 Selesai di tengah jadwal: Tutup, jam jadwal kosong',
      v_r.status = 'tutup' and v_r.jadwal_mulai is null and v_r.jadwal_selesai is null,
      v_r.status);
    delete from public.sesi_buka where lapak_id = v_lapak_a;
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J3 Selesai di tengah jadwal', false, sqlerrm);
  end;

  -- J4: Tutup tanpa jadwal: jam jadwal kosong
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_c;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J4 Tutup tanpa jadwal: jam jadwal kosong',
      v_r.status = 'tutup' and v_r.jadwal_mulai is null and v_r.jadwal_selesai is null,
      v_r.status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J4 Tutup tanpa jadwal', false, sqlerrm);
  end;

  -- ---------- Hak akses ----------

  -- H1: tamu (anon) bisa membaca view beserta kolom baru, tetapi tidak tabel jadwal
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.lapak_publik
     where id in (v_lapak_a, v_lapak_b) and tempat_kabupaten_kode = '33.14';
    -- Tamu tidak punya hak baca jadwal (013, 014); kalau suatu saat ada, RLS tetap menyaring semua baris
    begin
      select count(*)::text into v_kolom from public.jadwal where lapak_id = v_lapak_a;
    exception when insufficient_privilege then
      v_kolom := '0';
    end;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'H1 Tamu membaca lapak_publik (2 lapak Sragen); tabel jadwal tetap tertutup',
      v_n = 2 and v_kolom = '0',
      'view ' || v_n || ', jadwal ' || v_kolom);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H1 Hak tamu', false, sqlerrm);
  end;

  -- ---------- jadwal_publik: hanya lapak tayang ----------

  -- P1: lapak tayang mengembalikan jadwal yang sedang berlaku
  begin
    select count(*) into v_n from public.jadwal_publik(v_lapak_a);
    insert into hasil_uji (uji, lulus, catatan) values ('P1 jadwal_publik lapak tayang: 1 sesi jadwal', v_n = 1, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('P1 jadwal_publik tayang', false, sqlerrm);
  end;

  -- P2: lapak draf tidak mengembalikan jadwal
  begin
    select count(*) into v_n from public.jadwal_publik(v_lapak_d);
    insert into hasil_uji (uji, lulus, catatan) values ('P2 jadwal_publik lapak draf: kosong', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('P2 jadwal_publik draf', false, sqlerrm);
  end;

  -- P3: lapak disembunyikan tidak mengembalikan jadwal
  begin
    select count(*) into v_n from public.jadwal_publik(v_lapak_e);
    insert into hasil_uji (uji, lulus, catatan) values ('P3 jadwal_publik lapak disembunyikan: kosong', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('P3 jadwal_publik disembunyikan', false, sqlerrm);
  end;

  -- H2: sebagai tamu, jadwal_publik tetap hanya untuk lapak tayang, dan jadwal_sekarang ditolak
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.jadwal_publik(v_lapak_a);
    select count(*)::text into v_kolom from public.jadwal_publik(v_lapak_d);
    v_kolom := v_kolom || '/' || (select count(*) from public.jadwal_publik(v_lapak_e));
    begin
      perform * from public.jadwal_sekarang(v_lapak_d, now());
      v_kolom := v_kolom || '/jadwal_sekarang terbuka';
    exception when insufficient_privilege then
      v_kolom := v_kolom || '/jadwal_sekarang ditolak';
    end;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'H2 Tamu: jadwal_publik tayang 1, draf 0, disembunyikan 0; jadwal_sekarang ditolak',
      v_n = 1 and v_kolom = '0/0/jadwal_sekarang ditolak',
      'tayang ' || v_n || ', draf/disembunyikan ' || v_kolom);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H2 Hak tamu jadwal', false, sqlerrm);
  end;

  -- ---------- Bersihkan ----------
  delete from auth.users where id in (v_a, v_b, v_c, v_d, v_e);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
