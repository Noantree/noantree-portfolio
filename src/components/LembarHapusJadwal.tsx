import { useState } from 'react'
import { LembarBawah } from './LembarBawah'
import { supabase } from '../lib/supabase'

// Konfirmasi Hapus jadwal (V44, A35). Tidak ada di desain V44; bentuknya sama dengan konfirmasi hapus tempat (V31).
// Galat dari hapus_jadwal_saya (028) ditampilkan apa adanya di lembar ini. Saat menghapus lembar terkunci.
export function LembarHapusJadwal({ lapakId, onTutup, onSelesai }: { lapakId: string; onTutup: () => void; onSelesai: () => void }) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const hapus = async () => {
    if (sibuk) return
    setSibuk(true)
    setGalat(null)
    const { error } = await supabase.rpc('hapus_jadwal_saya', { p_lapak: lapakId })
    if (error) {
      setGalat(error.message || 'Jadwal belum terhapus. Periksa sinyal, lalu coba lagi.')
      setSibuk(false)
      return
    }
    onSelesai()
  }

  return (
    <LembarBawah terbuka onTutup={sibuk ? () => {} : onTutup} label="Hapus jadwal">
      <span className="mt-1 text-2xl font-extrabold leading-[1.15] tracking-[-0.02em]">Hapus jadwal?</span>
      <span className="text-[15px] leading-normal text-[#3D4A5F]">
        Lapakmu tidak punya jadwal tetap lagi. Status buka tetap bisa diatur manual.
      </span>

      {galat && (
        <p role="alert" className="text-sm text-merah">
          {galat}
        </p>
      )}

      <button
        type="button"
        onClick={hapus}
        disabled={sibuk}
        className="h-[54px] rounded-full bg-merah text-base font-bold text-white disabled:bg-[#F3C9C4]"
      >
        {sibuk ? 'Menghapus…' : 'Hapus jadwal'}
      </button>
      <button type="button" onClick={onTutup} disabled={sibuk} className="h-12 rounded-full bg-kartu text-[15px] font-bold text-tinta disabled:opacity-60">
        Batal
      </button>
    </LembarBawah>
  )
}
