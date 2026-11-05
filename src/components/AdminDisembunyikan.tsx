import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { KeadaanDaftar, LapakDisembunyikan } from '../lib/admin'
import { warnaInisial } from '../lib/beranda'
import { inisialLapak } from '../lib/pengarah'
import { jamWIB, tanggalWIB } from '../lib/waktu'

const BAYANGAN = 'shadow-[0_1px_2px_rgba(18,22,31,0.10),0_0_0_0.5px_rgba(18,22,31,0.06)]'

// Tab Disembunyikan (V35, A46, A47): waktu disembunyikan, alasan, catatan admin, Lihat laporan (V55), Tampilkan lagi.
// Daftarnya dimuat oleh halaman admin, karena jumlahnya juga dipakai di tab.
export function AdminDisembunyikan({
  keadaan,
  cobaLagi,
  sibukId,
  onTampilkan,
}: {
  keadaan: KeadaanDaftar<LapakDisembunyikan>
  cobaLagi: () => void
  sibukId: string | null
  onTampilkan: (l: LapakDisembunyikan) => void
}) {
  const daftar = keadaan.jenis === 'siap' ? keadaan.daftar : null

  return (
    <>
      <span className="text-[13px] text-[#5B6472]">Lapak yang tidak terlihat oleh pelanggan.</span>

      {keadaan.jenis === 'memuat' && (
        <>
          <div aria-hidden="true" className="flex flex-col gap-3 rounded-[22px] bg-kartu p-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-[#E3E7EE]" />
              <div className="flex grow flex-col gap-2">
                <div className="h-3 w-3/5 rounded-md bg-[#E3E7EE]" />
                <div className="h-2.5 w-2/5 rounded-[5px] bg-[#E9ECF1]" />
              </div>
            </div>
            <div className="h-14 rounded-2xl bg-white" />
          </div>
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
        <div className="rounded-3xl bg-kartu px-5 py-6 text-sm leading-normal text-[#3D4A5F]">Tidak ada lapak yang disembunyikan.</div>
      )}

      {daftar?.map((l) => (
        <KartuDisembunyikan key={l.lapak_id} lapak={l} nonaktif={sibukId !== null} onTampilkan={() => onTampilkan(l)} />
      ))}

      <span className="text-xs leading-normal text-[#5B6472]">
        Tampilkan lagi: lapak kembali terlihat, dan laporan yang ditandai ditindak kembali menjadi diabaikan.
      </span>
    </>
  )
}

function KartuDisembunyikan({ lapak: l, nonaktif, onTampilkan }: { lapak: LapakDisembunyikan; nonaktif: boolean; onTampilkan: () => void }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  const pada = l.disembunyikan_pada ? new Date(l.disembunyikan_pada) : null
  const info =
    (pada ? `Disembunyikan ${tanggalWIB(pada)} ${jamWIB(pada)}` : 'Disembunyikan') +
    (l.alasan_terbanyak ? ` · alasan: ${l.alasan_terbanyak}` : '')

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-kartu p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-extrabold text-white opacity-70"
          style={{ background: warnaInisial(l.lapak_id) }}
        >
          {l.foto_url && !fotoGagal ? (
            <img src={l.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
          ) : (
            inisialLapak(l.nama)
          )}
        </div>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-base font-bold [overflow-wrap:anywhere]">{l.nama}</span>
          <span className="text-xs text-[#5B6472]">{info}</span>
        </div>
      </div>

      {l.catatan_admin && (
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-3.5 py-3">
          <span className="text-[13px] font-bold">Catatan admin</span>
          <span className="text-[13px] leading-[1.45] text-[#5B6472] [overflow-wrap:anywhere]">{l.catatan_admin}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={`/admin/lapak/${l.lapak_id}`}
          className={`flex h-[46px] items-center justify-center rounded-full bg-white text-sm font-bold text-tinta hover:text-tinta ${BAYANGAN}`}
        >
          Lihat laporan
        </Link>
        <button
          type="button"
          disabled={nonaktif}
          onClick={onTampilkan}
          className="h-[46px] rounded-full bg-brand text-sm font-bold text-white disabled:opacity-60"
        >
          Tampilkan lagi
        </button>
      </div>
    </div>
  )
}
