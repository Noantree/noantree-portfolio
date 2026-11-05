import type { ButtonHTMLAttributes } from 'react'

type Varian = 'utama' | 'kedua' | 'netral'

const gaya: Record<Varian, string> = {
  utama: 'bg-brand text-white active:bg-brand-tekan',
  kedua: 'bg-brand-muda text-brand-tekan active:bg-[#DCE7FC]',
  netral: 'bg-kartu text-tinta active:bg-[#E6EAF1]',
}

// Tinggi 56 px (lebar sentuh minimal 44 px, PRD bagian 7). Bayangan hanya untuk tombol utama yang lembut.
export function Tombol({
  varian = 'utama',
  penuh = true,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian; penuh?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex h-14 items-center justify-center gap-2 rounded-[28px] px-6 text-base font-bold transition-colors disabled:opacity-50',
        penuh ? 'w-full' : 'w-fit',
        gaya[varian],
        className,
      ].join(' ')}
    />
  )
}
