import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KartuLapak } from '../components/KartuLapak'
import { BannerSinyalPutus, KerangkaMemuat } from '../components/KeadaanKhusus'
import { bacaTerakhir, simpanTerakhir } from '../lib/dataTerakhir'
import { LembarUrutkan } from '../components/LembarUrutkan'
import { LembarWilayah } from '../components/LembarWilayah'
import { TombolAjak } from '../components/TombolAjak'
import { bersihkanKata, cariLapak, infoCari, type HasilCari, type LapakCari } from '../lib/cari'
import { LABEL_URUTAN, urutkanDaftar, warnaInisial, type Urutan } from '../lib/beranda'
import { mintaLokasi, statusIzinLokasi, type Titik } from '../lib/lokasi'
import { inisialLapak } from '../lib/pengarah'
import { bacaWilayah, labelWilayah, labelWilayahLengkap, simpanWilayah, type PilihanWilayah } from '../lib/wilayah'
import type { StatusTampil } from '../components/ChipStatus'

// Muat ulang setiap 30 detik dan saat aplikasi kembali dibuka (A51)
const SEGARKAN = 30 * 1000
// Jeda mengetik sebelum mencari
const JEDA_KETIK = 350

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'gagal'; kunci: string }
  | { jenis: 'siap'; kunci: string; hasil: HasilCari; dimuatPada: number; gagalSegarkan: boolean }

const statusKartu = (l: LapakCari): StatusTampil => (l.status === 'biasanya_buka' ? 'biasanya' : l.status)

const IkonCari = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

