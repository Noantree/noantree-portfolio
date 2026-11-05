import { KodeQR } from './KodeQR'
import {
  BARIS_AJAKAN,
  BIRU,
  cq,
  GARIS_NAMA,
  GARIS_TEKS,
  JARAK_AJAKAN_LINK,
  JARAK_NAMA_QR,
  LEBAR,
  LEBAR_LINK,
  LEBAR_NAMA,
  LOGO_TINGGI,
  MAKS_BARIS_LINK,
  MAKS_BARIS_NAMA,
  PITA_ATAS,
  PITA_BAWAH,
  PUTIH,
  QR_UKURAN,
  TINGGI,
  TINTA,
  UKURAN_AJAKAN,
  ukuranLink,
  ukuranNama,
} from '../lib/kartuQR'

// Kartu QR gerobak (V26, A49) di layar dan di cetak A6 (kelas kartu-cetak, src/index.css).
// Tata letak dan ukuran dari src/lib/kartuQR.ts (satuan cqw: lebar kartu = 100cqw), sama dengan PNG dari gambarKartu.ts.
export function KartuQR({ nama, linkUrl, linkTampil }: { nama: string; linkUrl: string; linkTampil: string }) {
  return (
    <div
      className="kartu-cetak flex w-full flex-col overflow-hidden rounded-[28px] bg-white text-center"
      style={{ containerType: 'inline-size', aspectRatio: `${LEBAR} / ${TINGGI}` }}
    >
      <div className="flex shrink-0 items-center justify-center" style={{ height: cq(PITA_ATAS), backgroundColor: BIRU }}>
        <img src="/logo-horizontal-putih.png" alt="Noantree" className="w-auto" style={{ height: cq(LOGO_TINGGI) }} />
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center"
        style={{ gap: cq(JARAK_NAMA_QR), padding: `0 ${cq((LEBAR - LEBAR_NAMA) / 2)}` }}
      >
        <span
          className="line-clamp-6 font-extrabold"
          style={{ fontSize: cq(ukuranNama(nama)), lineHeight: GARIS_NAMA, color: TINTA, overflowWrap: 'anywhere', maxHeight: `${MAKS_BARIS_NAMA * GARIS_NAMA}em` }}
        >
          {nama}
        </span>
        <div className="shrink-0" style={{ width: cq(QR_UKURAN), height: cq(QR_UKURAN) }}>
          <KodeQR teks={linkUrl} label={`Kode QR ${nama}`} />
        </div>
      </div>
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{ height: cq(PITA_BAWAH), gap: cq(JARAK_AJAKAN_LINK), backgroundColor: BIRU, color: PUTIH }}
      >
        <span className="font-bold" style={{ fontSize: cq(UKURAN_AJAKAN), lineHeight: GARIS_TEKS }}>
          {BARIS_AJAKAN[0]}
          <br />
          {BARIS_AJAKAN[1]}
        </span>
        <span
          translate="no"
          className="line-clamp-3 select-text font-semibold"
          style={{
            fontSize: cq(ukuranLink(linkTampil)),
            lineHeight: GARIS_TEKS,
            overflowWrap: 'anywhere',
            maxWidth: cq(LEBAR_LINK),
            maxHeight: `${MAKS_BARIS_LINK * GARIS_TEKS}em`,
          }}
        >
          {linkTampil}
        </span>
      </div>
    </div>
  )
}
