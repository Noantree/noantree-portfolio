import { useEffect, useState } from 'react'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import type { Tujuan } from '../lib/pengarah'

const JEDA_KIRIM_ULANG = 60

// Cek email (V24): link masuk sudah dikirim, kirim ulang setelah 60 detik (A25).
// Tidak punya rute sendiri supaya tidak memakan nama slug (A36); ditampilkan di atas layar asal.
export default function CekEmail({
  email,
  tujuan,
  onGanti,
}: {
  email: string
  tujuan?: Tujuan
  onGanti: () => void
}) {
  const { kirimLinkEmail } = useSesi()
  const { tampilkan } = usePesan()
  const [sisa, setSisa] = useState(JEDA_KIRIM_ULANG)
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => {
    if (sisa <= 0) return
    const t = setTimeout(() => setSisa((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [sisa])

  const kirimUlang = async () => {
    setSibuk(true)
    const berhasil = await kirimLinkEmail(email, tujuan)
    setSibuk(false)
    if (berhasil) {
      setSisa(JEDA_KIRIM_ULANG)
      tampilkan({ teks: 'Link baru sudah dikirim.', jenis: 'berhasil' })
    } else {
      tampilkan({ teks: 'Link belum terkirim. Coba lagi sebentar lagi.', jenis: 'merah' })
    }
  }

  const menit = Math.floor(sisa / 60)
  const detik = String(sisa % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-5 pb-7 pt-3">
        <button
          type="button"
          onClick={onGanti}
          aria-label="Kembali"
          className="flex size-11 items-center justify-center rounded-full bg-kartu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="mt-10 flex size-18 items-center justify-center rounded-full bg-brand-muda" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F5FE6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M4 7l8 6 8-6" />
          </svg>
        </div>
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em]">Cek email kamu</h1>
        <p className="text-base leading-[1.55] text-[#3D4A5F]">
          Kami kirim link masuk ke <b className="break-all text-tinta">{email}</b>. Buka email itu di HP ini, lalu ketuk{' '}
          <b className="text-tinta">Masuk ke noantree</b>.
        </p>
        <div className="rounded-[18px] bg-kartu px-4 py-3.5 text-sm leading-normal text-[#3D4A5F]">
          Tidak ada di kotak masuk? Cek folder <b>Spam</b> atau <b>Promosi</b>. Link berlaku 1 jam.
        </div>

        <a
          href="mailto:"
          className="mt-auto flex h-14 items-center justify-center rounded-[28px] bg-brand text-base font-bold text-white active:bg-brand-tekan"
        >
          Buka aplikasi email
        </a>
        <button
          type="button"
          onClick={kirimUlang}
          disabled={sisa > 0 || sibuk}
          className="h-12 rounded-3xl bg-kartu text-[15px] font-semibold text-tinta disabled:text-teks-redup"
        >
          {sisa > 0 ? `Kirim ulang dalam ${menit}:${detik}` : 'Kirim ulang'}
        </button>
        <button type="button" onClick={onGanti} className="flex min-h-10 items-center self-center text-sm font-semibold text-brand-tekan">
          Salah email? Ganti
        </button>
      </main>
    </div>
  )
}
