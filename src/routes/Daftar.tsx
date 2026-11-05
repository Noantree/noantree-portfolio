import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PilihanMasuk } from '../components/PilihanMasuk'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { muatLapakSaya, rutePengarah } from '../lib/pengarah'

function TombolKembali() {
  const navigate = useNavigate()
  return (
    <div className="flex h-16 items-center">
      <button
        type="button"
        aria-label="Kembali"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>
  )
}

function Langkah({ nomor, children }: { nomor: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-extrabold text-brand-tekan">
        {nomor}
      </span>
      <span className="text-[15px] leading-[1.35]">{children}</span>
    </div>
  )
}

function TigaLangkah() {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-kartu p-4">
      <Langkah nomor={1}>Profil lapak: nama, jualan apa, foto</Langkah>
      <Langkah nomor={2}>Satu tempat jualan</Langkah>
      <Langkah nomor={3}>
        Jadwal buka <span className="text-teks-redup">(boleh nanti)</span>
      </Langkah>
      <span className="text-[13px] text-teks-redup">Sekitar 3 menit. Bisa dilanjutkan nanti.</span>
    </div>
  )
}

// Daftarkan lapakmu: V10 untuk tamu (juga pintu masuk pemilik lama), V46 bila sudah masuk (A25, A26).
export default function Daftar() {
  const { sesi, memuat } = useSesi()
  if (memuat) return null
  return sesi ? <SudahMasuk /> : <BelumMasuk />
}

function BelumMasuk() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
      <TombolKembali />
      <img src="/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-2xl" />
      <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Daftarkan lapakmu</h1>
      <p className="-mt-1 text-base leading-normal text-[#3D4A5F]">
        Gratis. Tiap mulai jualan cukup satu tombol, pelanggan langsung tahu kamu buka di mana.
      </p>
      <TigaLangkah />
      <div className="mt-auto flex flex-col gap-4">
        <PilihanMasuk tujuan={{ asal: 'daftar' }} labelGoogle="Lanjut dengan Google" emailTerbuka />
        <p className="text-center text-[13px] leading-normal text-teks-redup">
          Sudah punya lapak? Tombol yang sama langsung membawamu ke lapakmu.
        </p>
      </div>
    </main>
  )
}

function SudahMasuk() {
  const { sesi, keluar } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const [profil, setProfil] = useState<{ nama_tampilan: string | null; foto_url: string | null } | null>(null)
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => {
    if (!sesi) return
    supabase
      .from('profil')
      .select('nama_tampilan, foto_url')
      .eq('id', sesi.user.id)
      .maybeSingle()
      .then(({ data }) => setProfil(data))
  }, [sesi])

  if (!sesi) return null

  const nama = profil?.nama_tampilan ?? (sesi.user.user_metadata?.full_name as string | undefined) ?? sesi.user.email ?? ''
  const foto = profil?.foto_url ?? (sesi.user.user_metadata?.avatar_url as string | undefined) ?? null
  const inisial = nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k.charAt(0))
    .join('')
    .toUpperCase()

  const lanjut = async () => {
    setSibuk(true)
    try {
      const lapak = await muatLapakSaya(sesi.user.id)
      navigate(rutePengarah({ asal: 'daftar' }, lapak))
    } catch {
      tampilkan({ teks: 'Belum bisa memuat data lapak. Coba lagi.', jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-4 px-4 pb-6">
      <TombolKembali />
      <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em]">Daftarkan lapakmu</h1>
      <p className="-mt-1 text-base leading-normal text-[#3D4A5F]">
        Lapak akan terhubung ke akun ini. Kamu tetap bisa mengikuti lapak lain seperti biasa.
      </p>
      <div className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 shadow-[inset_0_0_0_1.5px_#D5DAE2]">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[15px] font-extrabold text-white">
          {foto ? <img src={foto} alt="" className="size-full object-cover" /> : inisial}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-bold">{nama}</span>
          <span className="truncate text-[13px] text-teks-redup">{sesi.user.email}</span>
        </div>
      </div>
      <TigaLangkah />
      <div className="mt-auto flex flex-col gap-2">
        <Tombol onClick={lanjut} disabled={sibuk}>
          Lanjut daftar lapak
        </Tombol>
        <button
          type="button"
          onClick={() => keluar()}
          className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-tekan"
        >
          Bukan akunmu? Ganti akun
        </button>
      </div>
    </main>
  )
}
