import { useState } from 'react'
import { LembarBawah } from './LembarBawah'
import { ALASAN_LAPOR, MAKS_CATATAN_LAPOR, laporLapak, type AlasanLapor } from '../lib/lapor'

const GALAT = 'Laporan belum terkirim. Periksa sinyal, lalu coba lagi.'
// Pesan dari lapor_lapak (021) yang ditampilkan apa adanya; dicek dengan includes, bukan kecocokan persis
const PESAN_SERVER = ['Centang pernyataan dulu', 'Pilih satu alasan', 'Sudah melapor lapak ini dalam 30 hari terakhir']
// Teks pernyataan dari PRD A44 (V9 belum memuatnya)
const PERNYATAAN = 'Saya melaporkan berdasarkan kondisi yang saya lihat sendiri'

// Lembar Laporkan (V9, A44). Dibuka hanya oleh pelanggan yang sudah masuk. Pemilik tidak pernah melihat tombolnya (A42).
// Dipasang ulang setiap kali dibuka, jadi pilihan, centang, dan catatan selalu mulai dari awal.
// Tanpa alasan terpilih di awal; Kirim laporan baru aktif setelah alasan dipilih dan pernyataan dicentang.
export function LembarLapor({
  lapak,
  onTutup,
  onTerkirim,
}: {
  lapak: { id: string; nama: string }
  onTutup: () => void
  onTerkirim: () => void
}) {
  const [alasan, setAlasan] = useState<AlasanLapor | null>(null)
  const [pernyataan, setPernyataan] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const siap = alasan !== null && pernyataan

  const kirim = async () => {
    if (sibuk || !alasan || !pernyataan) return
    setSibuk(true)
    setGalat(null)
    try {
      await laporLapak(lapak.id, alasan, catatan.trim() || null, pernyataan)
      onTerkirim()
    } catch (e) {
      const pesan = (e as { message?: string } | null)?.message ?? ''
      setGalat(PESAN_SERVER.find((p) => pesan.includes(p)) ?? GALAT)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <LembarBawah terbuka onTutup={onTutup} label="Laporkan lapak">
      <div className="-mt-1 flex flex-col gap-3">
        <span className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">Laporkan {lapak.nama}</span>
        <span className="text-sm text-[#5B6472]">Pilih satu alasan</span>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Alasan laporan">
        {ALASAN_LAPOR.map((teks) => {
          const terpilih = teks === alasan
          return (
            <label
              key={teks}
              className={`flex min-h-[50px] items-center gap-3 rounded-2xl px-4 text-[15px] ${terpilih ? 'font-bold' : 'font-medium'}`}
              style={{
                background: terpilih ? '#EAF1FE' : '#F4F6FA',
                boxShadow: terpilih ? 'inset 0 0 0 2px #1F5FE6' : 'none',
              }}
            >
              <input
                type="radio"
                name="alasan"
                value={teks}
                checked={terpilih}
                onChange={() => setAlasan(teks)}
                className="size-5 shrink-0"
                style={{ accentColor: '#1F5FE6' }}
              />
              {teks}
            </label>
          )
        })}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Ceritakan singkat (opsional)
        <textarea
          name="catatan"
          rows={2}
          autoComplete="off"
          maxLength={MAKS_CATATAN_LAPOR}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Contoh: katanya lagi buka, tapi tidak ada di tempat…"
          aria-describedby="hitung-catatan"
          className="resize-none rounded-2xl bg-[#F4F6FA] px-4 py-3 text-base font-normal outline-none"
        />
        <span id="hitung-catatan" className="self-end text-xs font-normal text-[#5B6472]">
          {catatan.length}/{MAKS_CATATAN_LAPOR}
        </span>
      </label>

      <label className="flex min-h-11 items-start gap-3 text-sm leading-normal text-tinta">
        <input
          type="checkbox"
          name="pernyataan"
          checked={pernyataan}
          onChange={(e) => setPernyataan(e.target.checked)}
          className="mt-px size-5 shrink-0"
          style={{ accentColor: '#1F5FE6' }}
        />
        {PERNYATAAN}
      </label>

      {galat && (
        <p role="alert" className="text-sm text-merah">
          {galat}
        </p>
      )}

      <button
        type="button"
        onClick={kirim}
        disabled={!siap || sibuk}
        className="h-[54px] w-full rounded-full bg-brand text-base font-bold text-white disabled:opacity-45"
      >
        {sibuk ? 'Mengirim…' : 'Kirim laporan'}
      </button>
      <span className="text-center text-xs leading-normal text-[#5B6472]">
        Pemilik lapak tidak tahu siapa yang melapor · 1 laporan per lapak per 30 hari
      </span>
    </LembarBawah>
  )
}
