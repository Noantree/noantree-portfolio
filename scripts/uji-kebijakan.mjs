// Uji teks V38 dari docs/draf-kebijakan-sk.md: node scripts/uji-kebijakan.mjs
// Ringkasan ada, nomor bagian berurutan dari 1, tanpa kode aturan internal (A37 dll.), dan daftar [TODO] yang tersisa.
import fs from 'node:fs'
import { periksaDokumen, potongBaris, uraiDraf } from '../src/lib/uraiKebijakan.ts'

let gagal = 0
const uji = (nama, hasil, harap) => {
  const lulus = JSON.stringify(hasil) === JSON.stringify(harap)
  if (!lulus) gagal++
  console.log(`${lulus ? 'lulus' : 'GAGAL'}  ${nama}${lulus ? '' : `  -> ${JSON.stringify(hasil)}, harap ${JSON.stringify(harap)}`}`)
}
const coba = (f) => {
  try {
    f()
    return 'ok'
  } catch (e) {
    return e.message
  }
}

const { privasi, sk } = uraiDraf(fs.readFileSync(new URL('../docs/draf-kebijakan-sk.md', import.meta.url), 'utf8'))
uji('Kebijakan Privasi lolos pemeriksaan', coba(() => periksaDokumen('Kebijakan Privasi', privasi)), 'ok')
uji('Syarat & Ketentuan lolos pemeriksaan', coba(() => periksaDokumen('Syarat & Ketentuan', sk)), 'ok')
uji('nomor Privasi 1–8', privasi.bagian.map((b) => parseInt(b.judul)), [1, 2, 3, 4, 5, 6, 7, 8])
uji('nomor S&K 1–11', sk.bagian.map((b) => parseInt(b.judul)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
uji('ringkasan S&K', sk.ringkas, 'Syarat ini mengatur penggunaan Noantree oleh pedagang keliling dan pelanggan di Sragen. Dengan masuk, Anda setuju dengan ketentuan ini. Noantree tidak menjual barang dan tidak ikut dalam transaksi antara pedagang dan pelanggan.')

const teks = (dok) => [dok.diperbarui, dok.ringkas, ...dok.bagian.flatMap((b) => [b.judul, ...b.isi.flatMap((x) => (x.jenis === 'daftar' ? x.butir : [x.teks]))])]
const todo = [...teks(privasi), ...teks(sk)].flatMap((t) => potongBaris(t ?? '').filter((p) => p.jenis === 'todo').map((p) => p.teks))
uji('[TODO] tersisa: tanggal, layanan email, kebocoran, domisili', todo, [
  '[TODO tanggal]',
  '[TODO: aktif setelah layanan email dipilih]',
  '[TODO: belum dipilih]',
  '[TODO: sesuai kebijakan yang diputuskan]',
  '[TODO tanggal]',
  '[TODO: domisili penyelesaian sengketa, ditunda]',
])
const semua = [...teks(privasi), ...teks(sk)].join('\n')
uji('pelapor: nama dan email terlihat admin', semua.includes('Nama tampilan dan alamat email Anda tercatat bersama laporan itu, dan dapat dilihat oleh tim admin.'), true)
uji('wilayah server Singapura', semua.includes('Data disimpan di server Supabase di Singapura.'), true)
uji('tanpa http atau www. (A37)', /https?:|www\./.test(semua), false)

// Pemeriksaan menangkap draf yang salah
const dok = (judul, isi = 'Teks.') => ({ diperbarui: null, ringkas: 'Ringkas.', bagian: judul.map((j) => ({ judul: j, isi: [{ jenis: 'paragraf', teks: isi }] })) })
uji('menolak nomor ganda', coba(() => periksaDokumen('x', dok(['1. A', '2. B', '2. C']))), 'x: bagian ke-3 bernomor salah: "2. C"')
uji('menolak nomor lompat', coba(() => periksaDokumen('x', dok(['1. A', '3. B']))), 'x: bagian ke-2 bernomor salah: "3. B"')
uji('menolak kode internal', coba(() => periksaDokumen('x', dok(['1. A'], 'Tanpa link (A37).'))), 'x: kode aturan internal di teks: "Tanpa link (A37)."')
uji('menolak ringkasan kosong', coba(() => periksaDokumen('x', { ...dok(['1. A']), ringkas: null })), 'x: paragraf ringkasan tidak ada')

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua uji lulus')
process.exit(gagal ? 1 : 0)
