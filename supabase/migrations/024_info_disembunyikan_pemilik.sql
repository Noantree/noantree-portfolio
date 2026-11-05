-- 024_info_disembunyikan_pemilik.sql
-- Layar pemilik V17 "Lapakmu sedang disembunyikan" (PRD A9, A47, A48). Dijalankan setelah 023.
-- Fungsi di 005, 016, 021, 022, dan 023 tidak diubah.
--
-- A9 (lapak disembunyikan tidak bisa Mulai buka) sudah ditegakkan di database oleh inti_mulai_buka
-- (016): status disembunyikan ditolak dengan pesan "Lapakmu sedang disembunyikan...". Migrasi ini tidak
-- menyentuhnya; hanya tes s5_4c_uji.sql yang memastikannya tetap berlaku.
--
-- Pemilik tidak boleh membaca tabel laporan atau tindakan_admin (hanya admin). Karena itu V17 membaca
-- lewat satu fungsi khusus pemilik yang hanya mengembalikan dua hal yang ada di desain:
--   - disembunyikan_pada : waktu tindakan 'sembunyikan' terakhir di tindakan_admin
--   - alasan             : alasan terbanyak dari laporan berstatus ditindak (laporan yang ikut ditindak saat
--                          lapak disembunyikan, A47). Seri dipecah oleh laporan paling baru, lalu abjad.
-- Tidak mengembalikan nama atau email pelapor, jumlah pelapor, id laporan, atau catatan admin.
-- Catatan admin bersifat internal dan tidak ada di desain V17, jadi tidak dikirim ke pemilik.
--
-- Hasil:
--   - 0 baris : lapak tidak sedang disembunyikan (tayang atau draf).
--   - 1 baris : lapak disembunyikan. Kedua kolom bisa kosong kalau lapak disembunyikan tanpa lewat
--               admin_tindak_lapak; layar menampilkan teks umum.

create or replace function public.pemilik_info_disembunyikan(p_lapak uuid)
returns table (
  disembunyikan_pada timestamptz,
  alasan             text
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  -- Sama dengan fungsi pemilik lain (005): tamu dan bukan pemilik ditolak dengan pesan yang sama
  perform public.cek_pemilik_lapak(p_lapak);

  return query
    select (select t.dibuat_pada
              from public.tindakan_admin t
             where t.lapak_id = l.id and t.aksi = 'sembunyikan'
             order by t.dibuat_pada desc
             limit 1),
           (select r.alasan
              from public.laporan r
             where r.lapak_id = l.id and r.status = 'ditindak'
             group by r.alasan
             order by count(*) desc, max(r.dibuat_pada) desc, r.alasan
             limit 1)
      from public.lapak l
     where l.id = p_lapak and l.status_tayang = 'disembunyikan';
end;
$$;

-- Hak akses sama dengan fungsi pemilik di 005 dan 016: anon dicabut, authenticated boleh.
-- Pemeriksaan pemilik di dalam fungsi tetap jadi penjaga utama.
revoke execute on function public.pemilik_info_disembunyikan(uuid) from public, anon;
grant execute on function public.pemilik_info_disembunyikan(uuid) to authenticated;
