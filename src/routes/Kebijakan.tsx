import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { KEBIJAKAN, potongBaris, type Dokumen } from '../lib/kebijakan'
import { JUDUL_SITUS } from '../lib/situs'
import { judulTab } from '../lib/lingkungan'

const TAB = [
  { kunci: 'privasi', label: 'Privasi', judul: 'Kebijakan Privasi' },
  { kunci: 'sk', label: 'Syarat & Ketentuan', judul: 'Syarat & Ketentuan' },
] as const

// Kebijakan Privasi dan Syarat & Ketentuan (V38) di /akun/kebijakan, tab S&K di /akun/kebijakan?tab=sk.
// Terbuka untuk tamu juga (dari lembar Masuk, kaki beranda, dan Daftar langkah 1). Teks dari docs/draf-kebijakan-sk.md.
export default function Kebijakan() {
  const [cari, setCari] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tab = cari.get('tab') === 'sk' ? TAB[1] : TAB[0]
  const dok = KEBIJAKAN[tab.kunci]

  useEffect(() => {
    document.title = judulTab(`${tab.judul} · ${JUDUL_SITUS}`)
    window.scrollTo(0, 0)
    return () => {
      document.title = judulTab()
    }
  }, [tab.judul])

  // Kembali ke layar sebelumnya; kalau halaman dibuka langsung dari link, ke beranda
  const kembali = () => (location.key !== 'default' ? navigate(-1) : navigate('/', { replace: true }))

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col gap-3.5 px-5 pb-6">
      <div className="flex h-16 items-center gap-3">
        <button type="button" onClick={kembali} aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kartu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div role="tablist" aria-label="Pilih dokumen" className="flex min-w-0 gap-1.5 rounded-[22px] bg-kartu p-1">
          {TAB.map((t) => {
            const aktif = t.kunci === tab.kunci
            return (
              <button
                key={t.kunci}
                type="button"
                role="tab"
                aria-selected={aktif}
                onClick={() => setCari(t.kunci === 'sk' ? { tab: 'sk' } : {}, { replace: true })}
                className={`flex h-9 items-center whitespace-nowrap rounded-[18px] px-3.5 text-[13px] ${aktif ? 'bg-white font-bold text-tinta' : 'font-semibold text-teks-redup'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">{tab.judul}</h1>
      {dok.diperbarui && (
        <p className="text-[13px] text-teks-redup">
          <Baris teks={dok.diperbarui} />
        </p>
      )}

      {/* Ringkasnya dari paragraf pembuka draf; kedua dokumen wajib punya (diperiksa npm run uji:kebijakan) */}
      <div className="flex flex-col gap-1.5 rounded-[18px] bg-kartu px-4 py-3.5">
        <span className="text-sm font-bold">Ringkasnya</span>
        <p className="text-sm leading-[1.5] text-[#3D4A5F]">
          <Baris teks={dok.ringkas ?? ''} />
        </p>
      </div>

      <Isi dok={dok} />
    </main>
  )
}

function Isi({ dok }: { dok: Dokumen }) {
  return dok.bagian.map((b, i) => (
    <section key={i} className="flex flex-col gap-1">
      <h2 className="text-base font-bold">{b.judul}</h2>
      <div className="flex flex-col gap-2 text-sm leading-[1.55] text-[#3D4A5F]">
        {b.isi.map((isi, j) =>
          isi.jenis === 'subjudul' ? (
            <h3 key={j} className={`font-bold text-tinta ${j > 0 ? 'mt-1' : ''}`}>
              <Baris teks={isi.teks} />
            </h3>
          ) : isi.jenis === 'daftar' ? (
            <ul key={j} className="flex list-disc flex-col gap-1 pl-5">
              {isi.butir.map((t, k) => (
                <li key={k}>
                  <Baris teks={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={j}>
              <Baris teks={isi.teks} />
            </p>
          ),
        )}
      </div>
    </section>
  ))
}

function Baris({ teks }: { teks: string }) {
  return potongBaris(teks).map((p, i) =>
    p.jenis === 'tebal' ? (
      <strong key={i} className="font-bold text-tinta">
        {p.teks}
      </strong>
    ) : p.jenis === 'todo' ? (
      <mark key={i} className="rounded bg-[#FFF1E0] px-1 font-semibold text-[#9A4A00]">
        {p.teks}
      </mark>
    ) : p.jenis === 'email' ? (
      <a key={i} href={`mailto:${p.teks}`} className="font-semibold text-brand-tekan underline [overflow-wrap:anywhere]">
        {p.teks}
      </a>
    ) : (
      <span key={i}>{p.teks}</span>
    ),
  )
}
