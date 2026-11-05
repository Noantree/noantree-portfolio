import qrcode from 'qrcode-generator'
import { supabase } from './supabase'
import { jamWIB } from './waktu'
import { SITUS_TAMPIL, SITUS_URL } from './lingkungan'

// Data bagikan dari view lapak_publik untuk lapak sendiri (A49). Lapak disembunyikan tidak ada di view.
export type LapakBagikan = {
  slug: string
  nama: string
  status: string
  tempat_nama: string | null
  berakhir_pada: string | null
}

// null = lapak tidak ada di view (disembunyikan). Galat dilempar supaya layar bisa menampilkan Coba lagi.
export async function muatLapakBagikan(lapakId: string): Promise<LapakBagikan | null> {
  const { data, error } = await supabase
    .from('lapak_publik')
    .select('slug, nama, status, tempat_nama, berakhir_pada')
    .eq('id', lapakId)
    .maybeSingle()
  if (error) throw error
  return data as LapakBagikan | null
}

// Link lapak selalu dari slug di database (A36), dengan alamat situs lingkungan ini dari src/lib/lingkungan.ts
// (produksi: noantree.id, staging: staging.noantree.id), supaya link dan QR yang dibagikan dari HP mana pun
// (termasuk saat uji di localhost) selalu menuju situs yang memakai database yang sama
export function linkLapak(slug: string) {
  return { url: `${SITUS_URL}/${slug}`, tampil: `${SITUS_TAMPIL}/${slug}` }
}

// Ajak lapak langgananmu (A50): pesan siap kirim dan link daftar, dengan alamat situs yang sama seperti link lapak
export const PESAN_AJAK =
  'Halo! Sekarang lapak bisa daftar gratis di noantree, biar pelanggan tahu kapan dan di mana kamu buka. Daftar di sini:'
export const linkDaftar = () => `${SITUS_URL}/daftar`

// Pesan yang ikut terkirim menyesuaikan status (A49)
export function pesanBagikan(l: LapakBagikan): string {
  if (l.status === 'buka') {
    const tempat = l.tempat_nama ? ` di ${l.tempat_nama}` : ''
    const sampai = l.berakhir_pada ? ` sampai ${jamWIB(new Date(l.berakhir_pada))}` : ''
    return `${l.nama} lagi buka${tempat}${sampai}.`
  }
  if (l.status === 'habis') return `Stok ${l.nama} lagi habis. Ikuti ${l.nama} di noantree biar tahu kapan buka lagi.`
  // Biasanya buka belum dikonfirmasi pemilik, jadi pesannya sama dengan Tutup
  return `Ikuti ${l.nama} di noantree biar tahu kapan buka.`
}

// Salin: clipboard bawaan HP, lalu cara lama. false = keduanya gagal.
export async function salinTeks(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = teks
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const berhasil = document.execCommand('copy')
      area.remove()
      return berhasil
    } catch {
      return false
    }
  }
}

// Matriks QR (koreksi galat M), dibuat di HP. true = modul gelap.
export function matriksQR(teks: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(teks)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

// Zona tepi putih 4 modul di setiap sisi supaya mudah di-scan
export const TEPI_QR = 4
