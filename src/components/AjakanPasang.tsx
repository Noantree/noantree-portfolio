import { useEffect, useState } from 'react'
import { Tombol } from './Tombol'
import { bolehAjakPasang, tandaiTerpasang, tolakAjakanPasang } from '../lib/pengingat'
import { bisaPasangLangsung, pasangSekarang, sudahTerpasang } from '../lib/pasang'
import { muatLapakSaya } from '../lib/pengarah'
import { useSesi } from '../lib/sesi'

// Ajakan pasang ke layar utama (V30, A38). Muncul setelah tayang, lalu maks. sekali seminggu jika ditolak.
// HP yang tidak mendukung pemasangan langsung mendapat petunjuk menu sebagai ganti tombol Pasang sekarang.
export function AjakanPasang() {
  const { sesi } = useSesi()
  const uid = sesi?.user.id
  const [terbuka, setTerbuka] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  // Hanya untuk pemilik yang lapaknya sudah tayang
  useEffect(() => {
    if (!uid || sudahTerpasang() || !bolehAjakPasang()) return
    muatLapakSaya(uid)
      .then((l) => setTerbuka(l?.status_tayang === 'tayang'))
      .catch(() => setTerbuka(false))
  }, [uid])

  if (!terbuka) return null

  const nantiSaja = () => {
    tolakAjakanPasang()
    setTerbuka(false)
  }

  const pasang = async () => {
    setSibuk(true)
    const diterima = await pasangSekarang()
    setSibuk(false)
    if (diterima) tandaiTerpasang()
    else tolakAjakanPasang()
    setTerbuka(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex cursor-pointer items-end bg-black/30" onClick={nantiSaja}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pasang noantree"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-[390px] cursor-default flex-col gap-4 rounded-t-[28px] bg-white px-5 pb-7 pt-3"
      >
        <div className="h-[5px] w-10 self-center rounded-full bg-[#D5DAE2]" />
        <div className="mt-1 flex items-center gap-3.5">
          <img src="/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-2xl" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-extrabold tracking-[-0.02em]">Pasang noantree di HP</span>
            <span className="text-[13px] text-teks-redup">Gratis, ringan, tanpa Play Store</span>
          </div>
        </div>
        <p className="text-base leading-[1.55] text-[#3D4A5F]">
          Ikon noantree muncul di layar utama seperti aplikasi biasa. Tiap mau jualan tinggal ketuk ikonnya, lalu{' '}
          <b className="text-tinta">Mulai buka</b>.
        </p>
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-kartu px-4 py-3.5">
          <span className="text-[13px] font-bold">Di iPhone</span>
          <span className="text-[13px] leading-normal text-[#3D4A5F]">
            Ketuk tombol Bagikan di Safari, lalu pilih <b>Tambahkan ke Layar Utama</b>.
          </span>
        </div>
        {bisaPasangLangsung() ? (
          <Tombol onClick={pasang} disabled={sibuk}>
            Pasang sekarang
          </Tombol>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-kartu px-4 py-3.5">
            <span className="text-[13px] font-bold">Di Android</span>
            <span className="text-[13px] leading-normal text-[#3D4A5F]">
              Ketuk menu <b>⋮</b> di browser, lalu pilih <b>Tambahkan ke layar utama</b>.
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={nantiSaja}
          className="flex min-h-11 cursor-pointer items-center justify-center text-[15px] font-semibold text-tinta"
        >
          Nanti saja
        </button>
      </div>
    </div>
  )
}
