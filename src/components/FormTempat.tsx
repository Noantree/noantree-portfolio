import { useState, type ReactNode } from 'react'
import { PetaTitik } from './PetaTitik'
import { supabase } from '../lib/supabase'
import { linkMaps, type Titik, type WilayahTempat } from '../lib/tempat'
import { bacaLink } from '../../supabase/functions/cek-link-maps/link.ts'

// Bagian formulir tempat yang sama di Daftar 2 (V12), Tempat baru (V43), dan Ubah tempat (V31).

const gayaPilihan =
  'h-13 w-full min-w-0 rounded-2xl bg-kartu px-3 text-[15px] text-tinta outline-none ring-2 ring-transparent focus:ring-brand disabled:opacity-60'

// Titik lokasi (A33): Pakai lokasiku sekarang, kotak titik tersimpan, lalu kolom tempel link Google Maps.
// onTitik: titik dari link Google Maps yang sudah dicek di server.
// sebelumTombol: misalnya kotak "Belum ada titik" di V31. setelahLink: misalnya catatan tanpa titik di V43.
export function BagianTitik({
  judul,
  keterangan,
  titik,
  mencari,
  nonaktif,
  onPakaiLokasi,
  onTitik,
  sebelumTombol,
  setelahLink,
}: {
  judul: ReactNode
  keterangan: string
  titik: Titik | null
  mencari: boolean
  nonaktif: boolean
  onPakaiLokasi: () => void
  onTitik: (t: Titik) => void
  sebelumTombol?: ReactNode
  setelahLink?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-bold">{judul}</span>
      {sebelumTombol}
      <PetaTitik titik={titik} onTitik={onTitik} nonaktif={nonaktif} mencari={mencari} onPakaiLokasi={onPakaiLokasi} />
      <span className="text-[13px] leading-[1.45] text-teks-redup">{keterangan}</span>

      {titik && (
        <p role="status" className="m-0 text-[13px] leading-[1.45] text-teks-redup">
          Titik ditandai: {titik.lat}, {titik.lng}.{' '}
          <a href={linkMaps(titik)} target="_blank" rel="noreferrer" className="font-bold text-brand-tekan">
            Cek di Maps
          </a>
        </p>
      )}

      <div className="flex items-center gap-2.5 text-[13px] text-teks-redup">
        <span className="h-px grow bg-[#E3E7EE]" />
        atau tempel link Google Maps
        <span className="h-px grow bg-[#E3E7EE]" />
      </div>
      <KolomLinkMaps nonaktif={nonaktif} onTitik={onTitik} />
      {setelahLink}
    </div>
  )
}

const PESAN_BUKAN_MAPS = 'Link ini bukan dari Google Maps. Salin ulang dari tombol Bagikan di aplikasi Google Maps.'
const PESAN_JARINGAN = 'Link belum bisa dicek. Periksa sinyal, lalu coba lagi.'

