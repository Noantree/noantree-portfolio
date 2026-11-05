import { useEffect, useState } from 'react'
import { LembarBawah } from './LembarBawah'
import { muatIsiHapusAkun, tutupLapakSaya, type IsiHapusAkun } from '../lib/hapusAkun'
import { linkLapak } from '../lib/bagikan'

const KATA = 'TUTUP'

// Tutup lapak permanen (V51, A29). Dibuka dari Profil lapak (V16) dan dari saran "Tutup lapak saja" di V32.
// Yang dihapus dan yang tetap, ketik TUTUP untuk mengaktifkan tombol; server memeriksa lagi.
// Galat dari server ditampilkan apa adanya.
export function LembarTutupLapak({ uid, onTutup, onSelesai }: { uid: string; onTutup: () => void; onSelesai: () => void }) {
  const [isi, setIsi] = useState<IsiHapusAkun | null>(null)
  const [gagalMuat, setGagalMuat] = useState(false)
  const [ketik, setKetik] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [putaran, setPutaran] = useState(0)

  useEffect(() => {
    let batal = false
    muatIsiHapusAkun(uid).then(
      (h) => !batal && setIsi(h),
      () => !batal && setGagalMuat(true),
    )
    return () => {
      batal = true
    }
  }, [uid, putaran])

  const lapak = isi?.lapak ?? null
  const siap = ketik.trim() === KATA && lapak !== null

  const tutup = async () => {
    if (!siap || sibuk || !lapak) return
    setSibuk(true)
    setGalat(null)
    try {
      await tutupLapakSaya(uid, lapak.id, ketik.trim())
      onSelesai()
    } catch (e) {
      setGalat((e as { message?: string } | null)?.message || 'Lapak belum tertutup. Periksa sinyal, lalu coba lagi.')
      setSibuk(false)
    }
  }

  // Link dengan alamat situs resmi (src/lib/situs.ts), sama dengan V36
  const barisLink = lapak?.slug ? `Halaman dan link ${linkLapak(lapak.slug).tampil}. QR di gerobak tidak berlaku lagi.` : null
  const barisTempat = lapak
    ? lapak.jumlahTempat !== null
      ? `${lapak.jumlahTempat} tempat, jadwal, dan foto`
      : 'Tempat, jadwal, dan foto'
    : null
  const barisPengikut = lapak ? (lapak.jumlahPengikut !== null ? `${lapak.jumlahPengikut} pengikut lapakmu` : 'Pengikut lapakmu') : null

  return (
    <LembarBawah terbuka onTutup={sibuk ? () => {} : onTutup} label="Tutup lapak permanen">
      <span className="mt-1 text-2xl font-extrabold leading-[1.15] tracking-[-0.02em]">Tutup lapak permanen?</span>
      <span className="text-[15px] leading-normal text-[#3D4A5F]">Untuk kamu yang berhenti jualan. Akunmu tetap ada.</span>

      {isi === null && !gagalMuat && (
        <div role="status" className="rounded-[18px] bg-kartu px-4 py-3.5 text-sm text-teks-redup">
          Memuat isi lapak…
        </div>
      )}
      {gagalMuat && (
        <div className="flex flex-col items-start gap-2.5 rounded-[18px] bg-kartu px-4 py-3.5">
          <span role="alert" className="text-sm leading-[1.45] text-[#3D4A5F]">
            Isi lapak belum bisa dimuat. Periksa sinyal, lalu coba lagi.
          </span>
          <button
            type="button"
            onClick={() => {
              setGagalMuat(false)
              setPutaran((n) => n + 1)
            }}
            className="h-11 rounded-full bg-white px-[18px] text-sm font-bold text-brand-tekan"
          >
            Coba lagi
          </button>
        </div>
      )}
      {isi && !lapak && (
        <div className="rounded-[18px] bg-kartu px-4 py-3.5 text-sm leading-[1.45] text-[#3D4A5F]">Kamu tidak punya lapak untuk ditutup.</div>
      )}
      {lapak && (
        <>
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-[#FDECEA] px-4 py-3.5 text-sm leading-[1.45] text-tinta">
            <b className="text-[#7A1A12]">Yang dihapus</b>
            {barisLink && <span className="[overflow-wrap:anywhere]">• {barisLink}</span>}
            <span>• {barisTempat}</span>
            <span>• {barisPengikut}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-kartu px-4 py-3.5 text-sm leading-[1.45]">
            <b>Yang tetap</b>
            <span>• Akunmu dan lapak yang kamu ikuti</span>
            <span>• Kamu bisa daftar lapak baru kapan saja</span>
          </div>
        </>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Ketik TUTUP untuk lanjut
        <input
          type="text"
          name="konfirmasi"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={ketik}
          onChange={(e) => setKetik(e.target.value)}
          placeholder="TUTUP"
          className="h-[52px] rounded-2xl bg-kartu px-4 text-base font-semibold tracking-[0.04em] outline-none focus-visible:shadow-[inset_0_0_0_2px_#1F5FE6]"
        />
      </label>

      {galat && (
        <p role="alert" className="text-sm text-merah">
          {galat}
        </p>
      )}

      <button
        type="button"
        onClick={tutup}
        disabled={!siap || sibuk}
        className="h-[54px] rounded-full bg-merah text-base font-bold text-white disabled:bg-[#F3C9C4]"
      >
        {sibuk ? 'Menutup…' : 'Tutup lapak permanen'}
      </button>
      <button type="button" onClick={onTutup} disabled={sibuk} className="h-12 rounded-full bg-kartu text-[15px] font-bold text-tinta disabled:opacity-60">
        Batal
      </button>
    </LembarBawah>
  )
}
