import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BagianTitik, BagianWilayah } from '../components/FormTempat'
import { LembarHapusTempat } from '../components/LembarHapusTempat'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { MAKS_TEMPAT, ambilLokasiku, useWilayahTempat, type Titik } from '../lib/tempat'

type Tempat = { id: string; nama: string; lat: number | null; lng: number | null; kecamatan_id: string | null }
type Isi = { lapakId: string; tempat: Tempat[] }

// Tanpa lapak ke /daftar, lapak draf ke langkah yang belum selesai (draf tetap lewat Daftar 2); selain itu
// lapak dan semua tempatnya (tabel milik sendiri lewat RLS)
async function muatTempatLapak(uid: string): Promise<Isi | { arah: string }> {
  const { data: lapak, error } = await supabase
    .from('lapak')
    .select('id, status_tayang, langkah_daftar')
    .eq('pemilik_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!lapak) return { arah: '/daftar' }
  if (lapak.status_tayang === 'draf') return { arah: `/daftar/${lapak.langkah_daftar}` }
  const { data: tempat, error: eTempat } = await supabase
    .from('tempat')
    .select('id, nama, lat, lng, kecamatan_id')
    .eq('lapak_id', lapak.id)
    .order('terakhir_dipakai', { ascending: false, nullsFirst: false })
    .order('dibuat_pada')
  if (eTempat) throw eTempat
  return { lapakId: lapak.id, tempat: (tempat ?? []) as Tempat[] }
}

// Tempat baru (V43, /lapakku/tempat/baru) dan Ubah tempat (V31, /lapakku/tempat/:id) untuk lapak tayang dan
// disembunyikan (A33, A34, A39). Formulir sama dengan Daftar 2 tanpa penanda langkah. Disimpan lewat tambah_tempat
// dan ubah_tempat (027), yang memeriksa ulang pemilik, isi, dan batas 10 tempat. Hapus tempat ini (V31) lewat
// lembar konfirmasi dan hapus_tempat (027).
export default function KelolaTempat({ mode }: { mode: 'baru' | 'ubah' }) {
  const { id: idTempat } = useParams()
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const wilayah = useWilayahTempat(tampilkan)
  const { siapkan } = wilayah

  const [isi, setIsi] = useState<Isi | null>(null)
  const [gagal, setGagal] = useState(false)
  const [putaran, setPutaran] = useState(0)
  const [nama, setNama] = useState('')
  const [titik, setTitik] = useState<Titik | null>(null)
  const [mencariTitik, setMencariTitik] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [lembarHapus, setLembarHapus] = useState(false)

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    let batal = false
    muatTempatLapak(uid).then(
      (hasil) => {
        if (batal) return
        if ('arah' in hasil) {
          navigate(hasil.arah, { replace: true })
          return
        }
        const ini = mode === 'ubah' ? hasil.tempat.find((t) => t.id === idTempat) : undefined
        if (ini) {
          setNama(ini.nama)
          setTitik(ini.lat !== null && ini.lng !== null ? { lat: ini.lat, lng: ini.lng, akurasi: null } : null)
        }
        setIsi(hasil)
        setGagal(false)
        siapkan(ini?.kecamatan_id ?? null).catch(() => tampilkan({ teks: 'Daftar wilayah belum termuat.', jenis: 'merah' }))
      },
      () => !batal && setGagal(true),
    )
    return () => {
      batal = true
    }
  }, [memuat, uid, navigate, mode, idTempat, siapkan, tampilkan, putaran])

  if (memuat || !sesi) return null

  const tempatIni = mode === 'ubah' ? isi?.tempat.find((t) => t.id === idTempat) : undefined
  const penuh = mode === 'baru' && isi !== null && isi.tempat.length >= MAKS_TEMPAT

  const kepala = (
    <div className="flex h-16 items-center gap-3">
      <Link to="/lapakku/profil" aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      {mode === 'baru' ? (
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold leading-[1.1]">Tempat baru</h1>
          {isi && !penuh && (
            <span className="text-[13px] text-[#5B6472]">
              Tempat ke-{isi.tempat.length + 1} dari maks. {MAKS_TEMPAT}
            </span>
          )}
        </div>
      ) : (
        <h1 className="text-xl font-bold">Ubah tempat</h1>
      )}
    </div>
  )

  const kotakPesan = (teks: string) => (
    <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
      <span className="text-sm leading-normal text-[#3D4A5F]">{teks}</span>
      <Link to="/lapakku/profil" className="flex h-11 items-center rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
        Kembali ke Profil lapak
      </Link>
    </div>
  )

  if (!isi || penuh || (mode === 'ubah' && !tempatIni)) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] bg-white px-4 pb-7">
        {kepala}
        {gagal ? (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
            <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
              Tempat belum bisa dimuat. Periksa sinyal, lalu coba lagi.
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
        ) : !isi ? (
          <span role="status" className="text-[13px] text-teks-redup">
            Memuat tempat…
          </span>
        ) : penuh ? (
          kotakPesan(`Lapakmu sudah punya ${MAKS_TEMPAT} tempat, batas maksimal. Hapus salah satu tempat dulu kalau mau menambah.`)
        ) : (
          kotakPesan('Tempat tidak ditemukan.')
        )}
      </main>
    )
  }

  const pakaiLokasi = () => {
    setMencariTitik(true)
    ambilLokasiku(tampilkan, setTitik, () => setMencariTitik(false))
  }

  const simpan = async () => {
    if (!nama.trim()) {
      tampilkan({ teks: 'Isi nama tempat dulu.', jenis: 'merah' })
      return
    }
    if (!wilayah.kecamatanId) {
      tampilkan({ teks: 'Pilih kecamatan dulu.', jenis: 'merah' })
      return
    }
    setSibuk(true)
    const isian = { p_nama: nama, p_lat: titik?.lat ?? null, p_lng: titik?.lng ?? null, p_kecamatan_id: wilayah.kecamatanId }
    const { error } =
      mode === 'baru'
        ? await supabase.rpc('tambah_tempat', { p_lapak: isi.lapakId, ...isian })
        : await supabase.rpc('ubah_tempat', { p_lapak: isi.lapakId, p_tempat: idTempat, ...isian })
    setSibuk(false)
    if (error) {
      tampilkan({ teks: error.message || 'Tempat belum tersimpan. Coba lagi.', jenis: 'merah' })
      return
    }
    tampilkan({ teks: 'Tempat tersimpan.', jenis: 'berhasil' })
    navigate('/lapakku/profil')
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] bg-white px-4 pb-7">
      {kepala}

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama tempat
        <input
          type="text"
          name="nama_tempat"
          autoComplete="off"
          placeholder="Contoh: Depan Masjid Agung"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="h-13 rounded-2xl bg-kartu px-4 text-base font-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
      </label>

      {mode === 'baru' ? (
        <BagianTitik
          judul={
            <>
              Titik lokasi <span className="font-medium text-[#5B6472]">(opsional)</span>
            </>
          }
          keterangan="Pilih ini kalau kamu sedang berdiri di tempat itu. Link Google Maps dibuat otomatis."
          titik={titik}
          mencari={mencariTitik}
          nonaktif={sibuk}
          onPakaiLokasi={pakaiLokasi}
          onTitik={setTitik}
          setelahLink={<span className="text-xs text-[#5B6472]">Tanpa titik, tempat tetap tampil tapi tidak masuk urutan “Terdekat”.</span>}
        />
      ) : (
        <BagianTitik
          judul="Titik lokasi"
          keterangan="Pilih ini kalau kamu sedang di tempat ini. Titik dan link dibuat otomatis."
          titik={titik}
          mencari={mencariTitik}
          nonaktif={sibuk}
          onPakaiLokasi={pakaiLokasi}
          onTitik={setTitik}
          sebelumTombol={
            !titik && (
              <div role="status" className="rounded-2xl bg-kartu px-3.5 py-3 text-[13px] leading-[1.45] text-[#3D4A5F]">
                Belum ada titik, jadi tempat ini belum masuk urutan “Terdekat”.
              </div>
            )
          }
        />
      )}

      <BagianWilayah w={wilayah} />

      <div className="mt-auto flex flex-col gap-1.5">
        <Tombol onClick={simpan} disabled={sibuk || mencariTitik}>
          {sibuk ? 'Menyimpan…' : mode === 'baru' ? 'Simpan tempat' : 'Simpan perubahan'}
        </Tombol>
        {mode === 'ubah' && (
          <>
            <button
              type="button"
              onClick={() => setLembarHapus(true)}
              disabled={sibuk}
              className="min-h-11 text-[15px] font-bold text-merah disabled:opacity-60"
            >
              Hapus tempat ini
            </button>
            <span className="text-center text-xs text-[#5B6472]">Tempat yang sedang dipakai buka tidak bisa dihapus.</span>
          </>
        )}
      </div>

      {lembarHapus && tempatIni && (
        <LembarHapusTempat
          lapakId={isi.lapakId}
          tempat={tempatIni}
          jumlahTempat={isi.tempat.length}
          onTutup={() => setLembarHapus(false)}
          onSelesai={() => {
            setLembarHapus(false)
            tampilkan({ teks: 'Tempat dihapus.', jenis: 'netral' })
            navigate('/lapakku/profil')
          }}
        />
      )}
    </main>
  )
}
