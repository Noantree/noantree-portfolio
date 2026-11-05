import { useState } from 'react'
import { Tombol } from './Tombol'
import { usePesan } from './Pesan'
import { useSesi } from '../lib/sesi'
import type { Tujuan } from '../lib/pengarah'
import CekEmail from '../routes/CekEmail'

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Cara masuk yang sama di semua tempat (A25): Google utama, email kedua.
// Masuk lewat email membuka kolom email di tempat (gaya kolom V10), lalu Cek email (V24).
// V10 memakai label Lanjut dengan Google dan kolom email yang langsung terbuka.
export function PilihanMasuk({
  tujuan,
  labelGoogle = 'Masuk dengan Google',
  emailTerbuka = false,
}: {
  tujuan?: Tujuan
  labelGoogle?: string
  emailTerbuka?: boolean
}) {
  const { masukGoogle, kirimLinkEmail } = useSesi()
  const { tampilkan } = usePesan()
  const [kolomTerbuka, setKolomTerbuka] = useState(emailTerbuka)
  const [email, setEmail] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [terkirimKe, setTerkirimKe] = useState<string | null>(null)

  const kirim = async () => {
    const bersih = email.trim().toLowerCase()
    if (!POLA_EMAIL.test(bersih)) {
      tampilkan({ teks: 'Tulis alamat email yang benar.', jenis: 'merah' })
      return
    }
    setSibuk(true)
    const berhasil = await kirimLinkEmail(bersih, tujuan)
    setSibuk(false)
    if (berhasil) setTerkirimKe(bersih)
    else tampilkan({ teks: 'Link belum terkirim. Coba lagi sebentar lagi.', jenis: 'merah' })
  }

  return (
    <>
      <Tombol onClick={() => masukGoogle(tujuan)}>
        <span className="flex size-6 items-center justify-center rounded-full bg-white text-sm font-extrabold text-brand">G</span>
        {labelGoogle}
      </Tombol>

      {emailTerbuka && (
        <div className="flex items-center gap-2.5 text-[13px] text-teks-redup">
          <span className="h-px grow bg-[#E3E7EE]" />
          atau lewat email
          <span className="h-px grow bg-[#E3E7EE]" />
        </div>
      )}

      {kolomTerbuka ? (
        <form
          className="grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            kirim()
          }}
        >
          <label className="flex min-w-0">
            <span className="sr-only">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoFocus={!emailTerbuka}
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-13 w-full min-w-0 rounded-[26px] bg-kartu px-4.5 text-base outline-none ring-2 ring-transparent focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            disabled={sibuk}
            className="h-13 rounded-[26px] bg-brand-muda px-4.5 text-[15px] font-bold text-brand-tekan active:bg-[#DCE7FC] disabled:opacity-50"
          >
            Kirim link
          </button>
        </form>
      ) : (
        <Tombol varian="netral" className="h-12 text-[15px]" onClick={() => setKolomTerbuka(true)}>
          Masuk lewat email
        </Tombol>
      )}

      {terkirimKe && <CekEmail email={terkirimKe} tujuan={tujuan} onGanti={() => setTerkirimKe(null)} />}
    </>
  )
}