// Hasil cari (V5) dan hasil kosong (V54), A22–A24. Kata dan pilihan "semua wilayah" ada di URL (?q=…&semua=1);
// lokasi pelanggan tidak pernah masuk URL atau query (A21).
export default function Cari() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kata = bersihkanKata(params.get('q') ?? '')
  const semua = params.get('semua') === '1'
  const [teks, setTeks] = useState(params.get('q') ?? '')
  const [wilayah, setWilayah] = useState(bacaWilayah)
  const [urutan, setUrutan] = useState<Urutan>('terdekat')
  // Lokasi hanya jika izin sudah diberi; halaman ini tidak pernah bertanya (A21)
  const [lokasi, setLokasi] = useState<Titik | null>(null)
  const [lembarUrutkan, setLembarUrutkan] = useState(false)
  const [lembarWilayah, setLembarWilayah] = useState(false)
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  const nomorMuat = useRef(0)

  const kunci = `${kata}|${semua}|${wilayah.provinsiKode}|${wilayah.kabupatenKode}|${wilayah.kecamatanKode}`

  // Ketikan diterapkan ke URL setelah jeda; kata baru kembali ke wilayah aktif
  const terapkanTeks = useCallback(
    (nilai: string) => {
      const bersih = bersihkanKata(nilai)
      if (bersih === kata) return
      setParams(bersih ? { q: bersih } : {}, { replace: true })
    },
    [kata, setParams],
  )
  useEffect(() => {
    const jeda = window.setTimeout(() => terapkanTeks(teks), JEDA_KETIK)
    return () => window.clearTimeout(jeda)
  }, [teks, terapkanTeks])

  const kirim = (e: FormEvent) => {
    e.preventDefault()
    terapkanTeks(teks)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const muat = useCallback(async () => {
    if (!kata) return
    const ini = ++nomorMuat.current
    try {
      const hasil = await cariLapak(kata, semua ? null : wilayah)
      if (ini !== nomorMuat.current) return
      setKeadaan({ jenis: 'siap', kunci, hasil, dimuatPada: Date.now(), gagalSegarkan: false })
      simpanTerakhir('cari', kunci, hasil)
    } catch {
      if (ini !== nomorMuat.current) return
      // Belum ada hasil di layar (dibuka tanpa sinyal): hasil terakhir untuk kata dan wilayah ini dari HP (V20)
      const lama = bacaTerakhir<HasilCari>('cari', kunci)
      setKeadaan((k) =>
        k.jenis === 'siap' && k.kunci === kunci
          ? { ...k, gagalSegarkan: true }
          : lama
            ? { jenis: 'siap', kunci, hasil: lama.data, dimuatPada: lama.pada, gagalSegarkan: true }
            : { jenis: 'gagal', kunci },
      )
    }
  }, [kata, semua, wilayah, kunci])

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

  useEffect(() => {
    let batal = false
    statusIzinLokasi().then((izin) => {
      if (izin !== 'granted' || batal) return
      mintaLokasi().then(
        (t) => !batal && setLokasi(t),
        () => {},
      )
    })
    return () => {
      batal = true
    }
  }, [])

  // Hasil untuk kata atau wilayah sebelumnya dianggap masih memuat
  const sekarang = keadaan.jenis !== 'memuat' && keadaan.kunci === kunci ? keadaan : null
  const urutanBerlaku: Urutan = urutan === 'terdekat' && !lokasi ? 'terpopuler' : urutan
  const hasil = sekarang?.jenis === 'siap' ? sekarang.hasil : null
  const kelompok = useMemo(
    () =>
      hasil && {
        lagiBuka: urutkanDaftar(hasil.lagiBuka, urutanBerlaku, lokasi),
        biasanyaBuka: urutkanDaftar(hasil.biasanyaBuka, urutanBerlaku, lokasi),
        sedangTutup: urutkanDaftar(hasil.sedangTutup, urutanBerlaku, lokasi),
      },
    [hasil, urutanBerlaku, lokasi],
  )

  const kembali = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/')
  }
  const cariSemua = () => setParams({ q: kata, semua: '1' })
  const terapkanWilayah = (w: PilihanWilayah) => {
    setLembarWilayah(false)
    simpanWilayah(w)
    setWilayah(w)
    if (semua) setParams({ q: kata }, { replace: true })
  }
  const cobaLagi = () => {
    if (sekarang?.jenis === 'gagal') setKeadaan({ jenis: 'memuat' })
    muat()
  }

  const tempatHasil = semua ? 'semua wilayah' : labelWilayahLengkap(wilayah)
  const kartu = (l: LapakCari) => (
    <KartuLapak
      key={l.id}
      ringkas
      href={`/${l.slug}`}
      lapak={{
        nama: l.nama,
        inisial: inisialLapak(l.nama),
        warna: warnaInisial(l.id),
        fotoUrl: l.foto_url,
        info: infoCari(l, hasil?.jadwalTutup ?? {}),
        status: statusKartu(l),
      }}
    />
  )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3 bg-white px-4 pb-6 pt-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={kembali} aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex min-w-0 gap-2">
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
            <span className="truncate">{labelWilayah(wilayah)}</span>&nbsp;▾
          </button>
        </div>
      </div>

      <form role="search" onSubmit={kirim}>
        <label className="flex h-12 items-center gap-2.5 rounded-full bg-kartu px-4 shadow-[inset_0_0_0_2px_#1F5FE6]">
          <IkonCari />
          <span className="sr-only">Cari lapak</span>
          <input
            type="search"
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            autoFocus={!kata}
            enterKeyHint="search"
            placeholder="Cari bakso, es dawet, cukur…"
            className="min-w-0 grow bg-transparent text-base text-tinta outline-none placeholder:text-teks-redup"
          />
        </label>
      </form>

      {kata && !sekarang && <KerangkaMemuat className="pt-1" />}

      {kata && sekarang?.jenis === 'gagal' && (
        <div className="mt-1 flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Hasil cari belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}

      {kata && sekarang?.jenis === 'siap' && sekarang.gagalSegarkan && <BannerSinyalPutus pada={sekarang.dimuatPada} onCobaLagi={cobaLagi} />}

      {kata && hasil && kelompok && hasil.jumlah > 0 && (
        <>
          <p className="text-[15px]">
            Hasil “{kata}” di <b>{tempatHasil}</b> · {hasil.jumlah} lapak
          </p>
          {kelompok.lagiBuka.length > 0 && <h2 className="mt-1 text-base font-bold">Lagi buka</h2>}
          {kelompok.lagiBuka.map(kartu)}
          {kelompok.biasanyaBuka.length > 0 && <h2 className="mt-1 text-base font-bold">Biasanya buka jam segini</h2>}
          {kelompok.biasanyaBuka.map(kartu)}
          {kelompok.sedangTutup.length > 0 && <h2 className="mt-1 text-base font-bold">Sedang tutup</h2>}
          {kelompok.sedangTutup.map(kartu)}
          {hasil.diLuar > 0 && (
            <button
              type="button"
              onClick={cariSemua}
              className="min-h-[52px] rounded-full bg-brand-muda px-5 py-2 text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
            >
              Cari “{kata}” di semua wilayah (+{hasil.diLuar})
            </button>
          )}
        </>
      )}

      {/* Hasil cari kosong (V54, A24) */}
      {kata && hasil && hasil.jumlah === 0 && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-3 py-8 text-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <h2 className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em]">
              Tidak ada “{kata}” di {tempatHasil}
            </h2>
            <p className="text-[15px] leading-normal text-[#3D4A5F]">
              Sudah dicari di nama dan keterangan semua lapak, termasuk yang sedang tutup.
            </p>
            {hasil.saran && (
              <p className="mt-1 rounded-2xl bg-kartu px-3.5 py-3 text-sm leading-normal text-[#3D4A5F]">
                Coba kata yang lebih umum, misalnya <b className="text-tinta">{hasil.saran}</b>.
              </p>
            )}
          </div>
          {hasil.diLuar > 0 && (
            <button type="button" onClick={cariSemua} className="flex min-h-14 items-center justify-center rounded-full bg-brand px-5 py-2 text-base font-bold text-white">
              Cari “{kata}” di semua wilayah (+{hasil.diLuar})
            </button>
          )}
          <TombolAjak className="flex h-[52px] w-full items-center justify-center rounded-full bg-brand-muda text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]" />
          <Link to="/daftar" className="flex min-h-11 items-center justify-center gap-1.5 text-center text-[15px]">
            <span className="text-teks-redup">Kamu jualan {hasil.saran ?? kata}?</span>
            <span className="shrink-0 font-bold text-brand-tekan">Daftar gratis ›</span>
          </Link>
        </>
      )}

      {/* Terdekat tanpa izin lokasi tetap berlaku sebagai Terpopuler; halaman ini tidak meminta lokasi */}
      <LembarUrutkan
        terbuka={lembarUrutkan}
        awal={urutanBerlaku}
        onTutup={() => setLembarUrutkan(false)}
        onTerapkan={(u) => {
          setLembarUrutkan(false)
          setUrutan(u)
        }}
      />
      <LembarWilayah terbuka={lembarWilayah} awal={wilayah} onTutup={() => setLembarWilayah(false)} onTerapkan={terapkanWilayah} />
    </main>
  )
}
