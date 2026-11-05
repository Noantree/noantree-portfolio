import { PilihanMasuk } from '../components/PilihanMasuk'
import { inisialLapak, samarkanEmail, type TandaPemilik } from '../lib/pengarah'

// Masuk lagi ke lapakmu (V52): sesi habis di HP yang pernah dipakai pemilik (A27).
// Tidak punya rute sendiri supaya tidak memakan nama slug (A36); ditampilkan oleh Pengarah.
export default function MasukLagi({ tanda, onLewati }: { tanda: TandaPemilik; onLewati: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
      <div className="h-8" />
      <img src="/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-2xl" />
      <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Masuk lagi ke lapakmu</h1>
      <p className="-mt-1 text-base leading-normal text-[#3D4A5F]">
        Sesi di HP ini sudah berakhir. Masuk dengan akun yang sama untuk lanjut mulai buka.
      </p>

      <div className="flex items-center gap-3 rounded-[20px] bg-kartu px-4 py-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[15px] font-extrabold text-white">
          {tanda.fotoUrl ? <img src={tanda.fotoUrl} alt="" className="size-full object-cover" /> : inisialLapak(tanda.namaLapak)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-bold">{tanda.namaLapak}</span>
          <span className="truncate text-[13px] text-teks-redup">Terakhir masuk dengan {samarkanEmail(tanda.email)}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <PilihanMasuk />
        <button type="button" onClick={onLewati} className="flex min-h-11 items-center justify-center text-sm text-teks-redup">
          Lihat lapak lain tanpa masuk
        </button>
      </div>
    </main>
  )
}
