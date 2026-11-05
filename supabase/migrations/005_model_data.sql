-- 005_model_data.sql
-- Model data MVP (PRD bagian 5) dan keamanan RLS (PRD bagian 8).
-- Dijalankan setelah 003 (wilayah) dan 004 (hapus tabel lama).
-- Semua waktu lokal memakai zona Asia/Jakarta (WIB).

-- ============================================================
-- 1. TABEL
-- ============================================================

create table if not exists public.profil (
  id              uuid primary key references auth.users(id) on delete cascade,
  nama_tampilan   text,
  foto_url        text,
  is_admin        boolean not null default false,
  dibuat_pada     timestamptz not null default now()
);

create table if not exists public.usaha (
  id           uuid primary key default gen_random_uuid(),
  pemilik_id   uuid not null references public.profil(id) on delete cascade,
  nama         text not null,
  dibuat_pada  timestamptz not null default now()
);

create table if not exists public.lapak (
  id             uuid primary key default gen_random_uuid(),
  usaha_id       uuid not null references public.usaha(id) on delete cascade,
  pemilik_id     uuid not null references public.profil(id) on delete cascade,
  nama           text not null,
  slug           text not null unique,
  deskripsi      text check (deskripsi is null or (deskripsi !~* 'http|www\.')),
  foto_url       text,
  status_tayang  text not null default 'draf'
                 check (status_tayang in ('draf', 'tayang', 'disembunyikan')),
  langkah_daftar smallint not null default 1 check (langkah_daftar between 1 and 3),
  dibuat_pada    timestamptz not null default now(),
  diubah_pada    timestamptz not null default now()
);

create table if not exists public.foto_lapak (
  id        uuid primary key default gen_random_uuid(),
  lapak_id  uuid not null references public.lapak(id) on delete cascade,
  url       text not null,
  urutan    smallint not null default 1
);

create table if not exists public.tempat (
  id                uuid primary key default gen_random_uuid(),
  lapak_id          uuid not null references public.lapak(id) on delete cascade,
  nama              text not null,
  lat               double precision,
  lng               double precision,
  link_maps         text,
  kecamatan_id      uuid references public.wilayah(id),
  terakhir_dipakai  timestamptz,
  dibuat_pada       timestamptz not null default now()
);

create table if not exists public.jadwal (
  id          uuid primary key default gen_random_uuid(),
  lapak_id    uuid not null references public.lapak(id) on delete cascade,
  hari        smallint not null check (hari between 0 and 6),   -- 0 = Minggu ... 6 = Sabtu
  jam_mulai   time not null,
  jam_selesai time not null
);

create table if not exists public.sesi_buka (
  id                       uuid primary key default gen_random_uuid(),
  lapak_id                 uuid not null references public.lapak(id) on delete cascade,
  tempat_id                uuid references public.tempat(id) on delete set null,
  mulai_pada               timestamptz not null default now(),
  berakhir_pada            timestamptz not null,
  status                   text not null default 'buka' check (status in ('buka', 'habis')),
  status_sejak            timestamptz not null default now(),
  diakhiri_pada            timestamptz,
  cara_akhir               text check (cara_akhir in ('manual', 'otomatis')),
  total_perpanjangan_menit integer not null default 0,
  dari_jadwal              boolean not null default false,
  akhir_dilihat_pemilik    timestamptz
);

-- Maks. 1 sesi aktif per lapak
create unique index if not exists sesi_aktif_satu_per_lapak
  on public.sesi_buka (lapak_id) where diakhiri_pada is null;

create table if not exists public.pengikut (
  pelanggan_id  uuid not null references public.profil(id) on delete cascade,
  lapak_id      uuid not null references public.lapak(id) on delete cascade,
  dibuat_pada   timestamptz not null default now(),
  primary key (pelanggan_id, lapak_id)
);

create table if not exists public.laporan (
  id           uuid primary key default gen_random_uuid(),
  lapak_id     uuid not null references public.lapak(id) on delete cascade,
  pelapor_id   uuid not null references public.profil(id) on delete cascade,
  alasan       text not null,
  catatan      text,
  dibuat_pada  timestamptz not null default now(),
  status       text not null default 'baru' check (status in ('baru', 'diabaikan', 'ditindak'))
);

create table if not exists public.tindakan_admin (
  id           uuid primary key default gen_random_uuid(),
  lapak_id     uuid not null references public.lapak(id) on delete cascade,
  admin_id     uuid not null references public.profil(id),
  aksi         text not null check (aksi in ('sembunyikan', 'tampilkan')),
  catatan      text,
  dibuat_pada  timestamptz not null default now()
);

create table if not exists public.cek_link (
  id           uuid primary key default gen_random_uuid(),
  pemilik_id   uuid not null references public.profil(id) on delete cascade,
  dibuat_pada  timestamptz not null default now()
);

