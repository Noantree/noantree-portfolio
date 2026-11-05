import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminDisembunyikan } from '../components/AdminDisembunyikan'
import { AdminSemuaLapak } from '../components/AdminSemuaLapak'
import { GerbangAdmin } from '../components/GerbangAdmin'
import { usePesan } from '../components/Pesan'
import {
  muatDilaporkan,
  muatDisembunyikan,
  pesanGalat,
  tindakLapak,
  useDaftarAdmin,
  type AksiAdmin,
  type LapakDilaporkan,
} from '../lib/admin'
import { warnaInisial } from '../lib/beranda'
import { inisialLapak } from '../lib/pengarah'
import { jamWIB, tanggalWIB } from '../lib/waktu'

type Tab = 'dilaporkan' | 'semua' | 'disembunyikan'

// Halaman admin (A45, A46, A47): tab Dilaporkan (V18), Semua lapak (V19), dan Disembunyikan (V35).
// Semua tindakan lewat admin_tindak_lapak; setelahnya semua daftar dimuat ulang, karena satu tindakan
// bisa mengubah isi tab lain (misalnya Sembunyikan memindahkan lapak ke Disembunyikan).
export default function Admin() {
  return (
    <GerbangAdmin>
      <HalamanAdmin />
    </GerbangAdmin>
  )
}

function HalamanAdmin() {
  const [cari, setCari] = useSearchParams()
  const tab: Tab = cari.get('tab') === 'semua' ? 'semua' : cari.get('tab') === 'disembunyikan' ? 'disembunyikan' : 'dilaporkan'
  const [versi, setVersi] = useState(0)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const { tampilkan } = usePesan()
  // Dilaporkan dan Disembunyikan selalu dimuat, karena jumlahnya tampil di tab; keduanya dimuat ulang langsung
  // di tindak(). versi hanya untuk tab Semua lapak, yang memuat daftarnya sendiri.
  const dilaporkan = useDaftarAdmin(muatDilaporkan, 0)
  const disembunyikan = useDaftarAdmin(muatDisembunyikan, 0)
  const { keadaan, cobaLagi } = dilaporkan

  // Setiap tindakan lewat admin_tindak_lapak, lalu semua daftar dimuat ulang. Galat dari server ditampilkan apa adanya.
  const tindak = async (lapakId: string, aksi: AksiAdmin) => {
    if (sibuk) return
    setSibuk(lapakId)
    try {
      await tindakLapak(lapakId, aksi, null, null)
    } catch (e) {
      tampilkan({ teks: pesanGalat(e), jenis: 'merah' })
    }
    await Promise.all([dilaporkan.muat(), disembunyikan.muat()])
    setVersi((v) => v + 1)
    setSibuk(null)
  }

  const daftar = keadaan.jenis === 'siap' ? keadaan.daftar : null
  const jumlahAktif = daftar?.filter((l) => l.laporan_aktif > 0).length
  const jumlahDisembunyikan = disembunyikan.keadaan.jenis === 'siap' ? disembunyikan.keadaan.daftar.length : undefined
  const pilihTab = (t: Tab) => setCari(t === 'dilaporkan' ? {} : { tab: t }, { replace: true })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3.5 bg-white px-4 pb-6">
      <div className="flex h-16 items-center gap-2.5">
        <img src="/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-[9px]" />
        <h1 className="text-xl font-extrabold tracking-[-0.03em]">Admin</h1>
      </div>

      {/* Pil sedikit lebih rapat dari V18 (12 px; di bawah 390 px 10 px dan huruf 12 px) supaya ketiga tab beserta angkanya muat tanpa scroll */}
      <div className="-my-[3px] flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Tab admin">
        <TombolTab aktif={tab === 'dilaporkan'} onClick={() => pilihTab('dilaporkan')}>
          {jumlahAktif === undefined ? 'Dilaporkan' : `Dilaporkan · ${jumlahAktif}`}
        </TombolTab>
        <TombolTab aktif={tab === 'semua'} onClick={() => pilihTab('semua')}>
          Semua lapak
        </TombolTab>
        <TombolTab aktif={tab === 'disembunyikan'} onClick={() => pilihTab('disembunyikan')}>
          {jumlahDisembunyikan === undefined ? 'Disembunyikan' : `Disembunyikan · ${jumlahDisembunyikan}`}
        </TombolTab>
      </div>

      {tab === 'semua' ? (
        <AdminSemuaLapak versi={versi} sibukId={sibuk} onSembunyikan={(l) => tindak(l.lapak_id, 'sembunyikan')} />
      ) : tab === 'disembunyikan' ? (
        <AdminDisembunyikan
          keadaan={disembunyikan.keadaan}
          cobaLagi={disembunyikan.cobaLagi}
          sibukId={sibuk}
          onTampilkan={(l) => tindak(l.lapak_id, 'tampilkan')}
        />
      ) : (
        <>
          <span className="text-[13px] text-[#5B6472]">Laporan dari pelanggan, terbanyak di atas.</span>

          {keadaan.jenis === 'memuat' && (
            <>
              {[1, 2].map((n) => (
                <div key={n} aria-hidden="true" className="flex flex-col gap-3 rounded-[22px] bg-kartu p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-[#E3E7EE]" />
                    <div className="flex grow flex-col gap-2">
                      <div className="h-3 w-3/5 rounded-md bg-[#E3E7EE]" />
                      <div className="h-2.5 w-2/5 rounded-[5px] bg-[#E9ECF1]" />
                    </div>
                  </div>
                  <div className="h-16 rounded-2xl bg-white" />
                </div>
              ))}
              <span role="status" className="text-[13px] text-teks-redup">
                Memuat laporan…
              </span>
            </>
          )}

          {keadaan.jenis === 'gagal' && (
            <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
              <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
                Daftar laporan belum bisa dimuat. Periksa sinyal, lalu coba lagi.
              </span>
              <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
                Coba lagi
              </button>
            </div>
          )}

          {daftar && daftar.length === 0 && (
            <div className="rounded-3xl bg-kartu px-5 py-6 text-sm leading-normal text-[#3D4A5F]">Belum ada laporan.</div>
          )}

          {daftar?.map((l) => (
            <KartuDilaporkan key={l.lapak_id} lapak={l} sibuk={sibuk === l.lapak_id} nonaktif={sibuk !== null} onTindak={(a) => tindak(l.lapak_id, a)} />
          ))}

          <span className="text-xs leading-normal text-[#5B6472]">Sembunyikan: hilang dari publik, data tetap, bisa ditampilkan lagi.</span>
        </>
      )}
    </main>
  )
}

