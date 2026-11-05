import { supabase } from './supabase'
import { baca, tulis } from './pengarah'

// Filter Wilayah (V21, A17–A20). Yang disimpan di HP hanya kode dan nama wilayah pilihan (A18).

export type PilihanWilayah = {
  provinsiKode: string
  provinsiNama: string
  kabupatenKode: string | null // null = Semua kabupaten/kota
  kabupatenNama: string | null
  kecamatanKode: string | null // null = Semua kecamatan
  kecamatanNama: string | null
}

export type Daerah = { kode: string; nama: string }

// Wilayah bawaan = Kabupaten Sragen (A18)
export const WILAYAH_BAWAAN: PilihanWilayah = {
  provinsiKode: '33',
  provinsiNama: 'Jawa Tengah',
  kabupatenKode: '33.14',
  kabupatenNama: 'Sragen',
  kecamatanKode: null,
  kecamatanNama: null,
}

const KUNCI_WILAYAH = 'noantree.wilayah'

export function bacaWilayah(): PilihanWilayah {
  const w = baca<PilihanWilayah>(KUNCI_WILAYAH)
  const sah =
    w &&
    typeof w.provinsiKode === 'string' &&
    typeof w.provinsiNama === 'string' &&
    (w.kabupatenKode === null || typeof w.kabupatenKode === 'string') &&
    (w.kecamatanKode === null || (typeof w.kecamatanKode === 'string' && w.kabupatenKode !== null))
  return sah ? w : WILAYAH_BAWAAN
}

export const simpanWilayah = (w: PilihanWilayah) => tulis(KUNCI_WILAYAH, w)

// Chip dan judul memakai tingkat paling spesifik: "Jawa Tengah", "Sragen", atau "Masaran" (A19)
export const labelWilayah = (w: PilihanWilayah) => w.kecamatanNama ?? w.kabupatenNama ?? w.provinsiNama

// Nama lengkap untuk kalimat (V5, V20, V53, V54): "Kecamatan Gesi", "Kab. Sragen", "Kota Surakarta", "Jawa Tengah"
export function labelWilayahLengkap(w: PilihanWilayah): string {
  if (w.kecamatanNama) return `Kecamatan ${w.kecamatanNama}`
  if (w.kabupatenNama) return w.kabupatenNama.startsWith('Kota ') ? w.kabupatenNama : `Kab. ${w.kabupatenNama}`
  return w.provinsiNama
}

// Wilayah satu tingkat lebih luas untuk V20 dan V53 (A24). Provinsi tidak punya tingkat di atasnya.
export function wilayahLebihLuas(w: PilihanWilayah): PilihanWilayah | null {
  if (w.kecamatanKode) return { ...w, kecamatanKode: null, kecamatanNama: null }
  if (w.kabupatenKode) return { ...w, kabupatenKode: null, kabupatenNama: null, kecamatanKode: null, kecamatanNama: null }
  return null
}

// "Kabupaten Sragen" → "Sragen"; kota tetap "Kota Surakarta" supaya tidak tertukar dengan kabupaten senama
export const namaKabupaten = (nama: string) => nama.replace(/^Kabupaten /, '')

// Kolom lapak_publik yang dipakai untuk menyaring tingkat paling spesifik
export function saringanWilayah(w: PilihanWilayah): [string, string] {
  if (w.kecamatanKode) return ['tempat_kecamatan_kode', w.kecamatanKode]
  if (w.kabupatenKode) return ['tempat_kabupaten_kode', w.kabupatenKode]
  return ['tempat_provinsi_kode', w.provinsiKode]
}

async function daftarDaerah(tingkat: 'provinsi' | 'kabupaten' | 'kecamatan', induk?: string): Promise<Daerah[]> {
  let q = supabase.from('wilayah').select('kode, nama').eq('tingkat', tingkat).eq('aktif', true)
  if (induk) q = q.eq('kode_induk', induk)
  const { data, error } = await q.order('nama')
  if (error) throw error
  const hasil = (data ?? []) as Daerah[]
  return tingkat === 'kabupaten' ? hasil.map((d) => ({ ...d, nama: namaKabupaten(d.nama) })) : hasil
}

export const daftarProvinsi = () => daftarDaerah('provinsi')
export const daftarKabupaten = (provinsiKode: string) => daftarDaerah('kabupaten', provinsiKode)
export const daftarKecamatan = (kabupatenKode: string) => daftarDaerah('kecamatan', kabupatenKode)

// Kecamatan yang punya lapak berstatus Lagi buka (titik hijau A20; Habis tidak dihitung)
export async function kecamatanLagiBuka(kabupatenKode: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('lapak_publik')
    .select('tempat_kecamatan_kode')
    .eq('tempat_kabupaten_kode', kabupatenKode)
    .eq('status', 'buka')
  if (error) throw error
  return new Set(((data ?? []) as { tempat_kecamatan_kode: string | null }[]).map((r) => r.tempat_kecamatan_kode ?? ''))
}

// N di "Tampilkan N lapak": lapak yang akan tampil di beranda untuk wilayah itu (A10, A20)
export async function jumlahLapakTampil(w: PilihanWilayah): Promise<number> {
  const [kolom, nilai] = saringanWilayah(w)
  const { count, error } = await supabase
    .from('lapak_publik')
    .select('id', { count: 'exact', head: true })
    .eq(kolom, nilai)
    .in('status', ['buka', 'habis', 'biasanya_buka'])
  if (error) throw error
  return count ?? 0
}
