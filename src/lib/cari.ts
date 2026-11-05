import { supabase } from './supabase'
import { infoKartu, type LapakBeranda } from './beranda'
import { saringanWilayah, type PilihanWilayah } from './wilayah'
import { jamWIB, ringkasJadwal, type BarisJadwal } from './waktu'

// Cari lapak (V5, V54, A22, A23, A24). Dicari di server lewat lapak_publik: nama dan deskripsi, semua status
// termasuk Tutup, di dalam wilayah aktif. Yang dikirim hanya kata dan wilayah; lokasi pelanggan tidak (A21).

export type LapakCari = Omit<LapakBeranda, 'status'> & { status: LapakBeranda['status'] | 'tutup' }

export type HasilCari = {
  lagiBuka: LapakCari[] // Lagi buka dan Habis, sama dengan beranda (A10)
  biasanyaBuka: LapakCari[]
  sedangTutup: LapakCari[]
  jadwalTutup: Record<string, string> // baris pertama ringkasan jadwal lapak Tutup (V5)
  jumlah: number // hasil di wilayah aktif (atau semua wilayah)
  diLuar: number // hasil di luar wilayah aktif, untuk "(+N)" (A23); 0 di mode semua wilayah
  saran: string | null // kata pertama yang punya hasil, hanya jika tidak ada hasil (V54)
}

// Batas baris yang dimuat; jumlah di judul tetap dihitung lengkap di server
const BATAS = 100

const KOLOM =
  'id, slug, nama, deskripsi, foto_url, status, berakhir_pada, tempat_nama, tempat_lat, tempat_lng, jumlah_pengikut, jadwal_mulai, jadwal_selesai'

// Karakter yang punya arti di saringan PostgREST (koma, kurung, titik dua, *, %, _) dibuang;
// yang tersisa huruf, angka, spasi, tanda hubung, &, dan petik
export const bersihkanKata = (teks: string) =>
  teks
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)

const saringKata = (kata: string) => `nama.ilike.*${kata}*,deskripsi.ilike.*${kata}*`

// wilayah null = semua wilayah
async function hitung(kata: string, wilayah: PilihanWilayah | null): Promise<number> {
  let q = supabase.from('lapak_publik').select('id', { count: 'exact', head: true }).or(saringKata(kata))
  if (wilayah) q = q.eq(...saringanWilayah(wilayah))
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export async function cariLapak(kata: string, wilayah: PilihanWilayah | null): Promise<HasilCari> {
  let q = supabase.from('lapak_publik').select(KOLOM).or(saringKata(kata))
  if (wilayah) q = q.eq(...saringanWilayah(wilayah))
  const [baris, jumlah, total] = await Promise.all([
    q.limit(BATAS),
    hitung(kata, wilayah),
    wilayah ? hitung(kata, null) : Promise.resolve(0),
  ])
  if (baris.error) throw baris.error
  const semua = (baris.data ?? []) as LapakCari[]
  const sedangTutup = semua.filter((l) => l.status === 'tutup')

  // Satu query jadwal untuk semua hasil Tutup
  const jadwalTutup: Record<string, string> = {}
  if (sedangTutup.length > 0) {
    const { data, error } = await supabase
      .from('jadwal_lapak_publik')
      .select('lapak_id, hari, jam_mulai, jam_selesai')
      .in(
        'lapak_id',
        sedangTutup.map((l) => l.id),
      )
    if (error) throw error
    const perLapak: Record<string, BarisJadwal[]> = {}
    for (const j of (data ?? []) as (BarisJadwal & { lapak_id: string })[]) (perLapak[j.lapak_id] ??= []).push(j)
    for (const [id, jadwal] of Object.entries(perLapak)) {
      const pertama = ringkasJadwal(jadwal)[0]
      if (pertama) jadwalTutup[id] = pertama
    }
  }

  // Saran V54: kata pertama dari pencarian beberapa kata, hanya jika kata itu memang punya hasil
  let saran: string | null = null
  const kataKata = kata.split(' ')
  if (jumlah === 0 && kataKata.length >= 2 && (await hitung(kataKata[0], wilayah)) > 0) saran = kataKata[0]

  return {
    lagiBuka: semua.filter((l) => l.status === 'buka' || l.status === 'habis'),
    biasanyaBuka: semua.filter((l) => l.status === 'biasanya_buka'),
    sedangTutup,
    jadwalTutup,
    jumlah,
    diLuar: wilayah ? Math.max(total - jumlah, 0) : 0,
    saran,
  }
}

// Keterangan kartu hasil cari, mengikuti V5:
// "Depan Pasar Sragen · sampai 14.00", "Biasanya di Depan Pasar Gemolong · 10.00–15.00",
// "Jadwal Senin–Sabtu 16.00–21.00" atau "Jadwal tidak tetap"
export function infoCari(l: LapakCari, jadwalTutup: Record<string, string>): string {
  if (l.status === 'tutup') return jadwalTutup[l.id] ? `Jadwal ${jadwalTutup[l.id].replace(' · ', ' ')}` : 'Jadwal tidak tetap'
  if (l.status === 'biasanya_buka') {
    const jam =
      l.jadwal_mulai && l.jadwal_selesai ? `${jamWIB(new Date(l.jadwal_mulai))}⁠–⁠${jamWIB(new Date(l.jadwal_selesai))}` : ''
    return [l.tempat_nama ? `Biasanya di ${l.tempat_nama}` : '', jam].filter(Boolean).join(' · ')
  }
  return infoKartu({ ...l, status: l.status })
}
