import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePesan } from '../components/Pesan'
import { LembarBagikan } from '../components/LembarBagikan'
import { LapakDisembunyikan } from '../components/LapakDisembunyikan'
import { BannerBelumTerkirim, BannerSinyalPutus, KerangkaMemuat } from '../components/KeadaanKhusus'
import {
  bacaAntreanMulai,
  bacaTerakhir,
  hapusAntreanMulai,
  simpanAntreanMulai,
  simpanTerakhir,
} from '../lib/dataTerakhir'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { inisialLapak } from '../lib/pengarah'
import {
  akhirJadwalJikaMulai,
  awalJadwalBerjalan,
  jamWIB,
  samaHariWIB,
  teksJadwalHariIni,
  teksSisa,
  type BarisJadwal,
} from '../lib/waktu'

type Lapak = { id: string; nama: string; foto_url: string | null; status_tayang: string; langkah_daftar: number }
type Tempat = { id: string; nama: string }
type Sesi = {
  id: string
  tempat_id: string | null
  berakhir_pada: string
  status: 'buka' | 'habis'
  total_perpanjangan_menit: number
  dari_jadwal: boolean
}
// Sesi yang berakhir otomatis dan belum dilihat pemilik (V28, A7), dari sesi_berakhir_belum_dilihat (017)
type SesiBerakhir = {
  id: string
  mulai_pada: string
  berakhir_pada: string
  tempat_id: string | null
  tempat_nama: string | null
  dari_jadwal: boolean
}
// Info V17 untuk lapak yang disembunyikan, dari pemilik_info_disembunyikan (024). Tanpa data pelapor.
type InfoSembunyi = { pada: string | null; alasan: string | null }
type Data = {
  lapak: Lapak
  tempat: Tempat[]
  jadwal: BarisJadwal[]
  sesi: Sesi | null
  berakhir: SesiBerakhir | null
  publik: { status: string; jumlah_pengikut: number } | null
  sembunyi: InfoSembunyi | null
}

const BATAS_PERPANJANG = 480
const SEGARKAN = 30 * 1000

// Label status pelanggan dari view lapak_publik (PRD bagian 3)
const LABEL_PUBLIK: Record<string, string> = {
  buka: 'Lagi buka',
  habis: 'Habis',
  biasanya_buka: 'Biasanya buka',
  tutup: 'Tutup',
}

