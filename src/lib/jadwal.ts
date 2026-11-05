import { useState } from 'react'

// Jadwal tujuh hari (A35): dipakai Daftar 3 (V13) dan Ubah jadwal (V44).
// Jam dinding WIB sebagai teks "HH:MM"; tidak ada konversi zona waktu di HP.
export type Sesi = { kunci: string; mulai: string; selesai: string }
export type Hari = { hari: number; nama: string; aktif: boolean; sesi: Sesi[] }
export type BarisJadwalDb = { hari: number; jam_mulai: string; jam_selesai: string }

// Urutan tampil Senin–Minggu; nomor hari mengikuti database (0 = Minggu … 6 = Sabtu)
const URUTAN: [number, string][] = [
  [1, 'Senin'],
  [2, 'Selasa'],
  [3, 'Rabu'],
  [4, 'Kamis'],
  [5, 'Jumat'],
  [6, 'Sabtu'],
  [0, 'Minggu'],
]
const MENIT_SEMINGGU = 7 * 1440

export const kunciBaru = () => Math.random().toString(36).slice(2)
export const lengkap = (s: Sesi) => s.mulai !== '' && s.selesai !== ''
const keMenit = (jam: string) => Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5))
export const tampilJam = (jam: string) => jam.replace(':', '.')
const menitKelipatan5 = (jam: string) => Number(jam.slice(3, 5)) % 5 === 0

export const jadwalKosong = (): Hari[] => URUTAN.map(([hari, nama]) => ({ hari, nama, aktif: false, sesi: [] }))

// Baris jadwal dari database menjadi isi formulir
export const jadwalDariDb = (baris: BarisJadwalDb[]): Hari[] =>
  jadwalKosong().map((h) => {
    const milik = baris.filter((b) => b.hari === h.hari)
    return {
      ...h,
      aktif: milik.length > 0,
      sesi: milik.map((b) => ({ kunci: kunciBaru(), mulai: b.jam_mulai.slice(0, 5), selesai: b.jam_selesai.slice(0, 5) })),
    }
  })

// Sesi yang ikut disimpan: hari dicentang dan jam terisi
export const sesiTerisi = (daftar: Hari[]) =>
  daftar.flatMap((h) => (h.aktif ? h.sesi.filter(lengkap).map((s) => ({ hari: h.hari, nama: h.nama, ...s })) : []))

export const isiKirim = (daftar: Hari[]) => sesiTerisi(daftar).map(({ hari, mulai, selesai }) => ({ hari, mulai, selesai }))

// Cari sesi bertumpuk, termasuk sesi lewat tengah malam yang menabrak hari berikutnya (Sabtu ke Minggu juga).
function cariTumpukan(daftar: Hari[]): string | null {
  const rentang = sesiTerisi(daftar).map((s) => {
    const awal = s.hari * 1440 + keMenit(s.mulai)
    const durasi = (keMenit(s.selesai) - keMenit(s.mulai) + 1440) % 1440
    return { nama: s.nama, awal, akhir: awal + durasi }
  })
  for (let i = 0; i < rentang.length; i++) {
    for (let j = i + 1; j < rentang.length; j++) {
      const a = rentang[i]
      const b = rentang[j]
      const tumpuk = [-MENIT_SEMINGGU, 0, MENIT_SEMINGGU].some((g) => a.awal < b.akhir + g && b.awal + g < a.akhir)
      if (tumpuk) return a.nama === b.nama ? `Jam sesi bertumpuk di hari ${a.nama}.` : `Jam sesi bertumpuk di hari ${a.nama} dan ${b.nama}.`
    }
  }
  return null
}

// Pemeriksaan yang sama dengan database (014, 028), supaya pesannya muncul sebelum dikirim. null = boleh disimpan.
export function periksaJadwal(daftar: Hari[]): string | null {
  const belumLengkap = daftar.find((h) => h.aktif && h.sesi.some((s) => !lengkap(s)))
  if (belumLengkap) return `Lengkapi jam sesi di hari ${belumLengkap.nama}.`
  const terisi = sesiTerisi(daftar)
  const menitGanjil = terisi.find((s) => !menitKelipatan5(s.mulai) || !menitKelipatan5(s.selesai))
  if (menitGanjil) return `Menit harus kelipatan 5 di hari ${menitGanjil.nama}.`
  const sama = terisi.find((s) => s.mulai === s.selesai)
  if (sama) return `Jam mulai dan jam selesai tidak boleh sama di hari ${sama.nama}.`
  return cariTumpukan(daftar)
}

// Isi formulir dan cara mengubahnya: centang hari, + Sesi, ubah jam, × hapus sesi, Samakan jam Senin
export function useEditorJadwal(tampilkan: (p: { teks: string; jenis: 'netral' }) => void) {
  const [jadwal, setJadwal] = useState<Hari[]>(jadwalKosong)

  const ubahHari = (hari: number, ubah: (h: Hari) => Hari) => setJadwal((j) => j.map((h) => (h.hari === hari ? ubah(h) : h)))

  const tambahSesi = (hari: number) =>
    ubahHari(hari, (h) => ({ ...h, aktif: true, sesi: [...h.sesi, { kunci: kunciBaru(), mulai: '', selesai: '' }] }))

  const centangHari = (hari: number, aktif: boolean) =>
    ubahHari(hari, (h) => ({
      ...h,
      aktif,
      sesi: aktif && h.sesi.length === 0 ? [{ kunci: kunciBaru(), mulai: '', selesai: '' }] : h.sesi,
    }))

  const ubahSesi = (hari: number, kunci: string, isi: Partial<Sesi>) =>
    ubahHari(hari, (h) => ({ ...h, sesi: h.sesi.map((s) => (s.kunci === kunci ? { ...s, ...isi } : s)) }))

  const hapusSesi = (hari: number, kunci: string) =>
    ubahHari(hari, (h) => {
      const sisa = h.sesi.filter((s) => s.kunci !== kunci)
      return { ...h, sesi: sisa, aktif: sisa.length > 0 && h.aktif }
    })

  const samakanSenin = () => {
    const senin = jadwal.find((h) => h.hari === 1)
    const contoh = senin?.aktif ? senin.sesi.filter(lengkap) : []
    if (contoh.length === 0) {
      tampilkan({ teks: 'Isi jam Senin dulu.', jenis: 'netral' })
      return
    }
    setJadwal((j) => j.map((h) => (h.aktif && h.hari !== 1 ? { ...h, sesi: contoh.map((s) => ({ ...s, kunci: kunciBaru() })) } : h)))
  }

  return { jadwal, setJadwal, tambahSesi, centangHari, ubahSesi, hapusSesi, samakanSenin }
}

export type EditorJadwal = ReturnType<typeof useEditorJadwal>
