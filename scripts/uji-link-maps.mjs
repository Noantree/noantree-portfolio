// Uji pengurai link Google Maps (A33) tanpa jaringan: node scripts/uji-link-maps.mjs
// Modulnya dipakai Edge Function supabase/functions/cek-link-maps (Deno); Node 24 menjalankan .ts langsung.
import { ambilTitik, bacaLink } from '../supabase/functions/cek-link-maps/link.ts'

let gagal = 0
const uji = (nama, hasil, harap) => {
  const lulus = JSON.stringify(hasil) === JSON.stringify(harap)
  if (!lulus) gagal++
  console.log(`${lulus ? 'lulus' : 'GAGAL'}  ${nama}${lulus ? '' : `  -> ${JSON.stringify(hasil)}, harap ${JSON.stringify(harap)}`}`)
}
const host = (link) => bacaLink(link) !== null

// Pola titik
uji('@lat,lng', ambilTitik('https://www.google.com/maps/@-7.4291,111.0193,17z'), { lat: -7.4291, lng: 111.0193 })
uji(
  '!3d!4d didahulukan dari @ (pin tempat, bukan tengah peta)',
  ambilTitik('https://www.google.com/maps/place/Pasar+Sragen/@-7.43,111.01,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-7.4291234!4d111.0193456'),
  { lat: -7.4291234, lng: 111.0193456 },
)
uji('?q=lat,lng', ambilTitik('https://www.google.com/maps?q=-7.4291,111.0193'), { lat: -7.4291, lng: 111.0193 })
uji('?q= dengan spasi tersandi', ambilTitik('https://www.google.com/maps?q=-7.4291,%20111.0193'), { lat: -7.4291, lng: 111.0193 })
uji('ll=lat,lng', ambilTitik('https://www.google.com/maps?ll=-6.2,106.8&z=15'), { lat: -6.2, lng: 106.8 })
uji('query=lat,lng (search api=1)', ambilTitik('https://www.google.com/maps/search/?api=1&query=-7.4291%2C111.0193'), { lat: -7.4291, lng: 111.0193 })
uji('?q= berisi nama tempat, bukan titik', ambilTitik('https://www.google.com/maps?q=Pasar+Sragen'), null)
uji('tanpa titik sama sekali', ambilTitik('https://maps.app.goo.gl/AbCdEf123'), null)

// Di luar Indonesia atau di luar rentang
uji('di luar Indonesia (Tokyo) ditolak', ambilTitik('https://www.google.com/maps/@35.6762,139.6503,15z'), null)
uji('di luar Indonesia (London) ditolak', ambilTitik('https://www.google.com/maps?q=51.5074,-0.1278'), null)
uji('di luar rentang ditolak', ambilTitik('https://www.google.com/maps/@-95.1,111.0,15z'), null)

// Host dan skema
uji('maps.app.goo.gl diterima', host('https://maps.app.goo.gl/AbCdEf123'), true)
uji('maps.google.com diterima (tujuan redirect link pendek)', host('https://maps.google.com/?q=-7.4291,111.0193'), true)
uji('host Google lain tetap ditolak (google.co.id)', host('https://www.google.co.id/maps/@-7.4291,111.0193,17z'), false)
uji('goo.gl/maps diterima', host('https://goo.gl/maps/AbCdEf123'), true)
uji('goo.gl bukan /maps ditolak', host('https://goo.gl/AbCdEf123'), false)
uji('www.google.com/maps diterima', host('https://www.google.com/maps/place/x'), true)
uji('google.com/maps diterima', host('https://google.com/maps?q=-7.4,111.0'), true)
uji('google.com bukan /maps ditolak', host('https://www.google.com/search?q=bakso'), false)
uji('/mapsx bukan /maps ditolak', host('https://www.google.com/mapsx/place/x'), false)
uji('http (bukan https) ditolak', host('http://maps.app.goo.gl/AbCdEf123'), false)
uji('host lain ditolak', host('https://bit.ly/abc'), false)
uji('host tiruan ditolak', host('https://www.google.com.penipu.id/maps/x'), false)
uji('subdomain tiruan ditolak', host('https://maps.app.goo.gl.penipu.id/x'), false)
uji('dengan user:pass ditolak', host('https://a:b@www.google.com/maps/x'), false)
uji('port lain ditolak', host('https://www.google.com:8443/maps/x'), false)
uji('bukan link ditolak', host('Depan Pasar Sragen'), false)
uji('kosong ditolak', host('   '), false)
uji('bukan teks ditolak', host(42), false)

console.log(gagal === 0 ? '\nSemua uji pengurai link lulus.' : `\n${gagal} uji GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
