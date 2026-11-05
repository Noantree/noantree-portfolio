-- s3_1_uji.sql
-- Uji S3.1 (PRD bagian 10, Sprint 3) untuk fungsi di 016_status_harian.sql, dengan waktu tiruan.
-- BUKAN migrasi: jalankan manual di SQL Editor Supabase (sebagai postgres) SETELAH 016 dijalankan.
--
-- Cara kerja:
--   - Membuat dua akun uji, dua lapak tayang, tempat, dan jadwal. Semua data uji dihapus lagi di akhir.
--   - auth.uid() ditiru dengan request.jwt.claims; waktu ditiru lewat parameter p_now fungsi inti_*.
--   - Hasil ditulis ke tabel sementara hasil_uji dan ditampilkan di akhir. Semua baris harus lulus = true.
--   - Kalau blok DO gagal di tengah, semua perubahan dibatalkan otomatis (tidak ada data uji yang tertinggal).
--
-- Tanggal uji (WIB): Senin 2 Nov 2026, Selasa 3 Nov 2026, Rabu 4 Nov 2026.
-- Jadwal lapak A: Senin 06.00–14.00 dan Selasa 18.00–02.00 (lewat tengah malam). Lapak B tanpa jadwal.
--
-- Belum diuji di sini (bagian dari S3.3): status publik di view lapak_publik setelah sesi lewat waktu atau
-- setelah Selesai, dan layar V28 sekali. View memakai now() asli sehingga tidak bisa diberi waktu tiruan.

drop table if exists pg_temp.hasil_uji;
create temp table hasil_uji (
  no      serial,
  uji     text,
  lulus   boolean,
  catatan text
);

do $$
declare
  v_a       uuid := gen_random_uuid();   -- pemilik lapak A
  v_b       uuid := gen_random_uuid();   -- pemilik lapak B
  v_usaha_a uuid;
  v_usaha_b uuid;
  v_lapak_a uuid;
  v_lapak_b uuid;
  v_t1      uuid;   -- tempat A, lebih lama dipakai
  v_t2      uuid;   -- tempat A, terakhir dipakai
  v_tb      uuid;   -- satu-satunya tempat B
  v_id      uuid;
  v_s       public.sesi_buka%rowtype;
  v_i       int;
  v_senin   date := '2026-11-02';
  v_selasa  date := '2026-11-03';
  v_rabu    date := '2026-11-04';
