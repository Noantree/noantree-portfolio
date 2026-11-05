import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tombol } from '../components/Tombol'
import { usePesan } from '../components/Pesan'
import { useSesi } from '../lib/sesi'
import { supabase } from '../lib/supabase'
import { kecilkanFoto } from '../lib/foto'
import { inisialLapak } from '../lib/pengarah'
import { munculkanBannerDaftar } from '../lib/pengingat'
import { GridFotoLapak } from '../components/GridFotoLapak'
import {
  MAKS_FOTO_LAPAK as MAKS_FOTO,
  UKURAN_FOTO_LAPAK,
  UKURAN_FOTO_PROFIL,
  kunciBaru,
  unggahFotoLapak,
  type FotoLapak as Foto,
} from '../lib/fotoLapak'

const MAKS_DESKRIPSI = 300

// Daftar 1: Profil lapak (V11). Disimpan sebagai draf lewat fungsi simpan_daftar_1 (A30, A32, A37, A40).
export default function Daftar1() {
  const { sesi, memuat } = useSesi()
  const navigate = useNavigate()
  const { tampilkan } = usePesan()

  const [siap, setSiap] = useState(false)
  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [izin, setIzin] = useState(false)
  // A52: null = belum dijawab. true = pindah tempat dalam 1 minggu, false = tetap di satu tempat.
  const [pindah, setPindah] = useState<boolean | null>(null)
  const [fotoProfil, setFotoProfil] = useState<{ url: string | null; blob?: Blob }>({ url: null })
  const [fotoLapak, setFotoLapak] = useState<Foto[]>([])
  const [hapusFoto, setHapusFoto] = useState<string[]>([])
  const [mengolah, setMengolah] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  // Dipicu oleh id akun, bukan objek sesi: sesi berganti tiap token diperbarui dan akan menimpa isian
  const uid = sesi?.user.id

  useEffect(() => {
    if (memuat) return
    if (!uid) {
      navigate('/daftar', { replace: true })
      return
    }
    const muat = async () => {
      const { data: lapak, error } = await supabase
        .from('lapak')
        .select('id, nama, deskripsi, foto_url, status_tayang, izin_tampil_pada, pindah_mingguan')
        .eq('pemilik_id', uid)
        .maybeSingle()
      if (error) {
        tampilkan({ teks: 'Belum bisa memuat data lapak. Coba lagi.', jenis: 'merah' })
        setSiap(true)
        return
      }
      if (lapak && lapak.status_tayang !== 'draf') {
        navigate('/lapakku', { replace: true })
        return
      }
      if (lapak) {
        setNama(lapak.nama)
        setDeskripsi(lapak.deskripsi ?? '')
        setIzin(lapak.izin_tampil_pada !== null)
        setPindah(lapak.pindah_mingguan)
        setFotoProfil({ url: lapak.foto_url })
        const { data: foto } = await supabase
          .from('foto_lapak')
          .select('id, url')
          .eq('lapak_id', lapak.id)
          .order('urutan')
        setFotoLapak((foto ?? []).map((f) => ({ kunci: f.id, id: f.id, url: f.url })))
      }
      setSiap(true)
    }
    muat()
  }, [memuat, uid, navigate, tampilkan])

  if (!sesi || !siap) return null

  const olahFoto = async (file: File, sisi: number, batasByte: number) => {
    try {
      return await kecilkanFoto(file, sisi, batasByte)
    } catch (e) {
      tampilkan({ teks: e instanceof Error ? e.message : 'Foto belum bisa dibaca. Pilih foto lain.', jenis: 'merah' })
      return null
    }
  }

  // A40: foto profil lapak 512 px maks. 500 KB
  const pilihFotoProfil = async (file: File) => {
    setMengolah(true)
    const blob = await olahFoto(file, UKURAN_FOTO_PROFIL.sisi, UKURAN_FOTO_PROFIL.batasByte)
    setMengolah(false)
    if (blob) setFotoProfil({ url: URL.createObjectURL(blob), blob })
  }

  // A40: foto lapak 1600 px maks. 3 MB, maks. 4 foto
  const tambahFotoLapak = async (files: FileList) => {
    const sisa = MAKS_FOTO - fotoLapak.length
    const dipilih = Array.from(files).slice(0, sisa)
    if (files.length > sisa) tampilkan({ teks: `Maks. ${MAKS_FOTO} foto lapak.`, jenis: 'netral' })
    setMengolah(true)
    const baru: Foto[] = []
    for (const file of dipilih) {
      const blob = await olahFoto(file, UKURAN_FOTO_LAPAK.sisi, UKURAN_FOTO_LAPAK.batasByte)
      if (blob) baru.push({ kunci: kunciBaru(), url: URL.createObjectURL(blob), blob })
    }
    setMengolah(false)
    setFotoLapak((f) => [...f, ...baru].slice(0, MAKS_FOTO))
  }

  const buangFoto = (foto: Foto) => {
    if (foto.id) setHapusFoto((h) => [...h, foto.id!])
    if (foto.blob) URL.revokeObjectURL(foto.url)
    setFotoLapak((f) => f.filter((x) => x.kunci !== foto.kunci))
  }

  const unggah = (blob: Blob, awalan: string) => unggahFotoLapak(sesi.user.id, blob, awalan)

  const lanjut = () => {
    if (!nama.trim()) {
      tampilkan({ teks: 'Isi nama lapak dulu.', jenis: 'merah' })
      return
    }
    if (/http|www\./i.test(deskripsi)) {
      tampilkan({ teks: 'Keterangan tidak boleh berisi link.', jenis: 'merah' })
      return
    }
    if (!izin) {
      tampilkan({ teks: 'Centang persetujuan tampil untuk umum dulu.', jenis: 'merah' })
      return
    }
    if (pindah === null) {
      tampilkan({ teks: 'Jawab dulu: apakah lapakmu pindah tempat dalam 1 minggu?', jenis: 'merah' })
      return
    }
    simpan(true)
  }

  // Lanjutkan nanti menyimpan isian yang ada tanpa menaikkan langkah, lalu ke beranda dengan banner V47 (A31).
  // Nama lapak wajib ada di database; tanpa nama belum ada yang bisa disimpan.
  const lanjutkanNanti = () => {
    if (!nama.trim()) {
      navigate('/')
      return
    }
    if (/http|www\./i.test(deskripsi)) {
      tampilkan({ teks: 'Keterangan tidak boleh berisi link.', jenis: 'merah' })
      return
    }
    simpan(false)
  }

  // selesai = true: Lanjut ke Daftar 2. selesai = false: Lanjutkan nanti.
  const simpan = async (selesai: boolean) => {
    setSibuk(true)
    try {
      let urlProfil = fotoProfil.url
      if (fotoProfil.blob) {
        urlProfil = await unggah(fotoProfil.blob, 'profil-')
        setFotoProfil({ url: urlProfil })
      }

      const { data: lapakId, error } = await supabase.rpc('simpan_daftar_1', {
        p_nama: nama,
        p_deskripsi: deskripsi,
        p_foto_url: urlProfil,
        p_izin: izin,
        p_selesai: selesai,
        p_pindah: pindah,
      })
      if (error) throw new Error('Profil lapak belum tersimpan. Coba lagi.')

      if (hapusFoto.length) {
        const { error: eHapus } = await supabase.from('foto_lapak').delete().in('id', hapusFoto)
        if (eHapus) throw new Error('Foto lama belum terhapus. Coba lagi.')
        setHapusFoto([])
      }

      // Foto baru diunggah satu per satu; yang berhasil langsung ditandai supaya tidak terunggah dua kali saat coba lagi
      const daftar = [...fotoLapak]
      for (let i = 0; i < daftar.length; i++) {
        const foto = daftar[i]
        if (!foto.blob) continue
        const url = await unggah(foto.blob, '')
        const { data: baris, error: eFoto } = await supabase
          .from('foto_lapak')
          .insert({ lapak_id: lapakId, url, urutan: i + 1 })
          .select('id')
          .single()
        if (eFoto) throw new Error('Foto lapak belum tersimpan. Coba lagi.')
        URL.revokeObjectURL(foto.url)
        daftar[i] = { kunci: foto.kunci, id: baris.id, url }
        setFotoLapak([...daftar])
      }

      if (selesai) navigate('/daftar/2')
      else {
        munculkanBannerDaftar(sesi.user.id)
        navigate('/')
      }
    } catch (e) {
      tampilkan({ teks: e instanceof Error ? e.message : 'Belum tersimpan. Coba lagi.', jenis: 'merah' })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-[18px] px-4 pb-7 pt-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-teks-redup">Langkah 1 dari 3</span>
          <button
            type="button"
            onClick={lanjutkanNanti}
            disabled={sibuk || mengolah}
            className="flex min-h-11 items-center text-[13px] font-bold text-brand-tekan disabled:opacity-50"
          >
            Lanjutkan nanti
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-1.5 rounded-full bg-brand" />
          <div className="h-1.5 rounded-full bg-[#E3E7EE]" />
          <div className="h-1.5 rounded-full bg-[#E3E7EE]" />
        </div>
      </div>

      <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">Profil lapak kamu</h1>

      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[26px] font-extrabold text-white">
          {fotoProfil.url ? (
            <img src={fotoProfil.url} alt="" className="size-full object-cover" />
          ) : (
            inisialLapak(nama)
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            className={`flex h-11 w-fit cursor-pointer items-center rounded-full bg-brand-muda px-[18px] text-sm font-bold text-brand-tekan ${
              mengolah || sibuk ? 'opacity-50' : ''
            }`}
          >
            Pilih atau ambil foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={mengolah || sibuk}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pilihFotoProfil(f)
                e.target.value = ''
              }}
            />
          </label>
          <span className="text-[13px] text-teks-redup">Opsional. Tanpa foto, inisial dipakai.</span>
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
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Jual atau layani apa?
        <textarea
          name="deskripsi"
          rows={3}
          autoComplete="off"
          maxLength={MAKS_DESKRIPSI}
          placeholder="Contoh: bakso urat 12 rb, mie ayam 10 rb, bisa bungkus…"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          className="resize-none rounded-2xl bg-kartu px-4 py-3.5 text-base font-normal leading-normal outline-none ring-2 ring-transparent focus:ring-brand"
        />
        <span className="text-xs font-medium text-teks-redup">Menu, harga, atau keterangan. Teks biasa, tanpa link.</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">
          Foto lapak <span className="font-medium text-teks-redup">(opsional, maks. {MAKS_FOTO})</span>
        </span>
        <GridFotoLapak
          foto={fotoLapak}
          nonaktif={mengolah || sibuk}
          sibuk={sibuk}
          onTambah={tambahFotoLapak}
          onBuang={buangFoto}
        />
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm leading-[1.45] font-bold">
          Dalam 1 minggu, apakah lapakmu pindah ke tempat lain?
        </legend>
        {[
          { nilai: false, teks: 'Tidak, tetap di satu tempat' },
          { nilai: true, teks: 'Ya, berpindah tempat dalam 1 minggu' },
        ].map((pilihan) => (
          <label
            key={String(pilihan.nilai)}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-[15px] font-semibold ${
              pindah === pilihan.nilai ? 'border-brand bg-brand-muda' : 'border-transparent bg-kartu'
            }`}
          >
            <input
              type="radio"
              name="pindah"
              checked={pindah === pilihan.nilai}
              onChange={() => setPindah(pilihan.nilai)}
              className="size-[22px] shrink-0 accent-brand"
            />
            <span>{pilihan.teks}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col rounded-[20px] bg-kartu px-4 py-1.5">
        <label className="flex items-start gap-3 py-3 text-sm leading-[1.45]">
          <input
            type="checkbox"
            checked={izin}
            onChange={(e) => setIzin(e.target.checked)}
            className="size-[22px] shrink-0 accent-brand"
          />
          {/* Kebijakan Privasi (V38) dibuka di tab baru, supaya isian dan foto yang belum disimpan tidak hilang */}
          <span>
            Saya setuju nama, foto, dan tempat lapak saya ditampilkan untuk umum, sesuai{' '}
            <a href="/akun/kebijakan" target="_blank" rel="noopener" className="text-brand-tekan">
              Kebijakan Privasi
            </a>
            .
          </span>
        </label>
        <span className="pb-2.5 pl-[34px] text-xs leading-[1.45] text-teks-redup">
          Syarat &amp; Ketentuan sudah kamu setujui saat masuk.
        </span>
      </div>

      <Tombol className="mt-auto" onClick={lanjut} disabled={sibuk || mengolah}>
        {sibuk ? 'Menyimpan…' : 'Lanjut'}
      </Tombol>
    </main>
  )
}
