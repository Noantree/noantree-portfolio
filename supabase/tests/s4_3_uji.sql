-- s4_3_uji.sql
-- Uji S4.3 (PRD bagian 5 dan 10) untuk 019_detail_lapak_publik.sql.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 019 dijalankan.
--
-- Cara kerja sama dengan s4_1_uji.sql:
--   - Membuat akun dan lapak uji, lalu menghapusnya lagi di akhir (on delete cascade).
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--
-- Lapak A (tayang): tempat Depan Pasar (Kec. Sragen), jadwal hari ini yang sedang berlaku, 2 foto.
-- Lapak B (tayang): sesi aktif berstatus Habis.
-- Lapak D (draf) dan E (disembunyikan): jadwal dan foto sama dengan A, tetapi tidak boleh terlihat.
-- Lapak F (tayang): jadwal Senin–Sabtu 06.00–14.00. Lapak G (tayang): jadwal Jumat 18.00–02.00.
-- buka_berikutnya diuji dengan waktu tiruan di minggu 2 November 2026 (Senin) lewat inti_buka_berikutnya.

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
  v_d       uuid := gen_random_uuid();
  v_e       uuid := gen_random_uuid();
  v_f       uuid := gen_random_uuid();
  v_g       uuid := gen_random_uuid();
  v_usaha   uuid;
  v_lapak_a uuid;
  v_lapak_b uuid;
  v_lapak_d uuid;
  v_lapak_e uuid;
  v_lapak_f uuid;
  v_lapak_g uuid;
  v_ta      uuid;
  v_tb      uuid;
  v_sragen  uuid;
  v_mulai   timestamp;  -- jam dinding WIB
  v_selesai timestamp;
  v_sejak   timestamptz := date_trunc('minute', now()) - interval '40 minutes';
  v_akhir   timestamptz := date_trunc('minute', now()) - interval '5 minutes';
  v_r       record;
  v_n       int;
  v_m       int;
  v_t       timestamptz;
  v_teks    text;
  v_kolom   text;
  -- Jam dinding WIB → timestamptz
  w constant text := 'Asia/Jakarta';
