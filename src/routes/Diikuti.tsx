import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ChipStatus } from '../components/ChipStatus'
import { HeaderPelanggan } from '../components/HeaderPelanggan'
import { BannerSinyalPutus, KerangkaMemuat } from '../components/KeadaanKhusus'
import { bacaTerakhir, simpanTerakhir } from '../lib/dataTerakhir'
import { KartuLapak } from '../components/KartuLapak'
import { usePesan } from '../components/Pesan'
import { useAkunSaya } from '../lib/akunSaya'
import { warnaInisial } from '../lib/beranda'
import { berhentiIkuti, ikuti, infoDiikuti, muatDiikuti, type IsiDiikuti, type LapakDiikuti } from '../lib/ikuti'
import { inisialLapak } from '../lib/pengarah'
import { useSesi } from '../lib/sesi'

// Muat ulang setiap 30 detik dan saat aplikasi kembali dibuka (A51)
const SEGARKAN = 30 * 1000
const GALAT = 'Belum bisa mengikuti. Periksa sinyal, lalu coba lagi.'

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'gagal' }
  | { jenis: 'siap'; isi: IsiDiikuti; dimuatPada: number; gagalSegarkan: boolean }

// Lapak yang diikuti (V7, A41, A43). Dua kelompok: Lagi buka dan Sedang tutup; Biasanya buka masuk Sedang tutup
// dengan chipnya sendiri. Tombol Berhenti hanya di baris Sedang tutup, mengikuti desain.
// Kalimat V7 "Segera: kabar saat lapak yang kamu ikuti mulai buka." tidak dipasang: notifikasi tidak masuk MVP (A43).
// Tamu diarahkan ke beranda.
export default function Diikuti() {
  const { sesi, memuat } = useSesi()
  const akun = useAkunSaya()
  const { tampilkan } = usePesan()
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  const nomorMuat = useRef(0)
  const uid = sesi?.user.id ?? null

  const muat = useCallback(async () => {
    if (!uid) return
    const ini = ++nomorMuat.current
    try {
      const isi = await muatDiikuti()
      if (ini !== nomorMuat.current) return
      setKeadaan({ jenis: 'siap', isi, dimuatPada: Date.now(), gagalSegarkan: false })
      // Daftar Diikuti milik akun ini; dihapus dari HP saat Keluar atau Hapus akun
      simpanTerakhir('diikuti', uid, isi, 1)
    } catch {
      if (ini !== nomorMuat.current) return
      // Belum ada data di layar (dibuka tanpa sinyal): data terakhir dari HP (V20)
      const lama = bacaTerakhir<IsiDiikuti>('diikuti', uid)
      setKeadaan((k) =>
        k.jenis === 'siap'
          ? { ...k, gagalSegarkan: true }
          : lama
            ? { jenis: 'siap', isi: lama.data, dimuatPada: lama.pada, gagalSegarkan: true }
            : { jenis: 'gagal' },
      )
    }
  }, [uid])

  useEffect(() => {
    muat()
    const jeda = window.setInterval(muat, SEGARKAN)
    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') muat()
    }
    document.addEventListener('visibilitychange', saatTerlihat)
    return () => {
      window.clearInterval(jeda)
      document.removeEventListener('visibilitychange', saatTerlihat)
    }
  }, [muat])

  // Baris langsung hilang saat Berhenti diketuk, dan kembali kalau fungsi gagal
  const ubahDaftar = (ubah: (isi: IsiDiikuti) => IsiDiikuti) =>
    setKeadaan((k) => (k.jenis === 'siap' ? { ...k, isi: ubah(k.isi) } : k))

  const berhenti = async (l: LapakDiikuti) => {
    ubahDaftar((isi) => ({ ...isi, sedangTutup: isi.sedangTutup.filter((x) => x.id !== l.id) }))
    try {
      await berhentiIkuti(l.id)
      tampilkan({
        teks: `Berhenti mengikuti ${l.nama}`,
        jenis: 'netral',
        batalkan: async () => {
          try {
            await ikuti(l.id)
          } catch {
            tampilkan({ teks: GALAT, jenis: 'merah' })
          }
          muat()
        },
      })
    } catch {
      tampilkan({ teks: GALAT, jenis: 'merah' })
      muat()
    }
  }

  if (!memuat && !sesi) return <Navigate to="/" replace />

  const isi = keadaan.jenis === 'siap' ? keadaan.isi : null
  const sekarang = keadaan.jenis === 'siap' ? keadaan.dimuatPada : 0
  const jumlah = isi ? isi.lagiBuka.length + isi.sedangTutup.length : undefined
  const cobaLagi = () => {
    if (keadaan.jenis === 'gagal') setKeadaan({ jenis: 'memuat' })
    muat()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-white pb-6">
      <HeaderPelanggan akun={akun} masuk={Boolean(sesi)} halaman="diikuti" jumlahDiikuti={jumlah} />
      <div className="flex flex-col gap-3 px-4">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Lapak yang kamu ikuti</h1>

        {keadaan.jenis === 'memuat' && <KerangkaMemuat />}

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

        {keadaan.jenis === 'siap' && keadaan.gagalSegarkan && <BannerSinyalPutus pada={keadaan.dimuatPada} onCobaLagi={cobaLagi} />}

        {isi && jumlah === 0 && (
          <div className="mt-1 flex flex-col items-start gap-2.5 rounded-3xl bg-kartu px-5 py-6">
            <h2 className="text-lg font-extrabold tracking-[-0.01em]">Belum ada lapak yang kamu ikuti</h2>
            <p className="text-sm leading-normal text-[#3D4A5F]">Ketuk Ikuti di halaman lapak supaya lapaknya muncul di sini.</p>
            <Link to="/" className="mt-1 flex h-11 items-center rounded-full bg-brand px-[18px] text-sm font-bold text-white hover:text-white">
              Lihat lapak yang lagi buka
            </Link>
          </div>
        )}

        {isi && isi.lagiBuka.length > 0 && (
          <>
            <h2 className="mt-1 text-base font-bold">Lagi buka</h2>
            {isi.lagiBuka.map((l) => (
              <KartuLapak
                key={l.id}
                ringkas
                href={`/${l.slug}`}
                lapak={{
                  nama: l.nama,
                  inisial: inisialLapak(l.nama),
                  warna: warnaInisial(l.id),
                  fotoUrl: l.foto_url,
                  info: infoDiikuti(l, isi.jadwal, sekarang),
                  status: l.status === 'habis' ? 'habis' : 'buka',
                }}
              />
            ))}
          </>
        )}

        {isi && isi.sedangTutup.length > 0 && (
          <>
            <h2 className="mt-1 text-base font-bold">Sedang tutup</h2>
            {isi.sedangTutup.map((l) => (
              <BarisTutup key={l.id} lapak={l} info={infoDiikuti(l, isi.jadwal, sekarang)} onBerhenti={() => berhenti(l)} />
            ))}
          </>
        )}
      </div>
    </main>
  )
}