-- ============================================================
-- 2. FUNGSI BANTU
-- ============================================================

-- Apakah pengguna yang sedang masuk adalah admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select p.is_admin from public.profil p where p.id = auth.uid()), false);
$$;

-- Jadwal yang berlaku untuk lapak pada waktu tertentu.
-- Mengembalikan sesi jadwal yang sedang berjalan atau yang akan dimulai hari ini,
-- termasuk kalau pemilik memulai lebih awal (tanpa batas jam awal).
-- Jadwal yang lewat tengah malam dihitung milik hari mulainya.
create or replace function public.jadwal_sekarang(p_lapak uuid, p_now timestamptz default now())
returns table (mulai timestamptz, selesai timestamptz)
language sql stable security definer set search_path = public
as $$
  select
    (c.tgl + j.jam_mulai)::timestamp at time zone 'Asia/Jakarta' as mulai,
    (c.tgl + j.jam_selesai
       + case when j.jam_selesai <= j.jam_mulai then interval '1 day' else interval '0 day' end
    )::timestamp at time zone 'Asia/Jakarta' as selesai
  from public.jadwal j
  cross join lateral (
    select ((p_now at time zone 'Asia/Jakarta')::date + g) as tgl
    from generate_series(-1, 0) as g
  ) c
  where j.lapak_id = p_lapak
    and extract(dow from c.tgl)::int = j.hari
    and p_now < (c.tgl + j.jam_selesai
       + case when j.jam_selesai <= j.jam_mulai then interval '1 day' else interval '0 day' end
    )::timestamp at time zone 'Asia/Jakarta'
  order by mulai
  limit 1;
$$;

-- Profil dibuat otomatis saat akun pertama kali masuk
create or replace function public.buat_profil_baru()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profil (id, nama_tampilan)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists saat_akun_baru on auth.users;
create trigger saat_akun_baru
  after insert on auth.users
  for each row execute function public.buat_profil_baru();

-- ============================================================
-- 3. BATAS JUMLAH DAN ATURAN DATA (trigger)
-- ============================================================

create or replace function public.cek_batas_tempat()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.tempat where lapak_id = new.lapak_id) >= 10 then
    raise exception 'Maksimal 10 tempat per lapak';
  end if;
  return new;
end;
$$;

drop trigger if exists batas_tempat on public.tempat;
create trigger batas_tempat
  before insert on public.tempat
  for each row execute function public.cek_batas_tempat();

create or replace function public.cek_batas_foto()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.foto_lapak where lapak_id = new.lapak_id) >= 4 then
    raise exception 'Maksimal 4 foto per lapak';
  end if;
  return new;
end;
$$;

drop trigger if exists batas_foto on public.foto_lapak;
create trigger batas_foto
  before insert on public.foto_lapak
  for each row execute function public.cek_batas_foto();

create or replace function public.cek_ikuti_lapak_sendiri()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.lapak where id = new.lapak_id and pemilik_id = new.pelanggan_id) then
    raise exception 'Pemilik tidak bisa mengikuti lapaknya sendiri';
  end if;
  return new;
end;
$$;

drop trigger if exists ikuti_lapak_sendiri on public.pengikut;
create trigger ikuti_lapak_sendiri
  before insert on public.pengikut
  for each row execute function public.cek_ikuti_lapak_sendiri();

-- ============================================================
-- 4. VIEW PUBLIK: lapak_publik (status efektif, PRD bagian 5)
-- ============================================================
-- Urutan: (1) disembunyikan/draf tidak tampil, (2) sesi aktif = Lagi buka atau Habis,
-- (3) dalam jadwal dan belum ada sesi sejak awal jadwal = Biasanya buka, (4) selain itu Tutup.

create or replace view public.lapak_publik as
select
  l.id,
  l.slug,
  l.nama,
  l.deskripsi,
  l.foto_url,
  case
    when sa.id is not null then sa.status
    when jw.mulai is not null and jw.mulai <= now()
         and not exists (
           select 1 from public.sesi_buka s
           where s.lapak_id = l.id and s.mulai_pada >= jw.mulai
         ) then 'biasanya_buka'
    else 'tutup'
  end as status,
  sa.berakhir_pada,
  tp.id          as tempat_id,
  tp.nama        as tempat_nama,
  tp.lat         as tempat_lat,
  tp.lng         as tempat_lng,
  tp.link_maps   as tempat_link_maps,
  (select count(*) from public.pengikut p where p.lapak_id = l.id) as jumlah_pengikut
