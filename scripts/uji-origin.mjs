// Uji pemeriksa origin Edge Function cek-link-maps (CORS), tanpa jaringan: npm run uji:origin
// Modulnya dipakai Edge Function supabase/functions/cek-link-maps (Deno); Node 24 menjalankan .ts langsung.
import { bacaDaftarOrigin, originDiizinkan } from '../supabase/functions/cek-link-maps/origin.ts'

let gagal = 0
const uji = (nama, hasil, harap) => {
  const lulus = JSON.stringify(hasil) === JSON.stringify(harap)
  if (!lulus) gagal++
  console.log(`${lulus ? 'lulus' : 'GAGAL'}  ${nama}${lulus ? '' : `  -> ${JSON.stringify(hasil)}, harap ${JSON.stringify(harap)}`}`)
}

const PRODUKSI = bacaDaftarOrigin('https://noantree.id, https://noantree.akun-anda.workers.dev')
const STAGING = bacaDaftarOrigin(
  'https://staging.noantree.id,https://noantree-staging.akun-anda.workers.dev,https://*-noantree-staging.akun-anda.workers.dev,http://localhost:5173',
)

uji('daftar dibaca, spasi dibuang', PRODUKSI, ['https://noantree.id', 'https://noantree.akun-anda.workers.dev'])
uji('daftar kosong', bacaDaftarOrigin(undefined), [])
uji('tanpa origin ditolak', originDiizinkan(null, PRODUKSI), false)

// Produksi: hanya persis
uji('produksi: noantree.id', originDiizinkan('https://noantree.id', PRODUKSI), true)
uji('produksi: staging ditolak', originDiizinkan('https://staging.noantree.id', PRODUKSI), false)
uji('produksi: pratinjau staging ditolak', originDiizinkan('https://fitur-a-noantree-staging.akun-anda.workers.dev', PRODUKSI), false)
uji('produksi: localhost ditolak', originDiizinkan('http://localhost:5173', PRODUKSI), false)
uji('produksi: http ditolak', originDiizinkan('http://noantree.id', PRODUKSI), false)

// Staging: persis dan pola pratinjau
uji('staging: staging.noantree.id', originDiizinkan('https://staging.noantree.id', STAGING), true)
uji('staging: workers.dev staging', originDiizinkan('https://noantree-staging.akun-anda.workers.dev', STAGING), true)
uji('staging: pratinjau branch', originDiizinkan('https://fitur-a-noantree-staging.akun-anda.workers.dev', STAGING), true)
uji('staging: localhost', originDiizinkan('http://localhost:5173', STAGING), true)
uji('staging: produksi ditolak', originDiizinkan('https://noantree.id', STAGING), false)
uji('staging: titik di bagian * ditolak', originDiizinkan('https://jahat.com-noantree-staging.akun-anda.workers.dev', STAGING), false)
uji('staging: host tiruan ditolak', originDiizinkan('https://x-noantree-staging.akun-anda.workers.dev.jahat.id', STAGING), false)
uji('staging: bagian * kosong ditolak', originDiizinkan('https://-noantree-staging.akun-anda.workers.dev', STAGING), false)
uji('staging: http untuk pola ditolak', originDiizinkan('http://fitur-a-noantree-staging.akun-anda.workers.dev', STAGING), false)
uji('staging: huruf besar ditolak', originDiizinkan('https://FITUR-noantree-staging.akun-anda.workers.dev', STAGING), false)
uji('staging: dengan port ditolak', originDiizinkan('https://fitur-noantree-staging.akun-anda.workers.dev:8443', STAGING), false)

// Pola yang tidak sah diabaikan, bukan membuka semua
uji('pola * saja diabaikan', originDiizinkan('https://apa.saja', ['*']), false)
uji('pola https://* diabaikan', originDiizinkan('https://apa.saja', ['https://*']), false)
uji('pola * di tengah diabaikan', originDiizinkan('https://a.noantree.id', ['https://a.*.id']), false)
uji('pola dua * diabaikan', originDiizinkan('https://a-b.x.id', ['https://*-*.x.id']), false)

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua uji origin lulus.')
process.exit(gagal ? 1 : 0)
