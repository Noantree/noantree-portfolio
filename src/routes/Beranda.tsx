import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BannerSinyalPutus, KerangkaMemuat } from '../components/KeadaanKhusus'
import { bacaTerakhir, simpanTerakhir } from '../lib/dataTerakhir'
import { Link } from 'react-router-dom'
import { BannerDaftar } from '../components/BannerDaftar'
import { HeaderPelanggan } from '../components/HeaderPelanggan'
import { KartuIzinLokasi } from '../components/KartuIzinLokasi'
import { KartuLapak } from '../components/KartuLapak'
import { KosongWilayah } from '../components/KosongWilayah'
import { LembarMasuk } from '../components/LembarMasuk'
import { LembarUrutkan } from '../components/LembarUrutkan'
import { LembarWilayah } from '../components/LembarWilayah'
import { baca, inisialLapak, tulis } from '../lib/pengarah'
import { mintaLokasi, statusIzinLokasi, type Titik } from '../lib/lokasi'
import { bacaWilayah, labelWilayah, simpanWilayah, type PilihanWilayah } from '../lib/wilayah'
import { useSesi } from '../lib/sesi'
import { useAkunSaya } from '../lib/akunSaya'
import {
  infoKartu,
  LABEL_URUTAN,
  muatBeranda,
  muatRingkasWilayah,
  statusTampil,
  urutkanKelompok,
  warnaInisial,
  type KelompokBeranda,
  type LapakBeranda,
  type RingkasWilayah,
  type Urutan,
} from '../lib/beranda'

// Muat ulang setiap 30 detik dan saat aplikasi kembali dibuka (A51). Tarik ke bawah menyusul di S6.1.
const SEGARKAN = 30 * 1000

// Pilihan di kartu izin lokasi (A14). Yang disimpan hanya pilihannya, bukan lokasi (A21).
const KUNCI_IZIN = 'noantree.izinLokasi'
type PilihanIzin = 'izinkan' | 'wilayah'

const kunciWilayah = (w: PilihanWilayah) => `${w.provinsiKode}|${w.kabupatenKode}|${w.kecamatanKode}`

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'gagal' }
  | { jenis: 'siap'; data: KelompokBeranda; ringkas: RingkasWilayah | null; dimuatPada: number; gagalSegarkan: boolean }

// lapakku: kartu lapak milik akun sendiri diberi awalan "Lapakmu · " (V48, A16)
function Kartu({ lapak, lapakku }: { lapak: LapakBeranda; lapakku: boolean }) {
  return (
    <KartuLapak
      lapak={{
        nama: lapak.nama,
        inisial: inisialLapak(lapak.nama),
        warna: warnaInisial(lapak.id),
        fotoUrl: lapak.foto_url,
        jual: lapak.deskripsi,
        info: lapakku ? `Lapakmu · ${infoKartu(lapak)}` : infoKartu(lapak),
        status: statusTampil(lapak),
      }}
      href={`/${lapak.slug}`}
    />
  )
}

