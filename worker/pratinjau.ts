// Pratinjau link halaman lapak (S6.2): judul, deskripsi, dan alamat lapak disisipkan ke index.html sebelum dikirim,
// supaya WhatsApp dan media sosial (yang tidak menjalankan JavaScript) membaca tag milik lapak itu.
// Fungsi murni tanpa API Cloudflare, diuji dengan scripts/uji-pratinjau.mjs.
import { DESKRIPSI_SITUS, SITUS_PRODUKSI, judulLapak } from '../src/lib/situs.ts'

// Nama rute aplikasi tidak pernah jadi slug (A36). "assets" adalah folder hasil build.
const RUTE_APLIKASI = new Set(['daftar', 'cari', 'lapakku', 'akun', 'diikuti', 'admin', 'komponen', 'assets'])

// Slug dari alamat satu tingkat seperti "/bakso-pak-slamet" (A36: huruf kecil, angka, tanda hubung).
// Alamat lain (beranda, rute aplikasi, berkas) mengembalikan null.
export function slugDariAlamat(pathname: string): string | null {
  const cocok = /^\/([A-Za-z0-9-]+)\/?$/.exec(pathname)
  if (!cocok) return null
  const slug = cocok[1].toLowerCase()
  return RUTE_APLIKASI.has(slug) ? null : slug
}

export type DataPratinjau = { slug: string; nama: string; deskripsi: string | null }

const PANJANG_DESKRIPSI = 200

function amankan(teks: string) {
  return teks.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function ringkas(teks: string) {
  const satuBaris = teks.replace(/\s+/g, ' ').trim()
  return satuBaris.length > PANJANG_DESKRIPSI ? `${satuBaris.slice(0, PANJANG_DESKRIPSI - 1).trimEnd()}…` : satuBaris
}

// Mengganti isi tag yang sudah ada di index.html. Tag yang tidak ditemukan dibiarkan (tidak ditambah).
// situsUrl = alamat situs lingkungan ini (produksi atau staging), dari supabase-publik.json.
export function sisipkanPratinjau(html: string, lapak: DataPratinjau, situsUrl: string = SITUS_PRODUKSI): string {
  const judul = amankan(judulLapak(lapak.nama.trim()))
  const deskripsi = amankan(lapak.deskripsi?.trim() ? ringkas(lapak.deskripsi) : DESKRIPSI_SITUS)
  const url = amankan(`${situsUrl}/${lapak.slug}`)
  const isiMeta = (atribut: 'property' | 'name', kunci: string, nilai: string) => (h: string) =>
    h.replace(new RegExp(`(<meta\\s+${atribut}="${kunci}"\\s+content=")[^"]*(")`), (_, a: string, b: string) => a + nilai + b)
  const langkah = [
    (h: string) => h.replace(/<title>[^<]*<\/title>/, () => `<title>${judul}</title>`),
    isiMeta('name', 'description', deskripsi),
    isiMeta('property', 'og:title', judul),
    isiMeta('property', 'og:description', deskripsi),
    isiMeta('property', 'og:url', url),
    isiMeta('name', 'twitter:title', judul),
    isiMeta('name', 'twitter:description', deskripsi),
  ]
  return langkah.reduce((h, f) => f(h), html)
}