from public.lapak l
left join lateral (
  select s.* from public.sesi_buka s
  where s.lapak_id = l.id and s.diakhiri_pada is null and s.berakhir_pada > now()
  limit 1
) sa on true
left join lateral (
  select j.mulai from public.jadwal_sekarang(l.id) j limit 1
) jw on true
left join lateral (
  select t.* from public.tempat t
  where t.lapak_id = l.id
  order by (t.id = sa.tempat_id) desc nulls last, t.terakhir_dipakai desc nulls last
  limit 1
) tp on true
where l.status_tayang = 'tayang';

-- ============================================================
-- 5. FUNGSI PEMILIK (satu-satunya jalan mengubah sesi_buka)
-- ============================================================

create or replace function public.cek_pemilik_lapak(p_lapak uuid)
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.lapak where id = p_lapak and pemilik_id = auth.uid()
  ) then
    raise exception 'Bukan pemilik lapak ini';
  end if;
end;
$$;

-- Mulai buka. Dalam jadwal (termasuk lebih awal): berakhir = akhir jadwal. Di luar jadwal: +4 jam.
create or replace function public.mulai_buka(p_lapak uuid, p_tempat uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_jw     record;
  v_id     uuid;
  v_akhir  timestamptz;
  v_dari   boolean;
begin
  perform public.cek_pemilik_lapak(p_lapak);

  -- Sesi yang sudah lewat waktunya ditutup otomatis dulu
  update public.sesi_buka
     set diakhiri_pada = berakhir_pada, cara_akhir = 'otomatis'
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada <= v_now;

  if exists (select 1 from public.sesi_buka where lapak_id = p_lapak and diakhiri_pada is null) then
    raise exception 'Lapak sudah buka';
  end if;

  select * into v_jw from public.jadwal_sekarang(p_lapak, v_now) limit 1;
  if found then
    v_akhir := v_jw.selesai;
    v_dari  := true;
  else
    v_akhir := v_now + interval '4 hours';
    v_dari  := false;
  end if;

  insert into public.sesi_buka (lapak_id, tempat_id, mulai_pada, berakhir_pada, status, status_sejak, dari_jadwal)
  values (p_lapak, p_tempat, v_now, v_akhir, 'buka', v_now, v_dari)
  returning id into v_id;

  if p_tempat is not null then
    update public.tempat set terakhir_dipakai = v_now where id = p_tempat;
  end if;

  return v_id;
end;
$$;

-- Ubah status sesi aktif: 'buka' atau 'habis'
create or replace function public.ubah_status(p_lapak uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);
  if p_status not in ('buka', 'habis') then
    raise exception 'Status tidak dikenal';
  end if;

  update public.sesi_buka
     set status = p_status, status_sejak = now()
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada > now();

  if not found then
    raise exception 'Tidak ada sesi aktif';
  end if;
end;
$$;

-- Perpanjang 60 menit, maks. total 480 menit (8 jam) per sesi
create or replace function public.perpanjang(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_total integer;
begin
  perform public.cek_pemilik_lapak(p_lapak);

  select total_perpanjangan_menit into v_total
    from public.sesi_buka
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada > now();

  if not found then
    raise exception 'Tidak ada sesi aktif';
  end if;
  if v_total + 60 > 480 then
    raise exception 'Batas 8 jam per sesi sudah tercapai';
  end if;

  update public.sesi_buka
     set berakhir_pada = berakhir_pada + interval '60 minutes',
         total_perpanjangan_menit = total_perpanjangan_menit + 60
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada > now();
end;
$$;

-- Selesai: akhiri sesi aktif secara manual
create or replace function public.selesai(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.cek_pemilik_lapak(p_lapak);

  update public.sesi_buka
     set diakhiri_pada = now(), cara_akhir = 'manual'
   where lapak_id = p_lapak and diakhiri_pada is null and berakhir_pada > now();

  if not found then
    raise exception 'Tidak ada sesi aktif';
  end if;
end;
$$;

-- Batalkan Selesai dalam 5 detik
create or replace function public.batalkan_selesai(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.cek_pemilik_lapak(p_lapak);

  select id into v_id from public.sesi_buka
   where lapak_id = p_lapak and cara_akhir = 'manual'
     and diakhiri_pada > now() - interval '5 seconds'
   order by diakhiri_pada desc
   limit 1;

  if v_id is null then
    raise exception 'Tidak bisa dibatalkan (lewat 5 detik)';
  end if;

  update public.sesi_buka
     set diakhiri_pada = null, cara_akhir = null
   where id = v_id;
end;
$$;

-- Laporan dari pelanggan: 1 per pelanggan per lapak per hari WIB, tidak untuk lapak sendiri
create or replace function public.lapor_lapak(p_lapak uuid, p_alasan text, p_catatan text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu';
  end if;
  if exists (select 1 from public.lapak where id = p_lapak and pemilik_id = auth.uid()) then
    raise exception 'Tidak bisa melaporkan lapak sendiri';
  end if;
  if exists (
    select 1 from public.laporan
     where lapak_id = p_lapak and pelapor_id = auth.uid()
       and (dibuat_pada at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
  ) then
    raise exception 'Sudah melapor lapak ini hari ini';
  end if;

  insert into public.laporan (lapak_id, pelapor_id, alasan, catatan)
  values (p_lapak, auth.uid(), p_alasan, p_catatan);
end;
$$;

-- ============================================================
-- 6. ROW LEVEL SECURITY (PRD bagian 8)
-- ============================================================

alter table public.profil         enable row level security;
alter table public.usaha          enable row level security;
alter table public.lapak          enable row level security;
alter table public.foto_lapak     enable row level security;
alter table public.tempat         enable row level security;
alter table public.jadwal         enable row level security;
alter table public.sesi_buka      enable row level security;
alter table public.pengikut       enable row level security;
alter table public.laporan        enable row level security;
alter table public.tindakan_admin enable row level security;
alter table public.cek_link       enable row level security;

-- profil: baca diri sendiri atau admin; ubah diri sendiri (is_admin hanya lewat SQL)
create policy "profil baca sendiri atau admin" on public.profil
  for select using (id = auth.uid() or public.is_admin());
create policy "profil ubah sendiri" on public.profil
  for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select p.is_admin from public.profil p where p.id = auth.uid()));

-- usaha: pemilik saja
create policy "usaha kelola pemilik" on public.usaha
  for all using (pemilik_id = auth.uid()) with check (pemilik_id = auth.uid());

-- lapak: pemilik kelola miliknya; admin boleh mengubah (sembunyikan, tampilkan)
create policy "lapak kelola pemilik" on public.lapak
  for all using (pemilik_id = auth.uid()) with check (pemilik_id = auth.uid());
create policy "lapak admin ubah" on public.lapak
  for update using (public.is_admin()) with check (public.is_admin());

-- tabel turunan lapak: pemilik lapak saja (publik lewat view)
create policy "foto kelola pemilik" on public.foto_lapak
  for all using (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()))
  with check (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()));
create policy "tempat kelola pemilik" on public.tempat
  for all using (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()))
  with check (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()));
