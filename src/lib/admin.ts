import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useSesi } from './sesi'

// Admin (A45, A46, A47; V18, V55). Baca lewat admin_daftar_dilaporkan (022) dan admin_detail_laporan (021);
// semua tindakan lewat admin_tindak_lapak (021). Aplikasi tidak pernah menulis tabel laporan,
// lapak, atau tindakan_admin langsung. Semua fungsi itu sendiri menolak akun yang bukan admin.

export type StatusAdmin = 'memuat' | 'admin' | 'bukan' | 'gagal'

// profil.is_admin milik akun sendiri (RLS profil: baris sendiri). Tamu = bukan admin.
export function useStatusAdmin(): { status: StatusAdmin; ulangi: () => void } {
  const { sesi, memuat } = useSesi()
  const uid = sesi?.user.id ?? null
  const [hasil, setHasil] = useState<{ uid: string; status: StatusAdmin } | null>(null)
  const [putaran, setPutaran] = useState(0)

  useEffect(() => {
    if (!uid) return
    let batal = false
    supabase
      .from('profil')
      .select('is_admin')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (batal) return
        const status: StatusAdmin = error ? 'gagal' : (data as { is_admin: boolean } | null)?.is_admin ? 'admin' : 'bukan'
        setHasil({ uid, status })
      })
    return () => {
      batal = true
    }
  }, [uid, putaran])

  const ulangi = useCallback(() => {
    setHasil(null)
    setPutaran((n) => n + 1)
  }, [])

  if (memuat) return { status: 'memuat', ulangi }
  if (!uid) return { status: 'bukan', ulangi }
  return { status: hasil?.uid === uid ? hasil.status : 'memuat', ulangi }
}

export type LapakDilaporkan = {
  lapak_id: string
  slug: string
  nama: string
  foto_url: string | null
  status_tayang: 'draf' | 'tayang' | 'disembunyikan'
  laporan_aktif: number
  laporan_total: number
  alasan_terbanyak: string | null
  laporan_baru_terakhir: string | null
}

// Tab Dilaporkan (V18): laporan aktif terbanyak di atas, urutan dari database
export async function muatDilaporkan(): Promise<LapakDilaporkan[]> {
  const { data, error } = await supabase.rpc('admin_daftar_dilaporkan')
  if (error) throw error
  return (data ?? []) as LapakDilaporkan[]
}

export type LapakSemua = {
  lapak_id: string
  slug: string
  nama: string
  foto_url: string | null
  status_tayang: 'tayang' | 'disembunyikan'
  dibuat_pada: string
  kecamatan_nama: string | null
}

// Tab Semua lapak (V19): tayang dan disembunyikan, terbaru di atas. Cari nama lapak di database (023).
export async function muatSemuaLapak(cari: string): Promise<LapakSemua[]> {
  const { data, error } = await supabase.rpc('admin_daftar_semua_lapak', { p_cari: cari.trim() || null })
  if (error) throw error
  return (data ?? []) as LapakSemua[]
}

export type LapakDisembunyikan = {
  lapak_id: string
  slug: string
  nama: string
  foto_url: string | null
  disembunyikan_pada: string | null
  catatan_admin: string | null
  alasan_terbanyak: string | null
}

// Tab Disembunyikan (V35): yang terakhir disembunyikan di atas (023)
export async function muatDisembunyikan(): Promise<LapakDisembunyikan[]> {
  const { data, error } = await supabase.rpc('admin_daftar_disembunyikan')
  if (error) throw error
  return (data ?? []) as LapakDisembunyikan[]
}

export type KeadaanDaftar<T> = { jenis: 'memuat' } | { jenis: 'gagal' } | { jenis: 'siap'; daftar: T[] }