begin
  -- ---------- Persiapan ----------
  select id into v_sragen from public.wilayah where tingkat = 'kecamatan' and kode = '33.14.10';

  -- Sesi jadwal hari ini: mulai 1 jam lalu, selesai 1 jam lagi (WIB), menit kelipatan 5
  v_mulai := date_trunc('hour', (now() at time zone w) - interval '1 hour')
             + floor(extract(minute from (now() at time zone w)) / 5) * interval '5 minutes';
  v_selesai := v_mulai + interval '2 hours';

  insert into auth.users (id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s43-' || n || '@contoh.invalid'
  from (values (v_a, 'a'), (v_b, 'b'), (v_d, 'd'), (v_e, 'e'), (v_f, 'f'), (v_g, 'g')) x(u, n);

  insert into public.usaha (pemilik_id, nama) values (v_a, 'Uji A') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_a, 'Uji A', 'uji-s43-a-' || substr(v_a::text, 1, 8), 'tayang', 3, now()) returning id into v_lapak_a;
  insert into public.usaha (pemilik_id, nama) values (v_b, 'Uji B') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_b, 'Uji B', 'uji-s43-b-' || substr(v_b::text, 1, 8), 'tayang', 3, now()) returning id into v_lapak_b;
  insert into public.usaha (pemilik_id, nama) values (v_d, 'Uji D') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar)
  values (v_usaha, v_d, 'Uji D', 'uji-s43-d-' || substr(v_d::text, 1, 8), 'draf', 2) returning id into v_lapak_d;
  insert into public.usaha (pemilik_id, nama) values (v_e, 'Uji E') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_e, 'Uji E', 'uji-s43-e-' || substr(v_e::text, 1, 8), 'disembunyikan', 3, now()) returning id into v_lapak_e;
  insert into public.usaha (pemilik_id, nama) values (v_f, 'Uji F') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_f, 'Uji F', 'uji-s43-f-' || substr(v_f::text, 1, 8), 'tayang', 3, now()) returning id into v_lapak_f;
  insert into public.usaha (pemilik_id, nama) values (v_g, 'Uji G') returning id into v_usaha;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha, v_g, 'Uji G', 'uji-s43-g-' || substr(v_g::text, 1, 8), 'tayang', 3, now()) returning id into v_lapak_g;

  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_a, 'Depan Pasar', v_sragen, now() - interval '1 day') returning id into v_ta;
  insert into public.tempat (lapak_id, nama, kecamatan_id, terakhir_dipakai)
  values (v_lapak_b, 'Simpang', v_sragen, now()) returning id into v_tb;

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  select l, extract(dow from v_mulai)::int, v_mulai::time, v_selesai::time
  from unnest(array[v_lapak_a, v_lapak_d, v_lapak_e]) l;
  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai)
  select v_lapak_f, h, '06:00', '14:00' from generate_series(1, 6) h;
  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values (v_lapak_g, 5, '18:00', '02:00');

  insert into public.foto_lapak (lapak_id, url, urutan)
  select l, 'https://contoh.invalid/' || l || '/' || u || '.jpg', u
  from unnest(array[v_lapak_a, v_lapak_d, v_lapak_e]) l cross join generate_series(1, 2) u;

  insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak)
  values (v_lapak_b, v_tb, now() - interval '1 hour', now() + interval '2 hours', 'habis', v_sejak);

  -- ---------- Kolom ----------

  -- K1: 18 kolom dari 018 tetap di urutan yang sama, 5 kolom baru di ujung
  begin
    select string_agg(column_name, ',' order by ordinal_position) into v_kolom
      from information_schema.columns where table_schema = 'public' and table_name = 'lapak_publik';
    insert into hasil_uji (uji, lulus, catatan) values (
      'K1 Kolom lapak_publik: 18 lama tetap urut, 5 baru di ujung',
      v_kolom = 'id,slug,nama,deskripsi,foto_url,status,berakhir_pada,tempat_id,tempat_nama,tempat_lat,tempat_lng,'
             || 'tempat_link_maps,jumlah_pengikut,tempat_kecamatan_kode,tempat_kabupaten_kode,tempat_provinsi_kode,'
             || 'jadwal_mulai,jadwal_selesai,status_sejak,terakhir_buka_pada,buka_berikutnya,'
             || 'tempat_kecamatan_nama,tempat_kabupaten_nama',
      v_kolom);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('K1 Kolom lapak_publik', false, sqlerrm);
  end;

  -- ---------- Hak tamu (anon) ----------

  -- H1: jadwal_lapak_publik dan foto_lapak_publik hanya untuk lapak tayang
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.jadwal_lapak_publik where lapak_id = v_lapak_a;
    select count(*) into v_m from public.foto_lapak_publik where lapak_id = v_lapak_a;
    v_teks := (select count(*) from public.jadwal_lapak_publik where lapak_id in (v_lapak_d, v_lapak_e)) || '/'
           || (select count(*) from public.foto_lapak_publik where lapak_id in (v_lapak_d, v_lapak_e));
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'H1 Tamu: jadwal dan foto lapak tayang terlihat (1 jadwal, 2 foto); draf dan disembunyikan 0',
      v_n = 1 and v_m = 2 and v_teks = '0/0',
      'tayang ' || v_n || '/' || v_m || ', draf+disembunyikan ' || v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H1 View jadwal dan foto untuk tamu', false, sqlerrm);
  end;

  -- H2: tabel jadwal dan foto_lapak tetap tertutup untuk tamu
  begin
    execute 'set local role anon';
    begin
      select count(*)::text into v_teks from public.jadwal where lapak_id = v_lapak_a;
    exception when insufficient_privilege then
      v_teks := 'ditolak';
    end;
    begin
      select v_teks || '/' || count(*) into v_teks from public.foto_lapak where lapak_id = v_lapak_a;
    exception when insufficient_privilege then
      v_teks := v_teks || '/ditolak';
    end;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'H2 Tamu: tabel jadwal dan foto_lapak tertutup (ditolak atau 0 baris)',
      v_teks in ('ditolak/ditolak', '0/0', 'ditolak/0', '0/ditolak'),
      'jadwal/foto_lapak ' || v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H2 Tabel tertutup', false, sqlerrm);
  end;

  -- H3: tamu tidak bisa memanggil inti_buka_berikutnya; buka_berikutnya_publik hanya untuk lapak tayang
  begin
    execute 'set local role anon';
    v_teks := coalesce((public.buka_berikutnya_publik(v_lapak_f) is not null)::text, 'null') || '/'
           || coalesce(public.buka_berikutnya_publik(v_lapak_d)::text, 'null') || '/'
           || coalesce(public.buka_berikutnya_publik(v_lapak_e)::text, 'null');
    begin
      perform public.inti_buka_berikutnya(v_lapak_d, now());
      v_teks := v_teks || '/inti terbuka';
    exception when insufficient_privilege then
      v_teks := v_teks || '/inti ditolak';
    end;
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values (
      'H3 Tamu: buka_berikutnya_publik tayang terisi, draf dan disembunyikan null; inti ditolak',
      v_teks = 'true/null/null/inti ditolak',
      v_teks);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H3 Fungsi buka berikutnya untuk tamu', false, sqlerrm);
  end;

  -- H4: lapak draf dan disembunyikan tidak ada di lapak_publik (V27)
  begin
    execute 'set local role anon';
    select count(*) into v_n from public.lapak_publik where id in (v_lapak_d, v_lapak_e);
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H4 Tamu: lapak draf dan disembunyikan tidak ada di lapak_publik', v_n = 0, 'baris ' || v_n);
  exception when others then
    execute 'reset role';
    insert into hasil_uji (uji, lulus, catatan) values ('H4 Draf dan disembunyikan', false, sqlerrm);
  end;

  -- ---------- buka_berikutnya dengan waktu tiruan (WIB) ----------

  -- B1: sebelum jadwal: Senin 05.00 → Senin 06.00 hari yang sama
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_f, '2026-11-02 05:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values (
      'B1 Sebelum jadwal (Senin 05.00): Senin 06.00',
      v_t = '2026-11-02 06:00'::timestamp at time zone w, to_char(v_t at time zone w, 'Dy DD HH24.MI'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B1 Sebelum jadwal', false, sqlerrm);
  end;

  -- B2: sesudah Selesai di tengah jadwal (Senin 10.00, sesi 06.00–14.00 sudah dimulai): Selasa 06.00
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_f, '2026-11-02 10:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values (
      'B2 Sesudah Selesai di tengah jadwal (Senin 10.00): Selasa 06.00',
      v_t = '2026-11-03 06:00'::timestamp at time zone w, to_char(v_t at time zone w, 'Dy DD HH24.MI'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B2 Sesudah Selesai', false, sqlerrm);
  end;

  -- B3: lewat tengah malam: Sabtu 01.00 di dalam sesi Jumat 18.00–02.00 → Jumat berikutnya 18.00
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_g, '2026-11-07 01:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values (
      'B3 Lewat tengah malam (Sabtu 01.00, sesi Jumat 18.00–02.00): Jumat 13 Nov 18.00',
      v_t = '2026-11-13 18:00'::timestamp at time zone w, to_char(v_t at time zone w, 'Dy DD HH24.MI'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B3 Lewat tengah malam', false, sqlerrm);
  end;

  -- B3b: Jumat 17.00 (sebelum sesi lewat tengah malam) → Jumat 18.00 hari yang sama
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_g, '2026-11-06 17:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values (
      'B3b Sebelum sesi lewat tengah malam (Jumat 17.00): Jumat 18.00',
      v_t = '2026-11-06 18:00'::timestamp at time zone w, to_char(v_t at time zone w, 'Dy DD HH24.MI'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B3b Sebelum sesi malam', false, sqlerrm);
  end;

  -- B4: Sabtu ke Senin: Sabtu 15.00, Minggu tanpa jadwal → Senin 06.00
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_f, '2026-11-07 15:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values (
      'B4 Sabtu ke Senin (Sabtu 15.00): Senin 06.00',
      v_t = '2026-11-09 06:00'::timestamp at time zone w, to_char(v_t at time zone w, 'Dy DD HH24.MI'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B4 Sabtu ke Senin', false, sqlerrm);
  end;

  -- B5: tanpa jadwal: null
  begin
    v_t := public.inti_buka_berikutnya(v_lapak_b, '2026-11-02 05:00'::timestamp at time zone w);
    insert into hasil_uji (uji, lulus, catatan) values ('B5 Tanpa jadwal: null', v_t is null, coalesce(v_t::text, 'null'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B5 Tanpa jadwal', false, sqlerrm);
  end;

  -- ---------- Kolom baru di lapak_publik (waktu sungguhan) ----------

  -- S1: Habis: status_sejak = jam status berlaku; kolom Tutup kosong
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_b;
    insert into hasil_uji (uji, lulus, catatan) values (
      'S1 Habis: status_sejak terisi, terakhir_buka_pada dan buka_berikutnya kosong',
      v_r.status = 'habis' and v_r.status_sejak = v_sejak and v_r.terakhir_buka_pada is null and v_r.buka_berikutnya is null,
      concat_ws(' ', v_r.status, to_char(v_r.status_sejak at time zone w, 'HH24.MI')));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S1 Habis sejak', false, sqlerrm);
  end;

  -- S2: Biasanya buka: status_sejak kosong; nama wilayah tempat terisi
  begin
    select * into v_r from public.lapak_publik where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values (
      'S2 Biasanya buka: status_sejak kosong; nama Kec. Sragen dan Kabupaten Sragen',
      v_r.status = 'biasanya_buka' and v_r.status_sejak is null
        and v_r.tempat_kecamatan_nama = 'Sragen' and v_r.tempat_kabupaten_nama = 'Kabupaten Sragen',
      concat_ws(' / ', v_r.status, v_r.tempat_kecamatan_nama, v_r.tempat_kabupaten_nama));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S2 Biasanya buka dan nama wilayah', false, sqlerrm);
  end;

  -- S3: Selesai di tengah jadwal: Tutup, terakhir_buka_pada = jam Selesai,
  --     buka_berikutnya = sesi jadwal yang sama minggu depan (satu-satunya jadwal lapak A)
  begin
    insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak,
                                  diakhiri_pada, cara_akhir, dari_jadwal)
    values (v_lapak_a, v_ta, now() - interval '30 minutes', v_selesai at time zone w, 'buka',
            now() - interval '30 minutes', v_akhir, 'manual', true);
    select * into v_r from public.lapak_publik where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values (
      'S3 Selesai di tengah jadwal: Tutup, terakhir_buka_pada = jam Selesai, buka_berikutnya = minggu depan',
      v_r.status = 'tutup' and v_r.terakhir_buka_pada = v_akhir
        and v_r.buka_berikutnya = (v_mulai + interval '7 days') at time zone w and v_r.status_sejak is null,
      concat_ws(' ', v_r.status, to_char(v_r.terakhir_buka_pada at time zone w, 'HH24.MI'),
                to_char(v_r.buka_berikutnya at time zone w, 'Dy DD HH24.MI')));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S3 Tutup setelah Selesai', false, sqlerrm);
  end;

  -- ---------- Bersihkan ----------
  delete from auth.users where id in (v_a, v_b, v_d, v_e, v_f, v_g);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
