import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KodeQR } from './KodeQR'
import { usePesan } from './Pesan'
import { linkLapak, muatLapakBagikan, pesanBagikan, salinTeks, type LapakBagikan } from '../lib/bagikan'

type Keadaan = { jenis: 'memuat' } | { jenis: 'gagal' } | { jenis: 'disembunyikan' } | { jenis: 'siap'; lapak: LapakBagikan }

// Lembar Bagikan untuk pemilik (V36, A49): QR, link + Salin, pesan sesuai status, Bagikan ke WhatsApp & lainnya,
// Lihat halamanku (Sprint 4), dan QR untuk gerobak (V26). Data dari lapak_publik; semua dibuat di HP.
export function LembarBagikan({ lapakId, terbuka, onTutup }: { lapakId: string; terbuka: boolean; onTutup: () => void }) {
  const { tampilkan } = usePesan()
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })

  const muat = useCallback(async () => {
    setKeadaan({ jenis: 'memuat' })
    try {
      const lapak = await muatLapakBagikan(lapakId)
      setKeadaan(lapak ? { jenis: 'siap', lapak } : { jenis: 'disembunyikan' })
    } catch {
      setKeadaan({ jenis: 'gagal' })
    }
  }, [lapakId])

  // Dimuat ulang setiap kali dibuka, supaya pesan mengikuti status terbaru
  useEffect(() => {
    if (terbuka) muat()
  }, [terbuka, muat])

  if (!terbuka) return null

  let isi
  if (keadaan.jenis === 'memuat') {
    isi = <p className="py-6 text-center text-[15px] text-teks-redup">Memuat…</p>
  } else if (keadaan.jenis === 'gagal') {
    isi = (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-center text-[15px] text-teks-redup">Link lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.</p>
        <button type="button" onClick={muat} className="h-12 rounded-full bg-brand-muda px-6 text-[15px] font-bold text-brand-tekan">
          Coba lagi
        </button>
      </div>
    )
  } else if (keadaan.jenis === 'disembunyikan') {
    isi = <p className="py-4 text-[15px] leading-normal text-[#3D4A5F]">Lapakmu sedang disembunyikan, jadi link belum bisa dibagikan.</p>
  } else {
    const { lapak } = keadaan
    const link = linkLapak(lapak.slug)
    const pesan = pesanBagikan(lapak)

    const salin = async () => {
      if (await salinTeks(link.url)) tampilkan({ teks: 'Link disalin.', jenis: 'berhasil' })
      else tampilkan({ teks: 'Link belum bisa disalin. Tekan lama link untuk menyalin.', jenis: 'merah' })
    }

    // Menu bagikan bawaan HP; kalau tidak ada, buka WhatsApp lewat wa.me
    const bagikan = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ text: pesan, url: link.url })
        } catch {
          // Menu bagikan ditutup tanpa memilih: tidak perlu pesan
        }
        return
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`${pesan} ${link.url}`)}`, '_blank', 'noopener')
    }

    isi = (
      <>
        <div className="flex items-center gap-3.5">
          <div className="size-[132px] shrink-0 rounded-2xl bg-kartu p-1.5 shadow-[inset_0_0_0_2px_#D5DAE2]">
            <div className="size-full overflow-hidden rounded-[10px] bg-white">
              <KodeQR teks={link.url} label={`Kode QR ${lapak.nama}`} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold leading-[1.35]">Tunjukkan ke pelanggan</span>
            <span className="text-[13px] leading-[1.45] text-teks-redup">
              Pelanggan scan dari HP-mu, langsung masuk ke halaman lapak dan bisa mengikuti.
            </span>
          </div>
        </div>

        <div className="flex min-h-[52px] items-center justify-between gap-2.5 rounded-2xl bg-kartu pl-4 pr-1.5">
          <span translate="no" className="min-w-0 select-text truncate text-sm font-bold">
            {link.tampil}
          </span>
          <button type="button" onClick={salin} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-brand-tekan">
            Salin
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-teks-redup">Pesan yang ikut terkirim</span>
          <span className="text-[13px] leading-normal text-[#3D4A5F]">“{pesan}”</span>
        </div>

        <button
          type="button"
          onClick={bagikan}
          className="h-14 rounded-[28px] bg-brand text-base font-bold text-white active:bg-brand-tekan"
        >
          Bagikan ke WhatsApp &amp; lainnya
        </button>

        <div className="grid grid-cols-2 gap-2">
          {/* Halaman lapak /:slug (V2) dibangun di Sprint 4 */}
          <button
            type="button"
            disabled
            className="flex h-[46px] flex-col items-center justify-center rounded-[23px] bg-kartu text-sm font-semibold leading-tight text-tinta opacity-60"
          >
            Lihat halamanku
            <span className="text-[11px] text-teks-redup">Segera</span>
          </button>
          <Link
            to="/lapakku/qr"
            className="flex h-[46px] items-center justify-center rounded-[23px] bg-kartu text-sm font-semibold text-tinta"
          >
            QR untuk gerobak
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bagikan lapak"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-[390px] flex-col gap-3.5 rounded-t-[28px] bg-white px-5 pb-6 pt-3"
      >
        <div className="h-[5px] w-10 self-center rounded-full bg-[#D5DAE2]" />
        <span className="text-[22px] font-extrabold tracking-[-0.02em]">Bagikan lapakmu</span>
        {isi}
      </div>
    </div>
  )
}
