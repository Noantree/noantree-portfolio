import { Link } from 'react-router-dom'

// Pengganti sementara untuk layar yang belum dibangun, supaya pengarah (A26, A27) bisa diuji.
// Diganti oleh Beranda pemilik (Sprint 3) dan Daftar 1–3 (Sprint 2).
export default function Sementara({ judul }: { judul: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pt-6">
      <h1 className="text-[22px] font-extrabold">{judul}</h1>
      <p className="text-[15px] text-teks-redup">Layar ini sedang dibangun.</p>
      <Link to="/" className="text-sm font-bold text-brand-tekan">
        Ke beranda
      </Link>
    </main>
  )
}
