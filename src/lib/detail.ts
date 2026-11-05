import { supabase } from './supabase'
import type { BarisJadwal } from './waktu'
import type { StatusTampil } from '../components/ChipStatus'

// Detail lapak /:slug (V2, V22, V23, V37, V27). Status dari lapak_publik; jadwal dan foto dari view publik (019).

export type DetailLapak = {
  id: string
  slug: string
  nama: string
  deskripsi: string | null
  foto_url: string | null
  status: 'buka' | 'habis' | 'biasanya_buka' | 'tutup'
  berakhir_pada: string | null
  tempat_nama: string | null
  tempat_lat: number | null
  tempat_lng: number | null
  tempat_link_maps: string | null
  jumlah_pengikut: number
  jadwal_mulai: string | null
  jadwal_selesai: string | null
  status_sejak: string | null
  terakhir_buka_pada: string | null
  buka_berikutnya: string | null
  tempat_kecamatan_nama: string | null
  tempat_kabupaten_nama: string | null
}

export type IsiDetail = { lapak: DetailLapak; jadwal: BarisJadwal[]; foto: string[] }

const KOLOM =
  'id, slug, nama, deskripsi, foto_url, status, berakhir_pada, tempat_nama, tempat_lat, tempat_lng, tempat_link_maps, ' +
  'jumlah_pengikut, jadwal_mulai, jadwal_selesai, status_sejak, terakhir_buka_pada, buka_berikutnya, ' +
  'tempat_kecamatan_nama, tempat_kabupaten_nama'

// null = slug tidak ada, atau lapak draf, disembunyikan, atau sudah ditutup (V27, A29, A47).
// Galat dilempar supaya layar bisa menampilkan Coba lagi.
export async function muatDetail(slug: string): Promise<IsiDetail | null> {
  const { data, error } = await supabase.from('lapak_publik').select(KOLOM).eq('slug', slug.toLowerCase()).maybeSingle()
  if (error) throw error
  if (!data) return null
  const lapak = data as unknown as DetailLapak
  const [jadwal, foto] = await Promise.all([
    supabase.from('jadwal_lapak_publik').select('hari, jam_mulai, jam_selesai').eq('lapak_id', lapak.id),
    supabase.from('foto_lapak_publik').select('url, urutan').eq('lapak_id', lapak.id).order('urutan'),
  ])
  if (jadwal.error) throw jadwal.error
  if (foto.error) throw foto.error
  return {
    lapak,
    jadwal: (jadwal.data ?? []) as BarisJadwal[],
    foto: ((foto.data ?? []) as { url: string }[]).map((f) => f.url),
  }
}

export const statusDetail = (l: DetailLapak): StatusTampil => (l.status === 'biasanya_buka' ? 'biasanya' : l.status)

// Link Maps dari pemilik; kalau tidak ada, dari titik tempat. Tanpa keduanya tombol tidak tampil.
export function linkMaps(l: DetailLapak): string | null {
  if (l.tempat_link_maps) return l.tempat_link_maps
  if (l.tempat_lat != null && l.tempat_lng != null)
    return `https://www.google.com/maps/search/?api=1&query=${l.tempat_lat},${l.tempat_lng}`
  return null
}

// "Kec. Sragen, Kab. Sragen" atau "Kec. Laweyan, Kota Surakarta" (V2)
export function teksWilayah(l: DetailLapak): string {
  const kab = l.tempat_kabupaten_nama?.replace(/^Kabupaten /, 'Kab. ')
  return [l.tempat_kecamatan_nama && `Kec. ${l.tempat_kecamatan_nama}`, kab].filter(Boolean).join(', ')
}

// "0,4 km dari kamu"; jarak dihitung di HP dan tidak dikirim (A21)
export function teksJarak(meter: number): string {
  const km = Math.max(meter, 100) / 1000
  return `${km.toLocaleString('id-ID', { maximumFractionDigits: km < 10 ? 1 : 0 })} km dari kamu`
}
