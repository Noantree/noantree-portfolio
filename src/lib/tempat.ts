import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Isi formulir tempat (A33, A34): dipakai Daftar 2 (V12), Tempat baru (V43), dan Ubah tempat (V31).
// Titik ini lokasi tempat jualan pemilik, boleh disimpan; lokasi pelanggan tidak pernah dikirim (A21).

export type Wilayah = { id: string; kode: string; nama: string; kode_induk: string | null }
export type Titik = { lat: number; lng: number; akurasi: number | null }

export const MAKS_TEMPAT = 10

// Bawaan segmen awal MVP (A18). Hanya titik awal pilihan; pemilik tetap memilih kecamatan sendiri (A34).
const PROVINSI_BAWAAN = '33'
const KABUPATEN_BAWAAN = '33.14'

export const linkMaps = (t: Titik) => `https://www.google.com/maps?q=${t.lat},${t.lng}`
export const bulatkan = (n: number) => Math.round(n * 1e6) / 1e6

async function muatWilayah(tingkat: 'provinsi' | 'kabupaten' | 'kecamatan', kodeInduk?: string) {
  let q = supabase.from('wilayah').select('id, kode, nama, kode_induk').eq('tingkat', tingkat).eq('aktif', true)
  if (kodeInduk) q = q.eq('kode_induk', kodeInduk)
  const { data, error } = await q.order('nama')
  if (error) throw error
  return (data ?? []) as Wilayah[]
}

type Tampilkan = (p: { teks: string; jenis: 'merah' | 'netral' }) => void

// Pilihan provinsi, kabupaten, dan kecamatan. siapkan(kecamatanId) mengisi pilihan awal dari kecamatan yang
// sudah tersimpan (atau bawaan Sragen) lalu memuat daftar provinsi; daftar kabupaten dan kecamatan menyusul.
export function useWilayahTempat(tampilkan: Tampilkan) {
  const [aktif, setAktif] = useState(false)
  const [daftarProvinsi, setDaftarProvinsi] = useState<Wilayah[]>([])
  const [daftarKabupaten, setDaftarKabupaten] = useState<Wilayah[]>([])
  const [daftarKecamatan, setDaftarKecamatan] = useState<Wilayah[]>([])
  const [provinsi, setProvinsi] = useState(PROVINSI_BAWAAN)
  const [kabupaten, setKabupaten] = useState(KABUPATEN_BAWAAN)
  const [kecamatanId, setKecamatanId] = useState('')
  const [gantiProvinsi, setGantiProvinsi] = useState(false)

  // Daftar kabupaten dan kecamatan tetap dimuat walaupun langkah sebelumnya gagal, sama dengan Daftar 2 sebelumnya
  const siapkan = useCallback(async (kecamatanTersimpan: string | null) => {
    try {
      let prov = PROVINSI_BAWAAN
      let kab = KABUPATEN_BAWAAN
      if (kecamatanTersimpan) {
        const { data: kec } = await supabase.from('wilayah').select('kode_induk').eq('id', kecamatanTersimpan).maybeSingle()
        if (kec?.kode_induk) {
          kab = kec.kode_induk
          prov = kab.split('.')[0]
          setKecamatanId(kecamatanTersimpan)
        }
      }
      setProvinsi(prov)
      setKabupaten(kab)
      setDaftarProvinsi(await muatWilayah('provinsi'))
    } finally {
      setAktif(true)
    }
  }, [])

  useEffect(() => {
    if (!aktif) return
    muatWilayah('kabupaten', provinsi)
      .then(setDaftarKabupaten)
      .catch(() => tampilkan({ teks: 'Daftar kabupaten belum termuat.', jenis: 'merah' }))
  }, [aktif, provinsi, tampilkan])

  useEffect(() => {
    if (!aktif || !kabupaten) return
    muatWilayah('kecamatan', kabupaten)
      .then(setDaftarKecamatan)
      .catch(() => tampilkan({ teks: 'Daftar kecamatan belum termuat.', jenis: 'merah' }))
  }, [aktif, kabupaten, tampilkan])

  const pilihProvinsi = (kode: string) => {
    setProvinsi(kode)
    setKabupaten('')
    setKecamatanId('')
    setDaftarKecamatan([])
    setGantiProvinsi(false)
  }
  const pilihKabupaten = (kode: string) => {
    setKabupaten(kode)
    setKecamatanId('')
    setDaftarKecamatan([])
  }

  return {
    siapkan,
    daftarProvinsi,
    daftarKabupaten,
    daftarKecamatan,
    provinsi,
    kabupaten,
    kecamatanId,
    setKecamatanId,
    pilihProvinsi,
    pilihKabupaten,
    gantiProvinsi,
    setGantiProvinsi,
    namaProvinsi: daftarProvinsi.find((p) => p.kode === provinsi)?.nama ?? '',
  }
}

export type WilayahTempat = ReturnType<typeof useWilayahTempat>

// Pakai lokasiku sekarang: titik GPS dibulatkan 6 desimal, beserta akurasinya
export function ambilLokasiku(tampilkan: Tampilkan, onTitik: (t: Titik) => void, onSelesai: () => void) {
  if (!('geolocation' in navigator)) {
    tampilkan({ teks: 'HP ini tidak bisa mengambil lokasi. Tempat tetap bisa disimpan tanpa titik.', jenis: 'netral' })
    onSelesai()
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onSelesai()
      onTitik({
        lat: bulatkan(pos.coords.latitude),
        lng: bulatkan(pos.coords.longitude),
        akurasi: Math.round(pos.coords.accuracy),
      })
    },
    (err) => {
      onSelesai()
      tampilkan({
        teks:
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Tempat tetap bisa disimpan tanpa titik.'
            : 'Lokasi belum ketemu. Coba lagi di tempat terbuka.',
        jenis: 'netral',
      })
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  )
}
