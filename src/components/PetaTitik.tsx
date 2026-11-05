import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { bulatkan, type Titik } from '../lib/tempat'

// Peta pemilihan titik (A33, V43). Peta dari OpenStreetMap. Pin tetap di tengah; yang digeser adalah petanya.
// Titik hanya berubah saat pemilik menggeser peta, mencari tempat, atau memakai lokasi HP.
// Lokasi pelanggan tidak pernah dikirim ke server (A21); di sini hanya lokasi tempat pemilik.
// Pencarian nama tempat dikirim ke layanan geocoding pihak ketiga (Photon), hanya teks pencarian, bukan lokasi.

const PUSAT_SRAGEN = { lat: -7.4291, lng: 111.0193 }

// Lokasi dari PC biasanya dari Wi-Fi atau IP, jadi bisa meleset jauh (A33). Dipakai untuk peringatan saja.
const ADALAH_HP = /Android|iPhone|iPad|iPod|Mobile/i
const dariPc = () => typeof navigator !== 'undefined' && !ADALAH_HP.test(navigator.userAgent)
const ZOOM_AWAL = 15
const URL_UBIN = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const URL_CARI = 'https://photon.komoot.io/api/'

type HasilCari = { nama: string; alamat: string; lat: number; lng: number }

function sama(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6
}

