// Alat database noantree lewat Supabase CLI, dengan pengaman supaya perintah tidak salah sasaran.
// Jalankan dari folder repo:  npm run db -- <staging|produksi> <perintah>
//
// Perintah:
//   cek          Daftar migrasi: mana yang sudah jalan di database itu (kolom Remote) dan mana yang belum.
//   siapkan      KHUSUS staging kosong: skrip awal (supabase/staging/awal-sebelum-003.sql) lalu semua migrasi.
//   push         Jalankan migrasi yang belum jalan. Ditampilkan dulu, lalu harus mengetik nama lingkungan.
//   tandai-lama  KHUSUS produksi, sekali saja: catat migrasi 003 sampai 029 sebagai "sudah jalan" tanpa menjalankannya,
//                karena dulu dijalankan manual lewat SQL Editor. Tanpa ini, push ke produksi mencoba mengulang 003.
//   fungsi       Deploy Edge Function cek-link-maps ke lingkungan itu.
//
// Sebelum pertama kali: `npx supabase login` (sekali per laptop). Jika CLI meminta password database, tempel password
// lingkungan itu dari pengelola password, di terminal saja (jangan di chat).
// Ref proyek ada di supabase/proyek.json. Untuk uji tanpa Supabase sungguhan: NOANTREE_DB_URL dan NOANTREE_SUPABASE_BIN.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'

const akar = path.resolve(import.meta.dirname, '..')
const VERSI_CLI = '2.122.0'
// Migrasi yang dulu dijalankan manual di produksi. Jangan tambah nomor baru di sini: migrasi baru selalu lewat push.
const VERSI_LAMA = Array.from({ length: 27 }, (_, i) => String(i + 3).padStart(3, '0'))

const [lingkungan, perintah] = process.argv.slice(2)
const PERINTAH = ['cek', 'siapkan', 'push', 'tandai-lama', 'fungsi']

function berhenti(pesan) {
  console.error(`\n✖ ${pesan}\n`)
  process.exit(1)
}

if (!['staging', 'produksi'].includes(lingkungan) || !PERINTAH.includes(perintah)) {
  berhenti(`Pemakaian: npm run db -- <staging|produksi> <${PERINTAH.join('|')}>`)
}

const proyek = JSON.parse(fs.readFileSync(path.join(akar, 'supabase/proyek.json'), 'utf8'))
const ref = proyek[lingkungan]
const urlUji = process.env.NOANTREE_DB_URL
if (!urlUji && !/^[a-z]{20}$/.test(ref ?? '')) {
  berhenti(`Ref proyek ${lingkungan} belum diisi atau salah bentuk di supabase/proyek.json (harus 20 huruf kecil).`)
}
if (!urlUji && lingkungan === 'staging' && ref === proyek.produksi) {
  berhenti('Ref staging sama dengan ref produksi di supabase/proyek.json. Periksa lagi.')
}

const NAMA = lingkungan === 'produksi' ? 'PRODUKSI (data pelanggan asli)' : 'STAGING (data uji)'
console.log(`\n================================================================`)
console.log(`  Lingkungan : ${NAMA}`)
console.log(`  Proyek     : ${urlUji ? `(uji) ${urlUji.replace(/:[^:@/]*@/, ':***@')}` : ref}`)
console.log(`  Perintah   : ${perintah}`)
console.log(`================================================================\n`)

