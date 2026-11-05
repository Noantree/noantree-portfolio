import { useState } from 'react'
import { Tombol } from '../components/Tombol'
import { ChipStatus } from '../components/ChipStatus'
import { KartuLapak } from '../components/KartuLapak'
import { LembarBawah } from '../components/LembarBawah'
import { usePesan } from '../components/Pesan'

// Halaman contoh untuk meninjau komponen dasar (S0.5). Bukan bagian dari aplikasi publik.
export default function Komponen() {
  const [lembar, setLembar] = useState(false)
  const { tampilkan } = usePesan()

  return (
    <main className="mx-auto flex w-full max-w-[390px] flex-col gap-6 px-4 py-6">
      <h1 className="text-[22px] font-extrabold">Komponen dasar</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-teks-redup">Tombol</h2>
        <Tombol onClick={() => tampilkan({ teks: 'Lapak sekarang buka.', jenis: 'berhasil' })}>Mulai buka</Tombol>
        <Tombol varian="kedua">Perpanjang</Tombol>
        <Tombol varian="netral">Keluar</Tombol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-teks-redup">Chip status</h2>
        <div className="flex flex-wrap gap-2">
          <ChipStatus status="buka" />
          <ChipStatus status="habis" />
          <ChipStatus status="biasanya" />
          <ChipStatus status="tutup" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-teks-redup">Kartu lapak</h2>
        <KartuLapak lapak={{ nama: 'Bakso Pak Slamet', inisial: 'BP', warna: '#1F5FE6', jual: 'Bakso urat, mie ayam', info: 'Depan Pasar Sragen · sampai 14.00', status: 'buka' }} />
        <KartuLapak lapak={{ nama: 'Cukur Keliling Mas Joko', inisial: 'CK', warna: '#24408E', jual: 'Potong rambut pria & anak', info: 'Biasanya di Depan SD Sidoharjo · jadwal 07.00–11.00', status: 'biasanya' }} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-teks-redup">Pesan 5 detik</h2>
        <Tombol varian="kedua" onClick={() => tampilkan({ teks: 'Lapak sudah tutup.', jenis: 'netral', batalkan: () => tampilkan({ teks: 'Dibatalkan. Lapak tetap buka.', jenis: 'info' }) })}>
          Tampilkan pesan dengan Batalkan
        </Tombol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-teks-redup">Lembar bawah</h2>
        <Tombol varian="netral" onClick={() => setLembar(true)}>Buka lembar</Tombol>
      </section>

      <LembarBawah terbuka={lembar} onTutup={() => setLembar(false)} judul="Masuk ke noantree">
        <Tombol>Lanjut dengan Google</Tombol>
        <Tombol varian="kedua">Masuk lewat email</Tombol>
      </LembarBawah>
    </main>
  )
}
