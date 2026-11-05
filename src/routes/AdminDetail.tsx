import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GerbangAdmin } from '../components/GerbangAdmin'
import { usePesan } from '../components/Pesan'
import {
  alasanTerbanyak,
  muatDetailLaporan,
  pesanGalat,
  tindakLapak,
  type AksiAdmin,
  type LapakAdmin,
  type Laporan,
  type StatusLaporan,
} from '../lib/admin'
import { warnaInisial } from '../lib/beranda'
import { inisialLapak } from '../lib/pengarah'
import { jamWIB, tanggalWIB } from '../lib/waktu'

const MAKS_CATATAN_ADMIN = 300
const BAYANGAN = 'shadow-[0_1px_2px_rgba(18,22,31,0.10),0_0_0_0.5px_rgba(18,22,31,0.06)]'

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'gagal' }
  | { jenis: 'tidak-ada' }
  | { jenis: 'siap'; lapak: LapakAdmin; laporan: Laporan[] }

// Detail laporan satu lapak (V55; A44, A46, A47). Nama dan email pelapor hanya terlihat di sini, oleh admin.
// Aksi: Abaikan per laporan, Abaikan semua, Sembunyikan lapak, Tampilkan lagi; catatan admin ikut tindakan
// yang dijalankan. Setiap tindakan lewat admin_tindak_lapak, lalu data dimuat ulang.
export default function AdminDetail() {
  return (
    <GerbangAdmin>
      <HalamanDetail />
    </GerbangAdmin>
  )
}

