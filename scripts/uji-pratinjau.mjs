// Uji Worker pratinjau link lapak (S6.2) tanpa jaringan dan tanpa wrangler: node scripts/uji-pratinjau.mjs
// Static assets dan Supabase ditiru; Node 24 menjalankan .ts langsung.
import fs from 'node:fs'
import { sisipkanPratinjau, slugDariAlamat } from '../worker/pratinjau.ts'
import worker from '../worker/index.ts'
import { SITUS_PRODUKSI as SITUS_URL, bacaLingkungan, bacaSitusUrl } from '../src/lib/situs.ts'

let gagal = 0
const uji = (nama, hasil, harap) => {
  const lulus = JSON.stringify(hasil) === JSON.stringify(harap)
  if (!lulus) gagal++
  console.log(`${lulus ? 'lulus' : 'GAGAL'}  ${nama}${lulus ? '' : `  -> ${JSON.stringify(hasil)}, harap ${JSON.stringify(harap)}`}`)
}
const meta = (html, kunci) => new RegExp(`<meta (?:property|name)="${kunci}" content="([^"]*)"`).exec(html)?.[1] ?? null
const judul = (html) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null

// index.html seperti hasil build: %SITUS_URL% sudah diganti
const INDEX = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replaceAll('%SITUS_URL%', SITUS_URL)

// Slug
uji('slug biasa', slugDariAlamat('/bakso-pak-slamet'), 'bakso-pak-slamet')
uji('slug huruf besar jadi kecil', slugDariAlamat('/Bakso-Pak-Slamet'), 'bakso-pak-slamet')
uji('garis miring di akhir', slugDariAlamat('/bakso-2/'), 'bakso-2')
uji('beranda bukan slug', slugDariAlamat('/'), null)
for (const r of ['daftar', 'cari', 'lapakku', 'akun', 'diikuti', 'admin', 'komponen', 'assets'])
  uji(`rute ${r} bukan slug (A36)`, slugDariAlamat(`/${r}`), null)
uji('subalamat bukan slug', slugDariAlamat('/akun/kebijakan'), null)
uji('berkas bukan slug', slugDariAlamat('/og-noantree.png'), null)

// Sisipkan
const h = sisipkanPratinjau(INDEX, { slug: 'bakso-pak-slamet', nama: 'Bakso Pak Slamet', deskripsi: 'Bakso urat dan mi ayam.\nPedas bisa.' })
uji('title', judul(h), 'Bakso Pak Slamet · noantree')
uji('og:title', meta(h, 'og:title'), 'Bakso Pak Slamet · noantree')
uji('twitter:title', meta(h, 'twitter:title'), 'Bakso Pak Slamet · noantree')
uji('og:description dari deskripsi, satu baris', meta(h, 'og:description'), 'Bakso urat dan mi ayam. Pedas bisa.')
uji('description', meta(h, 'description'), 'Bakso urat dan mi ayam. Pedas bisa.')
uji('twitter:description', meta(h, 'twitter:description'), 'Bakso urat dan mi ayam. Pedas bisa.')
uji('og:url dari SITUS_URL', meta(h, 'og:url'), `${SITUS_URL}/bakso-pak-slamet`)
uji('og:image tetap gambar umum', meta(h, 'og:image'), `${SITUS_URL}/og-noantree.png`)
uji('twitter:card tetap', meta(h, 'twitter:card'), 'summary_large_image')

const st = sisipkanPratinjau(INDEX, { slug: 'bakso-pak-slamet', nama: 'Bakso Pak Slamet', deskripsi: null }, 'https://staging.noantree.id')
uji('staging: og:url ke staging', meta(st, 'og:url'), 'https://staging.noantree.id/bakso-pak-slamet')

const tanpa = sisipkanPratinjau(INDEX, { slug: 'es-teh', nama: 'Es Teh', deskripsi: '  ' })
uji('deskripsi kosong: deskripsi umum', meta(tanpa, 'og:description'), meta(INDEX, 'og:description'))

const aneh = sisipkanPratinjau(INDEX, { slug: 'x', nama: 'Soto "Bu Har" <&>', deskripsi: 'a'.repeat(400) })
uji('nama diamankan', meta(aneh, 'og:title'), 'Soto &quot;Bu Har&quot; &lt;&amp;&gt; · noantree')
uji('nama diamankan di title', judul(aneh), 'Soto &quot;Bu Har&quot; &lt;&amp;&gt; · noantree')
uji('deskripsi panjang dipotong 200', meta(aneh, 'og:description').length, 200)
uji('$ di nama tidak merusak ganti', meta(sisipkanPratinjau(INDEX, { slug: 'x', nama: "Rp$1 $& $'", deskripsi: null }), 'og:title'), "Rp$1 $&amp; $' · noantree")

// Worker utuh dengan static assets dan Supabase tiruan
const SUPA = { url: 'https://contoh.supabase.co', kunciAnon: 'anon-publik' }
let dimintaSupabase = []
let jawabSupabase = () => new Response(JSON.stringify([{ slug: 'bakso-pak-slamet', nama: 'Bakso Pak Slamet', deskripsi: 'Bakso urat.' }]))
globalThis.fetch = async (url, init) => {
  dimintaSupabase.push({ url: String(url), apikey: init?.headers?.apikey })
  return jawabSupabase()
}
// Worker menyimpan isi supabase-publik.json selama hidup; tiap lingkungan diuji dengan salinan modul Worker sendiri
const buatEnv = (supa) => ({
  ASSETS: {
    async fetch(input) {
      const p = new URL(input instanceof Request ? input.url : input).pathname
      if (p === '/supabase-publik.json') return new Response(JSON.stringify(supa))
      if (p === '/' || !p.includes('.')) return new Response(INDEX, { headers: { 'content-type': 'text/html', etag: '"x"' } })
      return new Response('berkas', { headers: { 'content-type': 'image/png' } })
    },
  },
})
const env = buatEnv(SUPA)
const minta = (path, method = 'GET', host = 'noantree.id', w = worker, e = env) =>
  w.fetch(new Request(`https://${host}${path}`, { method }), e)

