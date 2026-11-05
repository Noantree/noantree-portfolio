-- 022_admin_dilaporkan.sql
-- Tab Dilaporkan untuk admin (PRD A46, A47; V18). Dijalankan setelah 021.
-- Fungsi di 021 (lapor_lapak, admin_tindak_lapak, admin_detail_laporan) tidak diubah.
--
-- admin_daftar_dilaporkan: daftar lapak, bukan daftar laporan (A46). Hanya baca; tidak menulis tabel apa pun.
--   - Lapak tampil kalau punya minimal satu laporan, apa pun statusnya (baru, diabaikan, ditindak),
--     dan apa pun status_tayang lapaknya. Jadi lapak yang sudah disembunyikan tetap muncul,
--     termasuk kalau masih punya laporan baru, dan admin tetap bisa membuka riwayatnya di V55.
--   - laporan_aktif = laporan berstatus baru; laporan_total = semua laporan lapak itu.
--   - alasan_terbanyak dihitung dari laporan baru; kalau tidak ada laporan baru, dari semua laporan.
--     Seri dipecah oleh laporan yang paling baru, lalu urutan abjad.
--   - Urutan: laporan aktif terbanyak di atas (A46), lalu laporan baru paling baru, total terbanyak, dan nama.

create or replace function public.admin_daftar_dilaporkan()
returns table (
  lapak_id              uuid,
  slug                  text,
  nama                  text,
  foto_url              text,
  status_tayang         text,
  laporan_aktif         integer,
  laporan_total         integer,
  alasan_terbanyak      text,
  laporan_baru_terakhir timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;
  return query
    with hitung as (
      select r.lapak_id as id_lapak,
             (count(*) filter (where r.status = 'baru'))::integer as aktif,
             count(*)::integer as total,
             max(r.dibuat_pada) filter (where r.status = 'baru') as baru_terakhir
        from public.laporan r
       group by r.lapak_id
    )
    select l.id, l.slug, l.nama, l.foto_url, l.status_tayang, h.aktif, h.total,
           (select r.alasan
              from public.laporan r
             where r.lapak_id = l.id and (h.aktif = 0 or r.status = 'baru')
             group by r.alasan
             order by count(*) desc, max(r.dibuat_pada) desc, r.alasan
             limit 1),
           h.baru_terakhir
      from hitung h
      join public.lapak l on l.id = h.id_lapak
     order by h.aktif desc, h.baru_terakhir desc nulls last, h.total desc, l.nama, l.id;
end;
$$;

-- Hak akses sama dengan fungsi admin di 021; anon juga dicabut, sama dengan 020.
-- Pemeriksaan is_admin di dalam fungsi tetap jadi penjaga utama.
revoke execute on function public.admin_daftar_dilaporkan() from public, anon;
grant execute on function public.admin_daftar_dilaporkan() to authenticated;
