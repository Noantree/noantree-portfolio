import { useState } from 'react'
import { Link } from 'react-router-dom'
import { warnaInisial } from '../lib/beranda'
import { inisialLapak } from '../lib/pengarah'
import type { AkunSaya } from '../lib/akunSaya'

// Header pelanggan (V1, V7, V48, A16): logo, lalu Masuk untuk tamu, atau [● Lapakku] [♡ N] [avatar] untuk akun.
// Lapakku hanya untuk pemilik; titik hijau hanya saat lapaknya Lagi buka (bukan Habis).
export function HeaderPelanggan({
  akun,
  masuk,
  onMasuk,
  halaman,
  jumlahDiikuti,
}: {
  akun: AkunSaya | null
  masuk: boolean // sesi ada (akun bisa belum selesai dimuat)
  onMasuk?: () => void
  halaman?: 'diikuti'
  jumlahDiikuti?: number // dari isi V7 supaya angka sama dengan daftar
}) {
  const jumlah = jumlahDiikuti ?? akun?.jumlahDiikuti
  // Di beranda nama aplikasi adalah judul halaman; di V7 judulnya "Lapak yang kamu ikuti"
  const Merek = halaman ? 'span' : 'h1'
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <Merek className="flex min-h-11 shrink-0 items-center">
        <img src="/logo-horizontal-biru.png" alt="Noantree" height={32} className="h-8 w-auto" />
      </Merek>
      {!masuk && onMasuk && (
        <button
          type="button"
          onClick={onMasuk}
          className="flex h-11 items-center rounded-full bg-kartu px-[18px] text-sm font-semibold text-tinta"
        >
          Masuk
        </button>
      )}
      {masuk && akun && (
        <div className="flex items-center gap-2">
          {akun.lapak && (
            // Lapakku jadi ikon saja (44 px) supaya header tidak sempit. Titik hijau = lapak lagi buka.
            <Link
              to="/lapakku"
              aria-label={akun.lapak.status === 'buka' ? 'Lapakku, lagi buka' : 'Lapakku'}
              className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-muda text-brand-tekan hover:text-brand-tekan"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10v10h16V10" />
                <path d="M2 10l2-6h16l2 6" />
                <path d="M9 20v-5h6v5" />
              </svg>
              {akun.lapak.status === 'buka' && (
                <span aria-hidden="true" className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-white bg-buka" />
              )}
            </Link>
          )}
          <Link
            to="/diikuti"
            aria-label={`Lapak yang diikuti${jumlah != null ? `, ${jumlah}` : ''}`}
            aria-current={halaman === 'diikuti' ? 'page' : undefined}
            className="flex h-11 items-center gap-1.5 rounded-full bg-brand-muda px-3.5 text-sm font-bold text-brand-tekan hover:text-brand-tekan"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A4FC2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
            {jumlah ?? ''}
          </Link>
          <Avatar akun={akun} />
        </div>
      )}
    </div>
  )
}

function Avatar({ akun }: { akun: AkunSaya }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  return (
    <Link
      to="/akun"
      aria-label="Akun saya"
      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-extrabold text-white hover:text-white"
      style={{ background: warnaInisial(akun.id) }}
    >
      {akun.fotoUrl && !fotoGagal ? (
        <img src={akun.fotoUrl} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
      ) : (
        inisialLapak(akun.nama ?? '')
      )}
    </Link>
  )
}