export function PetaTitik({
  titik,
  onTitik,
  nonaktif,
  mencari,
  onPakaiLokasi,
}: {
  titik: Titik | null
  onTitik: (t: Titik) => void
  nonaktif: boolean
  mencari: boolean
  onPakaiLokasi: () => void
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const peta = useRef<L.Map | null>(null)
  const titikRef = useRef<Titik | null>(titik)
  const onTitikRef = useRef(onTitik)
  const [gagal, setGagal] = useState(false)
  const [kueri, setKueri] = useState('')
  const [hasil, setHasil] = useState<HasilCari[] | null>(null)
  const [mencariNama, setMencariNama] = useState(false)

  useEffect(() => {
    titikRef.current = titik
    onTitikRef.current = onTitik
  }, [titik, onTitik])

  // Buat peta sekali. Galat dihitung dari ubin: kalau tidak ada ubin yang termuat, peta dianggap gagal.
  useEffect(() => {
    if (!wadah.current) return
    const m = L.map(wadah.current, { zoomControl: true, attributionControl: true }).setView(
      [PUSAT_SRAGEN.lat, PUSAT_SRAGEN.lng],
      ZOOM_AWAL,
    )
    const ubin = L.tileLayer(URL_UBIN, {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    })
    let adaUbin = false
    ubin.on('tileload', () => {
      adaUbin = true
    })
    ubin.on('tileerror', () => {
      if (!adaUbin) setGagal(true)
    })
    ubin.addTo(m)

    // Pergeseran dari pemilik saja. Pergeseran dari kode (setView di bawah) diabaikan karena sudah sama dengan titik.
    m.on('moveend', () => {
      const c = m.getCenter()
      const baru = { lat: bulatkan(c.lat), lng: bulatkan(c.lng) }
      const sekarang = titikRef.current
      if (sekarang && sama(sekarang, baru)) return
      if (!sekarang && sama(c, PUSAT_SRAGEN)) return
      onTitikRef.current({ ...baru, akurasi: null })
    })
    peta.current = m
    return () => {
      m.remove()
      peta.current = null
    }
  }, [])

  // Titik dari luar (lokasi HP, hasil cari, link Maps) menggeser peta ke titik itu.
  useEffect(() => {
    const m = peta.current
    if (!m || !titik) return
    if (sama(m.getCenter(), titik)) return
    m.setView([titik.lat, titik.lng], m.getZoom())
  }, [titik])

  const cari = async () => {
    const teks = kueri.trim()
    if (!teks || mencariNama || nonaktif) return
    setMencariNama(true)
    try {
      const url = `${URL_CARI}?q=${encodeURIComponent(teks)}&lat=${PUSAT_SRAGEN.lat}&lon=${PUSAT_SRAGEN.lng}&limit=8&lang=default`
      const res = await fetch(url)
      const isi = (await res.json()) as {
        features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[]
      }
      const daftar: HasilCari[] = (isi.features ?? [])
        .filter((f) => f.properties.countrycode === 'ID')
        .slice(0, 5)
        .map((f) => {
          const p = f.properties
          const alamat = [p.street, p.district, p.city ?? p.county, p.state].filter(Boolean).join(', ')
          return {
            nama: p.name ?? alamat ?? 'Tanpa nama',
            alamat,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }
        })
      setHasil(daftar)
    } catch {
      setHasil([])
    } finally {
      setMencariNama(false)
    }
  }

  const pilih = (h: HasilCari) => {
    setHasil(null)
    setKueri(h.nama)
    onTitik({ lat: bulatkan(h.lat), lng: bulatkan(h.lng), akurasi: null })
  }

  const kartuGagal = gagal && (
      <div role="alert" className="flex flex-col gap-3 rounded-[20px] bg-[#FDF1E4] p-4">
        <span className="text-base font-bold">Peta belum bisa dimuat.</span>
        <span className="text-sm text-[#374151]">Pakai link Google Maps atau Pakai lokasiku.</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPakaiLokasi}
            disabled={mencari || nonaktif}
            className="h-11 rounded-full bg-brand px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {mencari ? 'Mencari lokasi…' : 'Pakai lokasiku'}
          </button>
        </div>
      </div>
  )

  return (
    <div className="flex flex-col gap-2.5">
      {kartuGagal}
      {dariPc() && (
        <div role="note" className="rounded-2xl bg-[#FDF1E4] px-3.5 py-3 text-[13px] leading-[1.45] text-[#7A3E00]">
          <span className="font-bold">Akurasi lokasi dari PC rendah.</span> Titik dari PC bisa meleset jauh. Cek lagi titiknya di peta, lalu geser sampai pas di tempatmu. Untuk akurasi terbaik, buka dari HP.
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label className="flex min-w-0 grow">
            <span className="sr-only">Cari tempat</span>
            <input
              type="search"
              value={kueri}
              onChange={(e) => setKueri(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') cari()
              }}
              disabled={nonaktif}
              placeholder="Cari tempat"
              className="h-12 w-full min-w-0 rounded-2xl bg-kartu px-4 text-base outline-none ring-2 ring-transparent focus:ring-brand disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={cari}
            disabled={nonaktif || mencariNama || !kueri.trim()}
            className="h-11 shrink-0 rounded-full bg-brand px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {mencariNama ? 'Mencari…' : 'Cari'}
          </button>
        </div>
        {hasil && hasil.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#E3E7EE]">
            {hasil.map((h, i) => (
              <button
                key={`${h.lat},${h.lng},${i}`}
                type="button"
                onClick={() => pilih(h)}
                className="flex min-h-11 w-full flex-col items-start border-b border-[#EEF1F5] bg-white px-3.5 py-2.5 text-left last:border-b-0"
              >
                <span className="text-base font-semibold">{h.nama}</span>
                {h.alamat && <span className="text-[13px] text-teks-redup">{h.alamat}</span>}
              </button>
            ))}
          </div>
        )}
        {hasil && hasil.length === 0 && (
          <span className="text-[13px] text-teks-redup">Tidak ketemu? Geser peta ke tempatnya.</span>
        )}
      </div>

      <div className={`relative h-60 overflow-hidden rounded-[20px] border border-[#DDE2EA]${gagal ? ' hidden' : ''}`}>
        <div ref={wadah} className="h-full w-full" aria-label="Peta. Geser untuk memilih titik tempat." role="region" />
        <button
          type="button"
          onClick={onPakaiLokasi}
          disabled={mencari || nonaktif}
          className="absolute top-3 right-3 z-[1000] flex h-11 items-center gap-1.5 rounded-full border border-[#C9D0DB] bg-white px-4 text-sm font-bold text-brand disabled:opacity-50"
        >
          {mencari ? 'Mencari lokasi…' : 'Pakai lokasiku'}
        </button>
        <svg
          width="32"
          height="40"
          viewBox="0 0 32 40"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full"
        >
          <path d="M16 0C7.2 0 0 7.2 0 16c0 11.5 16 24 16 24s16-12.5 16-24C32 7.2 24.8 0 16 0z" fill="#1F5FE6" />
          <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
        </svg>
      </div>
    </div>
  )
}
