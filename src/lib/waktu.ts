// Hitungan jam untuk layar pemilik, selalu di WIB (Asia/Jakarta).
// WIB = UTC+7 tanpa musim panas, jadi jam dinding WIB didapat dengan menggeser 7 jam lalu membaca bagian UTC.

const GESER_WIB = 7 * 60 * 60 * 1000
const MENIT = 60 * 1000
const HARI = 24 * 60 * MENIT

export type BarisJadwal = { hari: number; jam_mulai: string; jam_selesai: string }

const duaDigit = (n: number) => String(n).padStart(2, '0')

// 14.00 (format jam di PRD: 24 jam, titik sebagai pemisah)
export function jamWIB(waktu: Date | number): string {
  const w = new Date(new Date(waktu).getTime() + GESER_WIB)
  return `${duaDigit(w.getUTCHours())}.${duaDigit(w.getUTCMinutes())}`
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// 27 Okt (tanggal WIB, dipakai di layar admin V18 dan V55)
export function tanggalWIB(waktu: Date | number): string {
  const w = new Date(new Date(waktu).getTime() + GESER_WIB)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]}`
}

// 25 Okt 2026 (tanggal WIB dengan tahun, dipakai di layar pemilik V17)
export function tanggalTahunWIB(waktu: Date | number): string {
  const w = new Date(new Date(waktu).getTime() + GESER_WIB)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`
}

// "06:00:00" dari database menjadi "06.00"
const jamJadwal = (jam: string) => jam.slice(0, 5).replace(':', '.')
const menitJadwal = (jam: string) => Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5))

// Tengah malam WIB (dalam milidetik UTC) dari hari yang memuat waktu ini
function tengahMalamWIB(waktu: number): number {
  return Math.floor((waktu + GESER_WIB) / HARI) * HARI - GESER_WIB
}

// 0 = Minggu ... 6 = Sabtu, sama dengan kolom jadwal.hari
const hariWIB = (waktu: number) => new Date(waktu + GESER_WIB).getUTCDay()

// Teks jadwal hari ini untuk V3/V14: "06.00–14.00", beberapa sesi digabung koma
export function teksJadwalHariIni(jadwal: BarisJadwal[], sekarang: number): string {
  if (jadwal.length === 0) return 'belum ada jadwal'
  const hariIni = jadwal
    .filter((j) => j.hari === hariWIB(sekarang))
    .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
  if (hariIni.length === 0) return 'libur hari ini'
  return 'jadwal hari ini ' + hariIni.map((j) => `${jamJadwal(j.jam_mulai)}–${jamJadwal(j.jam_selesai)}`).join(', ')
}

// Akhir sesi jadwal yang akan dipakai jika Mulai buka sekarang. Aturan yang sama dengan
// jadwal_untuk_mulai di migrasi 016: sesi yang sedang berjalan atau dimulai paling lama 3 jam lagi;
// sesi lewat tengah malam milik hari mulainya. null = di luar jadwal (berakhir 4 jam setelah mulai).
export function akhirJadwalJikaMulai(jadwal: BarisJadwal[], sekarang: number): number | null {
  return sesiJadwalPertama(jadwal, sekarang, 3 * 60 * MENIT)?.selesai ?? null
}

// Awal sesi jadwal yang sedang berjalan, untuk banner "Lupa mulai buka?" (A5). null = di luar jadwal.
export function awalJadwalBerjalan(jadwal: BarisJadwal[], sekarang: number): number | null {
  return sesiJadwalPertama(jadwal, sekarang, 0)?.mulai ?? null
}

// Sesi jadwal paling awal (kemarin, hari ini, besok, WIB) yang sudah mulai, atau mulai paling lama
// `lebihAwal` lagi, dan belum selesai. Sesi lewat tengah malam milik hari mulainya.
function sesiJadwalPertama(jadwal: BarisJadwal[], sekarang: number, lebihAwal: number) {
  const hariIni = tengahMalamWIB(sekarang)
  let terpilih: { mulai: number; selesai: number } | null = null
  for (const geser of [-1, 0, 1]) {
    const tgl = hariIni + geser * HARI
    for (const j of jadwal) {
      if (j.hari !== hariWIB(tgl)) continue
      const mulai = tgl + menitJadwal(j.jam_mulai) * MENIT
      const selesaiMenit = menitJadwal(j.jam_selesai)
      const selesai = tgl + selesaiMenit * MENIT + (selesaiMenit <= menitJadwal(j.jam_mulai) ? HARI : 0)
      if (sekarang >= mulai - lebihAwal && sekarang < selesai && (!terpilih || mulai < terpilih.mulai)) {
        terpilih = { mulai, selesai }
      }
    }
  }
  return terpilih
}

