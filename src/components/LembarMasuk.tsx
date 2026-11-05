import { Link } from 'react-router-dom'
import { LembarBawah } from './LembarBawah'
import { PilihanMasuk } from './PilihanMasuk'
import type { Tujuan } from '../lib/pengarah'

// Lembar Masuk (V6, A25, A26). Dari tombol Ikuti, lembar ini membawa tujuan aksi dan teks V6,
// supaya setelah masuk aksinya langsung dijalankan di halaman asal.
export function LembarMasuk({
  terbuka,
  onTutup,
  tujuan,
  keterangan,
}: {
  terbuka: boolean
  onTutup: () => void
  tujuan?: Tujuan
  keterangan?: string
}) {
  return (
    <LembarBawah terbuka={terbuka} onTutup={onTutup} judul="Masuk ke noantree">
      {keterangan && <p className="-mt-1 text-sm leading-normal text-[#3D4A5F]">{keterangan}</p>}
      <PilihanMasuk tujuan={tujuan} />
      <p className="text-center text-xs leading-normal text-teks-redup">
        Dengan masuk, kamu menyetujui{' '}
        <Link to="/akun/kebijakan?tab=sk" className="text-brand-tekan">
          Syarat &amp; Ketentuan
        </Link>{' '}
        dan{' '}
        <Link to="/akun/kebijakan" className="text-brand-tekan">
          Kebijakan Privasi
        </Link>
        . Yang kami simpan: nama, email, dan foto profil.
      </p>
      <div className="h-px bg-[#E3E7EE]" />
      <Link to="/daftar" className="flex min-h-11 items-center justify-between text-[15px]">
        <span className="text-teks-redup">Punya lapak?</span>
        <span className="font-bold text-brand-tekan">Daftarkan lapakmu ›</span>
      </Link>
    </LembarBawah>
  )
}
