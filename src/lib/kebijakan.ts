import draf from '../../docs/draf-kebijakan-sk.md?raw'
import { uraiDraf } from './uraiKebijakan'

// Kebijakan Privasi dan Syarat & Ketentuan (V38). Satu-satunya sumber teks adalah docs/draf-kebijakan-sk.md, dibaca
// saat build dan ditampilkan apa adanya. Catatan draf di atas judul pertama (termasuk alamat situs) tidak ditampilkan.
// Tanda [TODO …] dibiarkan dan diberi warna di layar supaya terlihat jelas belum final.
// Draf diperiksa (ringkasan, nomor bagian, kode internal) oleh npm run uji:kebijakan.
export const KEBIJAKAN = uraiDraf(draf)

export { EMAIL_KONTAK, potongBaris, type Bagian, type Dokumen, type IsiBagian, type Potongan } from './uraiKebijakan'
