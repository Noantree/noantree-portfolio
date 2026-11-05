import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LembarTutupLapak } from '../components/LembarTutupLapak'
import { usePesan } from '../components/Pesan'
import { inisialLapak } from '../lib/pengarah'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { ringkasJadwal, type BarisJadwal } from '../lib/waktu'

const MAKS_TEMPAT = 10

type Lapak = { id: string; nama: string; slug: string; foto_url: string | null; status_tayang: string; langkah_daftar: number }
type Tempat = { id: string; nama: string; lat: number | null; lng: number | null; kecamatan_id: string | null }
type Data = { lapak: Lapak; tempat: Tempat[]; kecamatan: Record<string, string>; jadwal: BarisJadwal[]; pengikut: number | null }

// Tanpa lapak ke /daftar, lapak draf ke langkah yang belum selesai; selain itu isi V16
async function muatProfilLapak(uid: string): Promise<Data | { arah: string }> {
  const { data: lapak, error } = await supabase
    .from('lapak')
    .select('id, nama, slug, foto_url, status_tayang, langkah_daftar')
    .eq('pemilik_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!lapak) return { arah: '/daftar' }
  if (lapak.status_tayang === 'draf') return { arah: `/daftar/${lapak.langkah_daftar}` }
  const [tempat, jadwal, publik] = await Promise.all([
    supabase
      .from('tempat')
      .select('id, nama, lat, lng, kecamatan_id')
      .eq('lapak_id', lapak.id)
      .order('terakhir_dipakai', { ascending: false, nullsFirst: false })
      .order('dibuat_pada'),
    supabase.from('jadwal').select('hari, jam_mulai, jam_selesai').eq('lapak_id', lapak.id),
    // Jumlah pengikut; lapak disembunyikan tidak ada di view, jadi angkanya tidak ditampilkan
    supabase.from('lapak_publik').select('jumlah_pengikut').eq('id', lapak.id).maybeSingle(),
  ])
  const galat = tempat.error ?? jadwal.error ?? publik.error
  if (galat) throw galat
  const daftarTempat = (tempat.data ?? []) as Tempat[]
  // Nama kecamatan dari tabel wilayah (dibaca publik); gagal membaca hanya menghilangkan nama kecamatan
  const idKecamatan = [...new Set(daftarTempat.map((t) => t.kecamatan_id).filter((x): x is string => Boolean(x)))]
  const kecamatan: Record<string, string> = {}
  if (idKecamatan.length > 0) {
    const { data: wilayah } = await supabase.from('wilayah').select('id, nama').in('id', idKecamatan)
    for (const w of (wilayah ?? []) as { id: string; nama: string }[]) kecamatan[w.id] = w.nama
  }
  return {
    lapak: lapak as Lapak,
    tempat: daftarTempat,
    kecamatan,
    jadwal: (jadwal.data ?? []) as BarisJadwal[],
    pengikut: (publik.data as { jumlah_pengikut: number } | null)?.jumlah_pengikut ?? null,
  }
}

// Profil lapak (V16, A39) di /lapakku/profil: profil, Lihat halamanku, QR untuk gerobak, daftar tempat, ringkasan jadwal,
// Akun saya, Jelajahi sebagai pelanggan, dan Tutup lapak permanen (V51, A29). Untuk pemilik lapak tayang dan disembunyikan;
// tanpa lapak ke /daftar, lapak draf ke langkah yang belum selesai, tamu ke beranda (sama dengan Lapakku).
// Data dibaca seperti Lapakku: tabel milik sendiri lewat RLS, jumlah pengikut dari lapak_publik.
// Ubah menuju Ubah profil (V42), + Tempat baru menuju Tempat baru (V43), Ubah per tempat menuju Ubah tempat (V31),
// dan baris Jadwal buka menuju Ubah jadwal (V44).
export default function ProfilLapak() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const [data, setData] = useState<Data | null>(null)
  const [gagal, setGagal] = useState(false)
  const [lembarTutup, setLembarTutup] = useState(false)
  const [fotoGagal, setFotoGagal] = useState(false)
  const [putaran, setPutaran] = useState(0)

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    let batal = false
    muatProfilLapak(uid).then(
      (hasil) => {
        if (batal) return
        if ('arah' in hasil) navigate(hasil.arah, { replace: true })
        else {
          setData(hasil)
          setGagal(false)
        }
      },
      () => !batal && setGagal(true),
    )
    return () => {
      batal = true
    }
  }, [memuat, uid, navigate, putaran])

  if (memuat || !sesi) return null

  const kepala = (
    <div className="flex h-16 items-center gap-3">
      <Link to="/lapakku" aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="text-xl font-bold">Profil lapak</h1>
    </div>
  )

  if (!data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 bg-white px-4 pb-6">
        {kepala}
        {gagal ? (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
            <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
              Profil lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
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
          <>
            <div aria-hidden="true" className="flex items-center gap-3.5">
              <div className="size-16 rounded-full bg-[#E3E7EE]" />
              <div className="flex grow flex-col gap-2">
                <div className="h-3.5 w-3/5 rounded-md bg-[#E3E7EE]" />
                <div className="h-2.5 w-1/3 rounded-[5px] bg-[#E9ECF1]" />
              </div>
            </div>
            <span role="status" className="text-[13px] text-teks-redup">
              Memuat profil lapak…
            </span>
          </>
        )}
      </main>
    )
  }

  const { lapak, tempat, kecamatan, jadwal, pengikut } = data
  const ringkas = ringkasJadwal(jadwal)
  const infoTempat = (t: Tempat) =>
    [
      t.kecamatan_id && kecamatan[t.kecamatan_id] ? `Kec. ${kecamatan[t.kecamatan_id]}` : null,
      t.lat !== null && t.lng !== null ? 'titik ada' : 'tanpa titik, tidak masuk “Terdekat”',
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 bg-white px-4 pb-6">
      {kepala}

      <div className="flex items-center gap-3.5">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[22px] font-extrabold text-white">
          {lapak.foto_url && !fotoGagal ? (
            <img src={lapak.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
          ) : (
            inisialLapak(lapak.nama)
          )}
        </div>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-lg font-extrabold [overflow-wrap:anywhere]">{lapak.nama}</span>
          {pengikut !== null && <span className="text-[13px] text-[#5B6472]">{pengikut} pengikut</span>}
        </div>
        <Link
          to="/lapakku/profil/ubah"
          className="flex h-11 shrink-0 items-center rounded-full bg-brand-muda px-4 text-sm font-bold text-brand-tekan hover:text-brand-tekan"
        >
          Ubah
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/${lapak.slug}`} className="flex h-12 items-center justify-center rounded-full bg-kartu text-sm font-semibold text-tinta hover:text-tinta">
          Lihat halamanku
        </Link>
        <Link to="/lapakku/qr" className="flex h-12 items-center justify-center rounded-full bg-kartu text-sm font-semibold text-tinta hover:text-tinta">
          QR untuk gerobak
        </Link>
      </div>

      <div className="mt-1 flex min-h-10 items-center justify-between">
        <h2 className="text-lg font-bold">
          Tempat{' '}
          <span className="text-sm font-medium text-[#5B6472]">
            {tempat.length} dari {MAKS_TEMPAT}
          </span>
        </h2>
        <Link to="/lapakku/tempat/baru" className="flex min-h-11 items-center text-sm font-bold text-[#1A4FC2] hover:text-tinta">
          + Tempat baru
        </Link>
      </div>
      <div className="flex flex-col rounded-[20px] bg-kartu py-1">
        {tempat.length === 0 && <span className="px-4 py-3 text-sm text-[#3D4A5F]">Belum ada tempat.</span>}
        {tempat.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 px-4 py-3">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[15px] font-bold [overflow-wrap:anywhere]">{t.nama}</span>
              <span className="text-[13px] text-[#5B6472]">{infoTempat(t)}</span>
            </div>
            {/* Tombol 34 px seperti V16, dengan area ketuk 44 px */}
            <Link to={`/lapakku/tempat/${t.id}`} aria-label={`Ubah ${t.nama}`} className="-my-1.5 flex h-11 shrink-0 items-center">
              <span className="flex h-[34px] items-center rounded-full bg-white px-3.5 text-[13px] font-bold text-[#1A4FC2]">Ubah</span>
            </Link>
          </div>
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-[20px] bg-kartu">
        <Link
          to="/lapakku/profil/jadwal"
          className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2 text-[15px] font-semibold text-tinta hover:text-tinta"
        >
          <span className="shrink-0">Jadwal buka</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-[#5B6472]">
            <span className="flex flex-col items-end text-right">
              {ringkas.length > 0 ? ringkas.map((b) => <span key={b}>{b}</span>) : <span>Belum ada jadwal</span>}
            </span>
            ›
          </span>
        </Link>
        <Link
          to="/akun"
          className="flex min-h-[52px] items-center justify-between gap-3 bg-[#EEF1F6] px-4 text-[15px] font-semibold text-tinta hover:text-tinta"
        >
          <span className="shrink-0">Akun saya</span>
          <span className="min-w-0 truncate font-medium text-[#5B6472]">{sesi.user.email} ›</span>
        </Link>
        <Link to="/" className="flex min-h-[52px] items-center justify-between px-4 text-[15px] font-semibold text-tinta hover:text-tinta">
          Jelajahi sebagai pelanggan <span className="text-[#5B6472]">›</span>
        </Link>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <button type="button" onClick={() => setLembarTutup(true)} className="flex h-11 items-center justify-center text-sm font-semibold text-merah">
          Tutup lapak permanen
        </button>
        <span className="text-center text-xs leading-normal text-[#5B6472]">Keluar dan hapus akun ada di Akun saya.</span>
      </div>

      {lembarTutup && (
        <LembarTutupLapak
          uid={sesi.user.id}
          onTutup={() => setLembarTutup(false)}
          onSelesai={() => {
            setLembarTutup(false)
            tampilkan({ teks: 'Lapakmu sudah ditutup.', jenis: 'netral' })
            navigate('/', { replace: true })
          }}
        />
      )}
    </main>
  )
}
