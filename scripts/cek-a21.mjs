// Pemeriksaan A21: lokasi pelanggan hanya dipakai di HP untuk jarak dan urutan,
// tidak dikirim ke server dan tidak disimpan. Jalankan: npm run cek:a21
import fs from 'node:fs'
import path from 'node:path'

const akar = path.resolve(import.meta.dirname, '..')
const src = path.join(akar, 'src')
const relatif = (f) => path.relative(akar, f).replaceAll('\\', '/')

function semuaBerkas(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return semuaBerkas(p)
    return /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

// Komentar dibuang supaya penjelasan di kode tidak ikut dihitung
const isiKode = (f) =>
  fs
    .readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const berkas = semuaBerkas(src).map((f) => ({ nama: relatif(f), isi: isiKode(f) }))
const gagal = []
const periksa = (lolos, pesan) => {
  if (!lolos) gagal.push(pesan)
}

// 1. Modul lokasi tidak punya jalan keluar: tanpa supabase, jaringan, atau penyimpanan HP
const lokasi = berkas.find((b) => b.nama === 'src/lib/lokasi.ts')
periksa(lokasi, 'src/lib/lokasi.ts tidak ditemukan')
for (const kata of ['supabase', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
  periksa(!lokasi?.isi.includes(kata), `src/lib/lokasi.ts memakai ${kata}`)
}

// 2. Geolocation hanya dibaca di modul lokasi. src/lib/tempat.ts membaca titik tempat milik pemilik lapak
//    (Daftar 2, Tempat baru V43, Ubah tempat V31), bukan lokasi pelanggan, dan hanya boleh dipakai layar itu.
const bolehGeolocation = ['src/lib/lokasi.ts', 'src/lib/tempat.ts']
for (const b of berkas) {
  if (b.isi.includes('geolocation') && !bolehGeolocation.includes(b.nama)) gagal.push(`${b.nama} membaca geolocation di luar src/lib/lokasi.ts`)
}
const bolehModulTempat = ['src/routes/Daftar2.tsx', 'src/routes/KelolaTempat.tsx', 'src/components/FormTempat.tsx', 'src/components/PetaTitik.tsx']
for (const b of berkas) {
  if (/from '(\.\.?\/)+lib\/tempat'/.test(b.isi) && !bolehModulTempat.includes(b.nama))
    gagal.push(`${b.nama} memakai src/lib/tempat.ts (titik tempat pemilik) di luar layar tempat pemilik`)
}

// 3. Hanya beranda, detail lapak, dan cari yang meminta lokasi (detail dan cari hanya jika izin sudah diberi)
const bolehMinta = ['src/lib/lokasi.ts', 'src/routes/Beranda.tsx', 'src/routes/DetailLapak.tsx', 'src/routes/Cari.tsx']
for (const b of berkas) {
  if (/\bmintaLokasi\b/.test(b.isi) && !bolehMinta.includes(b.nama)) gagal.push(`${b.nama} memanggil mintaLokasi`)
}

// 4. Pemakai lokasi tidak menulis lokasi ke penyimpanan HP
const pemakai = berkas.filter((b) => /from '[./]+(lib\/)?lokasi'/.test(b.isi))
for (const b of pemakai) {
  for (const baris of b.isi.split('\n')) {
    if (/\b(tulis|setItem)\s*\(/.test(baris) && /lokasi|Titik|\blat\b|\blng\b|coords/i.test(baris.replace(/KUNCI_IZIN/g, '')))
      gagal.push(`${b.nama} menyimpan lokasi: ${baris.trim()}`)
  }
}

// 5. Permintaan ke server tidak menerima lokasi: muatBeranda hanya menerima wilayah, muatDetail hanya slug,
//    dan modul wilayah (yang juga ke server) tidak mengenal lokasi
const beranda = berkas.find((b) => b.nama === 'src/lib/beranda.ts')
const tandaMuat = beranda?.isi.match(/function muatBeranda\(([^)]*)\)/)?.[1] ?? ''
periksa(tandaMuat && !/Titik|lokasi|lat|lng/i.test(tandaMuat), `muatBeranda menerima lebih dari wilayah: (${tandaMuat})`)
const detail = berkas.find((b) => b.nama === 'src/lib/detail.ts')
const tandaDetail = detail?.isi.match(/function muatDetail\(([^)]*)\)/)?.[1] ?? ''
periksa(tandaDetail && !/Titik|lokasi|lat|lng/i.test(tandaDetail), `muatDetail menerima lebih dari slug: (${tandaDetail})`)
periksa(detail && !/from '\.\/lokasi'/.test(detail.isi), 'src/lib/detail.ts mengimpor modul lokasi')
const wilayah = berkas.find((b) => b.nama === 'src/lib/wilayah.ts')
periksa(wilayah && !/lokasi|Titik/.test(wilayah.isi), 'src/lib/wilayah.ts mengenal lokasi pelanggan')
// Cari: query hanya menerima kata dan wilayah, dan modul cari tidak mengenal lokasi
const cari = berkas.find((b) => b.nama === 'src/lib/cari.ts')
const tandaCari = cari?.isi.match(/function cariLapak\(([^)]*)\)/)?.[1] ?? ''
periksa(tandaCari && !/Titik|lokasi|\blat\b|\blng\b/i.test(tandaCari), `cariLapak menerima lebih dari kata dan wilayah: (${tandaCari})`)
periksa(cari && !/lokasi|Titik/.test(cari.isi), 'src/lib/cari.ts mengenal lokasi pelanggan')

