import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { muatLapakSaya, type LapakSaya } from '../lib/pengarah'
import { linkLapak } from '../lib/bagikan'

// Lapak sudah tayang (V25, A30, A36). Rute /daftar/tayang; lapak belum tayang atau belum ada: ke /daftar.
// Link memakai alamat situs yang sedang dibuka, karena domain belum diputuskan.
export default function Tayang() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const [lapak, setLapak] = useState<LapakSaya | null>(null)

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/daftar', { replace: true })
      return
    }
    muatLapakSaya(uid)
      .then((l) => {
        if (!l || l.status_tayang !== 'tayang' || !l.slug) navigate('/daftar', { replace: true })
        else setLapak(l)
      })
      .catch(() => navigate('/daftar', { replace: true }))
  }, [memuat, uid, navigate])

  if (!lapak?.slug) return null

  // Alamat situs resmi (src/lib/situs.ts), sama dengan Bagikan dan QR
  const { url: link, tampil: linkTampil } = linkLapak(lapak.slug)

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(link)
      tampilkan({ teks: 'Link disalin.', jenis: 'berhasil' })
    } catch {
      tampilkan({ teks: 'Link belum bisa disalin.', jenis: 'merah' })
    }
  }

  const bagikan = async () => {
    if (!navigator.share) {
      salin()
      return
    }
    try {
      await navigator.share({ title: lapak.nama, url: link })
    } catch {
      // Menu bagikan ditutup tanpa memilih: tidak perlu pesan
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-5 pb-7 pt-14">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-[#E4F5EC]" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0E7A4F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
      <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em]">Lapakmu sudah tayang</h1>
      <p className="text-base leading-[1.55] text-[#3D4A5F]">
        Pelanggan sudah bisa menemukan {lapak.nama}. Supaya mereka tahu, bagikan link lapakmu ke grup WhatsApp pelanggan.
      </p>

      <div className="flex items-center justify-between gap-2.5 rounded-[20px] bg-kartu px-4 py-3.5">
        <span translate="no" className="min-w-0 break-all text-[15px] font-bold">
          {linkTampil}
        </span>
        <button
          type="button"
          onClick={salin}
          className="h-9 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
        >
          Salin
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={bagikan}
          className="h-13 rounded-full bg-brand-muda text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
        >
          Bagikan link
        </button>
        {/* QR gerobak (V26, A49); link dan QR ini juga bisa dibuka lagi dari Bagikan di beranda pemilik (V36) */}
        <Link
          to="/lapakku/qr"
          className="flex h-13 items-center justify-center rounded-full bg-brand-muda text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
        >
          QR gerobak
        </Link>
      </div>

      <div className="flex flex-col gap-2 rounded-[20px] bg-kartu p-4">
        <span className="text-[15px] font-bold">Tiap mau jualan</span>
        <span className="text-sm leading-normal text-[#3D4A5F]">
          Buka noantree, tekan <b className="text-tinta">Mulai buka</b>. Selesai jualan, tekan <b className="text-tinta">Selesai</b>. Itu saja.
        </span>
      </div>

      <button
        type="button"
        onClick={() => navigate('/lapakku', { replace: true })}
        className="mt-auto h-14 rounded-[28px] bg-brand text-base font-bold text-white active:bg-brand-tekan"
      >
        Ke beranda lapak
      </button>
    </main>
  )
}
