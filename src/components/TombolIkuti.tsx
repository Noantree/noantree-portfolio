import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LembarMasuk } from './LembarMasuk'
import { usePesan } from './Pesan'
import { berhentiIkuti, ikuti, sedangMengikuti } from '../lib/ikuti'
import { useSesi } from '../lib/sesi'

const GALAT = 'Belum bisa mengikuti. Periksa sinyal, lalu coba lagi.'
const KETERANGAN_MASUK =
  'Masuk untuk mengikuti atau melaporkan lapak. Melihat lapak tetap bisa tanpa masuk. Setelah masuk, aksi yang tadi kamu pilih langsung dijalankan.'

// Tombol Ikuti (V33, A41, A26). Tampilan berganti langsung saat diketuk, lalu kembali kalau fungsi gagal.
// Tamu melihat lembar Masuk V6; setelah masuk, Pengarah membawa kembali ke halaman ini dengan aksi tertunda,
// dan tombol ini menjalankannya sekali (aksiTertunda). Pemilik tidak pernah melihat tombol ini (V49, A42),
// dan database tetap menolak kalau dicoba.
export function TombolIkuti({
  lapak,
  varian = 'utama',
  ajakan,
  aksiTertunda,
  onAksiSelesai,
}: {
  lapak: { id: string; nama: string; slug: string }
  varian?: 'utama' | 'kartu' // kartu: di dalam kartu Habis (V23), latar putih
  ajakan?: string // kalimat di bawah tombol selama belum mengikuti (V22)
  aksiTertunda?: boolean
  onAksiSelesai?: () => void
}) {
  const { sesi, memuat } = useSesi()
  const { tampilkan } = usePesan()
  const navigate = useNavigate()
  // null = belum diketahui (memuat, atau tamu)
  const [diikuti, setDiikuti] = useState<boolean | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [lembarMasuk, setLembarMasuk] = useState(false)
  const aksiDijalankan = useRef(false)
  const uid = sesi?.user.id ?? null

  useEffect(() => {
    if (!uid) return
    let batal = false
    // Kalau aksi tertunda sudah berjalan, hasil baca ini bisa lebih lama dari ikuti dan tidak boleh menimpanya
    sedangMengikuti(lapak.id).then(
      (ya) => !batal && !aksiDijalankan.current && setDiikuti(ya),
      () => !batal && !aksiDijalankan.current && setDiikuti(false),
    )
    return () => {
      batal = true
    }
  }, [uid, lapak.id])

  const mulaiIkuti = async () => {
    setSibuk(true)
    setDiikuti(true)
    try {
      await ikuti(lapak.id)
      tampilkan({ teks: `Kamu mengikuti ${lapak.nama}`, jenis: 'info', aksi: { label: 'Lihat', jalankan: () => navigate('/diikuti') } })
    } catch {
      setDiikuti(false)
      tampilkan({ teks: GALAT, jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  const berhenti = async () => {
    setSibuk(true)
    setDiikuti(false)
    try {
      await berhentiIkuti(lapak.id)
      tampilkan({ teks: `Berhenti mengikuti ${lapak.nama}`, jenis: 'netral', batalkan: () => void mulaiIkutiDiam() })
    } catch {
      setDiikuti(true)
      tampilkan({ teks: GALAT, jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  // Batalkan berhenti: ikuti lagi tanpa pesan biru
  const mulaiIkutiDiam = async () => {
    setDiikuti(true)
    try {
      await ikuti(lapak.id)
    } catch {
      setDiikuti(false)
      tampilkan({ teks: GALAT, jenis: 'merah' })
    }
  }

  // Aksi tertunda dari sebelum masuk (A26): dijalankan sekali begitu sesi siap
  useEffect(() => {
    if (!aksiTertunda || !uid || aksiDijalankan.current) return
    aksiDijalankan.current = true
    onAksiSelesai?.()
    void mulaiIkuti()
    // mulaiIkuti dibuat ulang tiap render; yang penting hanya sekali per halaman
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aksiTertunda, uid])

  const ketuk = () => {
    if (!uid) {
      setLembarMasuk(true)
      return
    }
    if (sibuk || diikuti === null) return
    if (diikuti) void berhenti()
    else void mulaiIkuti()
  }

  const latar = varian === 'kartu' ? 'bg-white' : diikuti ? 'bg-kartu' : 'bg-brand-muda'
  const tinggi = varian === 'kartu' ? 'h-12' : 'h-[52px]'
  const tampilDiikuti = Boolean(uid && diikuti)

  return (
    <>
      <button
        type="button"
        onClick={ketuk}
        disabled={memuat}
        aria-pressed={uid ? Boolean(diikuti) : undefined}
        className={`flex ${tinggi} w-full items-center justify-center gap-1.5 rounded-full font-bold shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)] ${latar} ${
          tampilDiikuti ? 'text-[15px] text-tinta' : `text-brand-tekan ${varian === 'utama' ? 'text-base' : 'text-[15px]'}`
        }`}
      >
        {tampilDiikuti ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E7A4F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Diikuti
          </>
        ) : (
          '+ Ikuti lapak ini'
        )}
      </button>
      {ajakan && !tampilDiikuti && <span className="-mt-2.5 text-center text-[13px] text-teks-redup">{ajakan}</span>}
      <LembarMasuk
        terbuka={lembarMasuk}
        onTutup={() => setLembarMasuk(false)}
        keterangan={KETERANGAN_MASUK}
        tujuan={{ asal: 'aksi', aksi: 'ikuti', lapakId: lapak.id, kembaliKe: `/${lapak.slug}` }}
      />
    </>
  )
}
