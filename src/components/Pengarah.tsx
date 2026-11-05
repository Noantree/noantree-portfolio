import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSesi } from '../lib/sesi'
import {
  ambilTujuan,
  bacaTandaPemilik,
  muatLapakSaya,
  rutePengarah,
  simpanTandaPemilik,
  type TandaPemilik,
  type Tujuan,
} from '../lib/pengarah'
import MasukLagi from '../routes/MasukLagi'

// True jika halaman ini hanya dimuat ulang (refresh atau tarik ke bawah), bukan dibuka dari awal.
function halamanDimuatUlang(): boolean {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

// Mengarahkan pengguna saat aplikasi dibuka (A27) dan setelah masuk (A26).
// Memuat ulang beranda tidak dibelokkan (A27 diperbarui).
// Link langsung ke halaman lain (misal /:slug) tidak dibelokkan kecuali baru saja masuk.
export function Pengarah({ children }: { children: ReactNode }) {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mengarahkan, setMengarahkan] = useState(true)
  const [masukLagi, setMasukLagi] = useState<TandaPemilik | null>(null)
  // undefined = belum pernah diproses; dipakai juga agar StrictMode tidak memproses dua kali
  const terakhir = useRef<string | null | undefined>(undefined)

  const userId = sesi?.user.id ?? null
  const email = sesi?.user.email ?? ''

  useEffect(() => {
    if (memuat || terakhir.current === userId) return
    const bukaAplikasi = terakhir.current === undefined
    terakhir.current = userId

    if (!userId) {
      // Tujuan yang tersisa dari masuk yang dibatalkan tidak boleh terbawa ke masuk berikutnya
      ambilTujuan()
      const tanda = bacaTandaPemilik()
      if (bukaAplikasi && pathname === '/' && tanda) setMasukLagi(tanda)
      setMengarahkan(false)
      return
    }

    setMasukLagi(null)
    const tujuan: Tujuan | null = ambilTujuan()
    const arahkan = tujuan !== null || (bukaAplikasi && pathname === '/' && !halamanDimuatUlang())
    if (!arahkan) setMengarahkan(false)

    muatLapakSaya(userId)
      .then((lapak) => {
        if (lapak && lapak.status_tayang !== 'draf') {
          simpanTandaPemilik({ namaLapak: lapak.nama, fotoUrl: lapak.foto_url, email })
        }
        if (!arahkan) return
        const rute = rutePengarah(tujuan, lapak)
        // Aksi tertunda (ikuti) diteruskan ke halaman kembaliKe, yang menjalankannya sekali (A26)
        const state = tujuan?.asal === 'aksi' ? { aksiTertunda: tujuan } : undefined
        if (rute !== pathname || state) navigate(rute, { replace: true, state })
      })
      .catch(() => {
        // Gagal membaca lapak: tetap di halaman sekarang, jangan menebak tujuan
      })
      .finally(() => setMengarahkan(false))
    // pathname sengaja tidak jadi pemicu: pengarah hanya bereaksi saat aplikasi dibuka atau akun berganti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memuat, userId])

  if (memuat || mengarahkan) return null
  if (masukLagi) return <MasukLagi tanda={masukLagi} onLewati={() => setMasukLagi(null)} />
  return <>{children}</>
}
