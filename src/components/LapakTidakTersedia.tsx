import { Link } from 'react-router-dom'

// Lapak tidak tersedia (V27, A29, A47): slug tidak ada, lapak draf, disembunyikan, atau sudah ditutup.
// Sengaja tidak menyebut alasannya, supaya status moderasi lapak tidak terlihat publik.
export function LapakTidakTersedia() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 bg-white px-5 pb-7">
      <div className="flex h-16 items-center gap-2.5">
        <img src="/logo-horizontal-biru.png" alt="Noantree" className="h-8 w-auto" />
      </div>
      <div aria-hidden="true" className="mt-12 flex size-[72px] items-center justify-center rounded-full bg-kartu">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      </div>
      <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em]">Lapak ini sedang tidak tersedia</h1>
      <p className="text-base leading-[1.55] text-[#3D4A5F]">
        Mungkin pemiliknya sedang memperbarui lapak, atau lapak ini sudah tidak aktif. Coba lihat lapak lain yang lagi buka di dekatmu.
      </p>
      <Link
        to="/"
        className="mt-auto flex h-14 items-center justify-center rounded-full bg-brand text-base font-bold text-white"
      >
        Lihat lapak yang lagi buka
      </Link>
    </main>
  )
}