// Untuk V28: "Hari ini" atau "Kemarin" menurut tanggal WIB
export const samaHariWIB = (a: number, b: number) => tengahMalamWIB(a) === tengahMalamWIB(b)

// "sisa 2 jam 10 menit"
export function teksSisa(berakhir: number, sekarang: number): string {
  const menit = Math.floor((berakhir - sekarang) / MENIT)
  if (menit < 1) return 'sisa kurang dari 1 menit'
  const jam = Math.floor(menit / 60)
  const sisaMenit = menit % 60
  if (jam === 0) return `sisa ${sisaMenit} menit`
  return sisaMenit === 0 ? `sisa ${jam} jam` : `sisa ${jam} jam ${sisaMenit} menit`
}

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// V23 "Buka lagi …": "hari ini 16.00", "besok 06.00", atau nama hari ("Senin 06.00") menurut tanggal WIB
export function teksBukaBerikutnya(waktu: number, sekarang: number): string {
  const selisihHari = Math.round((tengahMalamWIB(waktu) - tengahMalamWIB(sekarang)) / HARI)
  const hari = selisihHari === 0 ? 'hari ini' : selisihHari === 1 ? 'besok' : NAMA_HARI[hariWIB(waktu)]
  return `${hari} ${jamWIB(waktu)}`
}

// V23 "terakhir buka …": hari ini, kemarin, N hari lalu, atau lebih dari sebulan lalu (tanggal WIB)
export function teksTerakhirBuka(waktu: number, sekarang: number): string {
  const selisihHari = Math.round((tengahMalamWIB(sekarang) - tengahMalamWIB(waktu)) / HARI)
  if (selisihHari <= 0) return 'hari ini'
  if (selisihHari === 1) return 'kemarin'
  if (selisihHari <= 30) return `${selisihHari} hari lalu`
  return 'lebih dari sebulan lalu'
}

// Kartu Jadwal V2 dan V7: hari berurutan (Senin dulu) dengan jam yang sama digabung,
// misalnya ["Senin–Jumat · 07.00–11.00", "Sabtu · 07.00–13.00"]. Beberapa sesi sehari digabung koma.
// Daftar 7 hari Senin sampai Minggu untuk kartu Jadwal di V2: jam per hari, atau null jika libur (tanpa sesi)
export function jadwalSeninMinggu(jadwal: BarisJadwal[]): { nama: string; jam: string | null }[] {
  const urutan = [1, 2, 3, 4, 5, 6, 0]
  return urutan.map((h) => {
    const sesi = jadwal
      .filter((j) => j.hari === h)
      .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
      .map((j) => `${jamJadwal(j.jam_mulai)}–${jamJadwal(j.jam_selesai)}`)
    return { nama: NAMA_HARI[h], jam: sesi.length ? sesi.join(', ') : null }
  })
}

export function ringkasJadwal(jadwal: BarisJadwal[]): string[] {
  const urutanHari = [1, 2, 3, 4, 5, 6, 0]
  const jamPerHari = urutanHari.map((h) =>
    jadwal
      .filter((j) => j.hari === h)
      .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
      .map((j) => `${jamJadwal(j.jam_mulai)}–${jamJadwal(j.jam_selesai)}`)
      .join(', '),
  )
  const baris: string[] = []
  let awal = 0
  for (let i = 1; i <= urutanHari.length; i++) {
    if (i < urutanHari.length && jamPerHari[i] === jamPerHari[awal]) continue
    if (jamPerHari[awal]) {
      const dari = NAMA_HARI[urutanHari[awal]]
      // Tujuh hari dengan jam yang sama: "Setiap hari" (V7)
      const hari =
        awal === 0 && i === urutanHari.length
          ? 'Setiap hari'
          : i - 1 === awal
            ? dari
            : `${dari}–${NAMA_HARI[urutanHari[i - 1]]}`
      baris.push(`${hari} · ${jamPerHari[awal]}`)
    }
    awal = i
  }
  return baris
}
