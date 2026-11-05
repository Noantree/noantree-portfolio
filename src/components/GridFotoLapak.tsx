import { MAKS_FOTO_LAPAK, type FotoLapak } from '../lib/fotoLapak'

// Kisi foto lapak (V11, V42): maks. 4 foto, × untuk menghapus, + untuk menambah, sisanya kotak kosong.
// onGanti (V42): ketuk foto untuk memilih foto pengganti.
export function GridFotoLapak({
  foto,
  nonaktif,
  sibuk,
  onTambah,
  onBuang,
  onGanti,
}: {
  foto: FotoLapak[]
  nonaktif: boolean
  sibuk: boolean
  onTambah: (files: FileList) => void
  onBuang: (foto: FotoLapak) => void
  onGanti?: (foto: FotoLapak, file: File) => void
}) {
  const kosong = Math.max(0, MAKS_FOTO_LAPAK - foto.length - 1)
  return (
    <div className="grid grid-cols-4 gap-2">
      {foto.map((f) => (
        <div key={f.kunci} className="relative h-[76px] overflow-hidden rounded-2xl bg-kartu">
          {onGanti ? (
            <label aria-label="Ganti foto" className={`block size-full ${nonaktif ? '' : 'cursor-pointer'}`}>
              <img src={f.url} alt="" className="size-full object-cover" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={nonaktif}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onGanti(f, file)
                  e.target.value = ''
                }}
              />
            </label>
          ) : (
            <img src={f.url} alt="" className="size-full object-cover" />
          )}
          <button
            type="button"
            aria-label="Hapus foto"
            disabled={sibuk}
            onClick={() => onBuang(f)}
            className="absolute right-0 top-0 flex size-11 items-start justify-end p-1"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white">×</span>
          </button>
        </div>
      ))}
      {foto.length < MAKS_FOTO_LAPAK && (
        <label
          aria-label="Tambah foto"
          className={`flex h-[76px] cursor-pointer items-center justify-center rounded-2xl bg-brand-muda text-[26px] font-semibold text-brand ${
            nonaktif ? 'opacity-50' : ''
          }`}
        >
          +
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={nonaktif}
            onChange={(e) => {
              if (e.target.files?.length) onTambah(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
      {Array.from({ length: kosong }, (_, i) => (
        <div key={`kosong-${i}`} className="h-[76px] rounded-2xl bg-kartu" />
      ))}
    </div>
  )
}