// Pil tab V18 (38 px), dengan area ketuk 44 px
function TombolTab({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={aktif} onClick={onClick} className="flex h-11 shrink-0 items-center">
      <span
        className={`flex h-[38px] items-center whitespace-nowrap rounded-full px-3 text-[13px] max-[389px]:px-2.5 max-[389px]:text-xs font-semibold tabular-nums ${
          aktif ? 'bg-tinta text-white' : 'bg-kartu text-tinta'
        }`}
      >
        {children}
      </span>
    </button>
  )
}

// Kartu satu lapak di tab Dilaporkan (V18, A46): jumlah laporan aktif dan total, alasan terbanyak.
// Ketuk nama atau ringkasan untuk membuka detail laporan (V55).
function KartuDilaporkan({
  lapak: l,
  sibuk,
  nonaktif,
  onTindak,
}: {
  lapak: LapakDilaporkan
  sibuk: boolean
  nonaktif: boolean
  onTindak: (aksi: AksiAdmin) => void
}) {
  const [fotoGagal, setFotoGagal] = useState(false)
  const detail = `/admin/lapak/${l.lapak_id}`
  const waktu = l.laporan_baru_terakhir
    ? `Laporan terakhir ${tanggalWIB(new Date(l.laporan_baru_terakhir))} · ${jamWIB(new Date(l.laporan_baru_terakhir))} WIB`
    : 'Tidak ada laporan baru'
  const info = l.status_tayang === 'disembunyikan' ? `Disembunyikan · ${waktu}` : waktu
  const bolehAbaikan = l.laporan_aktif > 0
  const bolehSembunyikan = l.status_tayang === 'tayang'

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-kartu p-4">
      <Link to={detail} className="flex items-center gap-3 text-tinta hover:text-tinta">
        <div
          className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-extrabold text-white"
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
        <span
          className={`flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-extrabold tabular-nums ${
            bolehAbaikan ? 'bg-[#FDECEA] text-[#9B1C12]' : 'bg-[#EEF0F4] text-[#5B6472]'
          }`}
        >
          {l.laporan_aktif} baru
        </span>
      </Link>

      <Link to={detail} className="flex flex-col gap-0.5 rounded-2xl bg-white px-3.5 py-3 text-tinta hover:text-tinta">
        <span className="text-[13px] text-[#5B6472]">Alasan terbanyak</span>
        <span className="text-sm font-bold">{l.alasan_terbanyak ?? '–'}</span>
        <span className="text-[13px] text-[#5B6472] tabular-nums">
          {l.laporan_aktif} laporan baru · {l.laporan_total} total
        </span>
      </Link>

      <Link to={`/${l.slug}`} className="flex min-h-11 items-center self-start text-[13px] font-semibold">
        Lihat halaman lapak
      </Link>

      {(bolehAbaikan || bolehSembunyikan) && (
        <div className="flex gap-2">
          {bolehAbaikan && (
            <button
              type="button"
              disabled={nonaktif}
              onClick={() => onTindak('abaikan')}
              className="h-[46px] min-w-0 flex-1 rounded-full bg-white text-sm font-bold text-tinta shadow-[0_1px_2px_rgba(18,22,31,0.10),0_0_0_0.5px_rgba(18,22,31,0.06)] disabled:opacity-60"
            >
              Abaikan semua
            </button>
          )}
          {bolehSembunyikan && (
            <button
              type="button"
              disabled={nonaktif}
              onClick={() => onTindak('sembunyikan')}
              className="h-[46px] min-w-0 flex-1 rounded-full bg-[#FDECEA] text-sm font-bold text-merah shadow-[0_1px_2px_rgba(180,35,24,0.18),0_0_0_0.5px_rgba(180,35,24,0.10)] disabled:opacity-60"
            >
              Sembunyikan lapak
            </button>
          )}
        </div>
      )}
      {sibuk && (
        <span role="status" className="sr-only">
          Memproses…
        </span>
      )}
    </div>
  )
}
