// Pengurai link Google Maps (A33): modul murni tanpa jaringan, dipakai Edge Function cek-link-maps dan diuji
// dengan scripts/uji-link-maps.mjs. Hanya membaca alamat link milik pemilik lapak, bukan lokasi pelanggan (A21).

export type Titik = { lat: number; lng: number }

// Hanya https, dan hanya host Google Maps:
//   maps.app.goo.gl (semua jalur), goo.gl (jalur /maps), google.com dan www.google.com (jalur /maps),
//   maps.google.com (semua jalur; host ini khusus Google Maps, tujuan redirect dari link pendek)
export function linkDiizinkan(url: URL): boolean {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false
  const host = url.hostname.toLowerCase()
  const jalurMaps = url.pathname === '/maps' || url.pathname.startsWith('/maps/')
  if (host === 'maps.app.goo.gl') return true
  if (host === 'maps.google.com') return true
  if (host === 'goo.gl') return jalurMaps
  if (host === 'google.com' || host === 'www.google.com') return jalurMaps
  return false
}

// Teks link menjadi URL yang diizinkan, atau null
export function bacaLink(teks: unknown): URL | null {
  if (typeof teks !== 'string') return null
  const bersih = teks.trim()
  if (bersih === '' || bersih.length > 2048) return null
  try {
    const url = new URL(bersih)
    return linkDiizinkan(url) ? url : null
  } catch {
    return null
  }
}

// Titik sah di bumi dan masih di sekitar Indonesia (batas kasar lat -11..6, lng 95..141)
export function titikSah(t: Titik): boolean {
  if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return false
  if (t.lat < -90 || t.lat > 90 || t.lng < -180 || t.lng > 180) return false
  return t.lat >= -11 && t.lat <= 6 && t.lng >= 95 && t.lng <= 141
}

const ANGKA = '(-?\\d{1,3}(?:\\.\\d+)?)'
const PASANGAN = new RegExp(`^\\s*${ANGKA}\\s*,\\s*${ANGKA}\\s*$`)

function pasangan(teks: string | null): Titik | null {
  if (!teks) return null
  const m = PASANGAN.exec(teks)
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}

// Ambil titik dari URL Google Maps. Urutan: pin tempat "!3dLAT!4dLNG" (paling tepat), lalu "@lat,lng" (tengah peta),
// lalu parameter q=, query=, atau ll= berisi "lat,lng". Titik di luar rentang atau di luar Indonesia: null.
export function ambilTitik(alamat: string): Titik | null {
  let teks: string
  try {
    teks = decodeURIComponent(alamat)
  } catch {
    teks = alamat
  }
  const calon: (Titik | null)[] = []

  const pin = new RegExp(`!3d${ANGKA}!4d${ANGKA}`).exec(teks)
  if (pin) calon.push({ lat: Number(pin[1]), lng: Number(pin[2]) })

  const at = new RegExp(`@${ANGKA},${ANGKA}`).exec(teks)
  if (at) calon.push({ lat: Number(at[1]), lng: Number(at[2]) })

  try {
    const url = new URL(alamat)
    for (const kunci of ['q', 'query', 'll']) calon.push(pasangan(url.searchParams.get(kunci)))
  } catch {
    // Bukan URL utuh: hanya pola di jalur yang dipakai
  }

  for (const t of calon) if (t && titikSah(t)) return t
  return null
}