// Baris Sedang tutup (V7): inisial pudar, nama dan keterangan sebagai link ke detail, tombol Berhenti
function BarisTutup({ lapak, info, onBerhenti }: { lapak: LapakDiikuti; info: string; onBerhenti: () => void }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] bg-white p-3.5 shadow-[inset_0_0_0_1.5px_#E3E7EE]">
      <div
        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-extrabold text-white opacity-70"
        style={{ background: warnaInisial(lapak.id) }}
      >
        {lapak.foto_url && !fotoGagal ? (
          <img src={lapak.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
        ) : (
          inisialLapak(lapak.nama)
        )}
      </div>
      <Link to={`/${lapak.slug}`} className="flex min-w-0 grow flex-col gap-[3px] text-tinta hover:text-tinta">
        <span className="truncate text-base font-bold">{lapak.nama}</span>
        {lapak.status === 'biasanya_buka' && (
          <span>
            <ChipStatus status="biasanya" />
          </span>
        )}
        <span className="text-[13px] text-teks-redup">{info}</span>
      </Link>
      <button
        type="button"
        onClick={onBerhenti}
        aria-label={`Berhenti ikuti ${lapak.nama}`}
        className="h-11 shrink-0 whitespace-nowrap rounded-full bg-kartu px-3.5 text-[13px] font-semibold text-tinta"
      >
        Berhenti
      </button>
    </div>
  )
}
