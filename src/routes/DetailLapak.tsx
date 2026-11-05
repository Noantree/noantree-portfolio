import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { LapakTidakTersedia } from '../components/LapakTidakTersedia'
import { BannerSinyalPutus, KerangkaMemuat } from '../components/KeadaanKhusus'
import { bacaTerakhir, simpanTerakhir } from '../lib/dataTerakhir'
import { LembarBagikan } from '../components/LembarBagikan'
import { LembarLapor } from '../components/LembarLapor'
import { LembarMasuk } from '../components/LembarMasuk'
import { TombolIkuti } from '../components/TombolIkuti'
import { LihatFoto } from '../components/LihatFoto'
import { usePesan } from '../components/Pesan'
import { linkLapak, salinTeks } from '../lib/bagikan'
import { linkMaps, muatDetail, teksJarak, teksWilayah, type DetailLapak, type IsiDetail } from '../lib/detail'
import { jarakMeter, mintaLokasi, statusIzinLokasi, type Titik } from '../lib/lokasi'
import { inisialLapak } from '../lib/pengarah'
import { warnaInisial } from '../lib/beranda'
import { useAkunSaya } from '../lib/akunSaya'
import { useSesi } from '../lib/sesi'
import { judulLapak } from '../lib/situs'
import { judulTab } from '../lib/lingkungan'
import type { Tujuan } from '../lib/pengarah'
import { jadwalSeninMinggu, jamWIB, teksBukaBerikutnya, teksTerakhirBuka } from '../lib/waktu'

// Status dimuat ulang setiap 30 detik dan saat aplikasi kembali dibuka, sama dengan beranda (A51)
const SEGARKAN = 30 * 1000

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'gagal' }
  | { jenis: 'tidak-ada' }
  | { jenis: 'siap'; isi: IsiDetail; dimuatPada: number; gagalSegarkan: boolean }

