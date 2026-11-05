export type StatusTampil = 'buka' | 'habis' | 'biasanya' | 'tutup'

const tampilan: Record<StatusTampil, { label: string; kelas: string; titik: string }> = {
  buka: { label: 'Lagi buka', kelas: 'bg-[#E4F5EC] text-[#0E7A4F]', titik: 'bg-buka' },
  habis: { label: 'Habis', kelas: 'bg-[#FDEEDF] text-[#A8500C]', titik: 'bg-habis' },
  biasanya: { label: 'Biasanya buka', kelas: 'bg-[#EEF0F4] text-teks-redup', titik: 'border-2 border-dashed border-tutup bg-transparent' },
  tutup: { label: 'Tutup', kelas: 'bg-[#EEF0F4] text-teks-redup', titik: 'border-2 border-tutup bg-transparent' },
}

// Chip status: label dan warna tetap sama di semua layar (PRD bagian 3, V0).
export function ChipStatus({ status }: { status: StatusTampil }) {
  const t = tampilan[status]
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-xs font-bold ${t.kelas}`}>
      <span className={`size-2 rounded-full ${t.titik}`} />
      {t.label}
    </span>
  )
}
