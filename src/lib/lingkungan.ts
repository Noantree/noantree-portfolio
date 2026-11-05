// Nilai per lingkungan untuk aplikasi, dari variabel build (diisi di Cloudflare per Worker, atau di .env.local).
// Produksi tidak perlu mengisi apa pun: VITE_SITUS_URL kosong = https://noantree.id, VITE_LINGKUNGAN kosong = produksi.
import { JUDUL_SITUS, bacaLingkungan, bacaSitusUrl, tampilkanAlamat } from './situs'

// Alamat situs untuk link lapak yang dibagikan, QR gerobak, dan link ajak daftar
export const SITUS_URL = bacaSitusUrl(import.meta.env.VITE_SITUS_URL)

// Alamat tanpa skema untuk ditampilkan, misalnya "noantree.id"
export const SITUS_TAMPIL = tampilkanAlamat(SITUS_URL)

// true hanya di build staging. Dipakai untuk penanda STAGING; tidak mengubah aturan bisnis apa pun.
export const STAGING = bacaLingkungan(import.meta.env.VITE_LINGKUNGAN) === 'staging'

// Judul tab peramban. Di staging diawali [STAGING] supaya tidak tertukar dengan produksi.
export const judulTab = (judul: string = JUDUL_SITUS) => (STAGING ? `[STAGING] ${judul}` : judul)