// Menjalankan Supabase CLI. Sasaran selalu ditulis eksplisit (--project-ref), tidak bergantung pada `supabase link`.
function cli(argumen, { tangkap = false, sasaran = true, bolehGagal = false } = {}) {
  const bin = process.env.NOANTREE_SUPABASE_BIN
  const target = !sasaran ? [] : urlUji ? ['--db-url', urlUji] : ['--project-ref', ref]
  const [perintahDasar, ...awal] = bin ? [bin] : ['npx', '--yes', `supabase@${VERSI_CLI}`]
  const hasil = spawnSync(perintahDasar, [...awal, ...argumen, ...target], {
    cwd: akar,
    stdio: tangkap ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (hasil.status !== 0 && bolehGagal) return null
  if (hasil.status !== 0) berhenti(`Supabase CLI berhenti dengan galat (perintah: supabase ${argumen.join(' ')}). Tidak ada langkah lanjutan yang dijalankan.`)
  return hasil.stdout ?? ''
}

// Baris JSON terakhir dari keluaran CLI (--output-format json)
function json(keluaran) {
  const baris = keluaran.trim().split('\n').reverse().find((b) => b.trim().startsWith('{'))
  if (!baris) berhenti('Keluaran Supabase CLI tidak bisa dibaca.')
  return JSON.parse(baris)
}

function migrasiTercatat() {
  const isi = json(cli(['migration', 'list', '--output-format', 'json'], { tangkap: true }))
  return (isi.migrations ?? []).filter((m) => m.remote).map((m) => m.remote)
}

async function konfirmasi(kata, alasan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const jawab = (await rl.question(`${alasan}\nKetik ${kata} lalu Enter untuk lanjut (apa pun selain itu = batal): `)).trim()
  rl.close()
  if (jawab !== kata) berhenti('Dibatalkan. Tidak ada yang diubah.')
}

const kataKonfirmasi = lingkungan === 'produksi' ? 'PRODUKSI' : 'staging'

async function push() {
  console.log('Migrasi yang akan dijalankan:')
  const rencana = json(cli(['db', 'push', '--dry-run', '--output-format', 'json'], { tangkap: true }))
  if (rencana.upToDate || !(rencana.migrations ?? []).length) {
    console.log('\n✔ Tidak ada migrasi baru. Database sudah sama dengan repo.\n')
    return
  }
  for (const m of rencana.migrations) console.log(`  • ${m}`)
  console.log('')
  await konfirmasi(kataKonfirmasi, `${rencana.migrations.length} migrasi akan dijalankan di ${NAMA}. Setiap migrasi hanya boleh jalan sekali.`)
  cli(['db', 'push', '--yes'])
  console.log(`\n✔ Selesai. Periksa dengan: npm run db -- ${lingkungan} cek\n`)
}

if (perintah === 'cek') {
  cli(['migration', 'list'])
} else if (perintah === 'siapkan') {
  if (lingkungan !== 'staging') berhenti('"siapkan" hanya untuk staging. Produksi tidak boleh dibuat ulang.')
  const ada = migrasiTercatat()
  if (ada.length) berhenti(`Staging sudah punya ${ada.length} migrasi tercatat (terakhir ${ada.at(-1)}). Pakai "push" untuk migrasi baru.`)
  await konfirmasi('staging', 'Staging kosong akan diisi: skrip awal, lalu semua migrasi di supabase/migrations.')
  if (cli(['db', 'query', '--file', 'supabase/staging/awal-sebelum-003.sql'], { bolehGagal: true }) === null) {
    berhenti(
      'Skrip awal gagal dijalankan lewat CLI. Jalankan manual: buka Supabase STAGING > SQL Editor, tempel isi\n' +
        '  supabase/staging/awal-sebelum-003.sql, cek nama proyek di kiri atas, Run. Lalu: npm run db -- staging push',
    )
  }
  console.log('✔ Skrip awal selesai.\n')
  await push()
} else if (perintah === 'push') {
  if (lingkungan === 'produksi') {
    const ada = migrasiTercatat()
    if (!VERSI_LAMA.every((v) => ada.includes(v))) {
      berhenti('Catatan migrasi produksi belum lengkap. Jalankan dulu sekali: npm run db -- produksi tandai-lama')
    }
  }
  await push()
} else if (perintah === 'tandai-lama') {
  if (lingkungan !== 'produksi') berhenti('"tandai-lama" hanya untuk produksi. Staging dibuat lewat "siapkan".')
  const ada = migrasiTercatat()
  if (ada.length) berhenti(`Produksi sudah punya ${ada.length} migrasi tercatat. "tandai-lama" tidak perlu dijalankan lagi.`)
  await konfirmasi(
    'PRODUKSI',
    `Migrasi ${VERSI_LAMA[0]} sampai ${VERSI_LAMA.at(-1)} akan DICATAT sebagai sudah jalan di produksi. Tidak ada SQL migrasi yang dijalankan.`,
  )
  cli(['migration', 'repair', '--status', 'applied', ...VERSI_LAMA, '--yes'])
  console.log('\n✔ Catatan migrasi produksi lengkap. Periksa dengan: npm run db -- produksi cek\n')
} else if (perintah === 'fungsi') {
  if (urlUji) berhenti('"fungsi" tidak bisa diuji dengan NOANTREE_DB_URL.')
  await konfirmasi(kataKonfirmasi, `Edge Function cek-link-maps akan di-deploy ke ${NAMA}.`)
  cli(['functions', 'deploy', 'cek-link-maps'])
  console.log(`\n✔ Selesai. Pastikan secret ALLOWED_ORIGINS di ${NAMA} sudah benar (dashboard > Edge Functions > Secrets).\n`)
}
