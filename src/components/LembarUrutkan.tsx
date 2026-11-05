import { useState } from 'react'
import { LembarBawah } from './LembarBawah'
import type { Urutan } from '../lib/beranda'

const PILIHAN: { nilai: Urutan; judul: string; ket: string }[] = [
  { nilai: 'terdekat', judul: 'Terdekat', ket: 'Perlu izin lokasi. Tanpa izin, otomatis Terpopuler. Lapak tanpa titik di bawah.' },
  { nilai: 'terpopuler', judul: 'Terpopuler', ket: 'Yang pengikutnya paling banyak di atas' },
  { nilai: 'abjad', judul: 'Abjad', ket: 'Nama lapak dari A sampai Z' },
]

// Lembar Urutkan (V39, A12). Pilihan baru berlaku setelah Terapkan.
export function LembarUrutkan({
  terbuka,
  awal,
  onTutup,
  onTerapkan,
}: {
  terbuka: boolean
  awal: Urutan
  onTutup: () => void
  onTerapkan: (u: Urutan) => void
}) {
  return (
    <LembarBawah terbuka={terbuka} onTutup={onTutup} label="Urutkan">
      {/* Dipasang ulang tiap dibuka supaya pilihan mulai dari urutan yang sedang berlaku */}
      {terbuka && <IsiUrutkan awal={awal} onTerapkan={onTerapkan} />}
    </LembarBawah>
  )
}

function IsiUrutkan({ awal, onTerapkan }: { awal: Urutan; onTerapkan: (u: Urutan) => void }) {
  const [pilih, setPilih] = useState(awal)
  return (
    <>
      <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">Urutkan</h2>
      {PILIHAN.map((p) => {
        const aktif = pilih === p.nilai
        return (
          <label
            key={p.nilai}
            className={`flex min-h-16 items-center gap-3.5 rounded-[18px] px-4 py-2.5 ${
              aktif ? 'bg-brand-muda shadow-[inset_0_0_0_2px_#1F5FE6]' : 'bg-kartu'
            }`}
          >
            <input
              type="radio"
              name="urut"
              checked={aktif}
              onChange={() => setPilih(p.nilai)}
              className="size-[22px] shrink-0 accent-brand"
            />
            <span className="flex grow flex-col gap-0.5">
              <span className="text-base font-bold">{p.judul}</span>
              <span className={`text-[13px] ${aktif ? 'text-[#3D4A5F]' : 'text-teks-redup'}`}>{p.ket}</span>
            </span>
          </label>
        )
      })}
      <button
        type="button"
        onClick={() => onTerapkan(pilih)}
        className="mt-1.5 flex h-14 items-center justify-center rounded-full bg-brand text-base font-bold text-white"
      >
        Terapkan
      </button>
      <span className="text-center text-xs text-teks-redup">
        Kelompok “Lagi buka” selalu di atas “Biasanya buka”, apa pun urutannya.
      </span>
    </>
  )
}
