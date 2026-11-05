import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { kecilkanFoto } from '../lib/foto'
import { inisialLapak, muatLapakSaya, teksLangkahBelumSelesai } from '../lib/pengarah'
import { jumlahDiikuti } from '../lib/ikuti'
import { LembarHapusAkun } from '../components/LembarHapusAkun'
import { LembarTutupLapak } from '../components/LembarTutupLapak'

type Profil = { nama_tampilan: string | null; foto_url: string | null }

const BARIS_AKUN = 'flex min-h-[52px] items-center justify-between px-4 text-[15px] font-semibold text-tinta hover:text-tinta'

// Akun saya (V8, V50): foto, nama, email, pintu masuk Daftar lapak atau kartu Lapakku, Lapak yang diikuti, V38, Keluar,
// Hapus akun (V32), dan Tutup lapak permanen (V51) lewat saran di V32.
export default function Akun() {
  const { sesi, memuat, keluar, gantiAkun } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const [profil, setProfil] = useState<Profil | null>(null)
  const [nama, setNama] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [kartuLapak, setKartuLapak] = useState<{ ke: string; judul: string; teks: string; tombol?: string } | null>(null)
  const [jumlahIkuti, setJumlahIkuti] = useState<number | null>(null)
  const [lembarHapus, setLembarHapus] = useState(false)
  const [lembarTutupLapak, setLembarTutupLapak] = useState(false)
  // Kartu Lapakku (V50) untuk lapak tayang atau disembunyikan
  const [lapakku, setLapakku] = useState<{ nama: string; fotoUrl: string | null } | null>(null)

  // Angka di baris Lapak yang diikuti; kalau gagal dibaca, angkanya tidak ditampilkan
  useEffect(() => {
    let batal = false
    jumlahDiikuti().then(
      (n) => !batal && setJumlahIkuti(n),
      () => {},
    )
    return () => {
      batal = true
    }
  }, [])

  useEffect(() => {
    if (memuat) return
    if (!sesi) {
      navigate('/', { replace: true })
      return
    }
    // Tanpa baris lapak: Buka lapakmu (V08). Draf: Lanjutkan daftar lapakmu, juga pengingat setelah banner V47 ditutup (A31).
    // Tayang atau disembunyikan: kartu Lapakku (V50) menuju Profil lapak (V16). Kalau gagal dibaca, kartu tidak ditampilkan.
    muatLapakSaya(sesi.user.id)
      .then((lapak) => {
        if (!lapak)
          setKartuLapak({
            ke: '/daftar',
            judul: 'Buka lapakmu di noantree',
            teks: 'Punya lapak atau jualan keliling? Daftar gratis pakai akun ini.',
            tombol: 'Daftar lapak sekarang',
          })
        else if (lapak.status_tayang === 'draf')
          setKartuLapak({
            ke: `/daftar/${lapak.langkah_daftar}`,
            judul: 'Lanjutkan daftar lapakmu',
            teks: teksLangkahBelumSelesai(lapak.langkah_daftar),
          })
        else {
          setKartuLapak(null)
          setLapakku({ nama: lapak.nama, fotoUrl: lapak.foto_url })
        }
      })
      .catch(() => setKartuLapak(null))
    const muat = async () => {
      const { data } = await supabase
        .from('profil')
        .select('nama_tampilan, foto_url')
        .eq('id', sesi.user.id)
        .maybeSingle()
      if (data) {
        setProfil(data)
        setNama(data.nama_tampilan ?? '')
        return
      }
      // Baris profil belum ada: buat dari nama akun Google, atau email bila tidak ada nama
      const awal = (sesi.user.user_metadata?.full_name as string | undefined) ?? sesi.user.email ?? 'Pengguna'
      await supabase.from('profil').upsert({ id: sesi.user.id, nama_tampilan: awal }, { onConflict: 'id' })
      setProfil({ nama_tampilan: awal, foto_url: null })
      setNama(awal)
    }
    muat()
  }, [memuat, sesi, navigate])

  if (memuat || !sesi) return null

  const simpanNama = async () => {
    const bersih = nama.trim()
    if (!bersih) {
      tampilkan({ teks: 'Nama tidak boleh kosong.', jenis: 'merah' })
      return
    }
    setSibuk(true)
    const { error } = await supabase
      .from('profil')
      .upsert({ id: sesi.user.id, nama_tampilan: bersih }, { onConflict: 'id' })
    setSibuk(false)
    if (error) tampilkan({ teks: 'Nama belum tersimpan. Coba lagi.', jenis: 'merah' })
    else {
      setProfil((p) => (p ? { ...p, nama_tampilan: bersih } : p))
      tampilkan({ teks: 'Nama tersimpan.', jenis: 'berhasil' })
    }
  }

  const gantiFoto = async (file: File) => {
    setSibuk(true)
    try {
      const kecil = await kecilkanFoto(file)
      const path = `${sesi.user.id}/profil.jpg`
      const { error: eUnggah } = await supabase.storage
        .from('foto-profil')
        .upload(path, kecil, { upsert: true, contentType: 'image/jpeg' })
      if (eUnggah) throw eUnggah
      const { data } = supabase.storage.from('foto-profil').getPublicUrl(path)
      const url = `${data.publicUrl}?v=${Date.now()}`
      const { error: eProfil } = await supabase.from('profil').update({ foto_url: url }).eq('id', sesi.user.id)
      if (eProfil) throw eProfil
      setProfil((p) => (p ? { ...p, foto_url: url } : p))
      tampilkan({ teks: 'Foto profil diganti.', jenis: 'berhasil' })
    } catch (e) {
      tampilkan({ teks: e instanceof Error ? e.message : 'Foto belum bisa diunggah.', jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  const inisial = (profil?.nama_tampilan ?? sesi.user.email ?? '?').trim().charAt(0).toUpperCase()
  // Foto yang diunggah didahulukan; kalau belum ada, pakai foto dari akun Google
  const fotoTampil = profil?.foto_url ?? (sesi.user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-6 px-4 pb-10 pt-6">
      <div className="flex items-center gap-3">
        <Link to="/" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full bg-kartu">
          ‹
        </Link>
        <h1 className="text-[20px] font-bold">Akun saya</h1>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-brand text-3xl font-extrabold text-white">
          {fotoTampil ? <img src={fotoTampil} alt="" className="size-full object-cover" /> : inisial}
        </div>
        <label className="cursor-pointer text-sm font-bold text-brand-tekan">
          Ganti foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={sibuk}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) gantiFoto(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="h-13 rounded-2xl bg-kartu px-4 text-base font-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
      </label>
      <Tombol varian="kedua" onClick={simpanNama} disabled={sibuk}>
        Simpan nama
      </Tombol>

      <div className="flex flex-col gap-1 rounded-2xl bg-kartu p-4">
        <span className="text-xs text-teks-redup">Email</span>
        <span className="text-[15px] font-semibold">{sesi.user.email}</span>
      </div>

      {kartuLapak && (
        <Link to={kartuLapak.ke} className="flex items-center gap-3 rounded-[20px] bg-brand-muda p-4 text-tinta">
          <div className="flex grow flex-col gap-1.5">
            <span className="text-[17px] font-bold tracking-[-0.01em]">{kartuLapak.judul}</span>
            <span className="text-sm leading-[1.45] text-[#3D4A5F]">{kartuLapak.teks}</span>
            {kartuLapak.tombol && (
              // Bukan tombol sungguhan: seluruh kartu sudah tautan. Ini hanya tampilan (V08 terbaru).
              <span className="mt-1.5 flex h-11 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-white">
                {kartuLapak.tombol}
              </span>
            )}
          </div>
          {!kartuLapak.tombol && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-brand-tekan">
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
        </Link>
      )}

      {lapakku && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Lapakku</span>
          <Link
            to="/lapakku/profil"
            className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 text-tinta shadow-[inset_0_0_0_1.5px_#D5DAE2] hover:text-tinta"
          >
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[15px] font-extrabold text-white">
              {lapakku.fotoUrl ? <img src={lapakku.fotoUrl} alt="" className="size-full object-cover" /> : inisialLapak(lapakku.nama)}
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="truncate text-base font-bold">{lapakku.nama}</span>
              <span className="text-[13px] text-[#5B6472]">Kelola profil, tempat, dan jadwal</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A4FC2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      )}

      {/* Lapak yang diikuti (V50, V7, A43), Kebijakan Privasi, dan Syarat & Ketentuan (V38) dalam satu kotak */}
      <div className="flex flex-col overflow-hidden rounded-[20px] bg-kartu">
        <Link to="/diikuti" className={BARIS_AKUN}>
          Lapak yang diikuti <span className="text-teks-redup">{jumlahIkuti ?? ''} ›</span>
        </Link>
        <Link to="/akun/kebijakan" className={`${BARIS_AKUN} bg-[#EEF1F6]`}>
          Kebijakan Privasi <span className="text-teks-redup">›</span>
        </Link>
        <Link to="/akun/kebijakan?tab=sk" className={BARIS_AKUN}>
          Syarat &amp; Ketentuan <span className="text-teks-redup">›</span>
        </Link>
      </div>

      <div className="mt-4">
        {/* A28: ganti akun memilih akun Google lain (login Google otomatis memakai akun terakhir) */}
        <button
          type="button"
          onClick={() => gantiAkun()}
          className="flex h-11 w-full items-center justify-center text-[15px] font-bold text-brand"
        >
          Ganti akun
        </button>
        <Tombol varian="netral" onClick={async () => { await keluar(); navigate('/') }}>
          Keluar
        </Tombol>
        <button
          type="button"
          onClick={() => setLembarHapus(true)}
          className="mt-2 flex h-11 w-full items-center justify-center text-sm font-semibold text-merah"
        >
          Hapus akun dan semua data saya
        </button>
      </div>

      {lembarHapus && (
        <LembarHapusAkun
          uid={sesi.user.id}
          onTutup={() => setLembarHapus(false)}
          onTerhapus={() => {
            setLembarHapus(false)
            tampilkan({ teks: 'Akunmu sudah dihapus.', jenis: 'netral' })
            navigate('/', { replace: true })
          }}
          onTutupLapak={() => {
            setLembarHapus(false)
            setLembarTutupLapak(true)
          }}
        />
      )}

      {/* Tutup lapak permanen (V51), dari saran "Tutup lapak saja" di V32 */}
      {lembarTutupLapak && (
        <LembarTutupLapak
          uid={sesi.user.id}
          onTutup={() => setLembarTutupLapak(false)}
          onSelesai={() => {
            setLembarTutupLapak(false)
            tampilkan({ teks: 'Lapakmu sudah ditutup.', jenis: 'netral' })
            navigate('/', { replace: true })
          }}
        />
      )}
    </main>
  )
}