const IkonPeta = ({ warna }: { warna: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
)

// Kartu status besar (V2 Lagi buka, V22 Biasanya buka, V23 Habis dan Tutup, A1).
// Lapak sendiri (V49, A42): tombol Maps nonaktif dan tanpa ajakan Ikuti. ikuti: tombol di dalam kartu Habis (V23).
function KartuStatus({
  lapak,
  jarak,
  sekarang,
  milikSendiri,
  ikuti,
}: {
  lapak: DetailLapak
  jarak: number | null
  sekarang: number
  milikSendiri: boolean
  ikuti?: ReactNode
}) {
  const maps = linkMaps(lapak)
  // Pemilik juga bisa membuka Maps untuk mengecek apakah titik lapaknya sudah tepat (keputusan Aji).
  const tombolMaps = (kelas: string, isi: ReactNode) => (
    <a href={maps!} target="_blank" rel="noopener noreferrer" className={kelas}>
      {isi}
    </a>
  )
  const ketJarak = jarak == null ? '' : teksJarak(jarak)
  const keterangan = (...bagian: string[]) => bagian.filter(Boolean).join(' · ')

  if (lapak.status === 'buka') {
    return (
      <div className="flex flex-col gap-1.5 rounded-3xl bg-[#E4F5EC] p-[18px]">
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0E7A4F]">
          <span className="size-2.5 rounded-full bg-buka shadow-[0_0_0_4px_rgba(22,168,106,0.2)]" />
          {lapak.berakhir_pada ? `Lagi buka sampai ${jamWIB(new Date(lapak.berakhir_pada))}` : 'Lagi buka'}
        </span>
        {lapak.tempat_nama && <span className="mt-1 text-xl font-bold tracking-[-0.01em]">{lapak.tempat_nama}</span>}
        {keterangan(teksWilayah(lapak), ketJarak) && (
          <span className="text-[13px] text-[#3D5A4B]">{keterangan(teksWilayah(lapak), ketJarak)}</span>
        )}
        {maps &&
          tombolMaps(
            'mt-2.5 flex h-[52px] items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white hover:text-white',
            <>
              <IkonPeta warna="#FFFFFF" />
              Buka di Google Maps
            </>,
          )}
      </div>
    )
  }

  if (lapak.status === 'habis') {
    return (
      <div className="flex flex-col gap-1.5 rounded-3xl bg-[#FDEEDF] p-[18px]">
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#A8500C]">
          <span className="size-2.5 rounded-full bg-habis" />
          {lapak.status_sejak ? `Habis sejak ${jamWIB(new Date(lapak.status_sejak))}` : 'Habis'}
        </span>
        {lapak.tempat_nama && <span className="mt-1 text-xl font-bold tracking-[-0.01em]">{lapak.tempat_nama}</span>}
        <span className="text-[13px] text-[#6B4A2F]">
          {ikuti ? 'Stok sudah habis. Coba lagi besok, atau ikuti lapak ini.' : 'Stok sudah habis. Coba lagi besok.'}
        </span>
        {ikuti && <div className="mt-2.5 flex flex-col">{ikuti}</div>}
      </div>
    )
  }

  if (lapak.status === 'biasanya_buka') {
    const jadwalHariIni =
      lapak.jadwal_mulai && lapak.jadwal_selesai
        ? `Jadwal hari ini ${jamWIB(new Date(lapak.jadwal_mulai))}⁠–⁠${jamWIB(new Date(lapak.jadwal_selesai))}`
        : ''
    return (
      <div className="flex flex-col gap-1.5 rounded-3xl bg-white p-[18px] shadow-[inset_0_0_0_1.5px_#D5DAE2]">
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-teks-redup">
          <span className="size-2.5 rounded-full border-2 border-dashed border-tutup" />
          Biasanya buka jam segini
        </span>
        <span className="text-sm leading-[1.45] text-teks-redup">
          Belum dikonfirmasi pemilik lapak. Bisa jadi memang belum buka, atau sudah buka tapi belum sempat mengabari.
        </span>
        {lapak.tempat_nama && <span className="mt-1.5 text-lg font-bold">Biasanya di {lapak.tempat_nama}</span>}
        {keterangan(jadwalHariIni, ketJarak) && (
          <span className="text-[13px] text-teks-redup">{keterangan(jadwalHariIni, ketJarak)}</span>
        )}
        {maps &&
          tombolMaps(
            'mt-2.5 flex h-12 items-center justify-center rounded-full bg-kartu text-[15px] font-bold text-tinta shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)] hover:text-tinta',
            'Lihat tempat biasanya di Maps',
          )}
      </div>
    )
  }

  // Tutup: dengan jadwal ("Buka lagi besok 06.00") atau tanpa jadwal ("Jadwal tidak tetap")
  const terakhir = lapak.terakhir_buka_pada ? teksTerakhirBuka(new Date(lapak.terakhir_buka_pada).getTime(), sekarang) : null
  const ketTerakhir = terakhir ? `terakhir buka ${terakhir}${lapak.tempat_nama ? ` di ${lapak.tempat_nama}` : ''}` : ''
  return (
    <div className="flex flex-col gap-1.5 rounded-3xl bg-kartu p-[18px]">
      <span className="inline-flex items-center gap-2 text-sm font-extrabold text-teks-redup">
        <span className="size-2.5 rounded-full shadow-[inset_0_0_0_2px_#8A93A1]" />
        Tutup
      </span>
      {lapak.buka_berikutnya ? (
        <>
          <span className="mt-1 text-xl font-bold tracking-[-0.01em]">
            Buka lagi {teksBukaBerikutnya(new Date(lapak.buka_berikutnya).getTime(), sekarang)}
          </span>
          <span className="text-[13px] text-teks-redup">{keterangan('Sesuai jadwal', ketTerakhir)}</span>
        </>
      ) : (
        <>
          <span className="mt-1 text-xl font-bold tracking-[-0.01em]">Jadwal tidak tetap</span>
          {(terakhir || !milikSendiri) && (
            <span className="text-[13px] text-teks-redup">
              {[terakhir ? `Terakhir buka ${terakhir}.` : '', milikSendiri ? '' : 'Ikuti supaya tahu saat buka lagi.'].filter(Boolean).join(' ')}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// Detail lapak /:slug (V2, V22, V23, V37; V27 jika tidak tersedia). Rute ini paling akhir di App, jadi nama rute
// aplikasi selalu menang (A36).
export default function DetailLapak() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const alamat = useLocation()
  const { tampilkan } = usePesan()
  const { sesi } = useSesi()
  const akun = useAkunSaya()
  const [lembarBagikan, setLembarBagikan] = useState(false)
  const [lembarLapor, setLembarLapor] = useState(false)
  const [lembarMasukLapor, setLembarMasukLapor] = useState(false)
  const laporDijalankan = useRef(false)
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  // Lokasi pelanggan hanya di state halaman ini, untuk jarak: tidak dikirim, tidak disimpan (A21)
  const [lokasi, setLokasi] = useState<Titik | null>(null)
  const [fotoAwal, setFotoAwal] = useState(0)
  const fotoDariSini = useRef(false)
  const nomorMuat = useRef(0)

  const muat = useCallback(async () => {
    const ini = ++nomorMuat.current
    try {
      const isi = await muatDetail(slug)
      if (ini !== nomorMuat.current) return
      setKeadaan(isi ? { jenis: 'siap', isi, dimuatPada: Date.now(), gagalSegarkan: false } : { jenis: 'tidak-ada' })
      // Lapak yang tidak tersedia lagi disimpan kosong, supaya tidak muncul dari data terakhir saat sinyal putus
      simpanTerakhir('detail', slug, isi, 10)
    } catch {
      if (ini !== nomorMuat.current) return
      // Belum ada data di layar (dibuka tanpa sinyal): data terakhir lapak ini dari HP (V20)
      const lama = bacaTerakhir<IsiDetail | null>('detail', slug)
      setKeadaan((k) =>
        k.jenis === 'siap'
          ? { ...k, gagalSegarkan: true }
          : lama?.data
            ? { jenis: 'siap', isi: lama.data, dimuatPada: lama.pada, gagalSegarkan: true }
            : { jenis: 'gagal' },
      )
    }
  }, [slug])

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

  // Judul tab peramban dengan nama lapak, sama dengan judul pratinjau link dari Worker (worker/pratinjau.ts)
  const namaLapak = keadaan.jenis === 'siap' ? keadaan.isi.lapak.nama : null
  useEffect(() => {
    if (!namaLapak) return
    document.title = judulTab(judulLapak(namaLapak))
    return () => {
      document.title = judulTab()
    }
  }, [namaLapak])

  // Jarak hanya jika izin lokasi sudah diberi; pelanggan tidak ditanya lagi di halaman ini
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

  const cobaLagi = () => {
    if (keadaan.jenis === 'gagal') setKeadaan({ jenis: 'memuat' })
    muat()
  }

  // Kembali ke halaman sebelumnya di aplikasi; dibuka langsung dari link atau QR → beranda
  const kembali = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/')
  }

  // Lihat foto memakai #foto supaya tombol kembali di HP menutup foto, bukan halaman
  const fotoTerbuka = alamat.hash === '#foto'
  const bukaFoto = (i: number) => {
    setFotoAwal(i)
    fotoDariSini.current = true
    navigate({ hash: 'foto' })
  }
  const tutupFoto = useCallback(() => {
    if (fotoDariSini.current) navigate(-1)
    else navigate({ hash: '' }, { replace: true })
    fotoDariSini.current = false
  }, [navigate])

  // Bagikan untuk pelanggan (A49): menu bagikan HP dengan link lapak; tanpa menu, link disalin
  const bagikan = async (l: DetailLapak) => {
    const link = linkLapak(l.slug).url
    if (navigator.share) {
      try {
        await navigator.share({ title: l.nama, url: link })
      } catch {
        // Menu bagikan ditutup tanpa memilih: tidak perlu pesan
      }
      return
    }
    if (await salinTeks(link)) tampilkan({ teks: 'Link lapak disalin.', jenis: 'berhasil' })
    else tampilkan({ teks: 'Link belum bisa disalin.', jenis: 'merah' })
  }

  // Aksi tertunda dari sebelum masuk (A26), diteruskan Pengarah lewat state navigasi.
  // Dihitung di sini, sebelum return awal, supaya hook di bawahnya tetap berurutan.
  const idLapakSiap = keadaan.jenis === 'siap' ? keadaan.isi.lapak.id : null
  const tertunda = (alamat.state as { aksiTertunda?: Tujuan } | null)?.aksiTertunda
  const hapusTertunda = () => navigate({ pathname: alamat.pathname, hash: alamat.hash }, { replace: true, state: null })
  const laporTertunda = Boolean(idLapakSiap && tertunda?.asal === 'aksi' && tertunda.aksi === 'lapor' && tertunda.lapakId === idLapakSiap)

  // Lapor tertunda (A26): setelah masuk, lembar Laporkan langsung terbuka sekali. Pemilik tidak pernah dibukakan (A42).
  useEffect(() => {
    if (!laporTertunda || !sesi || akun === null || laporDijalankan.current) return
    laporDijalankan.current = true
    if (akun.lapak?.id !== idLapakSiap) setLembarLapor(true)
    hapusTertunda()
    // hapusTertunda dibuat ulang tiap render; yang penting hanya sekali per kunjungan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laporTertunda, sesi, akun, idLapakSiap])

  if (keadaan.jenis === 'tidak-ada') return <LapakTidakTersedia />

  const lapak = keadaan.jenis === 'siap' ? keadaan.isi.lapak : null
  // Lapak sendiri (V49, A42). Selama data akun belum siap, tombol Ikuti belum ditampilkan supaya pemilik
  // tidak sempat melihatnya. Database tetap menolak kalau pemilik mencoba mengikuti.
  const akunSiap = !sesi || akun !== null
  const milikSendiri = Boolean(lapak && akun?.lapak?.id === lapak.id)
  const tampilIkuti = Boolean(lapak && akunSiap && !milikSendiri)
  const ikutiTertunda = Boolean(lapak && tertunda?.asal === 'aksi' && tertunda.aksi === 'ikuti' && tertunda.lapakId === lapak.id)
  // Tamu diminta masuk dulu (V6); pelanggan yang sudah masuk langsung mendapat lembar Laporkan (V9)
  const ketukLapor = () => (sesi ? setLembarLapor(true) : setLembarMasukLapor(true))
  const laporTerkirim = () => {
    setLembarLapor(false)
    tampilkan({ teks: 'Laporan terkirim. Terima kasih.', jenis: 'berhasil' })
  }
  const tombolIkuti = (varian: 'utama' | 'kartu', ajakan?: string) =>
    lapak && (
      <TombolIkuti
        lapak={lapak}
        varian={varian}
        ajakan={ajakan}
        aksiTertunda={ikutiTertunda}
        onAksiSelesai={hapusTertunda}
      />
    )
  const tombolKembali = (
    <button type="button" onClick={kembali} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full bg-kartu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-5 bg-white px-4 pb-6">
      <div className="flex h-[60px] items-center justify-between">
        {tombolKembali}
        {/* Lapak sendiri: Bagikan ada di kotak Ini lapakmu (V49) */}
        {lapak && !milikSendiri && (
          <button
            type="button"
            onClick={() => bagikan(lapak)}
            className="h-11 rounded-full bg-kartu px-4 text-sm font-semibold text-tinta shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
          >
            Bagikan
          </button>
        )}
      </div>

      {keadaan.jenis === 'memuat' && <KerangkaMemuat varian="lapak" />}

      {keadaan.jenis === 'gagal' && (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={cobaLagi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}

      {keadaan.jenis === 'siap' && lapak && (
        <>
          {keadaan.gagalSegarkan && <BannerSinyalPutus pada={keadaan.dimuatPada} onCobaLagi={cobaLagi} className="-mb-1" />}

          <Profil lapak={lapak} />

          {/* Kotak Ini lapakmu (V49, A42). Kelola lapak menuju Profil lapak (V16). */}
          {milikSendiri && (
            <div className="flex flex-col gap-2.5 rounded-[20px] bg-brand-muda p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-bold">Ini lapakmu</span>
                <span className="text-sm text-[#3D4A5F]">Begini tampilannya bagi pelanggan.</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/lapakku/profil"
                  className="flex h-12 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-white hover:text-white"
                >
                  Kelola lapak
                </Link>
                <button
                  type="button"
                  onClick={() => setLembarBagikan(true)}
                  className="h-12 rounded-full bg-white text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
                >
                  Bagikan
                </button>
              </div>
            </div>
          )}

          <KartuStatus
            lapak={lapak}
            milikSendiri={milikSendiri}
            ikuti={tampilIkuti && lapak.status === 'habis' ? tombolIkuti('kartu') : undefined}
            sekarang={keadaan.dimuatPada}
            jarak={
              lokasi && lapak.tempat_lat != null && lapak.tempat_lng != null
                ? jarakMeter(lokasi, { lat: lapak.tempat_lat, lng: lapak.tempat_lng })
                : null
            }
          />

          {/* Tombol Ikuti (V2, V22, A41). Lapak Habis memakai tombol di dalam kartunya (V23). */}
          {tampilIkuti &&
            lapak.status !== 'habis' &&
            tombolIkuti('utama', lapak.status === 'biasanya_buka' ? 'Ikuti supaya tahu saat lapak ini benar-benar buka.' : undefined)}

          {lapak.deskripsi && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">Tentang</h2>
              {/* Teks biasa tanpa link; maks. 300 karakter dijaga database (A37) */}
              <p className="whitespace-pre-line break-words text-base leading-[1.55]">{lapak.deskripsi}</p>
            </div>
          )}

          {keadaan.isi.foto.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {keadaan.isi.foto.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => bukaFoto(i)}
                  aria-label={`Lihat foto ${i + 1}`}
                  className={`h-32 overflow-hidden rounded-2xl bg-[#E3E7EE] ${
                    i === keadaan.isi.foto.length - 1 && keadaan.isi.foto.length % 2 === 1 ? 'col-span-2' : ''
                  }`}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {keadaan.isi.jadwal.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[20px] bg-kartu p-4">
              <h2 className="text-base font-bold">Jadwal</h2>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {jadwalSeninMinggu(keadaan.isi.jadwal).map((hari) => (
                  <li key={hari.nama} className="flex justify-between gap-3 text-[15px]">
                    <span className={hari.jam ? 'font-semibold' : 'text-teks-redup'}>{hari.nama}</span>
                    <span className={hari.jam ? '' : 'text-teks-redup'}>{hari.jam ?? 'Libur'}</span>
                  </li>
                ))}
              </ul>
              {/* V22 tidak memakai catatan ini karena kartu Biasanya buka sudah menyebut belum dikonfirmasi */}
              {lapak.status !== 'biasanya_buka' && (
                <span className="text-[13px] text-teks-redup">Jadwal hanya perkiraan. Status di atas yang paling akurat.</span>
              )}
            </div>
          )}

          {/* Tautan Laporkan lapak ini (V2, A44): hanya untuk lapak orang lain, tidak untuk pemilik (A42) */}
          {tampilIkuti && (
            <button type="button" onClick={ketukLapor} className="flex min-h-11 items-center self-start text-sm text-[#5B6472]">
              Laporkan lapak ini
            </button>
          )}
          {lembarLapor && lapak && (
            <LembarLapor lapak={lapak} onTutup={() => setLembarLapor(false)} onTerkirim={laporTerkirim} />
          )}
          {lapak && (
            <LembarMasuk
              terbuka={lembarMasukLapor}
              onTutup={() => setLembarMasukLapor(false)}
              keterangan="Masuk untuk melaporkan lapak. Melihat lapak tetap bisa tanpa masuk. Setelah masuk, laporanmu langsung dibuka untuk diisi."
              tujuan={{ asal: 'aksi', aksi: 'lapor', lapakId: lapak.id, kembaliKe: `/${lapak.slug}` }}
            />
          )}
          {milikSendiri && <LembarBagikan lapakId={lapak.id} terbuka={lembarBagikan} onTutup={() => setLembarBagikan(false)} />}

          {fotoTerbuka && keadaan.isi.foto.length > 0 && (
            <LihatFoto foto={keadaan.isi.foto} awal={Math.min(fotoAwal, keadaan.isi.foto.length - 1)} nama={lapak.nama} onTutup={tutupFoto} />
          )}
        </>
      )}
    </main>
  )
}

function Profil({ lapak }: { lapak: DetailLapak }) {
  const [fotoGagal, setFotoGagal] = useState(false)
  const pengikut = `${lapak.jumlah_pengikut.toLocaleString('id-ID')} pengikut`
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-extrabold text-white"
        style={{ background: warnaInisial(lapak.id) }}
      >
        {lapak.foto_url && !fotoGagal ? (
          <img src={lapak.foto_url} alt="" className="size-full object-cover" onError={() => setFotoGagal(true)} />
        ) : (
          inisialLapak(lapak.nama)
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="break-words text-2xl font-extrabold leading-[1.1] tracking-[-0.02em]">{lapak.nama}</h1>
        <span className="text-[13px] text-teks-redup">
          {[pengikut, lapak.tempat_kecamatan_nama].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  )
}
