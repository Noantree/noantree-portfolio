import { useCallback, useEffect, useState } from 'react'
import { muatSemuaLapak, useDaftarAdmin, type LapakSemua } from '../lib/admin'
import { warnaInisial } from '../lib/beranda'
import { inisialLapak } from '../lib/pengarah'
import { jamWIB, tanggalWIB } from '../lib/waktu'

const JEDA_CARI = 300

// Tab Semua lapak (V19, A46): lapak tayang dan disembunyikan, terbaru di atas, cari nama lapak.
// Sembunyikan hanya untuk lapak yang tayang; lapak disembunyikan mendapat chip.
export function AdminSemuaLapak({
  versi,
  sibukId,
  onSembunyikan,
}: {
  versi: number
  sibukId: string | null
  onSembunyikan: (l: LapakSemua) => void
}) {
  const [ketik, setKetik] = useState('')
  const [kata, setKata] = useState('')

  // Cari setelah berhenti mengetik sebentar, supaya tidak memanggil database di setiap huruf
  useEffect(() => {
    const jeda = window.setTimeout(() => setKata(ketik.trim()), JEDA_CARI)
    return () => window.clearTimeout(jeda)
  }, [ketik])

  const muatDaftar = useCallback(() => muatSemuaLapak(kata), [kata])
  const { keadaan, cobaLagi } = useDaftarAdmin(muatDaftar, versi)
  const daftar = keadaan.jenis === 'siap' ? keadaan.daftar : null

  return (
    <>
      <label className="flex h-12 items-center gap-2.5 rounded-full bg-kartu px-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Cari lapak</span>
        <input
          type="search"
          name="cari"
          autoComplete="off"
          value={ketik}
          onChange={(e) => setKetik(e.target.value)}
          placeholder="Cari nama lapak…"
          className="min-w-0 grow bg-transparent text-base outline-none"
        />
      </label>

      {daftar && daftar.length > 0 && (
        <span className="text-[13px] text-[#5B6472]">{daftar.length} lapak · terbaru di atas · tidak perlu dicek satu per satu</span>
      )}

      {keadaan.jenis === 'memuat' && (
        <>
          {[1, 2, 3].map((n) => (
            <div key={n} aria-hidden="true" className="flex items-center gap-3 rounded-[18px] bg-kartu px-3.5 py-3">
              <div className="size-10 rounded-full bg-[#E3E7EE]" />
              <div className="flex grow flex-col gap-2">
                <div className="h-3 w-3/5 rounded-md bg-[#E3E7EE]" />
                <div className="h-2.5 w-2/5 rounded-[5px] bg-[#E9ECF1]" />
              </div>
            </div>
          ))}
          <span role="status" className="text-[13px] text-teks-redup">
            Memuat lapak…
          </span>
        </>
      )}

      {keadaan.jenis === 'gagal' && (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Daftar lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}

      {daftar && daftar.length === 0 && (
        <div className="rounded-3xl bg-kartu px-5 py-6 text-sm leading-normal text-[#3D4A5F]">
          {kata ? `Tidak ada lapak bernama “${kata}”.` : 'Belum ada lapak yang tayang.'}
        </div>
      )}

      {daftar && daftar.length > 0 && (
        <div className="flex flex-col gap-2">
          {daftar.map((l) => (
            <BarisLapak key={l.lapak_id} lapak={l} nonaktif={sibukId !== null} onSembunyikan={() => onSembunyikan(l)} />
          ))}
        </div>
      )}
    </>
  )
}

function BarisLapak({ lapak: l, nonaktif, onSembunyikan }: { lapak: LapakSemua; nonaktif: boolean; onSembunyikan: () => void }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  const daftar = new Date(l.dibuat_pada)
  const info = [`Daftar ${tanggalWIB(daftar)} ${jamWIB(daftar)}`, l.kecamatan_nama].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-kartu px-3.5 py-3">
      <div
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-extrabold text-white"
        style={{ background: warnaInisial(l.lapak_id) }}
      >
        {l.foto_url && !fotoGagal ? (
          <img src={l.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
        ) : (
          inisialLapak(l.nama)
        )}
      </div>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold">{l.nama}</span>
        <span className="text-xs text-[#5B6472]">{info}</span>
      </div>
      {l.status_tayang === 'tayang' ? (
        // Tombol 34 px seperti V19, dengan area ketuk 44 px
        <button
          type="button"
          disabled={nonaktif}
          onClick={onSembunyikan}
          aria-label={`Sembunyikan ${l.nama}`}
          className="-my-1.5 flex h-11 shrink-0 items-center disabled:opacity-60"
        >
          <span className="flex h-[34px] items-center rounded-full bg-[#FDECEA] px-3 text-[13px] font-bold text-merah">Sembunyikan</span>
        </button>
      ) : (
        <span className="inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full bg-[#FDECEA] px-2.5 text-xs font-bold text-[#9B1C12]">
          Disembunyikan
        </span>
      )}
    </div>
  )
}
