import { supabase } from './supabase'

// Asal tindakan masuk, disimpan di HP sebelum pindah ke Google, dibaca setelah kembali (A26).
// 'aksi' = ikuti atau lapor yang tertunda; dijalankan oleh halaman kembaliKe (Sprint 5).
export type Tujuan =
  | { asal: 'umum' }
  | { asal: 'daftar' }
  | { asal: 'aksi'; aksi: 'ikuti' | 'lapor'; lapakId: string; kembaliKe: string }

// Tanda HP pernah dipakai pemilik (A27). Tidak dihapus saat Keluar, supaya V52 muncul.
export type TandaPemilik = { namaLapak: string; fotoUrl: string | null; email: string }

const KUNCI_TUJUAN = 'noantree.tujuan'
const KUNCI_PEMILIK = 'noantree.pemilik'

export function baca<T>(kunci: string): T | null {
  try {
    const isi = localStorage.getItem(kunci)
    return isi ? (JSON.parse(isi) as T) : null
  } catch {
    return null
  }
}

export function tulis(kunci: string, nilai: unknown) {
  try {
    if (nilai === null) localStorage.removeItem(kunci)
    else localStorage.setItem(kunci, JSON.stringify(nilai))
  } catch {
    // Penyimpanan HP tidak tersedia (mode privat): pengarah tetap jalan tanpa tanda
  }
}

export const simpanTujuan = (t: Tujuan) => tulis(KUNCI_TUJUAN, t)

export function ambilTujuan(): Tujuan | null {
  const t = baca<Tujuan>(KUNCI_TUJUAN)
  tulis(KUNCI_TUJUAN, null)
  return t
}

export const bacaTandaPemilik = () => baca<TandaPemilik>(KUNCI_PEMILIK)
export const simpanTandaPemilik = (t: TandaPemilik | null) => tulis(KUNCI_PEMILIK, t)

export type LapakSaya = {
  id: string
  nama: string
  foto_url: string | null
  slug: string | null
  status_tayang: 'draf' | 'tayang' | 'disembunyikan'
  langkah_daftar: number
}

// MVP: satu akun satu lapak. RLS hanya mengembalikan lapak milik sendiri.
export async function muatLapakSaya(pemilikId: string): Promise<LapakSaya | null> {
  const { data, error } = await supabase
    .from('lapak')
    .select('id, nama, slug, foto_url, status_tayang, langkah_daftar')
    .eq('pemilik_id', pemilikId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as LapakSaya | null
}

// Tujuan setelah masuk (A26). Draf belum dihitung "punya lapak": pemiliknya ke beranda pelanggan.
// Daftar selesai setelah langkah 2 (A30), saat status_tayang berubah dari draf; langkah 3 boleh dilewati.
// langkah_daftar = langkah yang sedang dikerjakan (2 artinya langkah 1 sudah tersimpan), bukan langkah terakhir yang selesai.
export function rutePengarah(tujuan: Tujuan | null, lapak: LapakSaya | null): string {
  if (tujuan?.asal === 'aksi') return tujuan.kembaliKe
  if (tujuan?.asal === 'daftar') {
    if (!lapak) return '/daftar/1'
    if (lapak.status_tayang === 'draf') return `/daftar/${lapak.langkah_daftar}`
    return '/lapakku'
  }
  return lapak && lapak.status_tayang !== 'draf' ? '/lapakku' : '/'
}

// s•••••••@contoh.invalid: huruf pertama tetap, sisa nama sebelum @ disamarkan (V52)
export function samarkanEmail(email: string): string {
  const [nama, domain] = email.split('@')
  if (!domain) return email
  return nama.charAt(0) + '•'.repeat(Math.max(nama.length - 1, 1)) + '@' + domain
}

// Inisial 2 huruf dari 2 kata pertama, atau 2 huruf pertama jika satu kata (A13)
export function inisialLapak(nama: string): string {
  // Kata yang tidak diawali huruf atau angka (misalnya "&") dilewati: "Bakso & Soto" → "BS"
  const kata = nama
    .trim()
    .split(/\s+/)
    .filter((k) => /^[\p{L}\p{N}]/u.test(k))
  if (kata.length >= 2) return (kata[0][0] + kata[1][0]).toUpperCase()
  return (kata[0] ?? '').slice(0, 2).toUpperCase()
}

// Isi langkah yang belum selesai, untuk banner V47 dan kartu Lanjutkan daftar di Akun saya (A31)
const ISI_LANGKAH: Record<number, string> = { 1: 'profil lapak', 2: 'tempat jualan', 3: 'jadwal, boleh dilewati' }
export const teksLangkahBelumSelesai = (langkah: number) =>
  `Tinggal langkah ${langkah} dari 3: ${ISI_LANGKAH[langkah] ?? 'profil lapak'}.`
