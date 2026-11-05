import { supabase } from './supabase'

// Laporkan lapak (A44; V9, V2). Tulis hanya lewat fungsi lapor_lapak (021): wajib centang pernyataan,
// lapak harus tayang, menolak lapak sendiri, dan membatasi 1 laporan per akun per lapak per 30 hari.
// Pemilik tidak pernah melihat pelapornya. Yang dikirim hanya id lapak, alasan, catatan, dan centang (A21).

export const ALASAN_LAPOR = [
  'Lapak tidak ada / akun iseng',
  'Status tidak sesuai',
  'Tempat salah',
  'Konten tidak pantas',
  'Lainnya',
] as const

export type AlasanLapor = (typeof ALASAN_LAPOR)[number]

export const MAKS_CATATAN_LAPOR = 200

export async function laporLapak(lapakId: string, alasan: AlasanLapor, catatan: string | null, pernyataan: boolean) {
  const { error } = await supabase.rpc('lapor_lapak', {
    p_lapak: lapakId,
    p_alasan: alasan,
    p_catatan: catatan,
    p_pernyataan: pernyataan,
  })
  if (error) throw error
}
