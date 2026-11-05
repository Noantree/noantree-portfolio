import { lengkap, tampilJam, type EditorJadwal } from '../lib/jadwal'

// Formulir jadwal tujuh hari yang sama di Daftar 3 (V13) dan Ubah jadwal (V44): kartu hari dengan sesi,
// lalu tombol Samakan jam Senin (A35).

// A35: jam 24 jam (00–23) dan menit kelipatan 5, lewat dropdown, bukan pemilih jam bawaan HP
const PILIHAN_JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const PILIHAN_MENIT = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const gayaDropdown =
  'h-11 w-12 appearance-none rounded-xl bg-white text-center text-[15px] tabular-nums outline-none ring-2 ring-transparent focus:ring-brand disabled:text-teks-redup'

// Nilai selalu '' atau lengkap "HH:MM": memilih jam mengisi menit 00, menit baru bisa dipilih setelah jam.
function PilihJam({ label, nilai, onUbah }: { label: string; nilai: string; onUbah: (nilai: string) => void }) {
  const jam = nilai.slice(0, 2)
  const menit = nilai.slice(3, 5)
  // Jadwal lama dengan menit di luar kelipatan 5 tetap tampil apa adanya supaya bisa dikoreksi
  const pilihanMenit = menit && !PILIHAN_MENIT.includes(menit) ? [...PILIHAN_MENIT, menit].sort() : PILIHAN_MENIT
  return (
    <span className="flex items-center gap-0.5">
      <select
        aria-label={`${label}, jam`}
        value={jam}
        onChange={(e) => onUbah(e.target.value ? `${e.target.value}:${menit || '00'}` : '')}
        className={gayaDropdown}
      >
        <option value="">--</option>
        {PILIHAN_JAM.map((j) => (
          <option key={j} value={j}>
            {j}
          </option>
        ))}
      </select>
      <span className="text-teks-redup">.</span>
      <select
        aria-label={`${label}, menit`}
        value={menit}
        disabled={!jam}
        onChange={(e) => onUbah(`${jam}:${e.target.value}`)}
        className={gayaDropdown}
      >
        {!jam && <option value="">--</option>}
        {pilihanMenit.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  )
}

export function FormJadwal({ e }: { e: EditorJadwal }) {
  return (
    <>
      <div className="flex flex-col rounded-[20px] bg-kartu px-3.5 py-1">
        {e.jadwal.map((h) => {
          const ringkas = h.aktif ? h.sesi.filter(lengkap).map((s) => `${tampilJam(s.mulai)}–${tampilJam(s.selesai)}`) : []
          return (
            <div key={h.hari} className="flex flex-col">
              <div className="flex min-h-[50px] items-center gap-2.5">
                <label className="flex w-24 shrink-0 items-center gap-2.5 text-[15px] font-semibold">
                  <input
                    type="checkbox"
                    checked={h.aktif}
                    onChange={(ev) => e.centangHari(h.hari, ev.target.checked)}
                    className="size-5 accent-brand"
                  />
                  {h.nama}
                </label>
                <span className={`min-w-0 grow truncate text-sm tabular-nums ${h.aktif ? 'text-tinta' : 'text-teks-redup'}`}>
                  {h.aktif ? ringkas.join(', ') : 'Libur'}
                </span>
                <button
                  type="button"
                  aria-label={`Tambah sesi ${h.nama}`}
                  onClick={() => e.tambahSesi(h.hari)}
                  className="h-[34px] shrink-0 rounded-full bg-white px-3 text-[13px] font-bold text-brand-tekan"
                >
                  + Sesi
                </button>
              </div>
              {h.aktif &&
                h.sesi.map((s) => (
                  <div key={s.kunci} className="flex items-center gap-2 pb-2 pl-[30px]">
                    <PilihJam
                      label={`Jam mulai ${h.nama}`}
                      nilai={s.mulai}
                      onUbah={(mulai) => e.ubahSesi(h.hari, s.kunci, { mulai })}
                    />
                    <span className="text-teks-redup">–</span>
                    <PilihJam
                      label={`Jam selesai ${h.nama}`}
                      nilai={s.selesai}
                      onUbah={(selesai) => e.ubahSesi(h.hari, s.kunci, { selesai })}
                    />
                    <button
                      type="button"
                      aria-label={`Hapus sesi ${h.nama}`}
                      onClick={() => e.hapusSesi(h.hari, s.kunci)}
                      className="flex size-11 shrink-0 items-center justify-center text-lg text-teks-redup"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={e.samakanSenin}
        className="h-10 self-start rounded-full bg-brand-muda px-4 text-sm font-bold text-brand-tekan"
      >
        Samakan jam Senin ke semua hari aktif
      </button>
    </>
  )
}