// Beranda pemilik: status harian (S3.2, S3.3). Tutup V3 (beberapa tempat) atau V14 (satu tempat) dengan banner
// Lupa mulai buka (A5), Lagi buka V4, batas perpanjangan V29, Habis V15, Berakhir otomatis V28 (A6, A7).
// Semua perubahan lewat fungsi database dari migrasi 016 dan 017 (A2, A3, A4).
export default function Lapakku() {
  const { sesi: akun, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = akun?.user.id

  const [data, setData] = useState<Data | null>(null)
  const [gagal, setGagal] = useState(false)
  const [pilihan, setPilihan] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [bagikanTerbuka, setBagikanTerbuka] = useState(false)
  const [sekarang, setSekarang] = useState(() => Date.now())
  // Waktu data di layar terakhir berhasil dimuat (atau waktu data terakhir dari HP), untuk keterangan V20
  const [dimuatPada, setDimuatPada] = useState<number | null>(null)
  // Antrean Mulai buka (A8): dibaca dari HP setiap render; setVersiAntrean memicu render ulang saat antrean berubah
  const [, setVersiAntrean] = useState(0)
  const [mengirim, setMengirim] = useState(false)
  const mengirimRef = useRef(false)
  const kirimAntreanRef = useRef<(manual: boolean) => void>(() => {})
  const antrean = uid ? bacaAntreanMulai(uid) : null

  const muat = useCallback(async () => {
    if (!uid) return
    try {
      const { data: lapak, error } = await supabase
        .from('lapak')
        .select('id, nama, foto_url, status_tayang, langkah_daftar')
        .eq('pemilik_id', uid)
        .maybeSingle()
      if (error) throw error
      if (!lapak) {
        navigate('/daftar', { replace: true })
        return
      }
      if (lapak.status_tayang === 'draf') {
        navigate(`/daftar/${lapak.langkah_daftar}`, { replace: true })
        return
      }
      // V17 (A9, A47): lapak disembunyikan. Pemilik tidak boleh membaca laporan, jadi alasan dan waktu dibaca
      // lewat fungsi khusus. Status harian tidak dimuat; muat ulang berkala membawa pemilik kembali saat ditampilkan lagi.
      if (lapak.status_tayang === 'disembunyikan') {
        const info = await supabase.rpc('pemilik_info_disembunyikan', { p_lapak: lapak.id })
        if (info.error) throw info.error
        const baris = ((info.data as { disembunyikan_pada: string | null; alasan: string | null }[] | null) ?? [])[0]
        const tersembunyi: Data = {
          lapak,
          tempat: [],
          jadwal: [],
          sesi: null,
          berakhir: null,
          publik: null,
          sembunyi: { pada: baris?.disembunyikan_pada ?? null, alasan: baris?.alasan ?? null },
        }
        setData(tersembunyi)
        simpanTerakhir('lapakku', uid, tersembunyi, 1)
        setGagal(false)
        setDimuatPada(Date.now())
        setSekarang(Date.now())
        return
      }
      // Dipanggil lebih dulu: fungsi ini juga menutup sesi yang lewat waktu (A6) sebelum sesi aktif dibaca
      const berakhir = await supabase.rpc('sesi_berakhir_belum_dilihat', { p_lapak: lapak.id })
      if (berakhir.error) throw berakhir.error
      const kini = new Date().toISOString()
      const [tempat, jadwal, sesi, publik] = await Promise.all([
        supabase
          .from('tempat')
          .select('id, nama')
          .eq('lapak_id', lapak.id)
          .order('terakhir_dipakai', { ascending: false, nullsFirst: false })
          .order('dibuat_pada'),
        supabase.from('jadwal').select('hari, jam_mulai, jam_selesai').eq('lapak_id', lapak.id),
        // Sesi aktif: belum diakhiri dan belum lewat berakhir_pada (sesi lewat waktu = Tutup, A6)
        supabase
          .from('sesi_buka')
          .select('id, tempat_id, berakhir_pada, status, total_perpanjangan_menit, dari_jadwal')
          .eq('lapak_id', lapak.id)
          .is('diakhiri_pada', null)
          .gt('berakhir_pada', kini)
          .maybeSingle(),
        // Status yang dilihat pelanggan dan jumlah pengikut; lapak disembunyikan tidak ada di view
        supabase.from('lapak_publik').select('status, jumlah_pengikut').eq('id', lapak.id).maybeSingle(),
      ])
      const galat = tempat.error ?? jadwal.error ?? sesi.error ?? publik.error
      if (galat) throw galat
      const baru: Data = {
        lapak,
        tempat: tempat.data ?? [],
        jadwal: jadwal.data ?? [],
        sesi: (sesi.data as Sesi | null) ?? null,
        berakhir: ((berakhir.data as SesiBerakhir[] | null) ?? [])[0] ?? null,
        publik: publik.data ?? null,
        sembunyi: null,
      }
      setData(baru)
      setGagal(false)
      setDimuatPada(Date.now())
      // Data lapak sendiri untuk dibuka tanpa sinyal (A8): nama, tempat, jadwal, dan status sesi. Tanpa email atau
      // data pelapor. Disimpan per akun dan dihapus saat Keluar, Hapus akun, atau Tutup lapak.
      simpanTerakhir('lapakku', uid, baru, 1)
      // Muat berhasil berarti sinyal ada: Mulai buka yang tertunda dikirim sekarang
      if (bacaAntreanMulai(uid)) kirimAntreanRef.current(false)
    } catch {
      // Gagal memuat: data di layar tetap; kalau belum ada, data terakhir dari HP dipakai (V20)
      const lama = bacaTerakhir<Data>('lapakku', uid)
      setData((d) => d ?? lama?.data ?? null)
      setDimuatPada((p) => p ?? lama?.pada ?? null)
      setGagal(true)
    }
    setSekarang(Date.now())
  }, [uid, navigate])

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    muat()
  }, [memuat, uid, navigate, muat])

  // Kirim antrean Mulai buka dengan waktu tekan aslinya (mulai_buka, p_waktu; 016 menolak lebih dari 1 jam lalu atau di
  // masa depan). Otomatis setelah muat berhasil, atau lewat Coba kirim lagi. Kotak V20 terlihat selama antrean ada.
  const kirimAntrean = useCallback(
    async (manual: boolean) => {
      if (!uid || mengirimRef.current) return
      const a = bacaAntreanMulai(uid)
      if (!a) return
      if (!navigator.onLine) {
        if (manual) tampilkan({ teks: 'Belum berhasil. Periksa sinyal, lalu coba lagi.', jenis: 'merah' })
        return
      }
      mengirimRef.current = true
      setMengirim(true)
      const { error } = await supabase.rpc('mulai_buka', { p_lapak: a.lapakId, p_tempat: a.tempatId, p_waktu: a.waktu })
      mengirimRef.current = false
      setMengirim(false)
      // Galat tanpa kode = permintaan tidak sampai ke server: antrean tetap
      if (error && !error.code) {
        if (manual) tampilkan({ teks: 'Belum berhasil. Periksa sinyal, lalu coba lagi.', jenis: 'merah' })
        return
      }
      // Terkirim atau ditolak server: antrean selesai dan dihapus dari HP
      hapusAntreanMulai()
      setVersiAntrean((v) => v + 1)
      if (error) tampilkan({ teks: error.code === 'P0001' ? error.message : 'Mulai buka belum berhasil dikirim.', jenis: 'merah' })
      else tampilkan({ teks: `Mulai buka terkirim, tercatat sejak ${jamWIB(new Date(a.waktu))}.`, jenis: 'berhasil' })
      await muat()
    },
    [uid, tampilkan, muat],
  )

  useEffect(() => {
    kirimAntreanRef.current = kirimAntrean
  }, [kirimAntrean])

  // Muat ulang setiap 30 detik dan saat aplikasi kembali dibuka
  useEffect(() => {
    if (!uid) return
    const jeda = window.setInterval(muat, SEGARKAN)
    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') muat()
    }
    document.addEventListener('visibilitychange', saatTerlihat)
    // Sinyal kembali: muat ulang; antrean Mulai buka ikut terkirim setelah muat berhasil (A8)
    window.addEventListener('online', muat)
    return () => {
      window.clearInterval(jeda)
      document.removeEventListener('visibilitychange', saatTerlihat)
      window.removeEventListener('online', muat)
    }
  }, [uid, muat])

  if (memuat || !akun) return null

  if (!data) {
    return gagal ? (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-[15px] text-teks-redup">Status lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.</p>
        <button type="button" onClick={muat} className="h-12 rounded-full bg-brand-muda px-6 text-[15px] font-bold text-brand-tekan">
          Coba lagi
        </button>
      </main>
    ) : (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col px-4 pt-6">
        <KerangkaMemuat varian="lapak" teks="Memuat status lapak…" />
      </main>
    )
  }

  const { lapak, tempat, jadwal, publik } = data
  // ---------- Disembunyikan (V17, A9, A47) ----------
  if (data.sembunyi) {
    return <LapakDisembunyikan lapak={lapak} pada={data.sembunyi.pada} alasan={data.sembunyi.alasan} />
  }
  // Sesi yang lewat berakhir_pada saat layar terbuka langsung dianggap Tutup; V28 muncul di muat ulang berikutnya
  const sesi =data.sesi && new Date(data.sesi.berakhir_pada).getTime() > sekarang ? data.sesi : null
  const tempatDipilih = pilihan && tempat.some((t) => t.id === pilihan) ? pilihan : (tempat[0]?.id ?? null)

  // Pesan dari database (raise exception, kode P0001) sudah dalam bahasa pemilik
  const jalankan = async (fungsi: string, args: Record<string, unknown>) => {
    setSibuk(true)
    const { error } = await supabase.rpc(fungsi, args)
    setSibuk(false)
    if (error) {
      tampilkan({ teks: error.code === 'P0001' ? error.message : 'Belum berhasil. Periksa sinyal, lalu coba lagi.', jenis: 'merah' })
      return false
    }
    await muat()
    return true
  }

  // Mulai buka (A2). Tanpa sinyal (A8): disimpan di HP dengan waktu saat tombol ditekan, lalu dikirim begitu sinyal
  // kembali. Saat ada sinyal waktu tidak dikirim, supaya jam HP yang meleset tidak membuat Mulai buka ditolak.
  const mulaiBuka = async () => {
    const waktu = new Date().toISOString()
    const antre = () => {
      simpanAntreanMulai({ uid: akun.user.id, lapakId: lapak.id, tempatId: tempatDipilih, waktu })
      setVersiAntrean((v) => v + 1)
    }
    if (!navigator.onLine) {
      antre()
      return
    }
    setSibuk(true)
    const { error } = await supabase.rpc('mulai_buka', { p_lapak: lapak.id, p_tempat: tempatDipilih })
    setSibuk(false)
    // Galat tanpa kode = permintaan tidak sampai ke server (sinyal putus): masuk antrean
    if (error && !error.code) {
      antre()
      return
    }
    if (error) {
      tampilkan({ teks: error.code === 'P0001' ? error.message : 'Belum berhasil. Periksa sinyal, lalu coba lagi.', jenis: 'merah' })
      return
    }
    await muat()
  }

  const bannerSinyal = gagal && dimuatPada !== null ? <BannerSinyalPutus pada={dimuatPada} onCobaLagi={muat} /> : null
  const bannerAntrean = antrean ? <BannerBelumTerkirim mengirim={mengirim} onKirim={() => kirimAntrean(true)} /> : null
  const perpanjang = () => jalankan('perpanjang', { p_lapak: lapak.id })

  // A3: Habis dan Selesai langsung berlaku, lalu pesan dengan Batalkan selama 5 detik
  const habis = async () => {
    if (await jalankan('ubah_status', { p_lapak: lapak.id, p_status: 'habis' }))
      tampilkan({
        teks: 'Status diubah ke Habis',
        jenis: 'habis',
        batalkan: () => jalankan('ubah_status', { p_lapak: lapak.id, p_status: 'buka' }),
      })
  }
  const stokAdaLagi = async () => {
    if (await jalankan('ubah_status', { p_lapak: lapak.id, p_status: 'buka' }))
      tampilkan({ teks: 'Status diubah ke Lagi buka', jenis: 'berhasil' })
  }
  const selesai = async () => {
    if (await jalankan('selesai', { p_lapak: lapak.id }))
      tampilkan({
        teks: 'Status diubah ke Tutup',
        jenis: 'netral',
        batalkan: () => jalankan('batalkan_selesai', { p_lapak: lapak.id }),
      })
  }

  const kepala = (
    <div className="flex h-16 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-extrabold text-white">
          {lapak.foto_url ? <img src={lapak.foto_url} alt="" className="size-full object-cover" /> : inisialLapak(lapak.nama)}
        </div>
        <span className="truncate text-lg font-bold">{lapak.nama}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label="Bagikan lapak"
          onClick={() => setBagikanTerbuka(true)}
          className="flex size-10 items-center justify-center rounded-full bg-brand-muda"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A4FC2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="M7 9l5-5 5 5" />
            <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
        {/* Profil menuju Profil lapak (V16) */}
        <Link to="/lapakku/profil" className="flex h-10 items-center rounded-full bg-kartu px-4 text-sm font-semibold text-tinta">
          Profil
        </Link>
      </div>
      <LembarBagikan lapakId={lapak.id} terbuka={bagikanTerbuka} onTutup={() => setBagikanTerbuka(false)} />
    </div>
  )

  const namaTempat = tempat.find((t) => t.id === sesi?.tempat_id)?.nama

  const tombolHabisSelesai = (
    <>
      <button
        type="button"
        onClick={habis}
        disabled={sibuk}
        className="flex h-16 items-center justify-center gap-2 rounded-[32px] bg-[#FDEEDF] text-lg font-extrabold text-[#A8500C] disabled:opacity-50"
      >
        <span className="size-2.5 rounded-full bg-habis" />
        Habis
      </button>
      <button
        type="button"
        onClick={selesai}
        disabled={sibuk}
        className="flex h-16 items-center justify-center rounded-[32px] bg-[#D5DAE2] text-lg font-extrabold text-tinta disabled:opacity-50"
      >
        Selesai
      </button>
    </>
  )

  // ---------- Habis (V15) ----------
  if (sesi?.status === 'habis') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
        {kepala}
        {bannerSinyal}
        <div className="flex flex-col gap-2 rounded-[28px] bg-[#FDEEDF] px-5 py-6">
          <span className="inline-flex items-center gap-2.5 text-sm font-bold text-[#A8500C]">
            <span className="size-3 rounded-full bg-habis" />
            Pelanggan melihat stok habis
          </span>
          <span className="text-[40px] font-extrabold leading-none tracking-[-0.035em] text-[#7A3A08]">Habis</span>
          {namaTempat && <span className="mt-1.5 text-[17px] font-bold">{namaTempat}</span>}
          <span className="text-[15px] text-[#6B4A2F]">
            Pelanggan tidak datang sia-sia · berakhir otomatis {jamWIB(new Date(sesi.berakhir_pada))}
          </span>
        </div>
        <div className="mt-auto flex flex-col gap-2.5">
          <button
            type="button"
            onClick={stokAdaLagi}
            disabled={sibuk}
            className="h-14 rounded-[28px] bg-brand-muda text-base font-bold text-brand-tekan disabled:opacity-50"
          >
            Stok ada lagi
          </button>
          <button
            type="button"
            onClick={selesai}
            disabled={sibuk}
            className="h-16 rounded-[32px] bg-[#D5DAE2] text-lg font-extrabold text-tinta disabled:opacity-50"
          >
            Selesai
          </button>
        </div>
      </main>
    )
  }

  // ---------- Lagi buka (V4) dan batas perpanjangan (V29) ----------
  if (sesi) {
    const berakhir = new Date(sesi.berakhir_pada).getTime()
    const diBatas = sesi.total_perpanjangan_menit >= BATAS_PERPANJANG
    // A4: abu, biru saat sisa waktu kurang dari 1 jam, nonaktif setelah total 8 jam
    const biru = !diBatas && berakhir - sekarang < 60 * 60 * 1000
    const akhirAwal = berakhir - sesi.total_perpanjangan_menit * 60 * 1000

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
        {kepala}
        {bannerSinyal}
        <div className="flex flex-col gap-2 rounded-[28px] bg-[#E4F5EC] px-5 py-6">
          <span className="inline-flex items-center gap-2.5 text-sm font-bold text-[#0E7A4F]">
            <span className={`size-3 rounded-full bg-buka ${diBatas ? '' : 'shadow-[0_0_0_5px_rgba(22,168,106,0.2)]'}`} />
            Pelanggan bisa melihatmu
          </span>
          <span className="text-[40px] font-extrabold leading-none tracking-[-0.035em] text-[#0B5E3D]">Lagi buka</span>
          {namaTempat && <span className="mt-1.5 text-[17px] font-bold">{namaTempat}</span>}
          <span className="text-[15px] text-[#2F4A3D]">
            sampai {jamWIB(berakhir)} · {teksSisa(berakhir, sekarang)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 rounded-[18px] bg-kartu px-4 py-3.5">
            <span className="text-[13px] text-teks-redup">Pengikut</span>
            <span className="text-[22px] font-extrabold tabular-nums">{publik ? publik.jumlah_pengikut : '–'}</span>
          </div>
          {diBatas ? (
            <button
              type="button"
              disabled
              aria-describedby="alasan-batas"
              className="flex flex-col gap-0.5 rounded-[18px] bg-kartu px-4 py-3.5 text-left text-[15px] font-bold text-tutup"
            >
              <span className="text-[13px] font-semibold">Sudah +8 jam</span>+ Perpanjang
            </button>
          ) : (
            <button
              type="button"
              onClick={perpanjang}
              disabled={sibuk}
              className={`flex flex-col gap-0.5 rounded-[18px] px-4 py-3.5 text-left text-[15px] font-bold disabled:opacity-50 ${
                biru ? 'bg-brand text-white' : 'bg-kartu text-tinta'
              }`}
            >
              <span className={`text-[13px] font-semibold ${biru ? 'text-white/85' : 'text-teks-redup'}`}>Masih ramai?</span>+ Perpanjang 1 jam
            </button>
          )}
        </div>

        {diBatas ? (
          <span id="alasan-batas" className="-mt-1 text-[13px] leading-normal text-[#3D4A5F]">
            {sesi.dari_jadwal ? 'Jadwalmu berakhir' : 'Sesimu awalnya berakhir'} {jamWIB(akhirAwal)} dan sudah diperpanjang 8 jam, batas
            maksimal perpanjangan. Masih buka setelah {jamWIB(berakhir)}?
          </span>
        ) : (
          <>
            <span className="-mt-1 text-[13px] text-teks-redup">
              Perpanjangan maksimal total 8 jam per sesi. Tombol jadi biru saat sisa waktu di bawah 1 jam.
            </span>
            {/* Kabari pelanggan membuka lembar Bagikan (V36, A49) */}
            <button
              type="button"
              onClick={() => setBagikanTerbuka(true)}
              className="flex h-13 items-center justify-center gap-2 rounded-[26px] bg-brand-muda px-4 text-[15px] font-bold text-brand-tekan"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d="M12 4v11" />
                <path d="M7 9l5-5 5 5" />
                <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
              </svg>
              Kabari pelanggan: aku lagi buka
            </button>
          </>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2.5">{tombolHabisSelesai}</div>
        {!diBatas && (
          <span className="-mt-1.5 text-center text-[13px] text-teks-redup">Habis: stok habis, masih di tempat · Selesai: sudah pulang</span>
        )}
      </main>
    )
  }

  const akhirJadwal = akhirJadwalJikaMulai(jadwal, sekarang)

  // ---------- Berakhir otomatis (V28, A6, A7): sekali, untuk sesi yang berakhir dalam 24 jam terakhir ----------
  const { berakhir } = data
  if (berakhir) {
    const mulai = new Date(berakhir.mulai_pada).getTime()
    const akhir = new Date(berakhir.berakhir_pada).getTime()
    // Buka lagi = sesi baru lewat mulai_buka, di tempat yang sama; lalu sesi lama ditandai sudah dilihat
    const bukaLagi = async () => {
      if (await jalankan('mulai_buka', { p_lapak: lapak.id, p_tempat: berakhir.tempat_id }))
        await jalankan('tandai_akhir_dilihat', { p_lapak: lapak.id })
    }

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
        {kepala}
        {bannerSinyal}
        <div role="status" className="flex flex-col gap-1.5 rounded-[20px] bg-brand-muda p-4">
          <span className="text-base font-bold">Status otomatis berakhir {jamWIB(akhir)}</span>
          <span className="text-sm leading-normal text-[#3D4A5F]">
            {berakhir.dari_jadwal ? 'Jadwalmu selesai' : 'Waktu sesimu habis'}, jadi lapak ditutup otomatis supaya pelanggan
            tidak datang saat kamu sudah pulang.
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[24px] bg-kartu p-5">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-teks-redup">
            <span className="size-2.5 rounded-full shadow-[inset_0_0_0_2px_#8A93A1]" />
            Status sekarang
          </span>
          <span className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em]">Tutup</span>
          <span className="text-[13px] text-teks-redup">
            {samaHariWIB(akhir, sekarang) ? 'Hari ini' : 'Kemarin'} buka {jamWIB(mulai)}–{jamWIB(akhir)}
            {berakhir.tempat_nama && ` di ${berakhir.tempat_nama}`}
          </span>
        </div>
        <span className="mt-auto text-center text-[15px] font-bold">Masih jualan?</span>
        <button
          type="button"
          onClick={bukaLagi}
          disabled={sibuk}
          className="h-16 rounded-[32px] bg-brand text-[20px] font-extrabold text-white active:bg-brand-tekan disabled:opacity-50"
        >
          Buka lagi
        </button>
        <span className="-mt-1.5 text-center text-[13px] text-teks-redup">
          {akhirJadwal !== null
            ? `Sesi baru: berakhir ${jamWIB(akhirJadwal)} (akhir jadwal), bisa diperpanjang sampai 8 jam`
            : 'Sesi baru: berakhir 4 jam lagi, bisa diperpanjang sampai 8 jam'}
        </span>
        <button
          type="button"
          onClick={() => jalankan('tandai_akhir_dilihat', { p_lapak: lapak.id })}
          disabled={sibuk}
          className="h-12 rounded-[24px] bg-kartu text-[15px] font-bold text-tinta disabled:opacity-50"
        >
          Oke, sudah pulang
        </button>
      </main>
    )
  }

  // ---------- Tutup (V3 beberapa tempat, V14 satu tempat) ----------
  // A5: banner saat pelanggan melihat Biasanya buka, artinya sesi jadwal sudah mulai dan lapak belum buka.
  // Jam diambil dari jadwal sendiri. Tidak bisa ditutup; hilang setelah Mulai buka atau setelah jadwal lewat.
  const awalJadwal = publik?.status === 'biasanya_buka' ? awalJadwalBerjalan(jadwal, sekarang) : null
  const perkiraan =
    jadwal.length === 0
      ? 'Tanpa jadwal: berakhir otomatis 4 jam setelah mulai, bisa diperpanjang sampai 8 jam'
      : akhirJadwal !== null
        ? `Berakhir otomatis ${jamWIB(akhirJadwal)} (akhir jadwal), bisa diperpanjang sampai 8 jam`
        : 'Di luar jadwal: berakhir otomatis 4 jam setelah mulai, bisa diperpanjang sampai 8 jam'
  const teksPelanggan = [publik ? `Pelanggan melihat: ${LABEL_PUBLIK[publik.status] ?? 'Tutup'}` : null, teksJadwalHariIni(jadwal, sekarang)]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
      {kepala}
      {bannerSinyal}
      {bannerAntrean}
      <div className="flex flex-col gap-1.5 rounded-[24px] bg-kartu p-5">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-teks-redup">
          <span className="size-2.5 rounded-full shadow-[inset_0_0_0_2px_#8A93A1]" />
          Status sekarang
        </span>
        <span className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em]">Tutup</span>
        {/* Ubah jadwal (V44) belum ada */}
        <span className="text-[13px] leading-[1.45] text-teks-redup">{teksPelanggan}</span>
      </div>

      {tempat.length > 1 ? (
        <>
          <span className="mt-1 text-base font-bold">Buka di mana hari ini?</span>
          {/* A2: pilihan bawaan = tempat yang terakhir dipakai (urutan pertama). + Tempat baru (V43) belum ada. */}
          <div className="flex flex-col gap-2">
            {tempat.map((t) => {
              const dipilih = t.id === tempatDipilih
              return (
                <label
                  key={t.id}
                  className={`flex min-h-14 items-center gap-3 rounded-[18px] px-4 text-base ${
                    dipilih ? 'bg-brand-muda font-bold shadow-[inset_0_0_0_2px_#1F5FE6]' : 'bg-kartu font-medium'
                  }`}
                >
                  <input
                    type="radio"
                    name="tempat"
                    checked={dipilih}
                    onChange={() => setPilihan(t.id)}
                    className="size-[22px] shrink-0 accent-brand"
                  />
                  {t.nama}
                </label>
              )
            })}
          </div>
        </>
      ) : (
        tempat.length === 1 && (
          // V14: satu tempat langsung dipakai (A2). Ganti belum ada karena Tempat baru (V43) belum dibuat.
          <div className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[18px] bg-kartu px-4">
            <span className="text-[13px] text-teks-redup">Buka di</span>
            <span className="text-base font-bold">{tempat[0].nama}</span>
          </div>
        )
      )}

      {awalJadwal !== null && (
        <div role="status" className="mt-auto rounded-[18px] bg-brand-muda px-4 py-3.5 text-[15px] font-semibold leading-[1.4] text-tinta">
          Biasanya kamu sudah buka jam {jamWIB(awalJadwal)}. Lupa mulai buka?
        </div>
      )}
      <button
        type="button"
        onClick={mulaiBuka}
        disabled={sibuk || antrean !== null}
        className={`${awalJadwal !== null ? '' : 'mt-auto '}h-16 rounded-[32px] bg-brand text-[20px] font-extrabold tracking-[-0.01em] text-white active:bg-brand-tekan disabled:opacity-50`}
      >
        {sibuk ? 'Memulai…' : 'Mulai buka'}
      </button>
      <span className="-mt-1.5 text-center text-[13px] text-teks-redup">{perkiraan}</span>
    </main>
  )
}
