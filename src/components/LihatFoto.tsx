import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Lihat foto (V37, A40): layar gelap, geser antarfoto dengan scroll-snap bawaan browser.
// Di PC: tombol panah kiri dan kanan, tombol panah keyboard, dan geser dengan mouse (disetujui Aji, poin 9).
export function LihatFoto({
  foto,
  awal,
  nama,
  onTutup,
}: {
  foto: string[];
  awal: number;
  nama: string;
  onTutup: () => void;
}) {
  const jalur = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState(awal);
  const aktifRef = useRef(awal);

  // Mulai dari foto yang diketuk, dengan halaman di belakang dikunci. Lebar bisa berubah setelah
  // scrollbar halaman hilang atau HP diputar; saat itu jalur disejajarkan lagi ke foto yang sama.
  useLayoutEffect(() => {
    const gulirAsli = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = jalur.current;
    const sejajarkan = () => {
      const slide = el?.children[aktifRef.current] as HTMLElement | undefined;
      if (el && slide) el.scrollLeft = slide.offsetLeft;
    };
    sejajarkan();
    const amati = new ResizeObserver(sejajarkan);
    if (el) amati.observe(el);
    return () => {
      amati.disconnect();
      document.body.style.overflow = gulirAsli;
    };
  }, []);

  const keFoto = (i: number) => {
    const el = jalur.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    aktifRef.current = i;
    setAktif(i);
    el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  };

  // Geser dengan mouse: scroll-snap tidak menangani mouse, jadi posisinya diatur manual lalu dikunci ke foto terdekat
  const geser = useRef<{ x: number; kiri: number } | null>(null);
  const mulaiGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !jalur.current) return;
    geser.current = { x: e.clientX, kiri: jalur.current.scrollLeft };
    jalur.current.style.scrollSnapType = "none";
  };
  const sedangGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = geser.current;
    if (!g || !jalur.current) return;
    jalur.current.scrollLeft = g.kiri - (e.clientX - g.x);
  };
  const selesaiGeser = () => {
    const el = jalur.current;
    if (!geser.current || !el) return;
    geser.current = null;
    el.style.scrollSnapType = "";
    const lebar =
      (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
    keFoto(
      Math.min(foto.length - 1, Math.max(0, Math.round(el.scrollLeft / lebar))),
    );
  };

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
      if (e.key === "ArrowRight")
        keFoto(Math.min(foto.length - 1, aktifRef.current + 1));
      if (e.key === "ArrowLeft") keFoto(Math.max(0, aktifRef.current - 1));
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, [onTutup, foto.length]);

  const saatGeser = () => {
    const el = jalur.current;
    const lebar = (el?.firstElementChild as HTMLElement | null)?.offsetWidth;
    if (!el || !lebar) return;
    aktifRef.current = Math.round(el.scrollLeft / lebar);
    setAktif(aktifRef.current);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${nama}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#0B0D12] text-white"
    >
      <div className="mx-auto flex h-16 w-full max-w-[430px] shrink-0 items-center justify-between px-4">
        <span className="text-[15px] font-semibold tabular-nums">
          {aktif + 1} / {foto.length}
        </span>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup"
          className="flex size-11 items-center justify-center rounded-full bg-white/[0.12]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1">
        {foto.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => keFoto(aktif - 1)}
              disabled={aktif === 0}
              aria-label="Foto sebelumnya"
              className="absolute top-1/2 left-2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.12] disabled:opacity-30"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => keFoto(aktif + 1)}
              disabled={aktif === foto.length - 1}
              aria-label="Foto berikutnya"
              className="absolute top-1/2 right-2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.12] disabled:opacity-30"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        <div
          ref={jalur}
          onScroll={saatGeser}
          onPointerDown={mulaiGeser}
          onPointerMove={sedangGeser}
          onPointerUp={selesaiGeser}
          onPointerCancel={selesaiGeser}
          onPointerLeave={selesaiGeser}
          className="flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-6 select-none [scrollbar-width:none] md:cursor-grab"
        >
          {foto.map((url, i) => (
            <div
              key={url}
              className="flex w-full shrink-0 snap-center items-center justify-center"
            >
              <img
                src={url}
                alt={`Foto ${i + 1} dari ${foto.length}, ${nama}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-3.5 px-4 pb-7">
        {foto.length > 1 && (
          <div className="flex justify-center gap-2" aria-hidden="true">
            {foto.map((url, i) => (
              <span
                key={url}
                className={`h-2 rounded-full ${i === aktif ? "w-[22px] bg-white" : "w-2 bg-white/35"}`}
              />
            ))}
          </div>
        )}
        <span className="text-center text-[13px] text-[#B8C0CC]">
          {foto.length > 1
            ? `Geser atau pakai panah untuk foto lain · ${nama}`
            : nama}
        </span>
      </div>
    </div>
  );
}
