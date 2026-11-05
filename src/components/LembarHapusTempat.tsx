import { useState } from 'react'
import { LembarBawah } from './LembarBawah'
import { supabase } from '../lib/supabase'

// Konfirmasi Hapus tempat ini (V31, A39). Tidak ada di desain V31; bentuknya mengikuti V32 dan V51.
// Jumlah tempat dihitung dari daftar yang sudah dimuat halaman. Satu-satunya tempat: tombol Hapus nonaktif.
// Penolakan lain (misalnya tempat sedang dipakai sesi buka yang berjalan) datang dari hapus_tempat (027)
// dan ditampilkan apa adanya di lembar ini; aplikasi tidak membaca sesi_buka untuk memeriksanya.
export function LembarHapusTempat({
  lapakId,
  tempat,
  jumlahTempat,
  onTutup,
  onSelesai,
}: {
  lapakId: string
  tempat: { id: string; nama: string }
  jumlahTempat: number
  onTutup: () => void
  onSelesai: () => void
}) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const satuSatunya = jumlahTempat <= 1

  const hapus = async () => {
    if (satuSatunya || sibuk) return
    setSibuk(true)
    setGalat(null)
    const { error } = await supabase.rpc('hapus_tempat', { p_lapak: lapakId, p_tempat: tempat.id })
    if (error) {
      setGalat(error.message || 'Tempat belum terhapus. Periksa sinyal, lalu coba lagi.')
      setSibuk(false)
      return
    }
    onSelesai()
  }

  return (
    <LembarBawah terbuka onTutup={sibuk ? () => {} : onTutup} label={satuSatunya ? 'Tidak bisa dihapus' : 'Hapus tempat ini'}>
      <span className="mt-1 text-2xl font-extrabold leading-[1.15] tracking-[-0.02em]">
        {satuSatunya ? 'Tidak bisa dihapus' : 'Hapus tempat ini?'}
      </span>
      <span className="text-[15px] leading-normal text-[#3D4A5F] [overflow-wrap:anywhere]">
        {satuSatunya
          ? 'Lapakmu harus punya minimal 1 tempat. Tambah tempat lain dulu, baru tempat ini bisa dihapus.'
          : `${tempat.nama} dihapus dari daftar tempat lapakmu. Riwayat buka sebelumnya tidak terpengaruh.`}
      </span>

      {galat && (
        <p role="alert" className="text-sm text-merah">
          {galat}
        </p>
      )}

      <button
        type="button"
        onClick={hapus}
        disabled={satuSatunya || sibuk}
        className="h-[54px] rounded-full bg-merah text-base font-bold text-white disabled:bg-[#F3C9C4]"
      >
        {sibuk ? 'Menghapus…' : 'Hapus tempat'}
      </button>
      <button type="button" onClick={onTutup} disabled={sibuk} className="h-12 rounded-full bg-kartu text-[15px] font-bold text-tinta disabled:opacity-60">
        Batal
      </button>
    </LembarBawah>
  )
}
