// Worker noantree (S6.2). Semua berkas tetap dilayani static assets dari dist. Worker hanya menangani halaman lapak
// (/:slug): index.html diberi judul, deskripsi, dan og:url milik lapak itu supaya pratinjau link di WhatsApp sesuai.
// Data dibaca dari view lapak_publik dengan kunci anon (kunci publik), tanpa perubahan database.
// Kalau apa pun gagal, index.html dikirim apa adanya, jadi halaman tetap terbuka seperti sebelum ada Worker.
// Kode yang sama dipakai Worker produksi (noantree) dan staging (noantree-staging); bedanya hanya isi supabase-publik.json.
import { sisipkanPratinjau, slugDariAlamat, type DataPratinjau } from './pratinjau.ts'
import { HOST_PRODUKSI, SITUS_PRODUKSI, bacaSitusUrl } from '../src/lib/situs.ts'

type Env = { ASSETS: { fetch(input: Request | URL | string): Promise<Response> } }

// URL Supabase, kunci anon, dan alamat situs, ditulis ke dist saat build dari variabel build (vite.config.ts).
// Ketiganya nilai publik yang juga ada di JavaScript aplikasi.
type SupabasePublik = { url: string; kunciAnon: string; situsUrl?: string }
let supabasePublik: Promise<SupabasePublik | null> | null = null

function bacaSupabasePublik(env: Env, asal: string) {
  supabasePublik ??= env.ASSETS.fetch(new URL('/supabase-publik.json', asal))
    .then((r) => (r.ok ? (r.json() as Promise<SupabasePublik>) : null))
    .then((s) => (s?.url && s.kunciAnon ? s : null))
    .catch(() => null)
    .then((s) => {
      if (!s) supabasePublik = null
      return s
    })
  return supabasePublik
}

// Alamat situs dari supabase-publik.json; berkas lama tanpa situsUrl atau nilai yang salah = produksi
function situsDari(s: SupabasePublik): string {
  try {
    return bacaSitusUrl(s.situsUrl)
  } catch {
    return SITUS_PRODUKSI
  }
}

async function muatLapak(s: SupabasePublik, slug: string): Promise<DataPratinjau | null> {
  // Status publik hanya lewat view lapak_publik; lapak draf, disembunyikan, atau ditutup tidak ada di sana
  const r = await fetch(`${s.url}/rest/v1/lapak_publik?select=slug,nama,deskripsi&slug=eq.${slug}&limit=1`, {
    headers: { apikey: s.kunciAnon, authorization: `Bearer ${s.kunciAnon}` },
    signal: AbortSignal.timeout(2500),
  })
  if (!r.ok) return null
  const baris = (await r.json()) as DataPratinjau[]
  return baris[0] ?? null
}

// Selain noantree.id (staging, alamat workers.dev, pratinjau per branch) tidak boleh masuk mesin pencari.
// public/_headers melakukan hal yang sama untuk berkas statis; aturan itu tidak berlaku untuk respons dari Worker.
function tandaiJanganDiindeks(alamat: URL, res: Response): Response {
  if (alamat.host === HOST_PRODUKSI) return res
  const kepala = new Headers(res.headers)
  kepala.set('x-robots-tag', 'noindex, nofollow')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: kepala })
}

async function layani(request: Request, env: Env, alamat: URL): Promise<Response> {
  const slug = request.method === 'GET' || request.method === 'HEAD' ? slugDariAlamat(alamat.pathname) : null
  if (!slug) return env.ASSETS.fetch(request)

  const index = await env.ASSETS.fetch(new URL('/', alamat))
  if (!index.ok) return index
  const html = await index.text()
  let isi = html
  try {
    const s = await bacaSupabasePublik(env, alamat.origin)
    const lapak = s ? await muatLapak(s, slug) : null
    if (s && lapak) isi = sisipkanPratinjau(html, lapak, situsDari(s))
  } catch {
    // Supabase lambat atau tidak terjangkau: index.html apa adanya
  }
  const kepala = new Headers(index.headers)
  kepala.delete('content-length')
  kepala.delete('etag')
  kepala.set('content-type', 'text/html; charset=utf-8')
  kepala.set('cache-control', 'public, max-age=0, must-revalidate')
  return new Response(request.method === 'HEAD' ? null : isi, { status: 200, headers: kepala })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const alamat = new URL(request.url)
    return tandaiJanganDiindeks(alamat, await layani(request, env, alamat))
  },
}
