import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GridFotoLapak } from '../components/GridFotoLapak'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { linkLapak } from '../lib/bagikan'
import { kecilkanFoto } from '../lib/foto'
import {
  MAKS_FOTO_LAPAK,
  UKURAN_FOTO_LAPAK,
  UKURAN_FOTO_PROFIL,
  hapusFileFotoLapak,
  kunciBaru,
  unggahFotoLapak,
  type FotoLapak,
} from '../lib/fotoLapak'
import { inisialLapak } from '../lib/pengarah'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'

const MAKS_DESKRIPSI = 300

type Lapak = { id: string; slug: string; nama: string; deskripsi: string | null; foto_url: string | null }
type Isi = { lapak: Lapak; foto: { id: string; url: string }[] }

// Tanpa lapak ke /daftar, lapak draf ke langkah yang belum selesai; selain itu isi V42
async function muatUbahProfil(uid: string): Promise<Isi | { arah: string }> {
  const { data: lapak, error } = await supabase
    .from('lapak')
    .select('id, slug, nama, deskripsi, foto_url, status_tayang, langkah_daftar')
    .eq('pemilik_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!lapak) return { arah: '/daftar' }
  if (lapak.status_tayang === 'draf') return { arah: `/daftar/${lapak.langkah_daftar}` }
  const { data: foto, error: eFoto } = await supabase.from('foto_lapak').select('id, url').eq('lapak_id', lapak.id).order('urutan')
  if (eFoto) throw eFoto
  return { lapak: lapak as Lapak, foto: (foto ?? []) as { id: string; url: string }[] }
}

// Ubah profil (V42; A36, A37, A40) di /lapakku/profil/ubah, untuk pemilik lapak tayang dan disembunyikan.
// Foto profil 512 px maks. 500 KB, nama (slug tetap, jadi link dan QR lama tetap jalan), deskripsi teks biasa
// maks. 300 karakter tanpa link, dan maks. 4 foto lapak 1600 px maks. 3 MB. Disimpan sekaligus lewat
// simpan_profil_lapak (026), yang memeriksa ulang semua aturan. File foto yang tidak dipakai lagi dihapus setelahnya.
export default function UbahProfil() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()
  const uid = sesi?.user.id

  const [lapak, setLapak] = useState<Lapak | null>(null)
  const [gagal, setGagal] = useState(false)
  const [putaran, setPutaran] = useState(0)
  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [fotoProfil, setFotoProfil] = useState<{ url: string | null; blob?: Blob }>({ url: null })
  const [fotoLapak, setFotoLapak] = useState<FotoLapak[]>([])
  // Foto lapak tersimpan yang dihapus atau diganti: id untuk database, url untuk berkas di Storage
  const [hapus, setHapus] = useState<{ id: string; url: string }[]>([])
  const [mengolah, setMengolah] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/', { replace: true })
      return
    }
    let batal = false
    muatUbahProfil(uid).then(
      (hasil) => {
        if (batal) return
        if ('arah' in hasil) {
          navigate(hasil.arah, { replace: true })
          return
        }
        setLapak(hasil.lapak)
        setNama(hasil.lapak.nama)
        setDeskripsi(hasil.lapak.deskripsi ?? '')
        setFotoProfil({ url: hasil.lapak.foto_url })
        setFotoLapak(hasil.foto.map((f) => ({ kunci: f.id, id: f.id, url: f.url })))
        setGagal(false)
      },
      () => !batal && setGagal(true),
    )
    return () => {
      batal = true
    }
  }, [memuat, uid, navigate, putaran])

  if (memuat || !sesi) return null

  const kepala = (
    <div className="flex h-16 items-center gap-3">
      <Link to="/lapakku/profil" aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="text-xl font-bold">Ubah profil</h1>
    </div>
  )

  if (!lapak) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] bg-white px-4 pb-7">
        {kepala}
        {gagal ? (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-kartu px-5 py-6">
            <span role="alert" className="text-sm leading-normal text-[#3D4A5F]">
              Profil lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
            </span>
            <button
              type="button"
              onClick={() => {
                setGagal(false)
                setPutaran((n) => n + 1)
              }}
              className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <span role="status" className="text-[13px] text-teks-redup">
            Memuat profil lapak…
          </span>
        )}
      </main>
    )
  }

  const olahFoto = async (file: File, ukuran: { sisi: number; batasByte: number }) => {
    try {
      return await kecilkanFoto(file, ukuran.sisi, ukuran.batasByte)
    } catch (e) {
      tampilkan({ teks: e instanceof Error ? e.message : 'Foto belum bisa dibaca. Pilih foto lain.', jenis: 'merah' })
      return null
    }
  }

  const gantiFotoProfil = async (file: File) => {
    setMengolah(true)
    const blob = await olahFoto(file, UKURAN_FOTO_PROFIL)
    setMengolah(false)
    if (!blob) return
    if (fotoProfil.blob && fotoProfil.url) URL.revokeObjectURL(fotoProfil.url)
    setFotoProfil({ url: URL.createObjectURL(blob), blob })
  }

  const tambahFotoLapak = async (files: FileList) => {
    const sisa = MAKS_FOTO_LAPAK - fotoLapak.length
    const dipilih = Array.from(files).slice(0, sisa)
    if (files.length > sisa) tampilkan({ teks: `Maks. ${MAKS_FOTO_LAPAK} foto lapak.`, jenis: 'netral' })
    setMengolah(true)
    const baru: FotoLapak[] = []
    for (const file of dipilih) {
      const blob = await olahFoto(file, UKURAN_FOTO_LAPAK)
      if (blob) baru.push({ kunci: kunciBaru(), url: URL.createObjectURL(blob), blob })
    }
    setMengolah(false)
    setFotoLapak((f) => [...f, ...baru].slice(0, MAKS_FOTO_LAPAK))
  }

  const lepasFoto = (foto: FotoLapak) => {
    if (foto.id) setHapus((h) => [...h, { id: foto.id!, url: foto.url }])
    if (foto.blob) URL.revokeObjectURL(foto.url)
  }

  const buangFoto = (foto: FotoLapak) => {
    lepasFoto(foto)
    setFotoLapak((f) => f.filter((x) => x.kunci !== foto.kunci))
  }

  // Ketuk foto: foto pengganti menempati kotak yang sama; foto lama ikut dihapus saat disimpan
  const gantiFotoLapak = async (foto: FotoLapak, file: File) => {
    setMengolah(true)
    const blob = await olahFoto(file, UKURAN_FOTO_LAPAK)
    setMengolah(false)
    if (!blob) return
    lepasFoto(foto)
    setFotoLapak((f) => f.map((x) => (x.kunci === foto.kunci ? { kunci: kunciBaru(), url: URL.createObjectURL(blob), blob } : x)))
  }

  const simpan = async () => {
    if (!nama.trim()) {
      tampilkan({ teks: 'Isi nama lapak dulu.', jenis: 'merah' })
      return
    }
    if (/http|www\./i.test(deskripsi)) {
      tampilkan({ teks: 'Keterangan tidak boleh berisi link.', jenis: 'merah' })
      return
    }
    setSibuk(true)
    const terunggah: string[] = []
    try {
      let urlProfil = fotoProfil.url
      if (fotoProfil.blob) {
        urlProfil = await unggahFotoLapak(sesi.user.id, fotoProfil.blob, 'profil-')
        terunggah.push(urlProfil)
      }
      const urlBaru: string[] = []
      for (const foto of fotoLapak) {
        if (!foto.blob) continue
        const url = await unggahFotoLapak(sesi.user.id, foto.blob, '')
        terunggah.push(url)
        urlBaru.push(url)
      }

      const { error } = await supabase.rpc('simpan_profil_lapak', {
        p_lapak: lapak.id,
        p_nama: nama,
        p_deskripsi: deskripsi,
        p_foto_url: urlProfil,
        p_foto_hapus: hapus.map((h) => h.id),
        p_foto_baru: urlBaru,
      })
      if (error) throw error

      // Berkas yang tidak dipakai lagi: foto profil lama yang diganti dan foto lapak yang dihapus atau diganti
      await hapusFileFotoLapak(sesi.user.id, [
        ...(urlProfil !== lapak.foto_url ? [lapak.foto_url] : []),
        ...hapus.map((h) => h.url),
      ])
      tampilkan({ teks: 'Profil lapak tersimpan.', jenis: 'berhasil' })
      navigate('/lapakku/profil')
    } catch (e) {
      // Foto yang sudah terunggah tetapi tidak jadi dipakai ikut dihapus
      await hapusFileFotoLapak(sesi.user.id, terunggah)
      tampilkan({ teks: (e as { message?: string } | null)?.message || 'Profil lapak belum tersimpan. Coba lagi.', jenis: 'merah' })
      setSibuk(false)
    }
  }

  const nonaktif = mengolah || sibuk

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] bg-white px-4 pb-7">
      {kepala}

      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[26px] font-extrabold text-white">
          {fotoProfil.url ? <img src={fotoProfil.url} alt="" className="size-full object-cover" /> : inisialLapak(nama || lapak.nama)}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            className={`flex h-11 w-fit cursor-pointer items-center rounded-full bg-brand-muda px-[18px] text-sm font-bold text-brand-tekan ${
              nonaktif ? 'opacity-50' : ''
            }`}
          >
            Ganti foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={nonaktif}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) gantiFotoProfil(f)
                e.target.value = ''
              }}
            />
          </label>
          <span className="text-[13px] text-teks-redup">Maks. 500 KB, otomatis dikecilkan.</span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Nama lapak
        <input
          type="text"
          name="nama_lapak"
          autoComplete="off"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="h-13 rounded-2xl bg-kartu px-4 text-base font-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
        {/* A36: slug tidak berubah walau nama diganti. Alamat situs resmi dari src/lib/situs.ts. */}
        <span className="text-xs font-medium text-teks-redup [overflow-wrap:anywhere]">
          Link lapak tetap {linkLapak(lapak.slug).tampil}, jadi QR yang sudah dicetak tetap jalan.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Jual atau layani apa?
        <textarea
          name="deskripsi"
          rows={3}
          autoComplete="off"
          maxLength={MAKS_DESKRIPSI}
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          className="resize-none rounded-2xl bg-kartu px-4 py-3.5 text-base font-normal leading-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
        <span className="text-xs font-medium text-teks-redup">Menu, harga, atau keterangan. Teks biasa, tanpa link.</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">
          Foto lapak{' '}
          <span className="font-medium text-teks-redup">
            {fotoLapak.length} dari {MAKS_FOTO_LAPAK}
          </span>
        </span>
        <GridFotoLapak
          foto={fotoLapak}
          nonaktif={nonaktif}
          sibuk={sibuk}
          onTambah={tambahFotoLapak}
          onBuang={buangFoto}
          onGanti={gantiFotoLapak}
        />
        <span className="text-xs text-teks-redup">Ketuk foto untuk mengganti atau menghapus.</span>
      </div>

      <Tombol className="mt-auto" onClick={simpan} disabled={nonaktif}>
        {sibuk ? 'Menyimpan…' : 'Simpan perubahan'}
      </Tombol>
    </main>
  )
}
