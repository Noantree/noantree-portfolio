// Pengurai teks Kebijakan Privasi dan S&K (V38) tanpa API peramban atau Vite, supaya bisa diuji dengan Node
// (scripts/uji-kebijakan.mjs). Dipakai src/lib/kebijakan.ts.

export type IsiBagian =
  | { jenis: 'paragraf'; teks: string }
  | { jenis: 'subjudul'; teks: string }
  | { jenis: 'daftar'; butir: string[] }

export type Bagian = { judul: string; isi: IsiBagian[] }

export type Dokumen = {
  // Baris "Terakhir diperbarui: …" apa adanya
  diperbarui: string | null
  // Paragraf sebelum bagian bernomor, tampil di kotak Ringkasnya (V38). Null kalau draf tidak punya.
  ringkas: string | null
  bagian: Bagian[]
}

export function uraiDokumen(baris: string[]): Dokumen {
  const dok: Dokumen = { diperbarui: null, ringkas: null, bagian: [] }
  let bagian: Bagian | null = null
  for (const mentah of baris) {
    const b = mentah.trim()
    if (!b || b === '---') continue
    if (b.startsWith('### ')) {
      bagian = { judul: b.slice(4), isi: [] }
      dok.bagian.push(bagian)
    } else if (!bagian) {
      if (b.startsWith('Terakhir diperbarui:')) dok.diperbarui = b
      else dok.ringkas = dok.ringkas ? `${dok.ringkas} ${b}` : b
    } else if (b.startsWith('- ')) {
      const akhir = bagian.isi.at(-1)
      if (akhir?.jenis === 'daftar') akhir.butir.push(b.slice(2))
      else bagian.isi.push({ jenis: 'daftar', butir: [b.slice(2)] })
    } else if (/^\*\*[^*]+\*\*$/.test(b)) {
      bagian.isi.push({ jenis: 'subjudul', teks: b.slice(2, -2) })
    } else {
      bagian.isi.push({ jenis: 'paragraf', teks: b })
    }
  }
  return dok
}

// Memecah draf pada dua judul "## KEBIJAKAN PRIVASI" dan "## SYARAT & KETENTUAN"
export function uraiDraf(teks: string): { privasi: Dokumen; sk: Dokumen } {
  const baris = teks.replace(/\r\n/g, '\n').split('\n')
  const awal = (judul: string) => {
    const i = baris.findIndex((b) => b.trim().toUpperCase() === `## ${judul}`)
    if (i < 0) throw new Error(`Judul "${judul}" tidak ada di docs/draf-kebijakan-sk.md`)
    return i
  }
  const p = awal('KEBIJAKAN PRIVASI')
  const s = awal('SYARAT & KETENTUAN')
  return {
    privasi: uraiDokumen(baris.slice(p + 1, s > p ? s : undefined)),
    sk: uraiDokumen(baris.slice(s + 1, p > s ? p : undefined)),
  }
}

// Pemeriksaan draf (npm run uji:kebijakan) supaya draf yang salah tidak tayang: ringkasan wajib ada, nomor bagian berurutan dari 1,
// dan kode aturan internal (misalnya A37) tidak boleh ada di teks yang tampil ke pengguna
export function periksaDokumen(nama: string, dok: Dokumen) {
  if (!dok.ringkas) throw new Error(`${nama}: paragraf ringkasan tidak ada`)
  dok.bagian.forEach((b, i) => {
    if (!b.judul.startsWith(`${i + 1}. `)) throw new Error(`${nama}: bagian ke-${i + 1} bernomor salah: "${b.judul}"`)
  })
  const semua = [
    dok.diperbarui ?? '',
    dok.ringkas,
    ...dok.bagian.flatMap((b) => [b.judul, ...b.isi.flatMap((x) => (x.jenis === 'daftar' ? x.butir : [x.teks]))]),
  ]
  const kode = semua.find((t) => /\bA\d+\b/.test(t))
  if (kode) throw new Error(`${nama}: kode aturan internal di teks: "${kode}"`)
}


// Kontak dan banding (A48), dijadikan link email di layar
export const EMAIL_KONTAK = 'kontak@contoh.invalid'

// Potongan teks satu baris: tebal (**…**), tanda [TODO …], dan alamat email kontak
export type Potongan = { jenis: 'teks' | 'tebal' | 'todo' | 'email'; teks: string }

export function potongBaris(teks: string): Potongan[] {
  const pola = /(\*\*[^*]+\*\*|\[TODO[^\]]*\]|kontak@contoh\.invalid)/g
  return teks
    .split(pola)
    .filter(Boolean)
    .map((t): Potongan => {
      if (t.startsWith('**') && t.endsWith('**') && t.length > 4) return { jenis: 'tebal', teks: t.slice(2, -2) }
      if (t.startsWith('[TODO')) return { jenis: 'todo', teks: t }
      if (t === EMAIL_KONTAK) return { jenis: 'email', teks: t }
      return { jenis: 'teks', teks: t }
    })
}
