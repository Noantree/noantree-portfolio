import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { muatLapakSaya, teksLangkahBelumSelesai } from '../lib/pengarah'
import { bannerDaftarDitutup, tutupBannerDaftar } from '../lib/pengingat'

// Banner "Daftar lapakmu belum selesai" di beranda (V47, A31), untuk lapak draf.
// Ditutup (×): disimpan di HP, dan pengingatnya pindah ke Akun saya.
export function BannerDaftar({ uid }: { uid: string }) {
  const [langkah, setLangkah] = useState<number | null>(null)

  useEffect(() => {
    if (bannerDaftarDitutup(uid)) return
    muatLapakSaya(uid)
      .then((l) => setLangkah(l?.status_tayang === 'draf' ? l.langkah_daftar : null))
      .catch(() => setLangkah(null))
  }, [uid])

  if (langkah === null) return null

  return (
    <div role="status" className="flex flex-col gap-2.5 rounded-[20px] bg-brand-muda p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold">Daftar lapakmu belum selesai</span>
          <span className="text-sm leading-[1.45] text-[#3D4A5F]">
            {teksLangkahBelumSelesai(langkah)}
            {langkah === 3 && ' Setelah itu lapakmu langsung tayang.'}
          </span>
        </div>
        <button
          type="button"
          aria-label="Tutup pengingat"
          onClick={() => {
            tutupBannerDaftar(uid)
            setLangkah(null)
          }}
          className="-mr-1.5 -mt-1.5 flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D4A5F" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <Link
        to={`/daftar/${langkah}`}
        className="flex h-12 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-white active:bg-brand-tekan"
      >
        Lanjutkan daftar
      </Link>
    </div>
  )
}
