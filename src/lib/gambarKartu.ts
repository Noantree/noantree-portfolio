import { matriksQR, TEPI_QR, type LapakBagikan } from './bagikan'
import {
  BARIS_AJAKAN,
  BIRU,
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
} from './kartuQR'

// Pecah teks per baris menurut lebar; kata yang lebih lebar dari satu baris dipotong per huruf
function pecahBaris(g: CanvasRenderingContext2D, teks: string, lebar: number): string[] {
  const baris: string[] = []
  for (const kata of teks.trim().split(/\s+/)) {
    if (g.measureText(kata).width > lebar) {
      let sisa = ''
      for (const h of kata) {
        if (sisa && g.measureText(sisa + h).width > lebar) {
          baris.push(sisa)
          sisa = ''
        }
        sisa += h
      }
      baris.push(sisa)
      continue
    }
    const coba = baris.length ? `${baris[baris.length - 1]} ${kata}` : kata
    if (baris.length && g.measureText(coba).width <= lebar) baris[baris.length - 1] = coba
    else baris.push(kata)
  }
  return baris
}

// Batasi jumlah baris; baris terakhir diberi ... dan dipendekkan sampai muat
function batasiBaris(g: CanvasRenderingContext2D, baris: string[], maks: number, lebar: number): string[] {
  if (baris.length <= maks) return baris
  const hasil = baris.slice(0, maks)
  let akhir = hasil[maks - 1]
  while (akhir && g.measureText(`${akhir}…`).width > lebar) akhir = akhir.slice(0, -1)
  hasil[maks - 1] = `${akhir}…`
  return hasil
}

// Kartu V26 digambar ulang ke canvas di HP untuk Simpan gambar (A49). Ukuran dan tata letak dari src/lib/kartuQR.ts,
// sama dengan kartu di layar dan di cetak.
export async function gambarKartu(lapak: LapakBagikan, link: { url: string; tampil: string }): Promise<Blob> {
  const ukNama = ukuranNama(lapak.nama)
  const ukLink = ukuranLink(link.tampil)
  await document.fonts.load(`800 ${ukNama}px "Plus Jakarta Sans"`)
  await document.fonts.load(`700 ${UKURAN_AJAKAN}px "Plus Jakarta Sans"`)
  await document.fonts.load(`600 ${ukLink}px "Plus Jakarta Sans"`)
  const logo = new Image()
  logo.src = '/logo-horizontal-putih.png'
  await logo.decode()

  const canvas = document.createElement('canvas')
  canvas.width = LEBAR
  canvas.height = TINGGI
  const g = canvas.getContext('2d')!
  g.fillStyle = PUTIH
  g.fillRect(0, 0, LEBAR, TINGGI)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const huruf = (berat: number, ukuran: number) => `${berat} ${ukuran}px "Plus Jakarta Sans", system-ui, sans-serif`

  // Pita biru atas: logo putih setinggi LOGO_TINGGI dengan rasio aslinya (1024 x 222), di tengah
  g.fillStyle = BIRU
  g.fillRect(0, 0, LEBAR, PITA_ATAS)
  const lebarLogo = Math.round((LOGO_TINGGI * logo.naturalWidth) / logo.naturalHeight)
  g.drawImage(logo, (LEBAR - lebarLogo) / 2, (PITA_ATAS - LOGO_TINGGI) / 2, lebarLogo, LOGO_TINGGI)

  // Badan putih: nama lapak (dipecah per baris, dipotong dengan ... kalau lebih dari MAKS_BARIS_NAMA) lalu QR, di tengah badan
  g.font = huruf(800, ukNama)
  const barisNama = batasiBaris(g, pecahBaris(g, lapak.nama, LEBAR_NAMA), MAKS_BARIS_NAMA, LEBAR_NAMA)
  const tinggiBaris = ukNama * GARIS_NAMA
  const tinggiIsi = barisNama.length * tinggiBaris + JARAK_NAMA_QR + QR_UKURAN
  let y = PITA_ATAS + (TINGGI - PITA_ATAS - PITA_BAWAH - tinggiIsi) / 2
  g.fillStyle = TINTA
  for (const baris of barisNama) {
    g.fillText(baris, LEBAR / 2, y + tinggiBaris / 2)
    y += tinggiBaris
  }
  y += JARAK_NAMA_QR

  const m = matriksQR(link.url)
  const sisi = m.length + TEPI_QR * 2
  const modul = QR_UKURAN / sisi
  const xQR = (LEBAR - QR_UKURAN) / 2
  m.forEach((baris, r) =>
    baris.forEach((gelap, c) => {
      if (gelap) g.fillRect(xQR + (c + TEPI_QR) * modul, y + (r + TEPI_QR) * modul, Math.ceil(modul), Math.ceil(modul))
    }),
  )

  // Pita biru bawah: ajakan scan dan alamat, huruf putih
  const yBawah = TINGGI - PITA_BAWAH
  g.fillStyle = BIRU
  g.fillRect(0, yBawah, LEBAR, PITA_BAWAH)
  const tinggiAjakan = UKURAN_AJAKAN * GARIS_TEKS
  const tinggiLink = ukLink * GARIS_TEKS
  g.font = huruf(600, ukLink)
  const barisLink = batasiBaris(g, pecahBaris(g, link.tampil, LEBAR_LINK), MAKS_BARIS_LINK, LEBAR_LINK)
  const tinggiBlok = BARIS_AJAKAN.length * tinggiAjakan + JARAK_AJAKAN_LINK + barisLink.length * tinggiLink
  let yy = yBawah + (PITA_BAWAH - tinggiBlok) / 2
  g.fillStyle = PUTIH
  g.font = huruf(700, UKURAN_AJAKAN)
  for (const baris of BARIS_AJAKAN) {
    g.fillText(baris, LEBAR / 2, yy + tinggiAjakan / 2)
    yy += tinggiAjakan
  }
  yy += JARAK_AJAKAN_LINK
  g.font = huruf(600, ukLink)
  for (const baris of barisLink) {
    g.fillText(baris, LEBAR / 2, yy + tinggiLink / 2)
    yy += tinggiLink
  }

  return new Promise((selesai, gagal) => canvas.toBlob((b) => (b ? selesai(b) : gagal(new Error('Gambar gagal dibuat'))), 'image/png'))
}