function HalamanDetail() {
  const { id = '' } = useParams()
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [fotoGagal, setFotoGagal] = useState(false)
  const { tampilkan } = usePesan()
  const nomorMuat = useRef(0)

  const muat = useCallback(async () => {
    const ini = ++nomorMuat.current
    try {
      const isi = await muatDetailLaporan(id)
      if (ini !== nomorMuat.current) return
      setKeadaan(isi ? { jenis: 'siap', ...isi } : { jenis: 'tidak-ada' })
    } catch {
      if (ini === nomorMuat.current) setKeadaan((k) => (k.jenis === 'siap' ? k : { jenis: 'gagal' }))
    }
  }, [id])

  useEffect(() => {
    muat()
  }, [muat])

  const tindak = async (aksi: AksiAdmin, laporanId: string | null) => {
    if (sibuk || keadaan.jenis !== 'siap') return
    setSibuk(true)
    try {
      await tindakLapak(keadaan.lapak.id, aksi, laporanId, catatan.trim() || null)
      setCatatan('')
    } catch (e) {
      tampilkan({ teks: pesanGalat(e), jenis: 'merah' })
    }
    await muat()
    setSibuk(false)
  }

  const cobaLagi = () => {
    setKeadaan({ jenis: 'memuat' })
    muat()
  }

  const lapak = keadaan.jenis === 'siap' ? keadaan.lapak : null
  const laporan = keadaan.jenis === 'siap' ? keadaan.laporan : []
  const jumlahBaru = laporan.filter((l) => l.status === 'baru').length
  const tersembunyi = lapak?.status_tayang === 'disembunyikan'
  const adaBilah = Boolean(lapak && (tersembunyi || jumlahBaru > 0 || lapak.status_tayang === 'tayang'))

  return (
    <main className={`mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 bg-white px-4 text-[15px] leading-[1.45] ${adaBilah ? 'pb-[180px]' : 'pb-6'}`}>
      <header className="sticky top-0 z-[5] flex min-h-16 items-center gap-3 bg-white py-2">
        <Link
          to="/admin"
          aria-label="Kembali"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu ${BAYANGAN}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold text-[#5B6472]">Admin · Dilaporkan</span>
          <h1 className="text-lg font-extrabold tracking-[-0.02em]">Detail laporan</h1>
        </div>
      </header>

      {keadaan.jenis === 'memuat' && (
        <>
          <div aria-hidden="true" className="flex flex-col gap-3 rounded-[22px] bg-kartu p-4">
            <div className="flex items-center gap-3">
              <div className="size-[52px] rounded-full bg-[#E3E7EE]" />
              <div className="flex grow flex-col gap-2">
                <div className="h-3 w-3/5 rounded-md bg-[#E3E7EE]" />
                <div className="h-2.5 w-2/5 rounded-[5px] bg-[#E9ECF1]" />
              </div>
            </div>
          </div>
          <span role="status" className="text-[13px] text-teks-redup">
            Memuat laporan…
          </span>
        </>
      )}

      {keadaan.jenis === 'gagal' && (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Laporan belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}

      {keadaan.jenis === 'tidak-ada' && (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span className="text-sm leading-normal text-[#3D4A5F]">Lapak tidak ditemukan.</span>
          <Link to="/admin" className="flex h-11 items-center rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Kembali ke Dilaporkan
          </Link>
        </div>
      )}

      {lapak && (
        <>
          <section aria-label="Lapak yang dilaporkan" className="flex min-w-0 flex-col gap-3 rounded-[22px] bg-kartu p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden="true"
                className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[17px] font-extrabold text-white"
                style={{ background: warnaInisial(lapak.id) }}
              >
                {lapak.foto_url && !fotoGagal ? (
                  <img src={lapak.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
                ) : (
                  inisialLapak(lapak.nama)
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[17px] font-extrabold [overflow-wrap:anywhere]">{lapak.nama}</span>
                <span className="text-[13px] text-[#5B6472]">Daftar {tanggalWIB(new Date(lapak.dibuat_pada))}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {tersembunyi ? (
                <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[#FDECEA] px-2.5 text-xs font-bold text-[#9B1C12]">
                  Disembunyikan
                </span>
              ) : lapak.status_tayang === 'tayang' ? (
                <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-white px-2.5 text-xs font-bold text-[#0B5E3D] ${BAYANGAN}`}>
                  Tayang
                </span>
              ) : (
                <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[#EEF0F4] px-2.5 text-xs font-bold text-[#5B6472]">
                  Draf
                </span>
              )}
              <Link to={`/${lapak.slug}`} className="flex min-h-11 items-center text-sm font-semibold">
                Lihat halaman lapak
              </Link>
            </div>
          </section>

          <section aria-label="Ringkasan laporan" className="grid grid-cols-3 gap-2">
            <Angka nilai={String(jumlahBaru)} keterangan="Laporan baru" sorot />
            <Angka nilai={String(laporan.length)} keterangan="Total semua" />
            <Angka nilai={alasanTerbanyak(laporan) ?? '–'} keterangan="Alasan terbanyak" alasan />
          </section>

          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-extrabold tracking-[-0.02em]">Daftar laporan</h2>
            <p className="text-[13px] text-[#5B6472]">Terbaru di atas. Identitas pelapor hanya terlihat admin.</p>
          </div>

          {laporan.length === 0 && (
            <div className="rounded-[20px] bg-kartu p-3.5 text-sm text-[#3D4A5F]">Belum ada laporan.</div>
          )}
          {laporan.map((l) => (
            <KartuLaporan key={l.laporan_id} laporan={l} nonaktif={sibuk} onAbaikan={() => tindak('abaikan', l.laporan_id)} />
          ))}

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Catatan admin (opsional)
            <textarea
              name="catatan-admin"
              rows={3}
              maxLength={MAKS_CATATAN_ADMIN}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: sudah dicek lewat telepon, lapak memang buka sore hari."
              className="min-h-[72px] resize-none rounded-2xl bg-kartu px-3.5 py-3 text-[15px] font-normal text-tinta outline-none focus-visible:shadow-[inset_0_0_0_2px_#1F5FE6]"
            />
          </label>
          <p className="text-xs leading-normal text-[#5B6472]">
            Sembunyikan lapak: lapak hilang dari publik, data dan pengikut tetap, dan semua laporan aktif ditandai ditindak. Tampilkan
            lagi: laporan yang ditandai ditindak dikembalikan sebagai diabaikan. Satu akun hanya bisa melaporkan lapak yang sama satu
            kali per 30 hari.
          </p>

          {adaBilah && (
            <nav
              aria-label="Aksi lapak"
              className="fixed inset-x-0 bottom-0 bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_16px_rgba(18,22,31,0.08)]"
            >
              <div className="mx-auto flex max-w-[358px] gap-2">
                {tersembunyi ? (
                  <button
                    type="button"
                    disabled={sibuk}
                    onClick={() => tindak('tampilkan', null)}
                    className="h-[54px] flex-1 rounded-full bg-[#E4F5EC] px-3 text-[15px] font-bold text-[#0B5E3D] disabled:opacity-60"
                  >
                    Tampilkan lagi
                  </button>
                ) : (
                  <>
                    {jumlahBaru > 0 && (
                      <button
                        type="button"
                        disabled={sibuk}
                        onClick={() => tindak('abaikan', null)}
                        className={`h-[54px] min-w-0 flex-[1] whitespace-nowrap rounded-full bg-kartu px-3 text-[15px] font-bold text-tinta disabled:opacity-60 max-[389px]:flex-auto ${BAYANGAN}`}
                      >
                        Abaikan semua
                      </button>
                    )}
                    {lapak.status_tayang === 'tayang' && (
                      <button
                        type="button"
                        disabled={sibuk}
                        onClick={() => tindak('sembunyikan', null)}
                        className="h-[54px] min-w-0 flex-[1.4] whitespace-nowrap rounded-full bg-[#FDECEA] max-[389px]:flex-auto px-3 text-[15px] font-bold text-merah shadow-[0_1px_2px_rgba(180,35,24,0.18),0_0_0_0.5px_rgba(180,35,24,0.10)] disabled:opacity-60"
                      >
                        Sembunyikan lapak
                      </button>
                    )}
                  </>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </main>
  )
}

function Angka({ nilai, keterangan, sorot, alasan }: { nilai: string; keterangan: string; sorot?: boolean; alasan?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-[18px] bg-white px-2.5 py-3 ${BAYANGAN}`}>
      <span
        className={
          alasan
            ? 'text-sm font-bold leading-[1.25] [overflow-wrap:anywhere]'
            : `text-[22px] font-extrabold tracking-[-0.02em] tabular-nums ${sorot ? 'text-merah' : ''}`
        }
      >
        {nilai}
      </span>
      <span className="text-xs leading-[1.3] text-[#5B6472]">{keterangan}</span>
    </div>
  )
}

const CHIP: Record<StatusLaporan, { teks: string; kelas: string; keterangan: string }> = {
  baru: { teks: 'Baru', kelas: 'bg-[#FDECEA] text-[#9B1C12]', keterangan: 'Belum ditindak' },
  diabaikan: { teks: 'Diabaikan', kelas: 'bg-[#EEF0F4] text-[#5B6472]', keterangan: 'Diabaikan admin' },
  ditindak: { teks: 'Ditindak', kelas: 'bg-[#E4F5EC] text-[#0B5E3D]', keterangan: 'Ditindak admin' },
}

function KartuLaporan({ laporan: l, nonaktif, onAbaikan }: { laporan: Laporan; nonaktif: boolean; onAbaikan: () => void }) {
  const chip = CHIP[l.status]
  return (
    <article aria-label={`Laporan dari ${l.pelapor_nama}`} className="flex min-w-0 flex-col gap-2.5 rounded-[20px] bg-kartu p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-bold [overflow-wrap:anywhere]">{l.pelapor_nama}</span>
          {l.pelapor_email && <span className="text-xs text-[#5B6472] [overflow-wrap:anywhere]">{l.pelapor_email}</span>}
        </div>
        <span className={`inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${chip.kelas}`}>
          {chip.teks}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-white p-3">
        <span className="text-sm font-bold">{l.alasan}</span>
        {l.catatan ? (
          <span className="text-sm text-[#3D4A5F] [overflow-wrap:anywhere]">“{l.catatan}”</span>
        ) : (
          <span className="text-sm italic text-[#5B6472]">Tanpa catatan</span>
        )}
      </div>
      <div className="flex min-w-0 items-start justify-between gap-2">
        {l.pernyataan_pada ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B5E3D]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E7A4F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Menyatakan melihat sendiri
          </span>
        ) : (
          <span className="text-xs text-[#5B6472]">Tanpa pernyataan</span>
        )}
        <span className="whitespace-nowrap text-xs text-[#5B6472] tabular-nums">
          {tanggalWIB(new Date(l.dibuat_pada))} · {jamWIB(new Date(l.dibuat_pada))} WIB
        </span>
      </div>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span className="text-xs text-[#5B6472]">{chip.keterangan}</span>
        {l.status === 'baru' && (
          <button type="button" disabled={nonaktif} onClick={onAbaikan} aria-label={`Abaikan laporan dari ${l.pelapor_nama}`} className="flex h-11 items-center disabled:opacity-60">
            <span className={`flex h-9 items-center rounded-full bg-white px-3.5 text-[13px] font-semibold text-tinta ${BAYANGAN}`}>Abaikan</span>
          </button>
        )}
      </div>
    </article>
  )
}