create policy "jadwal kelola pemilik" on public.jadwal
  for all using (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()))
  with check (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()));

-- sesi_buka: pemilik baca miliknya; ubah hanya lewat fungsi di atas
create policy "sesi baca pemilik" on public.sesi_buka
  for select using (exists (select 1 from public.lapak l where l.id = lapak_id and l.pemilik_id = auth.uid()));

-- pengikut: pelanggan kelola miliknya (pemilik tidak melihat daftar nama)
create policy "pengikut kelola sendiri" on public.pengikut
  for all using (pelanggan_id = auth.uid()) with check (pelanggan_id = auth.uid());

-- laporan dan tindakan_admin: admin saja (pelapor lewat lapor_lapak)
create policy "laporan baca admin" on public.laporan
  for select using (public.is_admin());
create policy "laporan ubah admin" on public.laporan
  for update using (public.is_admin()) with check (public.is_admin());
create policy "tindakan admin saja" on public.tindakan_admin
  for all using (public.is_admin()) with check (public.is_admin());

-- cek_link: pemilik baca miliknya; tulis hanya dari Edge Function (service role)
create policy "cek link baca sendiri" on public.cek_link
  for select using (pemilik_id = auth.uid());

-- ============================================================
-- 7. HAK AKSES
-- ============================================================

-- Publik membaca lapak lewat view saja
grant select on public.lapak_publik to anon, authenticated;

-- Hanya pengguna masuk yang boleh menjalankan fungsi pemilik dan lapor
revoke execute on function public.mulai_buka(uuid, uuid) from public;
revoke execute on function public.ubah_status(uuid, text) from public;
revoke execute on function public.perpanjang(uuid) from public;
revoke execute on function public.selesai(uuid) from public;
revoke execute on function public.batalkan_selesai(uuid) from public;
revoke execute on function public.lapor_lapak(uuid, text, text) from public;
grant execute on function public.mulai_buka(uuid, uuid) to authenticated;
grant execute on function public.ubah_status(uuid, text) to authenticated;
grant execute on function public.perpanjang(uuid) to authenticated;
grant execute on function public.selesai(uuid) to authenticated;
grant execute on function public.batalkan_selesai(uuid) to authenticated;
grant execute on function public.lapor_lapak(uuid, text, text) to authenticated;

-- Cek yang dijalankan setelah file ini (di SQL Editor):
-- select * from public.lapak_publik;               -- kosong dulu, belum ada lapak
-- select to_regclass('public.sesi_buka');           -- harus muncul nama tabel
