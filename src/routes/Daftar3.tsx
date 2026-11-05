import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormJadwal } from '../components/FormJadwal'
import { Tombol } from '../components/Tombol'
import { LembarBawah } from '../components/LembarBawah'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { munculkanBannerDaftar } from '../lib/pengingat'
import { isiKirim, jadwalDariDb, periksaJadwal, sesiTerisi, useEditorJadwal } from '../lib/jadwal'

// Daftar 3: Jadwal (V13). Tujuh hari, beberapa sesi per hari, boleh lewat tengah malam (A35). Boleh dilewati (A30).
// Formulir dan aturan jam dipakai bersama Ubah jadwal (V44).
export default function Daftar3() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const editor = useEditorJadwal(tampilkan)
  const { jadwal, setJadwal } = editor

  const [siap, setSiap] = useState(false)
  // Ada jadwal di database: Lewati perlu konfirmasi karena jadwal itu akan dihapus (A35)
  const [adaTersimpan, setAdaTersimpan] = useState(false)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)
  const [sibuk, setSibuk] = useState(false)

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
        if (!lapak || lapak.langkah_daftar < 3) {
          navigate(lapak ? `/daftar/${lapak.langkah_daftar}` : '/daftar/1', { replace: true })
          return
        }
        if (lapak.status_tayang !== 'draf') {
          navigate('/lapakku', { replace: true })
          return
        }
        const { data: baris, error: eJadwal } = await supabase
          .from('jadwal')
          .select('hari, jam_mulai, jam_selesai')
          .eq('lapak_id', lapak.id)
          .order('jam_mulai')
        if (eJadwal) throw eJadwal
        setAdaTersimpan((baris ?? []).length > 0)
        setJadwal(jadwalDariDb(baris ?? []))
      } catch {
        tampilkan({ teks: 'Belum bisa memuat jadwal. Coba lagi.', jenis: 'merah' })
      }
      setSiap(true)
    }
    muat()
  }, [memuat, uid, navigate, tampilkan, setJadwal])

  if (!sesi || !siap) return null

  const adaSesi = sesiTerisi(jadwal).length > 0

  // tayang = true: Simpan dan selesai atau Lewati, lalu lapak tayang dan ke V25 (A30).
  // tayang = false: Lanjutkan nanti, jadwal disimpan dan lapak tetap draf (A31).
  const kirim = async (isi: { hari: number; mulai: string; selesai: string }[], tayang: boolean) => {
    setSibuk(true)
    const { error } = await supabase.rpc('simpan_daftar_3', { p_jadwal: isi })
    if (error) {
      setSibuk(false)
      // Pesan dari database sudah dalam bahasa pemilik (misal "Jam sesi bertumpuk di hari Sabtu dan Minggu")
      tampilkan({ teks: error.code === 'P0001' ? error.message : 'Jadwal belum tersimpan. Coba lagi.', jenis: 'merah' })
      return false
    }
    if (!tayang) {
      setSibuk(false)
      keBerandaDenganBanner()
      return true
    }
    // Jadwal sudah tersimpan; kalau tayang gagal, lapak tetap draf dan tombol yang sama bisa diketuk lagi
    const { error: eTayang } = await supabase.rpc('tayangkan_lapak')
    setSibuk(false)
    if (eTayang) {
      tampilkan({ teks: eTayang.code === 'P0001' ? eTayang.message : 'Lapak belum tayang. Coba lagi.', jenis: 'merah' })
      return false
    }
    navigate('/daftar/tayang', { replace: true })
    return true
  }

  // Pemeriksaan yang sama dengan database (014), supaya pesannya muncul sebelum dikirim
  const periksa = () => {
    const galat = periksaJadwal(jadwal)
    if (galat) tampilkan({ teks: galat, jenis: 'merah' })
    return galat === null
  }

  const simpan = () => {
    if (periksa()) kirim(isiKirim(jadwal), true)
  }

  const keBerandaDenganBanner = () => {
    munculkanBannerDaftar(sesi.user.id)
    navigate('/')
  }

  // Lanjutkan nanti (A31): formulir kosong tidak menghapus jadwal tersimpan, cukup kembali ke beranda.
  const lanjutkanNanti = () => {
    if (!adaSesi) keBerandaDenganBanner()
    else if (periksa()) kirim(isiKirim(jadwal), false)
  }

  // Lewati = simpan tanpa jadwal. Jadwal tersimpan dihapus, jadi minta konfirmasi dulu.
  const lewati = () => {
    if (adaTersimpan) setKonfirmasiHapus(true)
    else kirim([], true)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 px-4 pb-6 pt-5">
      <div className="flex flex-col gap-2">
        {/* Lanjutkan nanti tidak ada di desain V13; ditambahkan sesuai keputusan S2.4 (A31), sama dengan V11 dan V12 */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-teks-redup">Langkah 3 dari 3 · boleh dilewati</span>
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
          <div className="h-1.5 rounded-full bg-brand" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">Biasanya buka jam berapa?</h1>
        <p className="text-sm leading-normal text-teks-redup">
          Pelanggan melihat jadwalmu, dan status otomatis berakhir di akhir jadwal. Satu sesi boleh panjang (kurang dari 24
          jam) dan bisa diperpanjang sampai 8 jam. Tanpa jadwal, berakhir 4 jam setelah mulai.
        </p>
      </div>

      <FormJadwal e={editor} />

      {/* Hanya satu tombol aktif: Simpan bila ada minimal 1 sesi terisi, Lewati bila belum ada sama sekali */}
      <Tombol className="mt-auto" onClick={simpan} disabled={!adaSesi || sibuk}>
        {sibuk && adaSesi ? 'Menyimpan…' : 'Simpan dan selesai'}
      </Tombol>
      <Tombol varian="netral" className="h-12 text-[15px] font-semibold" onClick={lewati} disabled={adaSesi || sibuk}>
        Lewati, jadwal saya tidak tetap
      </Tombol>

      <LembarBawah terbuka={konfirmasiHapus} onTutup={() => setKonfirmasiHapus(false)} judul="Hapus jadwalmu?">
        <p className="text-[15px] leading-normal text-[#3D4A5F]">Jadwal lamamu akan dihapus. Lapakmu tetap bisa dicari.</p>
        <div className="grid grid-cols-2 gap-2">
          <Tombol varian="netral" onClick={() => setKonfirmasiHapus(false)} disabled={sibuk}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              await kirim([], true)
              setKonfirmasiHapus(false)
            }}
            disabled={sibuk}
          >
            Ya, hapus
          </Tombol>
        </div>
      </LembarBawah>
    </main>
  )
}
