import { Link } from 'react-router-dom'
import { inisialLapak } from '../lib/pengarah'
import { jamWIB, tanggalTahunWIB } from '../lib/waktu'

// Email pemberitahuan ke pemilik (A47, A48) dikerjakan di S5.4 bagian 3b, setelah layanan email dan alamat
// admin diputuskan. Selama belum ada, layar tidak boleh menjanjikan email yang tidak pernah dikirim.
// TODO(S5.4 bagian 3b): ubah menjadi true saat email Sembunyikan dan Tampilkan lagi sudah terkirim.
const EMAIL_PEMBERITAHUAN_AKTIF = false

type Props = {
  lapak: { nama: string; foto_url: string | null }
  pada: string | null
  alasan: string | null
}

// V17: lapak milik pemilik sedang disembunyikan karena laporan (A9, A47). Mulai buka nonaktif; database juga
// menolaknya (mulai_buka, 016). Alasan dan waktu dari pemilik_info_disembunyikan (024): tidak memuat data pelapor.
export function LapakDisembunyikan({ lapak, pada, alasan }: Props) {
  const waktu = pada ? new Date(pada) : null
  const adaRincian = alasan !== null || waktu !== null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
      <div className="flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-extrabold text-white">
            {lapak.foto_url ? <img src={lapak.foto_url} alt="" className="size-full object-cover" /> : inisialLapak(lapak.nama)}
          </div>
          <span className="truncate text-lg font-bold">{lapak.nama}</span>
        </div>
        {/* Profil menuju Profil lapak (V16), sama dengan beranda pemilik */}
        <Link to="/lapakku/profil" className="flex h-10 shrink-0 items-center rounded-full bg-kartu px-4 text-sm font-semibold text-tinta">
          Profil
        </Link>
      </div>

      <div role="alert" className="flex flex-col gap-3 rounded-[24px] bg-[#FDECEA] p-5">
        <span className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[#7A1A12]">Lapakmu sedang disembunyikan</span>
        <span className="text-[15px] leading-normal text-[#4A2A26]">
          Ada laporan dari pelanggan, jadi untuk sementara lapak dan statusmu tidak terlihat oleh pelanggan.
        </span>

        {adaRincian && (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-3.5 py-3">
            {alasan !== null && (
              <>
                <span className="text-xs font-semibold text-teks-redup">Alasan laporan</span>
                <span className="text-base font-bold">{alasan}</span>
              </>
            )}
            {waktu && (
              <span className="text-xs text-teks-redup">
                Disembunyikan {tanggalTahunWIB(waktu)}, {jamWIB(waktu)}
              </span>
            )}
          </div>
        )}

        <span className="text-[13px] leading-normal text-[#4A2A26]">
          {EMAIL_PEMBERITAHUAN_AKTIF
            ? 'Merasa keliru atau sudah memperbaikinya? Balas email pemberitahuan yang kami kirim. Biasanya ditanggapi dalam 1×24 jam.'
            : 'Merasa keliru atau sudah memperbaikinya? Cara mengajukan banding akan tersedia di sini sebentar lagi.'}
        </span>

        <Link to="/lapakku/profil" className="flex h-12 items-center justify-center rounded-3xl bg-white text-[15px] font-semibold text-tinta">
          Periksa profil dan tempat
        </Link>
      </div>

      <button
        type="button"
        disabled
        aria-describedby="alasan-mulai-buka"
        className="mt-auto h-16 rounded-[32px] bg-[#EEF0F4] text-xl font-extrabold text-tutup"
      >
        Mulai buka
      </button>
      <span id="alasan-mulai-buka" className="-mt-1.5 text-center text-[13px] text-teks-redup">
        {EMAIL_PEMBERITAHUAN_AKTIF
          ? 'Aktif lagi setelah lapakmu ditampilkan kembali. Kabar juga dikirim ke email.'
          : 'Aktif lagi setelah lapakmu ditampilkan kembali.'}
      </span>
    </main>
  )
}