begin
  -- ---------- Persiapan ----------
  insert into auth.users (id, instance_id, aud, role, email)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s31-a@contoh.invalid'),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uji-s31-b@contoh.invalid');
  -- Profil dibuat otomatis oleh trigger saat_akun_baru (005)

  insert into public.usaha (pemilik_id, nama) values (v_a, 'Uji A') returning id into v_usaha_a;
  insert into public.usaha (pemilik_id, nama) values (v_b, 'Uji B') returning id into v_usaha_b;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha_a, v_a, 'Uji A', 'uji-s31-a-' || substr(v_a::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_a;
  insert into public.lapak (usaha_id, pemilik_id, nama, slug, status_tayang, langkah_daftar, izin_tampil_pada)
  values (v_usaha_b, v_b, 'Uji B', 'uji-s31-b-' || substr(v_b::text, 1, 8), 'tayang', 3, now())
  returning id into v_lapak_b;

  insert into public.tempat (lapak_id, nama, terakhir_dipakai) values (v_lapak_a, 'Tempat 1', '2026-10-01 08:00+07')
  returning id into v_t1;
  insert into public.tempat (lapak_id, nama, terakhir_dipakai) values (v_lapak_a, 'Tempat 2', '2026-10-20 08:00+07')
  returning id into v_t2;
  insert into public.tempat (lapak_id, nama) values (v_lapak_b, 'Tempat B') returning id into v_tb;

  insert into public.jadwal (lapak_id, hari, jam_mulai, jam_selesai) values
    (v_lapak_a, 1, '06:00', '14:00'),
    (v_lapak_a, 2, '18:00', '02:00');

  -- Masuk sebagai pemilik A
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- ---------- Aturan durasi (bagian 5) ----------

  -- U1: mulai di dalam jadwal berakhir di akhir jadwal
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U1 Mulai 10.00 untuk jadwal 06.00–14.00 berakhir 14.00',
      v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U1 Mulai di dalam jadwal', false, sqlerrm);
  end;

  -- U2: mulai 05.30 untuk jadwal 06.00–14.00 berakhir 14.00 (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '05:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U2 Mulai 05.30 untuk jadwal 06.00–14.00 berakhir 14.00',
      v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U2 Mulai 05.30', false, sqlerrm);
  end;

  -- U3: lebih dari 3 jam sebelum jadwal dihitung di luar jadwal (+4 jam)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '02:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U3 Mulai 02.30 (lebih dari 3 jam sebelum 06.00) berakhir 06.30',
      v_s.berakhir_pada = (v_senin + time '06:30')::timestamp at time zone 'Asia/Jakarta' and not v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U3 Batas 3 jam lebih awal', false, sqlerrm);
  end;

  -- U4: tepat 3 jam sebelum jadwal masih dihitung dalam jadwal
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '03:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U4 Mulai 03.00 (tepat 3 jam lebih awal) berakhir 14.00',
      v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U4 Tepat 3 jam lebih awal', false, sqlerrm);
  end;

  -- U5: di luar jadwal berakhir 4 jam kemudian (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '15:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U5 Mulai 15.00 di luar jadwal berakhir 19.00',
      v_s.berakhir_pada = (v_senin + time '19:00')::timestamp at time zone 'Asia/Jakarta' and not v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U5 Di luar jadwal', false, sqlerrm);
  end;

  -- U6: lewat tengah malam, mulai Selasa 20.00 untuk jadwal 18.00–02.00 berakhir Rabu 02.00 (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_selasa + time '20:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U6 Mulai Selasa 20.00 untuk jadwal 18.00–02.00 berakhir Rabu 02.00',
      v_s.berakhir_pada = (v_rabu + time '02:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U6 Lewat tengah malam', false, sqlerrm);
  end;

  -- U7: setelah tengah malam, mulai Rabu 01.00 masih milik sesi Selasa, berakhir Rabu 02.00
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_rabu + time '01:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U7 Mulai Rabu 01.00 (sesi Selasa 18.00–02.00) berakhir Rabu 02.00',
      v_s.berakhir_pada = (v_rabu + time '02:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U7 Setelah tengah malam', false, sqlerrm);
  end;

  -- U8: lebih awal untuk sesi lewat tengah malam, Selasa 15.30 berakhir Rabu 02.00
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_selasa + time '15:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U8 Mulai Selasa 15.30 untuk jadwal 18.00–02.00 berakhir Rabu 02.00',
      v_s.berakhir_pada = (v_rabu + time '02:00')::timestamp at time zone 'Asia/Jakarta' and v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U8 Lebih awal untuk sesi lewat tengah malam', false, sqlerrm);
  end;

  -- U9: lapak tanpa jadwal berakhir 4 jam kemudian
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    v_id := public.inti_mulai_buka(v_lapak_b, null, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U9 Lapak tanpa jadwal: mulai 10.00 berakhir 14.00',
      v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta' and not v_s.dari_jadwal,
      'berakhir ' || (v_s.berakhir_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U9 Tanpa jadwal', false, sqlerrm);
  end;

  -- U10: lapak dengan satu tempat tanpa p_tempat memakai tempat itu (A2)
  begin
    insert into hasil_uji (uji, lulus, catatan) values (
      'U10 Satu tempat tanpa p_tempat memakai tempat itu (A2)', v_s.tempat_id = v_tb, null);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U10 Satu tempat', false, sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- U11: p_tempat kosong memakai tempat yang terakhir dipakai (A2)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    update public.tempat set terakhir_dipakai = '2026-10-01 08:00+07' where id = v_t1;
    update public.tempat set terakhir_dipakai = '2026-10-20 08:00+07' where id = v_t2;
    v_id := public.inti_mulai_buka(v_lapak_a, null, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U11 p_tempat kosong memakai tempat terakhir dipakai (A2)', v_s.tempat_id = v_t2, null);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U11 Tempat terakhir dipakai', false, sqlerrm);
  end;

  -- U12: tempat milik lapak lain ditolak (A2)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_tb, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U12 Tempat lapak lain ditolak (A2)', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U12 Tempat lapak lain ditolak (A2)', sqlerrm = 'Tempat tidak dikenal', sqlerrm);
  end;

  -- ---------- Satu sesi aktif, A9, pemilik ----------

  -- U13: mulai buka dua kali ditolak (maks. 1 sesi aktif)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:05')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U13 Mulai buka dua kali ditolak', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U13 Mulai buka dua kali ditolak', sqlerrm = 'Lapak sudah buka', sqlerrm);
  end;

  -- U14: lapak disembunyikan tidak bisa mulai buka (A9)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    update public.lapak set status_tayang = 'disembunyikan' where id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U14 Lapak disembunyikan ditolak (A9)', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U14 Lapak disembunyikan ditolak (A9)', sqlerrm like 'Lapakmu sedang disembunyikan%', sqlerrm);
  end;
  update public.lapak set status_tayang = 'tayang' where id = v_lapak_a;

  -- U15: lapak draf tidak bisa mulai buka
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    update public.lapak set status_tayang = 'draf' where id = v_lapak_a;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U15 Lapak draf ditolak', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U15 Lapak draf ditolak', sqlerrm = 'Selesaikan daftar lapak dulu', sqlerrm);
  end;
  update public.lapak set status_tayang = 'tayang' where id = v_lapak_a;

  -- U16: lapak disembunyikan dengan sesi berjalan tetap bisa Selesai (hanya mulai buka yang ditolak)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    update public.lapak set status_tayang = 'disembunyikan' where id = v_lapak_a;
    perform public.inti_selesai(v_lapak_a, (v_senin + time '10:30')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U16 Lapak disembunyikan tetap bisa Selesai', true, null);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U16 Lapak disembunyikan tetap bisa Selesai', false, sqlerrm);
  end;
  update public.lapak set status_tayang = 'tayang' where id = v_lapak_a;

  -- U17: bukan pemilik ditolak
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    perform public.inti_mulai_buka(v_lapak_a, null, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U17 Bukan pemilik ditolak', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U17 Bukan pemilik ditolak', sqlerrm = 'Bukan pemilik lapak ini', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- ---------- Perpanjang (A4) ----------

  -- U18: 8 kali perpanjang berhasil, ke-9 ditolak, total 480 menit (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '15:00')::timestamp at time zone 'Asia/Jakarta');
    for v_i in 1..8 loop
      perform public.inti_perpanjang(v_lapak_a, (v_senin + time '15:10')::timestamp at time zone 'Asia/Jakarta');
    end loop;
    begin
      perform public.inti_perpanjang(v_lapak_a, (v_senin + time '15:10')::timestamp at time zone 'Asia/Jakarta');
      insert into hasil_uji (uji, lulus, catatan) values ('U18 Perpanjang ke-9 ditolak', false, 'tidak ditolak');
    exception when others then
      select * into v_s from public.sesi_buka where id = v_id;
      insert into hasil_uji (uji, lulus, catatan) values (
        'U18 Perpanjang ke-9 ditolak, total 480 menit, berakhir 03.00',
        sqlerrm = 'Batas 8 jam per sesi sudah tercapai'
          and v_s.total_perpanjangan_menit = 480
          and v_s.berakhir_pada = (v_selasa + time '03:00')::timestamp at time zone 'Asia/Jakarta',
        sqlerrm || '; total ' || v_s.total_perpanjangan_menit);
    end;
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U18 Perpanjang', false, sqlerrm);
  end;

  -- ---------- Habis (bagian 5) ----------

  -- U19: Habis tidak mengubah berakhir_pada; stok ada lagi mengembalikan status buka
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_ubah_status(v_lapak_a, 'habis', (v_senin + time '11:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    if v_s.status <> 'habis' or v_s.berakhir_pada <> (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta' then
      raise exception 'Habis salah: status %, berakhir %', v_s.status, v_s.berakhir_pada;
    end if;
    perform public.inti_ubah_status(v_lapak_a, 'buka', (v_senin + time '11:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U19 Habis tidak mengubah berakhir_pada; stok ada lagi = buka',
      v_s.status = 'buka' and v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta',
      'status ' || v_s.status);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U19 Habis', false, sqlerrm);
  end;

  -- ---------- Selesai dan Batalkan (A3) ----------

  -- U20: Selesai lalu Batalkan dalam 5 detik mengembalikan Lagi buka (PRD bagian 10)
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '11:00:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_batalkan_selesai(v_lapak_a, (v_senin + time '11:00:03')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U20 Selesai lalu Batalkan dalam 5 detik: sesi aktif lagi, status buka',
      v_s.diakhiri_pada is null and v_s.cara_akhir is null and v_s.status = 'buka', null);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U20 Batalkan dalam 5 detik', false, sqlerrm);
  end;

  -- U21: Batalkan setelah 5 detik ditolak
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '11:00:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_batalkan_selesai(v_lapak_a, (v_senin + time '11:00:06')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U21 Batalkan setelah 5 detik ditolak', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U21 Batalkan setelah 5 detik ditolak', sqlerrm like 'Tidak bisa dibatalkan%', sqlerrm);
  end;

  -- ---------- Lewat waktu (A6) ----------

  -- U22: sesi yang lewat berakhir_pada ditutup otomatis saat fungsi berikutnya dipanggil
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '15:00')::timestamp at time zone 'Asia/Jakarta');
    begin
      perform public.inti_ubah_status(v_lapak_a, 'habis', (v_senin + time '19:30')::timestamp at time zone 'Asia/Jakarta');
      insert into hasil_uji (uji, lulus, catatan) values ('U22 Sesi lewat waktu tidak bisa diubah', false, 'tidak ditolak');
    exception when others then
      -- Penutupan otomatis ikut dibatalkan oleh exception di atas; panggil fungsi yang tidak gagal untuk memeriksanya
      null;
    end;
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '19:30')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U22 Sesi lewat waktu ditutup otomatis (cara_akhir otomatis, diakhiri = berakhir) dan bisa buka lagi (A6)',
      v_s.cara_akhir = 'otomatis' and v_s.diakhiri_pada = v_s.berakhir_pada,
      'cara_akhir ' || coalesce(v_s.cara_akhir, 'kosong'));
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U22 Lewat waktu', false, sqlerrm);
  end;

  -- ---------- Mulai buka offline (A8) ----------

  -- U23: waktu tombol 30 menit lalu diterima dan dipakai sebagai mulai_pada
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    v_id := public.inti_mulai_buka(v_lapak_a, v_t1,
      (v_senin + time '09:30')::timestamp at time zone 'Asia/Jakarta',
      (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    select * into v_s from public.sesi_buka where id = v_id;
    insert into hasil_uji (uji, lulus, catatan) values (
      'U23 Offline: waktu 30 menit lalu dipakai sebagai mulai_pada (A8)',
      v_s.mulai_pada = (v_senin + time '09:30')::timestamp at time zone 'Asia/Jakarta'
        and v_s.berakhir_pada = (v_senin + time '14:00')::timestamp at time zone 'Asia/Jakarta',
      'mulai ' || (v_s.mulai_pada at time zone 'Asia/Jakarta')::text);
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U23 Offline 30 menit', false, sqlerrm);
  end;

  -- U24: waktu di masa depan ditolak
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1,
      (v_senin + time '10:10')::timestamp at time zone 'Asia/Jakarta',
      (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U24 Offline: waktu di masa depan ditolak (A8)', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U24 Offline: waktu di masa depan ditolak (A8)', sqlerrm like '%masa depan%', sqlerrm);
  end;

  -- U25: lebih dari 1 jam ke belakang ditolak
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1,
      (v_senin + time '08:59')::timestamp at time zone 'Asia/Jakarta',
      (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U25 Offline: lebih dari 1 jam lalu ditolak (A8)', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U25 Offline: lebih dari 1 jam lalu ditolak (A8)', sqlerrm like '%lebih dari 1 jam%', sqlerrm);
  end;

  -- U26: sebelum sesi terakhir diakhiri ditolak
  begin
    delete from public.sesi_buka where lapak_id in (v_lapak_a, v_lapak_b);
    perform public.inti_mulai_buka(v_lapak_a, v_t1, null, (v_senin + time '09:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_selesai(v_lapak_a, (v_senin + time '10:00')::timestamp at time zone 'Asia/Jakarta');
    perform public.inti_mulai_buka(v_lapak_a, v_t1,
      (v_senin + time '09:50')::timestamp at time zone 'Asia/Jakarta',
      (v_senin + time '10:05')::timestamp at time zone 'Asia/Jakarta');
    insert into hasil_uji (uji, lulus, catatan) values ('U26 Offline: sebelum sesi terakhir diakhiri ditolak (A8)', false, 'tidak ditolak');
  exception when others then
    insert into hasil_uji (uji, lulus, catatan) values ('U26 Offline: sebelum sesi terakhir diakhiri ditolak (A8)', sqlerrm like '%sesi terakhir%', sqlerrm);
  end;

  -- ---------- Bersihkan ----------
  -- Menghapus akun uji ikut menghapus profil, usaha, lapak, tempat, jadwal, dan sesi_buka (on delete cascade)
  delete from auth.users where id in (v_a, v_b);
end;
$$;

select no, uji, lulus, catatan from hasil_uji order by no;
