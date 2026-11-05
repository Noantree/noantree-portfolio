import { supabase } from './supabase'
import { infoKartu } from './beranda'
import type { LapakCari } from './cari'
import { jamWIB, ringkasJadwal, teksTerakhirBuka, type BarisJadwal } from './waktu'

// Ikuti dan Diikuti (A41, A42, A43; V2, V7, V33). Tulis hanya lewat fungsi ikuti_lapak dan berhenti_ikuti
// (020); keduanya idempotent dan menolak lapak sendiri di database. Yang dikirim hanya id lapak (A21).

export async function ikuti(lapakId: string) {
  const { error } = await supabase.rpc('ikuti_lapak', { p_lapak: lapakId })
  if (error) throw error
}

export async function berhentiIkuti(lapakId: string) {
  const { error } = await supabase.rpc('berhenti_ikuti', { p_lapak: lapakId })
  if (error) throw error
}

// Baris pengikut milik akun sendiri (RLS hanya mengembalikan baris sendiri)
async function idDiikuti(): Promise<string[]> {
  const { data, error } = await supabase.from('pengikut').select('lapak_id')
  if (error) throw error
  return ((data ?? []) as { lapak_id: string }[]).map((r) => r.lapak_id)
}

export async function sedangMengikuti(lapakId: string): Promise<boolean> {
  const { data, error } = await supabase.from('pengikut').select('lapak_id').eq('lapak_id', lapakId).maybeSingle()
  if (error) throw error
  return data !== null
}

// Jumlah di tombol ♡ header: hanya lapak yang masih tampil ke publik, sama dengan isi V7
export async function jumlahDiikuti(): Promise<number> {
  const ids = await idDiikuti()
  if (ids.length === 0) return 0
  const { count, error } = await supabase.from('lapak_publik').select('id', { count: 'exact', head: true }).in('id', ids)
  if (error) throw error
  return count ?? 0
}

export type LapakDiikuti = LapakCari & { terakhir_buka_pada: string | null }

// V7: dua kelompok. Lagi buka berisi Lagi buka dan Habis; Biasanya buka masuk Sedang tutup dengan chipnya sendiri.
// Lapak yang disembunyikan tidak ada di lapak_publik, jadi tidak tampil, tetapi barisnya tetap ada (A47).
export type IsiDiikuti = { lagiBuka: LapakDiikuti[]; sedangTutup: LapakDiikuti[]; jadwal: Record<string, string> }

const KOLOM =
  'id, slug, nama, deskripsi, foto_url, status, berakhir_pada, tempat_nama, tempat_lat, tempat_lng, jumlah_pengikut, ' +
  'jadwal_mulai, jadwal_selesai, terakhir_buka_pada'

export async function muatDiikuti(): Promise<IsiDiikuti> {
  const ids = await idDiikuti()
  if (ids.length === 0) return { lagiBuka: [], sedangTutup: [], jadwal: {} }
  const [lapak, jadwal] = await Promise.all([
    supabase.from('lapak_publik').select(KOLOM).in('id', ids),
    supabase.from('jadwal_lapak_publik').select('lapak_id, hari, jam_mulai, jam_selesai').in('lapak_id', ids),
  ])
  if (lapak.error) throw lapak.error
  if (jadwal.error) throw jadwal.error
  const semua = (lapak.data ?? []) as unknown as LapakDiikuti[]
  const perLapak: Record<string, BarisJadwal[]> = {}
  for (const j of (jadwal.data ?? []) as (BarisJadwal & { lapak_id: string })[]) (perLapak[j.lapak_id] ??= []).push(j)
  const ringkas: Record<string, string> = {}
  for (const [id, baris] of Object.entries(perLapak)) {
    const pertama = ringkasJadwal(baris)[0]
    if (pertama) ringkas[id] = pertama
  }
  return {
    lagiBuka: semua.filter((l) => l.status === 'buka' || l.status === 'habis'),
    sedangTutup: semua.filter((l) => l.status === 'tutup' || l.status === 'biasanya_buka'),
    jadwal: ringkas,
  }
}

// Keterangan baris V7: "Depan Pasar Sragen · sampai 14.00", "Biasanya di … · 10.00–15.00",
// "Jadwal setiap hari 10.00–16.00", "Jadwal tidak tetap · terakhir buka kemarin"
export function infoDiikuti(l: LapakDiikuti, jadwal: Record<string, string>, sekarang: number): string {
  if (l.status === 'biasanya_buka') {
    const jam =
      l.jadwal_mulai && l.jadwal_selesai ? `${jamWIB(new Date(l.jadwal_mulai))}⁠–⁠${jamWIB(new Date(l.jadwal_selesai))}` : ''
    return [l.tempat_nama ? `Biasanya di ${l.tempat_nama}` : '', jam].filter(Boolean).join(' · ')
  }
  if (l.status === 'tutup') {
    if (jadwal[l.id]) return `Jadwal ${jadwal[l.id].replace(' · ', ' ').replace(/^Setiap hari/, 'setiap hari')}`
    const terakhir = l.terakhir_buka_pada ? teksTerakhirBuka(new Date(l.terakhir_buka_pada).getTime(), sekarang) : null
    return terakhir ? `Jadwal tidak tetap · terakhir buka ${terakhir}` : 'Jadwal tidak tetap'
  }
  return infoKartu({ ...l, status: l.status })
}