// Memuat satu daftar admin. Dimuat ulang saat muat berubah atau versi naik (setelah setiap tindakan).
// Hasil muat yang sudah usang diabaikan; gagal memuat ulang tetap menampilkan daftar terakhir.
export function useDaftarAdmin<T>(muatDaftar: () => Promise<T[]>, versi: number) {
  const [keadaan, setKeadaan] = useState<KeadaanDaftar<T>>({ jenis: 'memuat' })
  const nomor = useRef(0)

  const muat = useCallback(async () => {
    const ini = ++nomor.current
    try {
      const daftar = await muatDaftar()
      if (ini === nomor.current) setKeadaan({ jenis: 'siap', daftar })
    } catch {
      if (ini === nomor.current) setKeadaan((k) => (k.jenis === 'siap' ? k : { jenis: 'gagal' }))
    }
  }, [muatDaftar])

  useEffect(() => {
    muat()
  }, [muat, versi])

  const cobaLagi = () => {
    setKeadaan({ jenis: 'memuat' })
    muat()
  }

  return { keadaan, muat, cobaLagi }
}

export type StatusLaporan = 'baru' | 'diabaikan' | 'ditindak'

export type Laporan = {
  laporan_id: string
  alasan: string
  catatan: string | null
  status: StatusLaporan
  dibuat_pada: string
  pernyataan_pada: string | null
  pelapor_nama: string
  pelapor_email: string | null
}

export type LapakAdmin = {
  id: string
  nama: string
  slug: string
  foto_url: string | null
  status_tayang: 'draf' | 'tayang' | 'disembunyikan'
  dibuat_pada: string
}

// Detail laporan (V55). Admin boleh membaca tabel lapak (RLS "lapak baca admin", 021).
// null = lapak tidak ditemukan.
export async function muatDetailLaporan(lapakId: string): Promise<{ lapak: LapakAdmin; laporan: Laporan[] } | null> {
  const [lapak, laporan] = await Promise.all([
    supabase.from('lapak').select('id, nama, slug, foto_url, status_tayang, dibuat_pada').eq('id', lapakId).maybeSingle(),
    supabase.rpc('admin_detail_laporan', { p_lapak: lapakId }),
  ])
  if (lapak.error) throw lapak.error
  if (laporan.error) throw laporan.error
  if (!lapak.data) return null
  return { lapak: lapak.data as LapakAdmin, laporan: (laporan.data ?? []) as Laporan[] }
}

// Alasan terbanyak, aturan yang sama dengan 022: dari laporan baru, atau dari semua laporan kalau tidak ada
// yang baru. Seri dipecah oleh laporan paling baru, lalu abjad.
export function alasanTerbanyak(laporan: Laporan[]): string | null {
  const baru = laporan.filter((l) => l.status === 'baru')
  const dasar = baru.length > 0 ? baru : laporan
  const hitung = new Map<string, { n: number; terakhir: string }>()
  for (const l of dasar) {
    const h = hitung.get(l.alasan)
    hitung.set(l.alasan, { n: (h?.n ?? 0) + 1, terakhir: h && h.terakhir > l.dibuat_pada ? h.terakhir : l.dibuat_pada })
  }
  const urut = [...hitung.entries()].sort(
    ([a, x], [b, y]) => y.n - x.n || Date.parse(y.terakhir) - Date.parse(x.terakhir) || a.localeCompare(b),
  )
  return urut[0]?.[0] ?? null
}

export type AksiAdmin = 'abaikan' | 'sembunyikan' | 'tampilkan'

// abaikan + laporanId = satu laporan; abaikan tanpa laporanId = Abaikan semua (A46, A47)
export async function tindakLapak(lapakId: string, aksi: AksiAdmin, laporanId: string | null, catatan: string | null) {
  const { error } = await supabase.rpc('admin_tindak_lapak', {
    p_lapak: lapakId,
    p_aksi: aksi,
    p_laporan: laporanId,
    p_catatan: catatan,
  })
  if (error) throw error
}

// Pesan galat dari server ditampilkan apa adanya
export const pesanGalat = (e: unknown) =>
  (e as { message?: string } | null)?.message || 'Belum bisa diproses. Periksa sinyal, lalu coba lagi.'
