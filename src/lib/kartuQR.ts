// Tata letak kartu QR gerobak (V26, A49): pita biru atas (logo putih), badan putih (nama dan QR), pita biru bawah (ajakan scan).
// Semua ukuran dalam piksel A6 pada 300 dpi (1240 x 1748). PNG memakai angka ini langsung; layar dan cetak memakai
// satuan cqw (lebar kartu = 100cqw), jadi ketiganya sama persis dan ukuran cetak tetap 105 x 148 mm.

export const LEBAR = 1240
export const TINGGI = 1748

// Piksel kartu jadi satuan cqw. Hanya dipakai di dalam elemen kartu (yang ber-container-type: inline-size).
export const cq = (px: number) => `${((px / LEBAR) * 100).toFixed(3)}cqw`

export const PITA_ATAS = 250
export const PITA_BAWAH = 300
export const LOGO_TINGGI = 120
export const QR_UKURAN = 760 // 64 mm, sudah termasuk zona kosong 4 modul
export const JARAK_NAMA_QR = 48
export const LEBAR_NAMA = 1040
export const LEBAR_LINK = 1100
export const GARIS_NAMA = 1.1
export const GARIS_TEKS = 1.2
export const MAKS_BARIS_NAMA = 6
export const MAKS_BARIS_LINK = 3

export const BIRU = '#1F5FE6'
export const TINTA = '#12161F'
export const PUTIH = '#FFFFFF'

// Teks ajakan dipecah dua baris yang tetap, supaya hurufnya bisa besar. Kalimatnya sama dengan V26.
export const BARIS_AJAKAN = ['Scan untuk tahu kami', 'lagi buka di mana'] as const
export const UKURAN_AJAKAN = 64
export const JARAK_AJAKAN_LINK = 20

// Ukuran huruf nama menurut panjangnya: nama pendek besar, nama panjang mengecil supaya tetap muat di badan kartu.
// Dipakai sama oleh layar, cetak, dan PNG.
export function ukuranNama(nama: string): number {
  const n = nama.trim().length
  if (n <= 22) return 104
  if (n <= 40) return 88
  if (n <= 64) return 72
  if (n <= 100) return 56
  return 44
}

// Alamat tampilan: satu baris selama muat dengan huruf minimal 30 px (perkiraan lebar huruf 0,62 em), tidak lebih dari 52 px.
// Alamat yang masih terlalu panjang (slug dari nama lapak yang sangat panjang) dipecah per huruf, maksimal MAKS_BARIS_LINK baris.
export function ukuranLink(tampil: string): number {
  return Math.max(30, Math.min(52, Math.floor(LEBAR_LINK / (tampil.length * 0.62))))
}