let r = await minta('/bakso-pak-slamet')
let isi = await r.text()
uji('worker: status 200', r.status, 200)
uji('worker: og:title lapak', meta(isi, 'og:title'), 'Bakso Pak Slamet · noantree')
uji('worker: etag dibuang', r.headers.get('etag'), null)
uji('worker: hanya view lapak_publik, select terbatas', dimintaSupabase.at(-1).url, `${SUPA.url}/rest/v1/lapak_publik?select=slug,nama,deskripsi&slug=eq.bakso-pak-slamet&limit=1`)
uji('worker: memakai kunci anon', dimintaSupabase.at(-1).apikey, 'anon-publik')
uji('worker: berkas lama tanpa situsUrl: og:url produksi', meta(isi, 'og:url'), `${SITUS_URL}/bakso-pak-slamet`)
uji('worker: produksi tanpa x-robots-tag', r.headers.get('x-robots-tag'), null)

r = await minta('/bakso-pak-slamet', 'HEAD')
uji('worker: HEAD tanpa isi', await r.text(), '')

dimintaSupabase = []
r = await minta('/akun')
uji('worker: rute aplikasi diteruskan tanpa Supabase', [await r.text() === INDEX, dimintaSupabase.length], [true, 0])
r = await minta('/og-noantree.png')
uji('worker: berkas diteruskan', await r.text(), 'berkas')

jawabSupabase = () => new Response('[]')
r = await minta('/tidak-ada')
uji('worker: lapak tidak ada: index apa adanya', await r.text(), INDEX)

jawabSupabase = () => {
  throw new TypeError('jaringan putus')
}
r = await minta('/bakso-pak-slamet')
uji('worker: Supabase gagal: index apa adanya', [r.status, await r.text() === INDEX], [200, true])

jawabSupabase = () => new Response('galat', { status: 500 })
r = await minta('/bakso-pak-slamet')
uji('worker: Supabase 500: index apa adanya', await r.text(), INDEX)

// Staging: alamat dari supabase-publik.json dan tanda jangan diindeks
const workerStaging = (await import('../worker/index.ts?staging')).default
const envStaging = buatEnv({ ...SUPA, situsUrl: 'https://staging.noantree.id' })
const mintaStaging = (path, host = 'staging.noantree.id') => minta(path, 'GET', host, workerStaging, envStaging)
jawabSupabase = () => new Response(JSON.stringify([{ slug: 'bakso-pak-slamet', nama: 'Bakso Pak Slamet', deskripsi: 'Bakso urat.' }]))
r = await mintaStaging('/bakso-pak-slamet')
isi = await r.text()
uji('staging: og:url dari supabase-publik.json', meta(isi, 'og:url'), 'https://staging.noantree.id/bakso-pak-slamet')
uji('staging: halaman lapak noindex', r.headers.get('x-robots-tag'), 'noindex, nofollow')
r = await mintaStaging('/akun')
uji('staging: rute aplikasi lewat Worker noindex', r.headers.get('x-robots-tag'), 'noindex, nofollow')
r = await mintaStaging('/bakso-pak-slamet', 'fitur-a-noantree-staging.akun-anda.workers.dev')
uji('pratinjau workers.dev noindex', r.headers.get('x-robots-tag'), 'noindex, nofollow')
r = await minta('/akun', 'GET', 'noantree.id')
uji('produksi: rute aplikasi tanpa x-robots-tag', r.headers.get('x-robots-tag'), null)
const workerSalah = (await import('../worker/index.ts?salah')).default
r = await minta('/bakso-pak-slamet', 'GET', 'noantree.id', workerSalah, buatEnv({ ...SUPA, situsUrl: 'https://jahat.example/' }))
uji('situsUrl salah bentuk: kembali ke produksi', meta(await r.text(), 'og:url'), `${SITUS_URL}/bakso-pak-slamet`)

// Nilai build
uji('VITE_SITUS_URL kosong = produksi', bacaSitusUrl(''), 'https://noantree.id')
uji('VITE_SITUS_URL staging', bacaSitusUrl(' https://staging.noantree.id '), 'https://staging.noantree.id')
uji('VITE_SITUS_URL localhost', bacaSitusUrl('http://localhost:5173'), 'http://localhost:5173')
for (const salah of ['https://staging.noantree.id/', 'http://staging.noantree.id', 'staging.noantree.id', 'https://staging.noantree.id/x', 'https://Staging.noantree.id'])
  uji(`VITE_SITUS_URL ditolak: ${salah}`, (() => { try { bacaSitusUrl(salah); return 'diterima' } catch { return 'ditolak' } })(), 'ditolak')
uji('VITE_LINGKUNGAN kosong = produksi', bacaLingkungan(undefined), 'produksi')
uji('VITE_LINGKUNGAN staging', bacaLingkungan('staging'), 'staging')
uji('VITE_LINGKUNGAN salah ditolak', (() => { try { bacaLingkungan('Staging'); return 'diterima' } catch { return 'ditolak' } })(), 'ditolak')

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua uji lulus')
process.exit(gagal ? 1 : 0)
