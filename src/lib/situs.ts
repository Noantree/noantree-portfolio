// Alamat situs noantree per lingkungan (produksi atau staging). Berkas ini sengaja tidak membaca import.meta.env,
// karena juga dipakai vite.config.ts (Node) dan Worker (worker/), yang tidak punya import.meta.env.
// Aplikasi membaca nilainya lewat src/lib/lingkungan.ts; vite.config.ts lewat loadEnv; Worker lewat supabase-publik.json.
// Login (redirect Google dan link email) tetap memakai alamat yang sedang dibuka, supaya uji di localhost tetap jalan.

// Alamat produksi. Dipakai bila VITE_SITUS_URL kosong, jadi build produksi tidak perlu variabel baru.
export const SITUS_PRODUKSI = 'https://noantree.id'
export const HOST_PRODUKSI = new URL(SITUS_PRODUKSI).host

// Alamat situs dari variabel build VITE_SITUS_URL, misalnya https://staging.noantree.id.
// Kosong = produksi. Bentuk lain (garis miring di akhir, ada path, bukan https) ditolak supaya build gagal dengan jelas,
// bukan diam-diam membuat link yang salah.
export function bacaSitusUrl(nilai: string | undefined): string {
  const v = (nilai ?? '').trim()
  if (!v) return SITUS_PRODUKSI
  if (/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) || /^http:\/\/localhost(:\d{2,5})?$/.test(v)) return v
  throw new Error(
    `VITE_SITUS_URL tidak valid: "${v}". Contoh benar: https://staging.noantree.id (huruf kecil, https, tanpa garis miring di akhir).`,
  )
}

// Lingkungan dari variabel build VITE_LINGKUNGAN: kosong atau "produksi" = produksi, "staging" = staging.
export type Lingkungan = 'produksi' | 'staging'
export function bacaLingkungan(nilai: string | undefined): Lingkungan {
  const v = (nilai ?? '').trim()
  if (!v || v === 'produksi') return 'produksi'
  if (v === 'staging') return 'staging'
  throw new Error(`VITE_LINGKUNGAN tidak valid: "${v}". Isi "staging" untuk staging, atau kosongkan untuk produksi.`)
}

// Alamat tanpa skema untuk ditampilkan, misalnya "noantree.id"
export const tampilkanAlamat = (url: string) => url.replace(/^https?:\/\//, '')

// Judul tab peramban dan judul pratinjau link (index.html memakai "noantree" sebagai judul umum)
export const JUDUL_SITUS = 'noantree'
export const judulLapak = (nama: string) => `${nama} · ${JUDUL_SITUS}`

// Deskripsi umum pratinjau link, sama dengan og:description di index.html
export const DESKRIPSI_SITUS = 'Lihat pedagang keliling yang sedang buka, di mana, dan sampai jam berapa. Tanpa instal aplikasi.'
