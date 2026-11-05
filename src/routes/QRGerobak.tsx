import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KartuQR } from '../components/KartuQR'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { linkLapak, muatLapakBagikan, type LapakBagikan } from '../lib/bagikan'
import { gambarKartu } from '../lib/gambarKartu'

// Simpan gambar dan Cetak (A6) baru aktif setelah domain noantree final: QR yang sudah ditempel di gerobak
// akan mati kalau alamatnya berganti. QR di layar tetap bisa ditunjukkan (keputusan S3.4).
const ALAMAT_FINAL = true

type Keadaan = { jenis: 'memuat' } | { jenis: 'gagal' } | { jenis: 'disembunyikan' } | { jenis: 'siap'; lapak: LapakBagikan }

// QR untuk gerobak (V26, A49): kartu siap cetak, Simpan gambar, Cetak (A6). Rute /lapakku/qr.
export default function QRGerobak() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'memuat' })
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    if (!uid) return
    setKeadaan({ jenis: 'memuat' })
    try {
      const { data: lapak, error } = await supabase
        .from('lapak')
        .select('id, status_tayang, langkah_daftar')
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
      const publik = await muatLapakBagikan(lapak.id)
      setKeadaan(publik ? { jenis: 'siap', lapak: publik } : { jenis: 'disembunyikan' })
    } catch {
      setKeadaan({ jenis: 'gagal' })
    }
  }, [uid, navigate])

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    muat()
  }, [memuat, uid, navigate, muat])

  if (memuat || !sesi) return null

  const kepala = (
    <div className="flex h-16 items-center gap-3">
      <Link to="/lapakku" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full bg-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="text-[20px] font-bold">QR untuk gerobak</h1>
    </div>
  )

  if (keadaan.jenis !== 'siap') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 bg-kartu px-4 pb-6">
        {kepala}
        {keadaan.jenis === 'memuat' && <p className="py-6 text-center text-[15px] text-teks-redup">Memuat…</p>}
        {keadaan.jenis === 'disembunyikan' && (
          <p className="text-[15px] leading-normal text-[#3D4A5F]">Lapakmu sedang disembunyikan, jadi link belum bisa dibagikan.</p>
        )}
        {keadaan.jenis === 'gagal' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-center text-[15px] text-teks-redup">QR lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.</p>
            <button type="button" onClick={muat} className="h-12 rounded-full bg-brand-muda px-6 text-[15px] font-bold text-brand-tekan">
              Coba lagi
            </button>
          </div>
        )}
      </main>
    )
  }

  const { lapak } = keadaan
  const link = linkLapak(lapak.slug)

  // Simpan ke Galeri lewat menu bagikan HP kalau bisa berbagi file; kalau tidak, unduh
  const simpanGambar = async () => {
    setSibuk(true)
    try {
      const blob = await gambarKartu(lapak, link)
      const file = new File([blob], `qr-${lapak.slug}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch {
          // Menu bagikan ditutup tanpa memilih
        }
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch {
      tampilkan({ teks: 'Gambar QR belum bisa dibuat. Coba lagi.', jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 bg-kartu px-4 pb-6">
      {kepala}
      {/* kartu-cetak: hanya bagian ini yang tercetak, ukuran A6 (index.css) */}
      <KartuQR nama={lapak.nama} linkUrl={link.url} linkTampil={link.tampil} />
      <span className="text-center text-[13px] leading-normal text-teks-redup">
        Tempel di gerobak atau meja. Pelanggan yang scan langsung masuk ke halaman lapakmu, lalu bisa mengikuti.
      </span>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={simpanGambar}
          disabled={!ALAMAT_FINAL || sibuk}
          className="h-14 rounded-[28px] bg-brand text-[15px] font-bold text-white disabled:opacity-50"
        >
          Simpan gambar
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ALAMAT_FINAL}
          className="h-14 rounded-[28px] bg-white text-[15px] font-bold text-tinta disabled:opacity-50"
        >
          Cetak (A6)
        </button>
      </div>
      {!ALAMAT_FINAL && (
        <span className="-mt-1 text-center text-[13px] leading-normal text-teks-redup">
          Simpan gambar dan Cetak bisa dipakai setelah alamat noantree final. Sekarang tunjukkan QR ini langsung dari HP.
        </span>
      )}
    </main>
  )
}
