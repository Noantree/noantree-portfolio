import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BagianTitik, BagianWilayah } from '../components/FormTempat'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { munculkanBannerDaftar } from '../lib/pengingat'
import { ambilLokasiku, useWilayahTempat, type Titik } from '../lib/tempat'

// Daftar 2: Tempat (V12). Satu tempat dengan titik GPS dan kabupaten/kecamatan (A30, A33, A34).
// Titik ini lokasi tempat jualan pemilik, boleh disimpan; lokasi pelanggan tidak pernah dikirim (A21).
// Bagian titik dan wilayah dipakai bersama Tempat baru (V43) dan Ubah tempat (V31).
export default function Daftar2() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const wilayah = useWilayahTempat(tampilkan)
  const { siapkan } = wilayah

  const [siap, setSiap] = useState(false)
  const [nama, setNama] = useState('')
  const [titik, setTitik] = useState<Titik | null>(null)
  const [mencariTitik, setMencariTitik] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  // Muat lapak draf dan tempat yang sudah tersimpan
  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/daftar', { replace: true })
      return
    }
    const muat = async () => {
      try {
        const { data: lapak, error } = await supabase
          .from('lapak')
          .select('id, status_tayang, langkah_daftar')
          .eq('pemilik_id', uid)
          .maybeSingle()
        if (error) throw error
        if (!lapak || lapak.langkah_daftar < 2) {
          navigate('/daftar/1', { replace: true })
          return
        }
        if (lapak.status_tayang !== 'draf') {
          navigate('/lapakku', { replace: true })
          return
        }

        const { data: tempat } = await supabase
          .from('tempat')
          .select('nama, lat, lng, kecamatan_id')
          .eq('lapak_id', lapak.id)
          .order('dibuat_pada')
          .limit(1)
          .maybeSingle()

        if (tempat) {
          setNama(tempat.nama)
          if (tempat.lat !== null && tempat.lng !== null) setTitik({ lat: tempat.lat, lng: tempat.lng, akurasi: null })
        }
        await siapkan(tempat?.kecamatan_id ?? null)
      } catch {
        tampilkan({ teks: 'Belum bisa memuat data. Coba lagi.', jenis: 'merah' })
        // Pilihan wilayah tetap disiapkan dengan bawaan supaya formulir bisa diisi
        siapkan(null).catch(() => {})
      }
      setSiap(true)
    }
    muat()
  }, [memuat, uid, navigate, tampilkan, siapkan])

  if (!sesi || !siap) return null

  const pakaiLokasi = () => {
    setMencariTitik(true)
    ambilLokasiku(tampilkan, setTitik, () => setMencariTitik(false))
  }

  const simpan = async (selesai: boolean) => {
    const { error } = await supabase.rpc('simpan_daftar_2', {
      p_nama: nama,
      p_lat: titik?.lat ?? null,
      p_lng: titik?.lng ?? null,
      p_kecamatan_id: wilayah.kecamatanId || null,
      p_selesai: selesai,
    })
    return !error
  }

  const lanjut = async () => {
    if (!nama.trim()) {
      tampilkan({ teks: 'Isi nama tempat dulu.', jenis: 'merah' })
      return
    }
    if (!wilayah.kecamatanId) {
      tampilkan({ teks: 'Pilih kecamatan dulu.', jenis: 'merah' })
      return
    }
    setSibuk(true)
    const berhasil = await simpan(true)
    setSibuk(false)
    if (berhasil) navigate('/daftar/3')
    else tampilkan({ teks: 'Tempat belum tersimpan. Coba lagi.', jenis: 'merah' })
  }

  // Lanjutkan nanti menyimpan isian yang ada tanpa menaikkan langkah, lalu ke beranda dengan banner V47 (A31).
  // Tanpa nama tempat belum ada yang bisa disimpan; profil lapak dari langkah 1 sudah tersimpan.
  const keBerandaDenganBanner = () => {
    munculkanBannerDaftar(sesi.user.id)
    navigate('/')
  }

  const lanjutkanNanti = async () => {
    if (!nama.trim()) {
      keBerandaDenganBanner()
      return
    }
    setSibuk(true)
    const berhasil = await simpan(false)
    setSibuk(false)
    if (berhasil) keBerandaDenganBanner()
    else tampilkan({ teks: 'Isian belum tersimpan. Coba lagi.', jenis: 'merah' })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] px-4 pb-7 pt-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-teks-redup">Langkah 2 dari 3</span>
          <button
            type="button"
            onClick={lanjutkanNanti}
            disabled={sibuk}
            className="flex min-h-11 items-center text-[13px] font-bold text-brand-tekan disabled:opacity-50"
          >
            Lanjutkan nanti
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-1.5 rounded-full bg-brand" />
          <div className="h-1.5 rounded-full bg-brand" />
          <div className="h-1.5 rounded-full bg-[#E3E7EE]" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">Satu tempat kamu biasa buka</h1>
        <p className="text-[15px] text-teks-redup">Tempat lain bisa ditambah setelah daftar.</p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama tempat
        <input
          type="text"
          name="nama_tempat"
          autoComplete="off"
          placeholder="Contoh: Depan Pasar Sragen"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="h-13 rounded-2xl bg-kartu px-4 text-base font-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
      </label>

      <BagianTitik
        judul="Titik lokasi"
        keterangan="Pilih ini kalau kamu sedang berdiri di tempat jualan. Link Google Maps dibuat otomatis."
        titik={titik}
        mencari={mencariTitik}
        nonaktif={sibuk}
        onPakaiLokasi={pakaiLokasi}
        onTitik={setTitik}
      />

      <BagianWilayah w={wilayah} />

      <p className="mt-auto text-center text-[13px] text-teks-redup">Setelah langkah ini, lapakmu sudah bisa ditemukan pelanggan.</p>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Tombol varian="netral" className="px-3 text-[15px]" onClick={() => navigate('/daftar/1')} disabled={sibuk}>
          Kembali
        </Tombol>
        <Tombol onClick={lanjut} disabled={sibuk || mencariTitik}>
          {sibuk ? 'Menyimpan…' : 'Simpan dan lanjut'}
        </Tombol>
      </div>
    </main>
  )
}
