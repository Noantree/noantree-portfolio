import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChipStatus, type StatusTampil } from './ChipStatus'

export type LapakRingkas = {
  nama: string
  inisial: string
  warna: string
  fotoUrl?: string | null
  jual?: string | null
  info: string
  status: StatusTampil
}

// Kartu di daftar lapak (V1): foto atau inisial (A13), nama, chip status, jual apa, dan keterangan.
// Biasanya buka dan Tutup: latar putih bergaris, inisial sedikit pudar.
// Dengan href, kartu menjadi link ke detail lapak /:slug (V2).
// ringkas: kartu hasil cari (V5), inisial 48 px tanpa baris jual; Tutup bergaris lebih tipis dan lebih pudar.
export function KartuLapak({ lapak, href, ringkas }: { lapak: LapakRingkas; href?: string; ringkas?: boolean }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  const redup = lapak.status === 'tutup' || lapak.status === 'biasanya'
  const tutupRingkas = ringkas && lapak.status === 'tutup'
  const pakaiFoto = lapak.fotoUrl && !fotoGagal
  const kelas = `flex gap-3.5 rounded-[20px] p-3.5 text-tinta hover:text-tinta ${
    !redup ? 'bg-kartu' : tutupRingkas ? 'bg-white shadow-[inset_0_0_0_1.5px_#E3E7EE]' : 'bg-white shadow-[inset_0_0_0_1.5px_#D5DAE2]'
  }`
  const isi = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold text-white ${
          ringkas ? 'size-12 text-base' : 'size-[52px] text-[17px]'
        }`}
        style={{ background: lapak.warna, opacity: !redup ? 1 : tutupRingkas ? 0.7 : 0.85 }}
      >
        {pakaiFoto ? (
          <img src={lapak.fotoUrl!} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
        ) : (
          lapak.inisial
        )}
      </div>
      <div className="flex min-w-0 grow flex-col gap-[3px]">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-base font-bold">{lapak.nama}</span>
          <span className="shrink-0">
            <ChipStatus status={lapak.status} />
          </span>
        </div>
        {lapak.jual && !ringkas && <span className="truncate text-sm text-[#3D4A5F]">{lapak.jual}</span>}
        <span className="text-[13px] text-teks-redup">{lapak.info}</span>
      </div>
    </>
  )
  return href ? (
    <Link to={href} className={kelas}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  )
}
