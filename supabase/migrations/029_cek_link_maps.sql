-- 029_cek_link_maps.sql
-- Batas cek link Google Maps: 10 per pemilik per hari WIB (A33). Dijalankan setelah 028.
-- Fungsi di 001 sampai 028 tidak diubah. Tabel cek_link (005) dan RLS-nya ("cek link baca sendiri") tidak diubah.
--
-- catat_cek_link dipanggil HANYA oleh Edge Function cek-link-maps dengan kunci service role (variabel lingkungan
-- Supabase, tidak pernah di kode). Pemilik tidak bisa memanggilnya langsung, jadi kuota tidak bisa dilewati.
-- Edge Function memanggilnya sebelum memeriksa link, jadi setiap permintaan yang sampai ke server ikut terhitung.
--
-- Batas hari memakai WIB (Asia/Jakarta), bukan waktu server atau UTC (CLAUDE.md):
--   awal hari ini = date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
-- Baris profil pemilik dikunci (for update), supaya dua permintaan bersamaan tidak melewati batas.
-- Hasil: true = dicatat (masih ada kuota), false = batas 10 hari ini sudah habis.

create or replace function public.catat_cek_link(p_pemilik uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_awal timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
begin
  perform 1 from public.profil where id = p_pemilik for update;
  if not found then
    raise exception 'Akun tidak dikenal';
  end if;

  if (select count(*) from public.cek_link
       where pemilik_id = p_pemilik
         and dibuat_pada >= v_awal
         and dibuat_pada < v_awal + interval '1 day') >= 10 then
    return false;
  end if;

  insert into public.cek_link (pemilik_id) values (p_pemilik);
  return true;
end;
$$;

revoke all on function public.catat_cek_link(uuid) from public, anon, authenticated;
grant execute on function public.catat_cek_link(uuid) to service_role;