// Tempel link Google Maps (A33). Cek link membuka link di Edge Function cek-link-maps, yang memakai 1 dari
// 10 kuota cek per pemilik per hari WIB lalu mengembalikan titiknya. Yang dikirim hanya link tempat milik pemilik;
// lokasi pelanggan tidak pernah dikirim (A21). Link yang jelas bukan Google Maps ditolak di HP dulu dengan
// aturan host yang sama dengan server, supaya kuota tidak terbuang. Titik dipakai simpan yang sudah ada
// (simpan_daftar_2, tambah_tempat, ubah_tempat); tidak ada jalur simpan lain.
export function KolomLinkMaps({ nonaktif, onTitik }: { nonaktif: boolean; onTitik: (t: Titik) => void }) {
  const [link, setLink] = useState('')
  const [memeriksa, setMemeriksa] = useState(false)
  // Gaya galat mengikuti V20: kotak merah untuk link yang salah, kotak abu untuk batas cek habis
  const [galat, setGalat] = useState<{ teks: string; abu: boolean } | null>(null)

  const cek = async () => {
    if (memeriksa || !link.trim()) return
    if (!bacaLink(link)) {
      setGalat({ teks: PESAN_BUKAN_MAPS, abu: false })
      return
    }
    setMemeriksa(true)
    setGalat(null)
    const { data, error } = await supabase.functions.invoke('cek-link-maps', { body: { link: link.trim() } })
    setMemeriksa(false)
    if (error) {
      // Pesan dari server ditampilkan apa adanya; tanpa respons (sinyal putus) memakai pesan jaringan
      const res = (error as { context?: Response }).context
      let teks = PESAN_JARINGAN
      let status = 0
      if (res && typeof res.json === 'function') {
        status = res.status
        try {
          const isi = (await res.json()) as { pesan?: string }
          if (isi?.pesan) teks = isi.pesan
        } catch {
          // Respons bukan JSON: pakai pesan jaringan
        }
      }
      setGalat({ teks, abu: status === 429 })
      return
    }
    const titik = data as { lat?: unknown; lng?: unknown } | null
    if (typeof titik?.lat !== 'number' || typeof titik.lng !== 'number') {
      setGalat({ teks: PESAN_JARINGAN, abu: false })
      return
    }
    onTitik({ lat: titik.lat, lng: titik.lng, akurasi: null })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <label className="flex min-w-0 grow">
          <span className="sr-only">Link Google Maps</span>
          <input
            type="url"
            name="link_maps"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setGalat(null)
            }}
            disabled={nonaktif || memeriksa}
            placeholder="Tempel link Google Maps"
            className="h-13 w-full min-w-0 rounded-2xl bg-kartu px-4 text-base outline-none ring-2 ring-transparent focus:ring-brand disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={cek}
          disabled={nonaktif || memeriksa || !link.trim()}
          className="h-13 shrink-0 rounded-2xl bg-brand-muda px-4 text-sm font-bold text-brand-tekan disabled:opacity-50"
        >
          {memeriksa ? 'Memeriksa…' : 'Cek link'}
        </button>
      </div>
      {galat && (
        <div
          role="alert"
          className={`rounded-[18px] px-4 py-3.5 text-sm leading-[1.45] ${galat.abu ? 'bg-kartu text-[#3D4A5F]' : 'bg-[#FDECEA] text-[#7A1A12]'}`}
        >
          {galat.teks}
        </div>
      )}
    </div>
  )
}

// Wilayah tempat ini (A34): kabupaten dan kecamatan dipilih manual, provinsi bisa diganti
export function BagianWilayah({ w }: { w: WilayahTempat }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">Wilayah tempat ini</span>
      {w.gantiProvinsi && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-teks-redup">
          Provinsi
          <select value={w.provinsi} onChange={(e) => w.pilihProvinsi(e.target.value)} className={gayaPilihan}>
            {w.daftarProvinsi.map((p) => (
              <option key={p.id} value={p.kode}>
                {p.nama}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-teks-redup">
          Kabupaten/Kota
          <select value={w.kabupaten} onChange={(e) => w.pilihKabupaten(e.target.value)} className={gayaPilihan}>
            <option value="">Pilih</option>
            {w.daftarKabupaten.map((k) => (
              <option key={k.id} value={k.kode}>
                {k.nama.replace(/^Kabupaten /, '')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-teks-redup">
          Kecamatan
          <select
            value={w.kecamatanId}
            onChange={(e) => w.setKecamatanId(e.target.value)}
            disabled={!w.kabupaten}
            className={gayaPilihan}
          >
            <option value="">Pilih</option>
            {w.daftarKecamatan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </label>
      </div>
      <span className="text-xs text-teks-redup">
        Provinsi: {w.namaProvinsi} ·{' '}
        <button type="button" onClick={() => w.setGantiProvinsi(true)} className="inline-flex min-h-11 items-center text-brand-tekan underline">
          ganti
        </button>
      </span>
    </div>
  )
}
