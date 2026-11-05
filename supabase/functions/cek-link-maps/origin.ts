// Pemeriksa origin untuk CORS Edge Function cek-link-maps. Fungsi murni tanpa API Deno, diuji dengan
// scripts/uji-origin.mjs.
//
// Isi ALLOWED_ORIGINS (dipisah koma) boleh berupa:
//   - origin persis, misalnya https://noantree.id atau http://localhost:5173
//   - pola dengan SATU tanda * di awal nama host, khusus https, misalnya
//     https://*-noantree-staging.akun-anda.workers.dev untuk alamat pratinjau per branch di staging.
//     Tanda * hanya cocok dengan huruf kecil, angka, dan tanda hubung (tanpa titik), jadi tidak bisa dipakai untuk
//     menyelipkan host lain seperti https://jahat.com-noantree-staging...
// Pola lain (lebih dari satu *, * di tengah, tanpa https, ada path) diabaikan.

const POLA = /^https:\/\/\*([a-z0-9.-]+)$/

export function bacaDaftarOrigin(nilai: string | undefined): string[] {
  return (nilai ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function originDiizinkan(origin: string | null, daftar: string[]): origin is string {
  if (!origin) return false
  for (const entri of daftar) {
    if (!entri.includes('*')) {
      if (entri === origin) return true
      continue
    }
    const cocok = POLA.exec(entri)
    if (!cocok) continue
    const akhiran = cocok[1]
    if (!origin.startsWith('https://') || !origin.endsWith(akhiran)) continue
    const depan = origin.slice('https://'.length, origin.length - akhiran.length)
    if (/^[a-z0-9-]+$/.test(depan)) return true
  }
  return false
}
