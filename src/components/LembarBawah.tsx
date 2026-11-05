import type { ReactNode } from 'react'

// Lembar yang muncul dari bawah layar, untuk masuk, pilihan, dan bagikan (PRD bagian 7, V6, V36).
export function LembarBawah({
  terbuka,
  onTutup,
  judul,
  label,
  children,
}: {
  terbuka: boolean
  onTutup: () => void
  judul?: string
  label?: string // nama dialog untuk pembaca layar jika judul digambar sendiri
  children: ReactNode
}) {
  if (!terbuka) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={onTutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul ?? label}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[92dvh] w-full max-w-[390px] overflow-y-auto rounded-t-[28px] bg-white px-4 pb-8 pt-3 shadow-[0_-4px_16px_rgba(18,22,31,.08)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D5DAE2]" />
        {judul && <h2 className="mb-3 text-lg font-bold">{judul}</h2>}
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  )
}
