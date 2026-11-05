-- 023_admin_semua_disembunyikan.sql
-- Tab Semua lapak (V19) dan Disembunyikan (V35) untuk admin (PRD A46, A47). Dijalankan setelah 022.
-- Fungsi di 021 dan 022 tidak diubah. Kedua fungsi di sini hanya membaca dan hanya untuk admin.
-- Sembunyikan (V19) dan Tampilkan lagi (V35) tetap lewat admin_tindak_lapak (021).

-- ============================================================
-- 1. SEMUA LAPAK (V19)
-- ============================================================
-- Lapak tayang dan disembunyikan, terbaru di atas. Draf tidak ikut: belum tayang dan belum tentu punya slug.
-- p_cari mencocokkan nama lapak tanpa membedakan huruf besar kecil. Kosong atau null = semua.
-- Dicocokkan dengan position(), bukan ilike, supaya % dan _ di kata cari tidak jadi wildcard.
-- kecamatan_nama: kecamatan tempat yang terakhir dipakai (atau yang terakhir dibuat), kosong kalau belum ada.

create or replace function public.admin_daftar_semua_lapak(p_cari text default null)
returns table (
  lapak_id        uuid,
  slug            text,
  nama            text,
  foto_url        text,
  status_tayang   text,
  dibuat_pada     timestamptz,
  kecamatan_nama  text
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_cari text := lower(trim(coalesce(p_cari, '')));
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  return query
    select l.id, l.slug, l.nama, l.foto_url, l.status_tayang, l.dibuat_pada,
           (select w.nama
              from public.tempat t
              join public.wilayah w on w.id = t.kecamatan_id
             where t.lapak_id = l.id
             order by t.terakhir_dipakai desc nulls last, t.dibuat_pada desc
             limit 1)
      from public.lapak l
     where l.status_tayang in ('tayang', 'disembunyikan')
       and (v_cari = '' or position(v_cari in lower(l.nama)) > 0)
     order by l.dibuat_pada desc, l.id;
end;
$$;

-- ============================================================
-- 2. DISEMBUNYIKAN (V35)
-- ============================================================
-- Lapak yang sedang disembunyikan, yang terakhir disembunyikan di atas.
-- disembunyikan_pada dan catatan_admin diambil dari tindakan 'sembunyikan' terakhir di tindakan_admin.
-- Keduanya kosong kalau lapak disembunyikan tanpa lewat admin_tindak_lapak.
-- alasan_terbanyak dihitung dari laporan berstatus ditindak, yaitu laporan yang ikut ditindak saat lapak
-- disembunyikan (A47). Seri dipecah oleh laporan paling baru, lalu abjad. Kosong kalau tidak ada.

create or replace function public.admin_daftar_disembunyikan()
returns table (
  lapak_id            uuid,
  slug                text,
  nama                text,
  foto_url            text,
  disembunyikan_pada  timestamptz,
  catatan_admin       text,
  alasan_terbanyak    text
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  return query
    select l.id, l.slug, l.nama, l.foto_url, s.dibuat_pada, s.catatan,
           (select r.alasan
              from public.laporan r
             where r.lapak_id = l.id and r.status = 'ditindak'
             group by r.alasan
             order by count(*) desc, max(r.dibuat_pada) desc, r.alasan
             limit 1)
      from public.lapak l
      left join lateral (
        select t.dibuat_pada, t.catatan
          from public.tindakan_admin t
         where t.lapak_id = l.id and t.aksi = 'sembunyikan'
         order by t.dibuat_pada desc
         limit 1
      ) s on true
     where l.status_tayang = 'disembunyikan'
     order by s.dibuat_pada desc nulls last, l.nama, l.id;
end;
$$;

-- ============================================================
-- 3. HAK AKSES (sama dengan 022)
-- ============================================================
-- Pemeriksaan is_admin di dalam fungsi tetap jadi penjaga utama.
revoke execute on function public.admin_daftar_semua_lapak(text) from public, anon;
grant execute on function public.admin_daftar_semua_lapak(text) to authenticated;

revoke execute on function public.admin_daftar_disembunyikan() from public, anon;
grant execute on function public.admin_daftar_disembunyikan() to authenticated;
