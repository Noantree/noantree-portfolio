import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormJadwal } from '../components/FormJadwal'
import { LembarHapusJadwal } from '../components/LembarHapusJadwal'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { isiKirim, jadwalDariDb, periksaJadwal, sesiTerisi, useEditorJadwal, type BarisJadwalDb } from '../lib/jadwal'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'

type Isi = { lapakId: string; jadwal: BarisJadwalDb[] }

// Tanpa lapak ke /daftar, lapak draf ke langkah yang belum selesai (draf tetap lewat Daftar 3); selain itu
// lapak dan jadwalnya (tabel milik sendiri lewat RLS)
async function muatJadwalLapak(uid: string): Promise<Isi | { arah: string }> {
  const { data: lapak, error } = await supabase
    .from('lapak')
    .select('id, status_tayang, langkah_daftar')
    .eq('pemilik_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!lapak) return { arah: '/daftar' }
  if (lapak.status_tayang === 'draf') return { arah: `/daftar/${lapak.langkah_daftar}` }
  const { data: jadwal, error: eJadwal } = await supabase
    .from('jadwal')
    .select('hari, jam_mulai, jam_selesai')
    .eq('lapak_id', lapak.id)
    .order('jam_mulai')
  if (eJadwal) throw eJadwal
  return { lapakId: lapak.id, jadwal: (jadwal ?? []) as BarisJadwalDb[] }
}

// Ubah jadwal (V44, A35) di /lapakku/profil/jadwal, untuk pemilik lapak tayang dan disembunyikan. Formulir dan aturan
// jam sama dengan Daftar 3. Hanya satu tombol aktif: Simpan perubahan bila ada minimal 1 sesi, Hapus jadwal bila
// formulir kosong (dan ada jadwal tersimpan). Disimpan lewat simpan_jadwal_saya dan hapus_jadwal_saya (028), yang
// memeriksa ulang semua aturan dan tidak menyentuh sesi buka yang sedang berjalan.
export default function UbahJadwal() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const editor = useEditorJadwal(tampilkan)
  const { jadwal, setJadwal } = editor

  const [lapakId, setLapakId] = useState<string | null>(null)
  const [adaTersimpan, setAdaTersimpan] = useState(false)
  const [gagal, setGagal] = useState(false)
  const [putaran, setPutaran] = useState(0)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [lembarHapus, setLembarHapus] = useState(false)

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    let batal = false
    muatJadwalLapak(uid).then(
      (hasil) => {
        if (batal) return
        if ('arah' in hasil) {
          navigate(hasil.arah, { replace: true })
          return
        }
        setJadwal(jadwalDariDb(hasil.jadwal))
        setAdaTersimpan(hasil.jadwal.length > 0)
        setLapakId(hasil.lapakId)
        setGagal(false)
      },
      () => !batal && setGagal(true),
    )
    return () => {
      batal = true
    }
  }, [memuat, uid, navigate, setJadwal, putaran])

  if (memuat || !sesi) return null

  const kepala = (
    <div className="flex h-16 items-center gap-3">
      <Link to="/lapakku/profil" aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="text-xl font-bold">Ubah jadwal</h1>
    </div>
  )

  if (!lapakId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 bg-white px-4 pb-6">
        {kepala}
        {gagal ? (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
            <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
              Jadwal belum bisa dimuat. Periksa sinyal, lalu coba lagi.
            </span>
            <button
              type="button"
              onClick={() => {
                setGagal(false)
                setPutaran((n) => n + 1)
              }}
              className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <span role="status" className="text-[13px] text-teks-redup">
            Memuat jadwal…
          </span>
        )}
      </main>
    )
  }

  const adaSesi = sesiTerisi(jadwal).length > 0

  // Galat dari pemeriksaan di HP atau dari server ditampilkan di halaman, di atas tombol
  const simpan = async () => {
    const salah = periksaJadwal(jadwal)
    if (salah) {
      setGalat(salah)
      return
    }
    setSibuk(true)
    setGalat(null)
    const { error } = await supabase.rpc('simpan_jadwal_saya', { p_lapak: lapakId, p_jadwal: isiKirim(jadwal) })
    setSibuk(false)
    if (error) {
      setGalat(error.message || 'Jadwal belum tersimpan. Periksa sinyal, lalu coba lagi.')
      return
    }
    tampilkan({ teks: 'Jadwal tersimpan.', jenis: 'berhasil' })
    navigate('/lapakku/profil')
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 bg-white px-4 pb-6">
      {kepala}
      <p className="text-sm leading-normal text-[#5B6472]">
        Status otomatis berakhir di akhir jadwal dan bisa diperpanjang sampai 8 jam. Perubahan berlaku mulai sesi berikutnya.
      </p>

      <FormJadwal e={editor} />

      <div className="mt-auto flex flex-col gap-2">
        {galat && (
          <p role="alert" className="text-sm leading-normal text-merah">
            {galat}
          </p>
        )}
        {/* Hanya satu tombol aktif: Simpan bila ada minimal 1 sesi terisi, Hapus jadwal bila formulir kosong (A35) */}
        <Tombol onClick={simpan} disabled={!adaSesi || sibuk}>
          {sibuk ? 'Menyimpan…' : 'Simpan perubahan'}
        </Tombol>
        <button
          type="button"
          onClick={() => setLembarHapus(true)}
          disabled={adaSesi || sibuk || !adaTersimpan}
          className="h-12 rounded-full text-[15px] font-semibold text-tinta disabled:text-teks-redup disabled:opacity-60"
        >
          Hapus jadwal, jualan saya tidak tetap
        </button>
        <span className="text-center text-xs leading-normal text-[#5B6472]">
          Tanpa jadwal, status berakhir 4 jam setelah Mulai buka dan tidak ada “Biasanya buka”.
        </span>
      </div>

      {lembarHapus && (
        <LembarHapusJadwal
          lapakId={lapakId}
          onTutup={() => setLembarHapus(false)}
          onSelesai={() => {
            setLembarHapus(false)
            tampilkan({ teks: 'Jadwal dihapus.', jenis: 'netral' })
            navigate('/lapakku/profil')
          }}
        />
      )}
    </main>
  )
}
