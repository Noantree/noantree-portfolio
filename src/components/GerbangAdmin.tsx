import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStatusAdmin } from '../lib/admin'

// Hanya akun dengan profil.is_admin = true yang bisa membuka /admin (PRD bagian 10).
// Tamu dan akun lain diarahkan ke beranda. Fungsi admin di database tetap menolak siapa pun yang bukan admin.
export function GerbangAdmin({ children }: { children: ReactNode }) {
  const { status, ulangi } = useStatusAdmin()

  if (status === 'bukan') return <Navigate to="/" replace />
  if (status === 'admin') return <>{children}</>

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-3 bg-white px-4 pt-6">
      {status === 'memuat' ? (
        <span role="status" className="text-[13px] text-teks-redup">
          Memuat…
        </span>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
          <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
            Akun belum bisa diperiksa. Periksa sinyal, lalu coba lagi.
          </span>
          <button type="button" onClick={ulangi} className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan">
            Coba lagi
          </button>
        </div>
      )}
    </main>
  )
}
