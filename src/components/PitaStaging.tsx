import { STAGING } from '../lib/lingkungan'

// Penanda staging: pita tipis di atas setiap layar, hanya di build staging (VITE_LINGKUNGAN=staging).
// Alat kerja supaya staging tidak tertukar dengan produksi; tidak pernah tampil di noantree.id dan tidak bisa ditutup.
export function PitaStaging() {
  if (!STAGING) return null
  return (
    <div
      role="note"
      className="w-full bg-habis px-4 py-1 text-center text-[12px] font-bold leading-4 tracking-wide text-tinta"
    >
      STAGING · data uji, bukan noantree.id
    </div>
  )
}