// Beranda pelanggan (V1, V34, V45, A10–A15, A17–A21), kotak cari ke /cari (A22), dan wilayah kosong V20/V53 (A24).
export default function Beranda() {
  const { sesi, memuat } = useSesi()
  const akun = useAkunSaya()
  const [lembarMasuk, setLembarMasuk] = useState(false)
  const [lembarUrutkan, setLembarUrutkan] = useState(false)
  const [lembarWilayah, setLembarWilayah] = useState(false)
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  // Pilihan wilayah terakhir diingat di HP; bawaan Sragen (A18)
  const [wilayah, setWilayah] = useState(bacaWilayah)
  const [urutan, setUrutan] = useState<Urutan>('terdekat')
  // Lokasi pelanggan hanya di state layar ini: tidak dikirim, tidak disimpan (A21)
  const [lokasi, setLokasi] = useState<Titik | null>(null)
  const [memintaLokasi, setMemintaLokasi] = useState(false)
  const [izinDicek, setIzinDicek] = useState(false)
  const [pilihanIzin, setPilihanIzin] = useState(() => baca<PilihanIzin>(KUNCI_IZIN))
  const nomorMuat = useRef(0)

  const ambilLokasi = useCallback(() => {
    setMemintaLokasi(true)
    mintaLokasi()
      .then(setLokasi, () => setLokasi(null))
      .finally(() => setMemintaLokasi(false))
  }, [])

  // Lokasi diambil tanpa bertanya hanya jika izin sudah diberi, atau pelanggan pernah menekan
  // Izinkan lokasi dan izinnya belum ditolak
  useEffect(() => {
    let batal = false
    statusIzinLokasi().then((izin) => {
      if (batal) return
      if (izin === 'granted' || (baca<PilihanIzin>(KUNCI_IZIN) === 'izinkan' && izin !== 'denied')) ambilLokasi()
      setIzinDicek(true)
    })
    return () => {
      batal = true
    }
  }, [ambilLokasi])

  const pilihIzin = (p: PilihanIzin) => {
    setPilihanIzin(p)
    tulis(KUNCI_IZIN, p)
  }

  // Terdekat tanpa lokasi berlaku sebagai Terpopuler, dan chip ikut menulis Terpopuler (A12)
  const urutanBerlaku: Urutan = urutan === 'terdekat' && !lokasi ? 'terpopuler' : urutan
  const tampilKartuIzin = izinDicek && !pilihanIzin && !lokasi && !memintaLokasi
  const tampilTanpaLokasi = izinDicek && !tampilKartuIzin && urutan === 'terdekat' && !lokasi && !memintaLokasi
  const namaWilayah = labelWilayah(wilayah)

  const pakaiLokasi = () => {
    pilihIzin('izinkan')
    setUrutan('terdekat')
    ambilLokasi()
  }

  const terapkanUrutan = (u: Urutan) => {
    setLembarUrutkan(false)
    if (u === 'terdekat' && !lokasi) pakaiLokasi()
    else setUrutan(u)
  }

  // Memilih wilayah di lembar juga menutup kartu izin lokasi (A14)
  const terapkanWilayah = (w: PilihanWilayah) => {
    setLembarWilayah(false)
    if (!pilihanIzin) pilihIzin('wilayah')
    simpanWilayah(w)
    if (kunciWilayah(w) !== kunciWilayah(wilayah)) {
      setKeadaan({ jenis: 'memuat' })
      setWilayah(w)
    }
  }

  // Gagal saat sudah ada data: data terakhir tetap tampil dengan keterangan (V20).
  // Gagal sebelum ada data (aplikasi dibuka tanpa sinyal): data terakhir yang tersimpan di HP dipakai (A8).
  // Hasil permintaan lama (misalnya wilayah sebelumnya) diabaikan.
  const muat = useCallback(async () => {
    const ini = ++nomorMuat.current
    const kunci = kunciWilayah(wilayah)
    try {
      const data = await muatBeranda(wilayah)
      // Tidak ada yang buka: cek apakah wilayah ini punya lapak sama sekali (V20 atau V53, A24)
      const ringkas =
        data.lagiBuka.length === 0 && data.biasanyaBuka.length === 0 ? await muatRingkasWilayah(wilayah) : null
      if (ini !== nomorMuat.current) return
      setKeadaan({ jenis: 'siap', data, ringkas, dimuatPada: Date.now(), gagalSegarkan: false })
      simpanTerakhir('beranda', kunci, { data, ringkas })
    } catch {
      if (ini !== nomorMuat.current) return
      const lama = bacaTerakhir<{ data: KelompokBeranda; ringkas: RingkasWilayah | null }>('beranda', kunci)
      setKeadaan((k) =>
        k.jenis === 'siap'
          ? { ...k, gagalSegarkan: true }
          : lama
            ? { jenis: 'siap', data: lama.data.data, ringkas: lama.data.ringkas, dimuatPada: lama.pada, gagalSegarkan: true }
            : { jenis: 'gagal' },
      )
    }
  }, [wilayah])

  // Urutan dihitung ulang di HP saat urutan atau lokasi berubah, tanpa memuat ulang data
  const kelompok = useMemo(
    () => (keadaan.jenis === 'siap' ? urutkanKelompok(keadaan.data, urutanBerlaku, lokasi) : null),
    [keadaan, urutanBerlaku, lokasi],
  )

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

  const cobaLagi = () => {
    if (keadaan.jenis === 'gagal') setKeadaan({ jenis: 'memuat' })
    muat()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-white pb-2">
      {/* Header V1 (tamu) dan V48 (akun, dengan Lapakku untuk pemilik, A16) */}
      {memuat ? (
        <HeaderPelanggan akun={null} masuk />
      ) : (
        <HeaderPelanggan akun={akun} masuk={Boolean(sesi)} onMasuk={() => setLembarMasuk(true)} />
      )}

      {!memuat && sesi && (
        <div className="px-4 pb-2.5 pt-1 empty:hidden">
          <BannerDaftar uid={sesi.user.id} />
        </div>
      )}

      <div className="flex flex-col gap-3.5 px-4 pt-1">
        {tampilKartuIzin && <KartuIzinLokasi onIzinkan={pakaiLokasi} onPilihWilayah={() => setLembarWilayah(true)} />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLembarUrutkan(true)}
            className="flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-tinta px-4 text-[13px] font-semibold text-white"
          >
            {LABEL_URUTAN[urutanBerlaku]} ▾
          </button>
          <button
            type="button"
            onClick={() => setLembarWilayah(true)}
            className="flex h-11 min-w-0 items-center whitespace-nowrap rounded-full bg-kartu px-4 text-[13px] font-semibold text-tinta"
          >
            <span className="truncate">{namaWilayah}</span>&nbsp;▾
          </button>
        </div>
        {/* Tanpa lokasi: izin ditolak, atau memilih wilayah tanpa memberi izin (V34, A12) */}
        {tampilTanpaLokasi && (
          <div className="flex items-center justify-between gap-2.5 text-[13px] text-teks-redup">
            <span>Tanpa lokasi, diurutkan dari yang terpopuler. Persempit wilayah biar lebih dekat.</span>
            <button type="button" onClick={pakaiLokasi} className="min-h-11 shrink-0 whitespace-nowrap font-bold text-brand-tekan">
              Pakai lokasi
            </button>
          </div>
        )}
        {/* Kotak cari (V1, V34): membuka halaman cari V5 */}
        <Link
          to="/cari"
          className="flex h-12 items-center gap-2.5 rounded-full bg-kartu px-4 text-[15px] text-teks-redup hover:text-teks-redup"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Cari bakso, es dawet, cukur…
        </Link>
      </div>

      {keadaan.jenis === 'memuat' && <KerangkaMemuat className="px-4 pt-4" />}

      {keadaan.jenis === 'gagal' && (
        <div className="mx-4 mt-4 flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Daftar lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}

      {keadaan.jenis === 'siap' && kelompok && (
        <>
          {keadaan.gagalSegarkan && <BannerSinyalPutus pada={keadaan.dimuatPada} onCobaLagi={cobaLagi} className="mx-4 mt-1" />}

          {kelompok.lagiBuka.length > 0 && (
            <>
              <div className="mt-[18px] flex items-baseline justify-between px-4">
                <h2 className="text-xl font-bold tracking-[-0.01em]">Lagi buka di {namaWilayah}</h2>
                <span className="text-[13px] text-teks-redup">{kelompok.lagiBuka.length} lapak</span>
              </div>
              <div className="flex flex-col gap-2.5 px-4 pt-3">
                {kelompok.lagiBuka.map((l) => (
                  <Kartu key={l.id} lapak={l} lapakku={l.id === akun?.lapak?.id} />
                ))}
              </div>
            </>
          )}

          {kelompok.biasanyaBuka.length > 0 && (
            <div className="flex flex-col gap-2.5 px-4 pt-4">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-bold">Biasanya buka jam segini</h2>
                  <span className="text-[13px] text-teks-redup">{kelompok.biasanyaBuka.length} lapak</span>
                </div>
                <span className="text-[13px] text-teks-redup">Belum dikonfirmasi pemilik lapak</span>
              </div>
              {kelompok.biasanyaBuka.map((l) => (
                <Kartu key={l.id} lapak={l} lapakku={l.id === akun?.lapak?.id} />
              ))}
            </div>
          )}

          {keadaan.ringkas && (
            <KosongWilayah wilayah={wilayah} ringkas={keadaan.ringkas} sekarang={keadaan.dimuatPada} onPilih={terapkanWilayah} />
          )}

          {/* Ujung daftar beranda (V45, A15). V53 sudah punya Daftar gratis sendiri, jadi kartu ini tidak tampil. Pemilik lapak (V48) juga tidak melihat ajakan ini. */}
          <div className={`mt-6 px-4 ${keadaan.ringkas?.jumlah === 0 || akun?.lapak ? 'hidden' : ''}`}>
            <div className="flex flex-col gap-2 rounded-3xl bg-white p-[18px] shadow-[inset_0_0_0_1.5px_#D5DAE2]">
              <span className="text-[17px] font-extrabold tracking-[-0.01em]">Punya lapak atau jualan keliling?</span>
              <span className="text-sm leading-normal text-[#3D4A5F]">
                Daftarkan gratis. Pelangganmu bisa lihat kapan dan di mana kamu buka.
              </span>
              <Link
                to="/daftar"
                className="mt-1 flex h-12 items-center justify-center rounded-full bg-brand-muda text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
              >
                Daftar lapak gratis
              </Link>
            </div>
          </div>
          {/* Kaki beranda (V45) menuju V38 */}
          <div className="flex justify-center gap-5 pb-2 pt-[18px] text-[13px]">
            <Link to="/akun/kebijakan?tab=sk" className="text-brand-tekan">
              Syarat &amp; Ketentuan
            </Link>
            <Link to="/akun/kebijakan" className="text-brand-tekan">
              Kebijakan Privasi
            </Link>
          </div>
        </>
      )}

      <LembarUrutkan
        terbuka={lembarUrutkan}
        awal={urutanBerlaku}
        onTutup={() => setLembarUrutkan(false)}
        onTerapkan={terapkanUrutan}
      />
      <LembarWilayah
        terbuka={lembarWilayah}
        awal={wilayah}
        onTutup={() => setLembarWilayah(false)}
        onTerapkan={terapkanWilayah}
      />

      <LembarMasuk terbuka={lembarMasuk} onTutup={() => setLembarMasuk(false)} />
    </main>
  )
}