// Ikuti (020): fungsi hanya menerima id lapak, dan modul ikuti serta data akun tidak mengenal lokasi
const modulIkuti = berkas.find((b) => b.nama === 'src/lib/ikuti.ts')
periksa(modulIkuti && !/lokasi|Titik|\blat\b|\blng\b|coords/.test(modulIkuti.isi), 'src/lib/ikuti.ts mengenal lokasi pelanggan')
for (const [, fungsi, isi] of modulIkuti?.isi.matchAll(/rpc\('(\w+)',\s*(\{[^}]*\})/g) ?? [])
  periksa(isi.trim() === '{ p_lapak: lapakId }', `${fungsi} dipanggil dengan lebih dari id lapak: ${isi}`)
const akunSaya = berkas.find((b) => b.nama === 'src/lib/akunSaya.ts')
periksa(akunSaya && !/lokasi|Titik/.test(akunSaya.isi), 'src/lib/akunSaya.ts mengenal lokasi pelanggan')

// 6. Lokasi tidak masuk URL: di pemakai modul lokasi, baris yang mengubah URL tidak menyebut lokasi
for (const b of pemakai) {
  for (const baris of b.isi.split('\n')) {
    if (/\b(setParams|setSearchParams|navigate|pushState|replaceState)\s*\(/.test(baris) && /lokasi|Titik|\blat\b|\blng\b|coords/i.test(baris))
      gagal.push(`${b.nama} memasukkan lokasi ke URL: ${baris.trim()}`)
  }
}

// 7. Data terakhir untuk keadaan sinyal putus (V20) tidak membawa lokasi pelanggan, dan modulnya tidak mengenal lokasi
const dataTerakhir = berkas.find((b) => b.nama === 'src/lib/dataTerakhir.ts')
periksa(dataTerakhir && !/\blokasi\b|Titik|coords|geolocation/.test(dataTerakhir.isi.replace(/\/\/.*$/gm, '')), 'src/lib/dataTerakhir.ts mengenal lokasi pelanggan')
for (const b of berkas) {
  for (const baris of b.isi.split('\n')) {
    if (/\bsimpanTerakhir\s*\(/.test(baris) && /lokasi|Titik|coords|jarak/i.test(baris))
      gagal.push(`${b.nama} menyimpan lokasi pelanggan ke data terakhir: ${baris.trim()}`)
  }
}

if (gagal.length) {
  console.error('A21 GAGAL:\n- ' + gagal.join('\n- '))
  process.exit(1)
}
console.log(`A21 lolos: ${berkas.length} berkas diperiksa, pemakai modul lokasi: ${pemakai.map((b) => b.nama).join(', ')}`)
