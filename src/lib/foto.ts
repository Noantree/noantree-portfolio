// Mengecilkan foto di HP sebelum diunggah (A40): sisi terpanjang maks. `sisi` px, JPEG,
// kualitas diturunkan bertahap sampai ukuran di bawah `batasByte`.
export async function kecilkanFoto(file: File, sisi = 512, batasByte = 500 * 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const skala = Math.min(1, sisi / Math.max(bitmap.width, bitmap.height))
  const lebar = Math.round(bitmap.width * skala)
  const tinggi = Math.round(bitmap.height * skala)

  const kanvas = document.createElement('canvas')
  kanvas.width = lebar
  kanvas.height = tinggi
  const ctx = kanvas.getContext('2d')
  if (!ctx) throw new Error('Peramban tidak mendukung pengolahan gambar')
  ctx.drawImage(bitmap, 0, 0, lebar, tinggi)
  bitmap.close()

  let kualitas = 0.9
  let hasil = await keBlob(kanvas, kualitas)
  while (hasil.size > batasByte && kualitas > 0.4) {
    kualitas -= 0.1
    hasil = await keBlob(kanvas, kualitas)
  }
  if (hasil.size > batasByte) throw new Error('Foto terlalu besar, pilih foto lain')
  return hasil
}

function keBlob(kanvas: HTMLCanvasElement, kualitas: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    kanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal mengolah foto'))), 'image/jpeg', kualitas),
  )
}
