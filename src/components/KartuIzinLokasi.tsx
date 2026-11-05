// Kartu izin lokasi di beranda (V1, A14). Tampil sampai pelanggan memilih salah satu tombol.
export function KartuIzinLokasi({ onIzinkan, onPilihWilayah }: { onIzinkan: () => void; onPilihWilayah: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-brand-muda p-4">
      <div className="flex items-start gap-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1F5FE6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-px shrink-0"
        >
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold">Lihat lapak terdekat dulu?</span>
          <span className="text-[13px] leading-[1.45] text-[#3D4A5F]">Lokasimu hanya dipakai untuk mengurutkan, tidak disimpan.</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onIzinkan} className="h-11 rounded-full bg-brand text-sm font-bold text-white">
          Izinkan lokasi
        </button>
        <button
          type="button"
          onClick={onPilihWilayah}
          className="h-11 rounded-full bg-white text-sm font-bold text-brand-tekan shadow-[0_1px_2px_rgba(18,22,31,.10),0_0_0_.5px_rgba(18,22,31,.06)]"
        >
          Pilih wilayah
        </button>
      </div>
    </div>
  )
}
