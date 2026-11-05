import { Link } from 'react-router-dom'
import { TombolAjak } from './TombolAjak'
import { labelWilayah, labelWilayahLengkap, wilayahLebihLuas, type PilihanWilayah } from '../lib/wilayah'
import { teksBukaBerikutnya } from '../lib/waktu'
import type { RingkasWilayah } from '../lib/beranda'

// Beranda saat wilayah aktif tidak punya lapak yang Lagi buka atau Biasanya buka (A24):
// tanpa lapak sama sekali → V53; ada lapak tapi semuanya Tutup → V20, dengan jadwal buka berikutnya.
// Tombol wilayah lebih luas tidak tampil di tingkat provinsi.
export function KosongWilayah({
  wilayah,
  ringkas,
  sekarang,
  onPilih,
}: {
  wilayah: PilihanWilayah
  ringkas: RingkasWilayah
  sekarang: number
  onPilih: (w: PilihanWilayah) => void
}) {
  const luas = wilayahLebihLuas(wilayah)
  const nama = labelWilayahLengkap(wilayah)

  if (ringkas.jumlah > 0) {
    // "besok 06.00" → "besok pukul 06.00"
    const kapan = ringkas.bukaBerikutnya
      ? teksBukaBerikutnya(new Date(ringkas.bukaBerikutnya).getTime(), sekarang).replace(/ (\d\d\.\d\d)$/, ' pukul $1')
      : null
    return (
      <div className="mx-4 mt-4 flex flex-col items-start gap-2.5 rounded-3xl bg-kartu px-5 py-6">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]">Belum ada yang buka di {nama}</h2>
        <p className="text-sm leading-normal text-[#3D4A5F]">
          {kapan
            ? `${ringkas.jumlah} lapak di sini biasanya mulai buka ${kapan}. Ikuti supaya tahu saat mereka buka.`
            : `${ringkas.jumlah} lapak di sini belum punya jadwal tetap. Ikuti supaya tahu saat mereka buka.`}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {luas && (
            <button
              type="button"
              onClick={() => onPilih(luas)}
              className="h-11 rounded-full bg-brand px-[18px] text-sm font-bold text-white"
            >
              Lihat seluruh {labelWilayahLengkap(luas)}
            </button>
          )}
          <TombolAjak className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5 px-4 pb-6 pt-2">
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-3 py-8 text-center">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <h2 className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em]">Belum ada lapak di {nama}</h2>
        <p className="text-[15px] leading-normal text-[#3D4A5F]">
          Lapak di sini belum terdaftar di noantree. Coba wilayah yang lebih luas, atau ajak lapak langgananmu bergabung.
        </p>
      </div>
      {luas && (
        <button
          type="button"
          onClick={() => onPilih(luas)}
          className="flex h-14 items-center justify-center rounded-full bg-brand text-base font-bold text-white"
        >
          Lihat seluruh {labelWilayahLengkap(luas)}
        </button>
      )}
      <TombolAjak className="flex h-[52px] w-full items-center justify-center rounded-full bg-brand-muda text-[15px] font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]" />
      <Link to="/daftar" className="flex min-h-11 items-center justify-center gap-1.5 text-[15px]">
        <span className="text-teks-redup">Punya lapak di {labelWilayah(wilayah)}?</span>
        <span className="font-bold text-brand-tekan">Daftar gratis ›</span>
      </Link>
    </div>
  )
}
