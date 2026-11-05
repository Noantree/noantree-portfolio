-- s3_3_uji.sql
-- Uji S3.3 (PRD bagian 5 dan 10, Sprint 3) untuk 017_status_efektif.sql, dengan waktu tiruan.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 016 dan 017 dijalankan.
--
-- Cara kerja sama dengan s3_1_uji.sql:
--   - Membuat akun dan lapak uji, lalu menghapusnya lagi di akhir (on delete cascade).
--   - auth.uid() ditiru dengan request.jwt.claims; waktu ditiru lewat status_lapak_pada dan fungsi inti_*.
--   - Hasil ditampilkan dari tabel sementara hasil_uji. Semua baris harus lulus = true.
--   - Kalau blok DO gagal di tengah, semua perubahan dibatalkan otomatis.
--
-- Tanggal uji (WIB): Senin 2 Nov 2026, Selasa 3 Nov 2026, Rabu 4 Nov 2026.
-- Jadwal lapak A: Senin 06.00–14.00 dan 16.00–20.00, Selasa 18.00–02.00 (lewat tengah malam).
--
-- Catatan: J1 memanggil tutup_sesi_semua() sungguhan, sama dengan job tiap jam. Sesi lewat waktu milik
-- lapak lain ikut ditandai otomatis, persis seperti yang akan dilakukan job.

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
  v_usaha_a uuid;
  v_usaha_b uuid;
  v_lapak_a uuid;
  v_lapak_b uuid;
  v_t1      uuid;
  v_tb      uuid;
  v_id      uuid;
  v_id2     uuid;
  v_status  text;
  v_n       int;
  v_s       public.sesi_buka%rowtype;
  v_senin   date := '2026-11-02';
  v_selasa  date := '2026-11-03';
  v_rabu    date := '2026-11-04';
