import { useEffect, useState } from 'react'
import { LembarBawah } from './LembarBawah'
import {
  daftarKabupaten,
  daftarKecamatan,
  daftarProvinsi,
  jumlahLapakTampil,
  kecamatanLagiBuka,
  WILAYAH_BAWAAN,
  type Daerah,
  type PilihanWilayah,
} from '../lib/wilayah'

// Kecamatan yang tampil sebelum "+ N lainnya" (selain "Semua")
const KECAMATAN_AWAL = 8

type Muat<T> = { keadaan: 'memuat' } | { keadaan: 'gagal' } | { keadaan: 'siap'; data: T }

// Memuat ulang setiap kunci atau putaran berubah; hasil permintaan lama diabaikan
function useMuat<T>(muat: (() => Promise<T>) | null, kunci: string, putaran: number): Muat<T> | null {
  const [hasil, setHasil] = useState<Muat<T> | null>(null)
  useEffect(() => {
    if (!muat) {
      setHasil(null)
      return
    }
    let batal = false
    setHasil({ keadaan: 'memuat' })
    muat().then(
      (data) => !batal && setHasil({ keadaan: 'siap', data }),
      () => !batal && setHasil({ keadaan: 'gagal' }),
    )
    return () => {
      batal = true
    }
    // muat dibuat ulang tiap render; kunci yang menentukan kapan memuat ulang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, putaran])
  return hasil
}

// Lembar Wilayah (V21, A17–A20). Pilihan baru berlaku setelah "Tampilkan N lapak".
export function LembarWilayah({
  terbuka,
  awal,
  onTutup,
  onTerapkan,
}: {
  terbuka: boolean
  awal: PilihanWilayah
  onTutup: () => void
  onTerapkan: (w: PilihanWilayah) => void
}) {
  return (
    <LembarBawah terbuka={terbuka} onTutup={onTutup} label="Pilih wilayah">
      {terbuka && <IsiWilayah awal={awal} onTerapkan={onTerapkan} />}
    </LembarBawah>
  )
}

const kelasPilih =
  'h-[52px] w-full rounded-2xl bg-kartu px-3.5 text-base font-semibold text-tinta disabled:opacity-100'

function IsiWilayah({ awal, onTerapkan }: { awal: PilihanWilayah; onTerapkan: (w: PilihanWilayah) => void }) {
  const [w, setW] = useState(awal)
  const [putaran, setPutaran] = useState(0)
  const [luas, setLuas] = useState(false)

  const provinsi = useMuat(daftarProvinsi, 'provinsi', putaran)
  const kabupaten = useMuat(() => daftarKabupaten(w.provinsiKode), w.provinsiKode, putaran)
  const kab = w.kabupatenKode
  const kecamatan = useMuat(kab ? () => daftarKecamatan(kab) : null, kab ?? '', putaran)
  const lagiBuka = useMuat(kab ? () => kecamatanLagiBuka(kab) : null, kab ?? '', putaran)
  const jumlah = useMuat(() => jumlahLapakTampil(w), `${w.provinsiKode}|${kab}|${w.kecamatanKode}`, putaran)

  const gagal = [provinsi, kabupaten, kecamatan].some((m) => m?.keadaan === 'gagal')

  // Selama daftar dimuat, pilihan yang sedang berlaku tetap terlihat di kotak pilihan
  const opsiProvinsi: Daerah[] =
    provinsi?.keadaan === 'siap' ? provinsi.data : [{ kode: w.provinsiKode, nama: w.provinsiNama }]
  const opsiKabupaten: Daerah[] =
    kabupaten?.keadaan === 'siap'
      ? kabupaten.data
      : kab && w.kabupatenNama
        ? [{ kode: kab, nama: w.kabupatenNama }]
        : []

  // "Semua" di depan, lalu kecamatan yang ada lapak Lagi buka (A–Z), lalu sisanya (A–Z)
  const titik = lagiBuka?.keadaan === 'siap' ? lagiBuka.data : new Set<string>()
  const daftarKec = kecamatan?.keadaan === 'siap' ? kecamatan.data : []
  const urutKec = [...daftarKec.filter((d) => titik.has(d.kode)), ...daftarKec.filter((d) => !titik.has(d.kode))]
  const posisiPilihan = urutKec.findIndex((d) => d.kode === w.kecamatanKode)
  const semuaKec = luas || posisiPilihan >= KECAMATAN_AWAL || urutKec.length <= KECAMATAN_AWAL + 1
  const kecTampil = semuaKec ? urutKec : urutKec.slice(0, KECAMATAN_AWAL)

  const pilihProvinsi = (kode: string) => {
    const d = opsiProvinsi.find((p) => p.kode === kode)
    if (!d) return
    setW({ provinsiKode: d.kode, provinsiNama: d.nama, kabupatenKode: null, kabupatenNama: null, kecamatanKode: null, kecamatanNama: null })
    setLuas(false)
  }
  const pilihKabupaten = (kode: string) => {
    const d = opsiKabupaten.find((k) => k.kode === kode)
    setW({ ...w, kabupatenKode: d?.kode ?? null, kabupatenNama: d?.nama ?? null, kecamatanKode: null, kecamatanNama: null })
    setLuas(false)
  }
  const pilihKecamatan = (d: Daerah | null) => setW({ ...w, kecamatanKode: d?.kode ?? null, kecamatanNama: d?.nama ?? null })

  const chip = (aktif: boolean) =>
    `flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${aktif ? 'bg-tinta text-white' : 'bg-kartu text-tinta'}`

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Wilayah</h2>
        <button
          type="button"
          onClick={() => {
            setW(WILAYAH_BAWAAN)
            setLuas(false)
          }}
          className="flex h-11 items-center"
        >
          <span className="flex h-9 items-center rounded-full bg-kartu px-3.5 text-[13px] font-semibold text-tinta">Atur ulang</span>
        </button>
      </div>
      <p className="-mt-1.5 text-sm leading-[1.45] text-[#3D4A5F]">
        Pilih seluas atau sespesifik yang kamu mau. Biarkan “Semua” untuk melihat lebih banyak lapak.
      </p>

      {gagal && (
        <div className="flex items-center justify-between gap-2.5 rounded-[18px] bg-kartu px-4 py-3">
          <span role="alert" className="text-sm leading-[1.4] text-[#3D4A5F]">
            Daftar wilayah belum bisa dimuat.
          </span>
          <button
            type="button"
            onClick={() => setPutaran((p) => p + 1)}
            className="h-11 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-bold text-brand-tekan"
          >
            Coba lagi
          </button>
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-teks-redup">
        Provinsi
        <select
          name="provinsi"
          value={w.provinsiKode}
          disabled={provinsi?.keadaan !== 'siap'}
          onChange={(e) => pilihProvinsi(e.target.value)}
          className={kelasPilih}
        >
          {opsiProvinsi.map((d) => (
            <option key={d.kode} value={d.kode}>
              {d.nama}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-teks-redup">
        Kabupaten/Kota
        <select
          name="kabupaten"
          value={kab ?? ''}
          disabled={kabupaten?.keadaan !== 'siap'}
          onChange={(e) => pilihKabupaten(e.target.value)}
          className={kelasPilih}
        >
          <option value="">Semua kabupaten/kota</option>
          {opsiKabupaten.map((d) => (
            <option key={d.kode} value={d.kode}>
              {d.nama}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-teks-redup">Kecamatan</span>
        {kab && kecamatan?.keadaan === 'memuat' && <span className="text-sm text-teks-redup">Memuat kecamatan…</span>}
        {kab && kecamatan?.keadaan === 'siap' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!w.kecamatanKode} onClick={() => pilihKecamatan(null)} className={chip(!w.kecamatanKode)}>
              Semua
            </button>
            {kecTampil.map((d) => (
              <button
                key={d.kode}
                type="button"
                aria-pressed={w.kecamatanKode === d.kode}
                onClick={() => pilihKecamatan(d)}
                className={chip(w.kecamatanKode === d.kode)}
              >
                {d.nama}
                {titik.has(d.kode) && <span aria-label="ada yang lagi buka" className="size-2 rounded-full bg-buka" />}
              </button>
            ))}
            {!semuaKec && (
              <button type="button" onClick={() => setLuas(true)} className={chip(false)}>
                + {urutKec.length - KECAMATAN_AWAL} lainnya
              </button>
            )}
          </div>
        )}
        <span className="text-xs leading-[1.45] text-teks-redup">
          Titik hijau = ada lapak yang lagi buka. Kecamatan muncul setelah kabupaten dipilih.
        </span>
      </div>

      <button
        type="button"
        onClick={() => onTerapkan(w)}
        className="mt-1 flex h-14 items-center justify-center rounded-full bg-brand text-base font-bold text-white"
      >
        {jumlah?.keadaan === 'siap' ? `Tampilkan ${jumlah.data} lapak` : 'Tampilkan lapak'}
      </button>
    </div>
  )
}
