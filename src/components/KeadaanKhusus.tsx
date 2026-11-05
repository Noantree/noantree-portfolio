import { useState } from 'react'
import { jamWIB, samaHariWIB, tanggalWIB } from '../lib/waktu'

// Keadaan khusus V20 yang dipakai bersama beberapa layar.

// Memuat: kerangka diam (tanpa denyut). Baru tampil setelah 200 ms, jadi muatan yang cepat tidak berkedip.
// daftar = kartu lapak (beranda, cari, Diikuti); lapak = foto, nama, dan kotak status (detail lapak, Lapakku).
export function KerangkaMemuat({
  varian = 'daftar',
  teks = 'Memuat lapak…',
  className = '',
}: {
  varian?: 'daftar' | 'lapak'
  teks?: string
  className?: string
}) {
  return (
    <div className={`flex animate-[muncul_150ms_ease-out_200ms_both] flex-col gap-2.5 ${className}`}>
      {varian === 'daftar' ? (
        [1, 2].map((n) => (
          <div key={n} aria-hidden="true" className="flex gap-3.5 rounded-[20px] bg-kartu p-3.5">
            <div className="size-[52px] shrink-0 rounded-full bg-[#E3E7EE]" />
            <div className="flex grow flex-col justify-center gap-2">
              <div className="h-3 w-3/5 rounded-md bg-[#E3E7EE]" />
              <div className="h-2.5 w-[85%] rounded-[5px] bg-[#E9ECF1]" />
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-5" aria-hidden="true">
          <div className="flex items-center gap-4">
            <div className="size-[76px] shrink-0 rounded-full bg-[#E3E7EE]" />
            <div className="flex grow flex-col gap-2">
              <div className="h-4 w-3/5 rounded-md bg-[#E3E7EE]" />
              <div className="h-3 w-2/5 rounded-md bg-[#E9ECF1]" />
            </div>
          </div>
          <div className="h-40 rounded-3xl bg-kartu" />
        </div>
      )}
      <span role="status" className="text-[13px] text-teks-redup">
        {teks}
      </span>
    </div>
  )
}

// Sinyal putus (V20, A8): data terakhir tetap tampil dengan jam dimuatnya. Data dari hari lain diberi tanggal.
export function BannerSinyalPutus({ pada, onCobaLagi, className = '' }: { pada: number; onCobaLagi: () => void; className?: string }) {
  const [sekarang] = useState(() => Date.now())
  const waktu = samaHariWIB(pada, sekarang) ? jamWIB(pada) : `${tanggalWIB(pada)} ${jamWIB(pada)}`
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-2.5 rounded-[18px] bg-[#EEF0F4] px-4 py-3.5 shadow-[inset_0_0_0_1.5px_#D5DAE2] ${className}`}
    >
      <span className="text-sm leading-[1.4]">Tidak ada sinyal. Menampilkan data terakhir ({waktu}).</span>
      <button type="button" onClick={onCobaLagi} className="h-11 shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 text-[13px] font-bold">
        Coba lagi
      </button>
    </div>
  )
}

// Mulai buka belum terkirim (V20, A8). Dikirim otomatis begitu sinyal kembali; Coba kirim lagi untuk mengirim sekarang.
export function BannerBelumTerkirim({ mengirim, onKirim }: { mengirim: boolean; onKirim: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2.5 rounded-[18px] bg-[#FDEEDF] px-4 py-3.5 text-sm leading-[1.45] text-[#6B3A0C]">
      <span>
        <b>Belum terkirim.</b> Status “Mulai buka” akan dikirim otomatis begitu sinyal kembali.
      </span>
      <button
        type="button"
        onClick={onKirim}
        disabled={mengirim}
        className="h-11 rounded-full bg-white px-4 text-[13px] font-bold text-[#6B3A0C] disabled:opacity-60"
      >
        {mengirim ? 'Mengirim…' : 'Coba kirim lagi'}
      </button>
    </div>
  )
}
