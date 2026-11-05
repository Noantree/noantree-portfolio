import { useMemo } from 'react'
import { matriksQR, TEPI_QR } from '../lib/bagikan'

// Kode QR sebagai SVG (tajam di ukuran berapa pun), di atas latar putih dengan zona tepi 4 modul (A49)
export function KodeQR({ teks, label }: { teks: string; label: string }) {
  const { jalur, sisi } = useMemo(() => {
    const m = matriksQR(teks)
    let d = ''
    m.forEach((baris, r) =>
      baris.forEach((gelap, c) => {
        if (gelap) d += `M${c + TEPI_QR} ${r + TEPI_QR}h1v1h-1z`
      }),
    )
    return { jalur: d, sisi: m.length + TEPI_QR * 2 }
  }, [teks])

  return (
    <svg viewBox={`0 0 ${sisi} ${sisi}`} role="img" aria-label={label} shapeRendering="crispEdges" className="size-full">
      <rect width={sisi} height={sisi} fill="#FFFFFF" />
      <path d={jalur} fill="#12161F" />
    </svg>
  )
}
