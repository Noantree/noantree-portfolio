import { useEffect, useState } from 'react'
import { LembarBawah } from './LembarBawah'
import { hapusAkunSaya, muatIsiHapusAkun, type IsiHapusAkun } from '../lib/hapusAkun'

const KATA = 'HAPUS'

// Hapus akun (V32, A28). Daftar "yang ikut terhapus" menyesuaikan isi akun: pelanggan tanpa lapak hanya profil
// dan lapak yang diikuti; pemilik ditambah lapak, tempat, jadwal, foto, dan pengikut, plus saran Tutup lapak saja.
// Tombol aktif setelah HAPUS diketik; server memeriksa lagi. Galat dari server ditampilkan apa adanya.
export function LembarHapusAkun({
  uid,
  onTutup,
  onTerhapus,
  onTutupLapak,
}: {
  uid: string
  onTutup: () => void
  onTerhapus: () => void
  onTutupLapak: () => void
}) {
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

  const siap = ketik.trim() === KATA && isi !== null

  const hapus = async () => {
    if (!siap || sibuk) return
    setSibuk(true)
    setGalat(null)
    try {
      await hapusAkunSaya(uid, ketik.trim())
      onTerhapus()
    } catch (e) {
      setGalat((e as { message?: string } | null)?.message || 'Akun belum terhapus. Periksa sinyal, lalu coba lagi.')
      setSibuk(false)
    }
  }

  const lapak = isi?.lapak ?? null
  const barisLapak = lapak
    ? `Lapak ${lapak.nama}, ${lapak.jumlahTempat !== null ? `${lapak.jumlahTempat} tempat, ` : 'tempat, '}jadwal, dan foto`
    : null
  const barisPengikut = lapak ? (lapak.jumlahPengikut !== null ? `${lapak.jumlahPengikut} pengikut lapakmu` : 'Pengikut lapakmu') : null

  return (
    <LembarBawah terbuka onTutup={sibuk ? () => {} : onTutup} label="Hapus akun">
      <span className="mt-1 text-2xl font-extrabold leading-[1.15] tracking-[-0.02em]">Hapus akun dan semua data?</span>
      <span className="text-[15px] leading-normal text-[#3D4A5F]">Yang ikut terhapus permanen:</span>

      {isi === null && !gagalMuat && (
        <div role="status" className="rounded-[18px] bg-kartu px-4 py-3.5 text-sm text-teks-redup">
          Memuat isi akun…
        </div>
      )}
      {gagalMuat && (
        <div className="flex flex-col items-start gap-2.5 rounded-[18px] bg-kartu px-4 py-3.5">
          <span role="alert" className="text-sm leading-[1.45] text-[#3D4A5F]">
            Isi akun belum bisa dimuat. Periksa sinyal, lalu coba lagi.
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
      {isi && (
        <ul className="flex flex-col gap-2 rounded-[18px] bg-kartu px-4 py-3.5 text-sm leading-[1.45]">
          {barisLapak && <li>• {barisLapak}</li>}
          {barisPengikut && <li>• {barisPengikut}</li>}
          <li>• Profil: nama dan foto</li>
          <li>• Lapak yang kamu ikuti</li>
        </ul>
      )}

      <span className="text-[13px] leading-normal text-[#5B6472]">
        Laporan yang pernah kamu kirim disimpan tanpa nama untuk keamanan. Akun langsung terhapus dan tidak bisa dipulihkan.
      </span>

      {/* Tutup lapak saja membuka Tutup lapak permanen (V51) */}
      {lapak && (
        <button
          type="button"
          onClick={onTutupLapak}
          disabled={sibuk}
          className="rounded-2xl bg-[#EAF1FE] px-3.5 py-3 text-left text-sm leading-[1.45] text-[#12306E]"
        >
          Hanya berhenti jualan? <b className="text-[#1A4FC2]">Tutup lapak saja</b>, akunmu tetap ada.
        </button>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Ketik HAPUS untuk lanjut
        <input
          type="text"
          name="konfirmasi"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={ketik}
          onChange={(e) => setKetik(e.target.value)}
          placeholder="HAPUS"
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
        onClick={hapus}
        disabled={!siap || sibuk}
        className="h-[54px] rounded-full bg-merah text-base font-bold text-white disabled:bg-[#F3C9C4]"
      >
        {sibuk ? 'Menghapus…' : 'Hapus permanen'}
      </button>
      <button type="button" onClick={onTutup} disabled={sibuk} className="h-12 rounded-full bg-kartu text-[15px] font-bold text-tinta disabled:opacity-60">
        Batal
      </button>
    </LembarBawah>
  )
}
