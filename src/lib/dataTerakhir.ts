// Data terakhir yang berhasil dimuat, disimpan di HP untuk keadaan sinyal putus (V20, A8).
// Kalau memuat gagal dan belum ada data di layar, data ini ditampilkan dengan keterangan
// "Tidak ada sinyal. Menampilkan data terakhir (jam)." Service worker hanya menyimpan kerangka aplikasi.
//
// Yang disimpan hanya data yang memang tampil di layar: data publik lapak (beranda, cari, detail) dan data milik
// akun sendiri (Diikuti, Lapakku). Lokasi pelanggan tidak pernah disimpan (A21), begitu pula email, nomor HP, atau
// data pelapor. Data milik akun dihapus saat Keluar, Hapus akun, atau Tutup lapak.

const AWALAN = 'noantree.terakhir.'
const UMUR_MAKS = 7 * 24 * 60 * 60 * 1000

type Simpanan<T> = { pada: number; data: T }
type Grup = 'beranda' | 'cari' | 'detail' | 'diikuti' | 'lapakku'
// Grup yang berisi data milik akun yang sedang masuk
const GRUP_AKUN: Grup[] = ['diikuti', 'lapakku']

function bacaGrup(grup: Grup): Record<string, Simpanan<unknown>> {
  try {
    const isi = localStorage.getItem(AWALAN + grup)
    return isi ? (JSON.parse(isi) as Record<string, Simpanan<unknown>>) : {}
  } catch {
    return {}
  }
}

// Menyimpan data satu layar; tiap grup hanya menyimpan beberapa yang terbaru (maks)
export function simpanTerakhir(grup: Grup, id: string, data: unknown, maks = 5) {
  try {
    const isi = { ...bacaGrup(grup), [id]: { pada: Date.now(), data } }
    const sisa = Object.entries(isi)
      .sort(([, a], [, b]) => b.pada - a.pada)
      .slice(0, maks)
    localStorage.setItem(AWALAN + grup, JSON.stringify(Object.fromEntries(sisa)))
  } catch {
    // Penyimpanan HP penuh atau tidak tersedia (mode privat): layar tetap jalan tanpa data terakhir
  }
}

// Data terakhir beserta waktu dimuatnya, atau null kalau tidak ada atau sudah lebih dari 7 hari
export function bacaTerakhir<T>(grup: Grup, id: string): Simpanan<T> | null {
  const s = bacaGrup(grup)[id]
  if (!s || typeof s.pada !== 'number' || Date.now() - s.pada > UMUR_MAKS) return null
  return s as Simpanan<T>
}

export function hapusGrupTerakhir(grup: Grup) {
  try {
    localStorage.removeItem(AWALAN + grup)
  } catch {
    // Abaikan
  }
}

// Saat Keluar, Hapus akun, atau berganti akun: data milik akun dan antrean Mulai buka dihapus dari HP
export function hapusDataAkun() {
  for (const g of GRUP_AKUN) hapusGrupTerakhir(g)
  hapusAntreanMulai()
}

// ---------- Antrean Mulai buka (A8) ----------
// Mulai buka yang ditekan saat sinyal putus. Hanya satu aksi, disimpan dengan waktu saat tombol ditekan; dikirim ke
// mulai_buka (016, p_waktu) begitu sinyal kembali, jadi sesi dihitung dari waktu tekan. Server menolak waktu yang
// lebih dari 1 jam lalu atau di masa depan. Aplikasi tidak pernah menulis sesi_buka langsung.

const KUNCI_ANTREAN = 'noantree.antreanMulai'

export type AntreanMulai = { uid: string; lapakId: string; tempatId: string | null; waktu: string }

export function simpanAntreanMulai(a: AntreanMulai) {
  try {
    localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(a))
  } catch {
    // Tidak bisa disimpan: Lapakku tetap menampilkan galat biasa
  }
}

export function bacaAntreanMulai(uid: string): AntreanMulai | null {
  try {
    const isi = localStorage.getItem(KUNCI_ANTREAN)
    const a = isi ? (JSON.parse(isi) as AntreanMulai) : null
    return a && a.uid === uid ? a : null
  } catch {
    return null
  }
}

export function hapusAntreanMulai() {
  try {
    localStorage.removeItem(KUNCI_ANTREAN)
  } catch {
    // Abaikan
  }
}
