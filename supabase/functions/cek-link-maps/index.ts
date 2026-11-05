// Edge Function cek-link-maps (A33): membuka link Google Maps milik pemilik lapak di server, lalu mengembalikan
// titik lat dan lng. Maks. 10 cek per pemilik per hari WIB, dihitung lewat catat_cek_link (migrasi 029).
//
// Rahasia hanya dari variabel lingkungan Supabase, tidak pernah ditulis di kode:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (disediakan Supabase otomatis)
//   ALLOWED_ORIGINS: origin aplikasi yang boleh memanggil, dipisah koma (diisi pemilik lewat `supabase secrets set`).
//   Boleh berisi pola dengan satu * di awal host untuk alamat pratinjau per branch (lihat origin.ts).
//
// Yang dikirim aplikasi hanya link Google Maps tempat jualan pemilik. Lokasi pelanggan tidak pernah sampai ke sini (A21).
// Isi halaman tidak disimpan; yang dicatat hanya baris cek_link (id pemilik dan waktu).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ambilTitik, bacaLink, linkDiizinkan } from './link.ts'
import { bacaDaftarOrigin, originDiizinkan } from './origin.ts'

const MAKS_LOMPATAN = 3
const BATAS_WAKTU_MS = 5000

// Teks V20 untuk dua keadaan yang ada di desain; teks lain untuk keadaan yang tidak ada di desain
const PESAN_BUKAN_MAPS = 'Link ini bukan dari Google Maps. Salin ulang dari tombol Bagikan di aplikasi Google Maps.'
const PESAN_BATAS_HABIS = 'Batas periksa hari ini habis (10 dari 10). Tempat tetap bisa disimpan tanpa titik; coba periksa lagi besok.'
const PESAN_TANPA_TITIK = 'Titik tidak ditemukan di link ini'
const PESAN_JARINGAN = 'Link belum bisa dicek. Periksa sinyal, lalu coba lagi.'
const PESAN_MASUK = 'Masuk dulu untuk memeriksa link.'
const ORIGIN_STAGING = 'https://staging.noantree.id'

const daftarOrigin = bacaDaftarOrigin(Deno.env.get('ALLOWED_ORIGINS'))

function kepalaCors(origin: string | null): Record<string, string> {
  if (!originDiizinkan(origin, daftarOrigin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function balas(status: number, isi: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...kepalaCors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// Ikuti redirect satu per satu (maks. 3 lompatan). Setiap tujuan harus lolos pemeriksaan host yang sama;
// redirect ke host lain tidak pernah diikuti. Satu batas waktu 5 detik untuk semua lompatan.
// Hasil: URL terakhir, { ditolak: host } kalau redirect keluar dari Google Maps (host itu disebut untuk diagnosa staging),
// atau melempar galat jaringan.
async function ikutiLink(awal: URL): Promise<URL | { ditolak: string }> {
  const sinyal = AbortSignal.timeout(BATAS_WAKTU_MS)
  let kini = awal
  for (let lompatan = 0; lompatan <= MAKS_LOMPATAN; lompatan++) {
    // Link yang sudah memuat titik tidak perlu dibuka
    if (ambilTitik(kini.href)) return kini
    if (lompatan === MAKS_LOMPATAN) return kini
    const res = await fetch(kini.href, { method: 'GET', redirect: 'manual', signal: sinyal, headers: { 'User-Agent': 'noantree-cek-link' } })
    // Isi halaman tidak dibaca dan tidak disimpan
    await res.body?.cancel()
    const tujuan = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!tujuan) return kini
    const berikut = new URL(tujuan, kini)
    if (!linkDiizinkan(berikut)) return { ditolak: berikut.hostname }
    kini = berikut
  }
  return kini
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  // CORS: hanya origin aplikasi. Permintaan dari peramban dengan origin lain ditolak.
  if (origin && !originDiizinkan(origin, daftarOrigin)) return balas(403, { pesan: 'Origin tidak diizinkan' }, null)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: kepalaCors(origin) })
  if (req.method !== 'POST') return balas(405, { pesan: 'Hanya POST' }, origin)

  // Pemilik yang sedang masuk: id diambil dari JWT lewat Supabase Auth, bukan dari isi permintaan
  const otorisasi = req.headers.get('authorization') ?? ''
  if (!otorisasi.toLowerCase().startsWith('bearer ')) return balas(401, { pesan: PESAN_MASUK }, origin)
  const url = Deno.env.get('SUPABASE_URL')!
  const pengguna = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: otorisasi } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: akun, error: eAkun } = await pengguna.auth.getUser()
  if (eAkun || !akun.user) return balas(401, { pesan: PESAN_MASUK }, origin)

  // Kuota dihitung SEBELUM link diperiksa: setiap permintaan yang sampai ke server ikut terhitung, termasuk link
  // yang salah atau gagal dibuka. Dengan begitu fungsi ini tidak bisa dipakai untuk menguji alamat sembarang tanpa batas.
  const layanan = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: boleh, error: eKuota } = await layanan.rpc('catat_cek_link', { p_pemilik: akun.user.id })
  if (eKuota) return balas(500, { pesan: PESAN_JARINGAN }, origin)
  if (boleh !== true) return balas(429, { pesan: PESAN_BATAS_HABIS }, origin)

  let isi: unknown
  try {
    isi = await req.json()
  } catch {
    return balas(400, { pesan: PESAN_BUKAN_MAPS }, origin)
  }
  const link = bacaLink((isi as { link?: unknown } | null)?.link)
  if (!link) return balas(400, { pesan: PESAN_BUKAN_MAPS }, origin)

  let akhir: URL | { ditolak: string }
  try {
    akhir = await ikutiLink(link)
  } catch {
    // Galat jaringan atau lewat 5 detik; kuota sudah terpakai di langkah sebelumnya
    return balas(502, { pesan: PESAN_JARINGAN }, origin)
  }
  if (!(akhir instanceof URL)) {
    // Diagnosa: hanya untuk permintaan dari staging. Produksi tetap memakai pesan biasa.
    const pesan = origin === ORIGIN_STAGING
      ? `${PESAN_BUKAN_MAPS} (diagnosa: dialihkan ke ${akhir.ditolak})`
      : PESAN_BUKAN_MAPS
    return balas(400, { pesan }, origin)
  }

  const titik = ambilTitik(akhir.href)
  if (!titik) {
    // Diagnosa: hanya untuk permintaan dari staging. Host dan jalur saja, tanpa query.
    const pesan = origin === ORIGIN_STAGING
      ? `${PESAN_TANPA_TITIK} (diagnosa: alamat akhir ${akhir.host}${akhir.pathname})`
      : PESAN_TANPA_TITIK
    return balas(422, { pesan }, origin)
  }
  return balas(200, { lat: titik.lat, lng: titik.lng }, origin)
})
