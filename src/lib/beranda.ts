import { supabase } from './supabase'
import { jamWIB } from './waktu'
import { jarakMeter, type Titik } from './lokasi'
import { saringanWilayah, type PilihanWilayah } from './wilayah'
import type { StatusTampil } from '../components/ChipStatus'

// Beranda pelanggan (V1, V45): data hanya dari view lapak_publik.

export type LapakBeranda = {
  id: string
  slug: string
  nama: string
  deskripsi: string | null
  foto_url: string | null
  status: 'buka' | 'habis' | 'biasanya_buka'
  berakhir_pada: string | null
  tempat_nama: string | null
  tempat_lat: number | null
  tempat_lng: number | null
  jumlah_pengikut: number
  jadwal_mulai: string | null
  jadwal_selesai: string | null
}

export type KelompokBeranda = { lagiBuka: LapakBeranda[]; biasanyaBuka: LapakBeranda[] }

export type Urutan = 'terdekat' | 'terpopuler' | 'abjad'

export const LABEL_URUTAN: Record<Urutan, string> = { terdekat: 'Terdekat', terpopuler: 'Terpopuler', abjad: 'Abjad' }

// Kolom yang dibutuhkan urutan A12; dipakai juga oleh hasil cari (V5)
type BisaDiurutkan = Pick<LapakBeranda, 'nama' | 'jumlah_pengikut' | 'tempat_lat' | 'tempat_lng'>

const abjad = (a: BisaDiurutkan, b: BisaDiurutkan) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
const terpopuler = (a: BisaDiurutkan, b: BisaDiurutkan) => b.jumlah_pengikut - a.jumlah_pengikut || abjad(a, b)

// Urutan A12, dihitung di HP di dalam satu kelompok. Terdekat tanpa lokasi jatuh ke Terpopuler.
// Lapak tanpa titik di paling bawah, di antaranya Terpopuler.
// Lokasi pelanggan hanya dipakai di sini untuk menghitung jarak dan tidak pernah dikirim (A21).
export function urutkanDaftar<T extends BisaDiurutkan>(daftar: T[], urutan: Urutan, lokasi: Titik | null): T[] {
  let banding = terpopuler
  if (urutan === 'abjad') banding = abjad
  if (urutan === 'terdekat' && lokasi) {
    const jarak = (l: BisaDiurutkan) =>
      l.tempat_lat == null || l.tempat_lng == null ? Infinity : jarakMeter(lokasi, { lat: l.tempat_lat, lng: l.tempat_lng })
    banding = (a, b) => {
      const ja = jarak(a)
      const jb = jarak(b)
      return ja === jb ? terpopuler(a, b) : ja - jb
    }
  }
  return [...daftar].sort(banding)
}

export const urutkanKelompok = (k: KelompokBeranda, urutan: Urutan, lokasi: Titik | null): KelompokBeranda => ({
  lagiBuka: urutkanDaftar(k.lagiBuka, urutan, lokasi),
  biasanyaBuka: urutkanDaftar(k.biasanyaBuka, urutan, lokasi),
})

// Wilayah tanpa lapak yang buka: berapa lapak ada di sana (termasuk Tutup) dan kapan yang paling awal
// buka lagi menurut jadwal. jumlah 0 = V53, lebih dari 0 = V20 (A24).
export type RingkasWilayah = { jumlah: number; bukaBerikutnya: string | null }

export async function muatRingkasWilayah(wilayah: PilihanWilayah): Promise<RingkasWilayah> {
  const [kolom, nilai] = saringanWilayah(wilayah)
  const [hitung, awal] = await Promise.all([
    supabase.from('lapak_publik').select('id', { count: 'exact', head: true }).eq(kolom, nilai),
    supabase
      .from('lapak_publik')
      .select('buka_berikutnya')
      .eq(kolom, nilai)
      .not('buka_berikutnya', 'is', null)
      .order('buka_berikutnya')
      .limit(1),
  ])
  if (hitung.error) throw hitung.error
  if (awal.error) throw awal.error
  const baris = (awal.data ?? []) as { buka_berikutnya: string }[]
  return { jumlah: hitung.count ?? 0, bukaBerikutnya: baris[0]?.buka_berikutnya ?? null }
}

// Lapak Tutup tidak tampil di beranda (A10). Galat dilempar supaya layar bisa menampilkan Coba lagi.
// Hanya saringan wilayah yang dikirim; lokasi pelanggan tidak pernah ikut (A21).
export async function muatBeranda(wilayah: PilihanWilayah): Promise<KelompokBeranda> {
  const [kolom, nilai] = saringanWilayah(wilayah)
  const { data, error } = await supabase
    .from('lapak_publik')
    .select(
      'id, slug, nama, deskripsi, foto_url, status, berakhir_pada, tempat_nama, tempat_lat, tempat_lng, jumlah_pengikut, jadwal_mulai, jadwal_selesai',
    )
    .eq(kolom, nilai)
    .in('status', ['buka', 'habis', 'biasanya_buka'])
  if (error) throw error
  const semua = (data ?? []) as LapakBeranda[]
  return {
    // Kelompok "Lagi buka di …" berisi Lagi buka dan Habis (A10)
    lagiBuka: semua.filter((l) => l.status === 'buka' || l.status === 'habis'),
    biasanyaBuka: semua.filter((l) => l.status === 'biasanya_buka'),
  }
}

export const statusTampil = (l: LapakBeranda): StatusTampil => (l.status === 'biasanya_buka' ? 'biasanya' : l.status)

// Baris info kartu (V1): "Depan Pasar Sragen · sampai 14.00", "Simpang Masaran · stok habis",
// "Biasanya di Depan SD Sidoharjo · jadwal 07.00–11.00"
export function infoKartu(l: LapakBeranda): string {
  const tempat = l.tempat_nama ?? ''
  const gabung = (...bagian: string[]) => bagian.filter(Boolean).join(' · ')
  if (l.status === 'habis') return gabung(tempat, 'stok habis')
  if (l.status === 'buka') return gabung(tempat, l.berakhir_pada ? `sampai ${jamWIB(new Date(l.berakhir_pada))}` : '')
  // Penyambung kata (U+2060) supaya rentang jam tidak terpotong di "18.00–"
  const jadwal =
    l.jadwal_mulai && l.jadwal_selesai
      ? `jadwal ${jamWIB(new Date(l.jadwal_mulai))}⁠–⁠${jamWIB(new Date(l.jadwal_selesai))}`
      : ''
  return gabung(tempat ? `Biasanya di ${tempat}` : '', jadwal)
}

// Palet tetap inisial (A13, dari desain V1): tanpa hijau dan oranye karena itu warna status.
// Dipilih dari id lapak supaya warnanya tidak berubah saat nama diganti.
const PALET_INISIAL = ['#1F5FE6', '#9C2F5B', '#7A4E2D', '#24408E']

export function warnaInisial(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALET_INISIAL[h % PALET_INISIAL.length]
}