begin
  -- ---------- Persiapan ----------
  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s33-a@contoh.invalid'),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s33-b@contoh.invalid');

  insert into public.usaha (pemilik_id, nama) values (v_a, 'Uji A') returning id into v_usaha_a;
  insert into public.usaha (pemilik_id, nama) values (v_b, 'Uji B') returning id into v_usaha_b;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha_a, v_a, 'Uji A', 'uji-s33-a-' || substr(v_a::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_a;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha_b, v_b, 'Uji B', 'uji-s33-b-' || substr(v_b::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_b;

  insert into public.tempat (lapak_id, nama) values (v_lapak_a, 'Depan Pasar') returning id into v_t1;
  insert into public.tempat (lapak_id, nama) values (v_lapak_b, 'Tempat B') returning id into v_tb;

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values
    (v_lapak_a, 1, '06:00', '14:00'),
    (v_lapak_a, 1, '16:00', '20:00'),
    (v_lapak_a, 2, '18:00', '02:00');

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- ---------- Status efektif (PRD bagian 5) ----------

  -- S1: di dalam jadwal tanpa sesi = Biasanya buka
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '07:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('S1 Senin 07.00 dalam jadwal tanpa sesi: Biasanya buka', v_status = 'biasanya_buka', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S1 Biasanya buka', false, sqlerrm);
  end;

  -- S2: sebelum jadwal = Tutup
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '05:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('S2 Senin 05.00 sebelum jadwal: Tutup', v_status = 'tutup', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S2 Sebelum jadwal', false, sqlerrm);
  end;

  -- S3 (wajib): mulai 05.30 untuk jadwal 06.00–14.00, Selesai 10.00, status 10.30 = Tutup
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '05:30')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '10:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values (
      'S3 Wajib: mulai 05.30, Selesai 10.00 di tengah jadwal 06.00–14.00, status 10.30 Tutup (bukan Biasanya buka)',
      v_status = 'tutup', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S3 Wajib Selesai di tengah jadwal', false, sqlerrm);
  end;

  -- S4 (wajib): data S3, sesi jadwal berikutnya (16.00–20.00) kembali Biasanya buka tanpa tindakan pemilik
  begin
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '16:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values (
      'S4 Wajib: sesi jadwal berikutnya 16.30 kembali Biasanya buka', v_status = 'biasanya_buka', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S4 Wajib sesi jadwal berikutnya', false, sqlerrm);
  end;

  -- S5: sesi aktif = Lagi buka (buka), lalu Habis (habis)
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '11:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_ubah_status(v_lapak_a, 'habis', (v_senin + time '11:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values (
      'S5 Sesi aktif: buka, lalu habis',
      v_status = 'buka'
        and public.status_lapak_pada(v_lapak_a, (v_senin + time '11:45')::timestamp at time zone 'Asia/Jakarta') = 'habis',
      v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S5 Sesi aktif', false, sqlerrm);
  end;

  -- S6: sesi jadwal yang diperpanjang lalu Selesai tetap milik jadwal itu (akhir awal = berakhir - perpanjangan)
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '08:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_perpanjang(v_lapak_a, (v_senin + time '09:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '12:00')::timestamp at time zone 'Asia/Jakarta');
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '12:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('S6 Diperpanjang lalu Selesai di tengah jadwal: Tutup', v_status = 'tutup', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S6 Diperpanjang lalu Selesai', false, sqlerrm);
  end;

  -- S7: sesi di luar jadwal (mulai 02.30, lebih dari 3 jam sebelum 06.00) bukan milik jadwal; setelah Selesai = Biasanya buka
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '02:30')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '06:15')::timestamp at time zone 'Asia/Jakarta');
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '07:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values (
      'S7 Sesi di luar jadwal tidak dihitung milik jadwal: setelah Selesai 07.00 Biasanya buka', v_status = 'biasanya_buka', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S7 Sesi di luar jadwal', false, sqlerrm);
  end;

  -- S8: lewat tengah malam (Selasa 18.00–02.00): Rabu 01.00 tanpa sesi = Biasanya buka;
  --     setelah Mulai Selasa 20.00 dan Selesai 23.00, Rabu 01.00 = Tutup (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_status := public.status_lapak_pada(v_lapak_a, (v_rabu + time '01:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_selasa + time '20:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_selasa + time '23:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values (
      'S8 Lewat tengah malam: Rabu 01.00 Biasanya buka, setelah Selesai Tutup',
      v_status = 'biasanya_buka'
        and public.status_lapak_pada(v_lapak_a, (v_rabu + time '01:00')::timestamp at time zone 'Asia/Jakarta') = 'tutup',
      v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S8 Lewat tengah malam', false, sqlerrm);
  end;

  -- S9: sesi lewat waktu tanpa ditutup = Tutup (A6, PRD bagian 10 "status publik Tutup")
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '17:00')::timestamp at time zone 'Asia/Jakarta');
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '20:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('S9 Sesi lewat berakhir_pada: status publik Tutup', v_status = 'tutup', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S9 Lewat waktu', false, sqlerrm);
  end;

  -- S10: lapak disembunyikan atau draf tidak punya status publik
  begin
    update public.lapak set status_tayang = 'disembunyikan' where id = v_lapak_a;
    v_status := public.status_lapak_pada(v_lapak_a, (v_senin + time '07:00')::timestamp at time zone 'Asia/Jakarta');
    update public.lapak set status_tayang = 'tayang' where id = v_lapak_a;
    insert into hasil_uji (uji, lulus, catatan) values ('S10 Lapak disembunyikan: tidak tampil (null)', v_status is null, coalesce(v_status, 'null'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('S10 Disembunyikan', false, sqlerrm);
  end;

  -- ---------- Layar Berakhir V28 sekali (A6, A7) ----------

  -- B1: sesi berakhir otomatis muncul sekali, dan ditutup otomatis saat dibaca
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_senin + time '14:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'B1 Sesi berakhir otomatis 14.00, dibuka 14.30: V28 muncul, sesi ditandai otomatis',
      v_n = 1 and v_s.cara_akhir = 'otomatis' and v_s.diakhiri_pada = v_s.berakhir_pada,
      'baris ' || v_n || ', cara_akhir ' || coalesce(v_s.cara_akhir, 'kosong'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B1 V28 muncul', false, sqlerrm);
  end;

  -- B2: setelah Oke, sudah pulang (tandai), V28 tidak muncul lagi
  begin
    perform public.inti_tandai_akhir_dilihat(v_lapak_a, (v_senin + time '14:31')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_senin + time '14:32')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('B2 Setelah ditandai dilihat: V28 tidak muncul lagi (sekali)', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B2 V28 sekali', false, sqlerrm);
  end;

  -- B3: Buka lagi = mulai_buka lalu tandai; sesi lama ditandai dilihat dan sesi baru aktif
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_senin + time '14:30')::timestamp at time zone 'Asia/Jakarta');
    v_id2 := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '14:31')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_tandai_akhir_dilihat(v_lapak_a, (v_senin + time '14:31')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'B3 Buka lagi: sesi lama ditandai dilihat, sesi baru aktif sampai 20.00 (jadwal 16.00 dalam 3 jam)',
      v_n = 1 and v_s.akhir_dilihat_pemilik is not null
        and (select diakhiri_pada is null and berakhir_pada = (v_senin + time '20:00')::timestamp at time zone 'Asia/Jakarta'
             from public.sesi_buka where id = v_id2),
      null);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B3 Buka lagi', false, sqlerrm);
  end;

  -- B4: Selesai manual tidak memunculkan V28
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '12:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_senin + time '14:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('B4 Selesai manual: V28 tidak muncul', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B4 Selesai manual', false, sqlerrm);
  end;

  -- B5: sesi aktif: V28 tidak muncul
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_senin + time '11:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('B5 Sesi aktif: V28 tidak muncul', v_n = 0, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B5 Sesi aktif', false, sqlerrm);
  end;

  -- B6: berakhir lebih dari 24 jam lalu: tidak muncul, langsung ditandai dilihat (PRD bagian 5)
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_selasa + time '14:01')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'B6 Berakhir lebih dari 24 jam lalu: V28 tidak muncul, ditandai dilihat',
      v_n = 0 and v_s.cara_akhir = 'otomatis' and v_s.akhir_dilihat_pemilik is not null,
      'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B6 Batas 24 jam', false, sqlerrm);
  end;

  -- B7: berakhir 23 jam lalu masih muncul
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select count(*) into v_n from public.inti_sesi_berakhir_belum_dilihat(v_lapak_a, (v_selasa + time '13:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('B7 Berakhir 23 jam lalu: V28 masih muncul', v_n = 1, 'baris ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B7 Dalam 24 jam', false, sqlerrm);
  end;

  -- B8: bukan pemilik ditolak
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    perform public.inti_tandai_akhir_dilihat(v_lapak_a, (v_senin + time '14:31')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('B8 Bukan pemilik ditolak', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('B8 Bukan pemilik ditolak', sqlerrm = 'Bukan pemilik lapak ini', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- ---------- Job tiap jam (A6) ----------

  -- J1: tutup_sesi_semua menutup sesi lewat waktu (waktu sungguhan)
  begin
    delete from public.sesi_buka where lapak_id = v_lapak_b;
    insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak)
    values (v_lapak_b, v_tb, now() - interval '5 hours', now() - interval '1 hour', 'buka', now() - interval '5 hours')
    returning id into v_id;
    v_n := public.tutup_sesi_semua();
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J1 tutup_sesi_semua: sesi lewat waktu jadi otomatis, diakhiri = berakhir',
      v_n >= 1 and v_s.cara_akhir = 'otomatis' and v_s.diakhiri_pada = v_s.berakhir_pada,
      'ditutup ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J1 tutup_sesi_semua', false, sqlerrm);
  end;

  -- J2: job pg_cron terpasang tiap jam
  begin
    select count(*) into v_n from cron.job
     where jobname = 'noantree-tutup-sesi' and schedule = '0 * * * *' and command like '%tutup_sesi_semua%';
    insert into hasil_uji (uji, lulus, catatan) values ('J2 Job pg_cron noantree-tutup-sesi tiap jam terpasang', v_n = 1, 'job ' || v_n);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J2 Job pg_cron', false, sqlerrm);
  end;

  -- J3: view lapak_publik terbaca dan memakai status_lapak (waktu sungguhan)
  begin
    select status into v_status from public.lapak_publik where id = v_lapak_b;
    insert into hasil_uji (uji, lulus, catatan) values (
      'J3 lapak_publik terbaca; lapak tanpa jadwal dan tanpa sesi aktif = Tutup', v_status = 'tutup', v_status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('J3 lapak_publik', false, sqlerrm);
  end;

  -- ---------- Bersihkan ----------
  delete from auth.users where id in (v_a, v_b);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
