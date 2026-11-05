import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type JenisPesan = 'info' | 'netral' | 'berhasil' | 'habis' | 'merah'

// Warna per jenis persis dari V33: latar, garis tepi, teks, dan warna tombol
const warna: Record<JenisPesan, { kotak: string; tombol: string }> = {
  info: { kotak: 'bg-brand-muda text-[#12306E] shadow-[inset_0_0_0_1.5px_#C9DAFB]', tombol: 'text-brand-tekan' },
  netral: { kotak: 'bg-[#EEF0F4] text-tinta shadow-[inset_0_0_0_1.5px_#D5DAE2]', tombol: 'text-tinta' },
  berhasil: { kotak: 'bg-[#E4F5EC] text-[#0B5E3D] shadow-[inset_0_0_0_1.5px_#BFE6D1]', tombol: 'text-[#0E7A4F]' },
  habis: { kotak: 'bg-[#FDEEDF] text-[#7A3A08] shadow-[inset_0_0_0_1.5px_#F5C79B]', tombol: 'text-[#A8500C]' },
  merah: { kotak: 'bg-[#FDECEA] text-[#7A1A12] shadow-[inset_0_0_0_1.5px_#F5C2BC]', tombol: 'text-merah' },
}

// batalkan: tombol Batalkan (A3). aksi: tombol lain, misalnya Lihat setelah mengikuti (A41). Satu tombol per pesan.
type Pesan = { teks: string; jenis: JenisPesan; batalkan?: () => void; aksi?: { label: string; jalankan: () => void } }
type Konteks = { tampilkan: (p: Pesan) => void }

const KonteksPesan = createContext<Konteks | null>(null)

// Satu pesan dalam satu waktu, hilang otomatis setelah 5 detik (V33, A3).
// Posisi 176 px dari bawah (120 px ditambah tinggi pesan 56 px) supaya tidak menutupi tombol utama di bawah layar.
export function PenyediaPesan({ children }: { children: ReactNode }) {
  const [aktif, setAktif] = useState<Pesan | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const tutup = useCallback(() => {
    window.clearTimeout(timer.current)
    setAktif(null)
  }, [])

  const tampilkan = useCallback((p: Pesan) => {
    window.clearTimeout(timer.current)
    setAktif(p)
    timer.current = window.setTimeout(() => setAktif(null), 5000)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <KonteksPesan.Provider value={{ tampilkan }}>
      {children}
      {aktif && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-4 bottom-[176px] z-50 mx-auto flex min-h-14 max-w-[358px] items-center justify-between gap-2.5 rounded-[18px] pl-[18px] pr-2 ${warna[aktif.jenis].kotak}`}
        >
          <span className="py-2.5 text-sm font-semibold leading-[1.35]">{aktif.teks}</span>
          {(aktif.batalkan || aktif.aksi) && (
            <button
              type="button"
              onClick={() => {
                if (aktif.batalkan) aktif.batalkan()
                else aktif.aksi?.jalankan()
                tutup()
              }}
              className={`h-10 shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 text-[13px] font-bold ${warna[aktif.jenis].tombol}`}
            >
              {aktif.batalkan ? 'Batalkan' : aktif.aksi?.label}
            </button>
          )}
        </div>
      )}
    </KonteksPesan.Provider>
  )
}

export function usePesan() {
  const k = useContext(KonteksPesan)
  if (!k) throw new Error('usePesan harus dipakai di dalam PenyediaPesan')
  return k
}
