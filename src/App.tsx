import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PenyediaPesan } from './components/Pesan'
import { PenyediaSesi } from './lib/sesi'
import Beranda from './routes/Beranda'
import Komponen from './routes/Komponen'
import Akun from './routes/Akun'
import Kebijakan from './routes/Kebijakan'
import Sementara from './routes/Sementara'
import Daftar from './routes/Daftar'
import Daftar1 from './routes/Daftar1'
import Daftar2 from './routes/Daftar2'
import Daftar3 from './routes/Daftar3'
import Tayang from './routes/Tayang'
import Lapakku from './routes/Lapakku'
import QRGerobak from './routes/QRGerobak'
import ProfilLapak from './routes/ProfilLapak'
import UbahProfil from './routes/UbahProfil'
import KelolaTempat from './routes/KelolaTempat'
import UbahJadwal from './routes/UbahJadwal'
import DetailLapak from './routes/DetailLapak'
import Cari from './routes/Cari'
import Diikuti from './routes/Diikuti'
import Admin from './routes/Admin'
import AdminDetail from './routes/AdminDetail'
import { Pengarah } from './components/Pengarah'
import { AjakanPasang } from './components/AjakanPasang'
import { PitaStaging } from './components/PitaStaging'

export default function App() {
  return (
    <PenyediaSesi>
      <PitaStaging />
      <PenyediaPesan>
        <BrowserRouter>
          <Pengarah>
            <Routes>
              <Route path="/" element={<Beranda />} />
              <Route path="/komponen" element={<Komponen />} />
              <Route path="/cari" element={<Cari />} />
              <Route path="/diikuti" element={<Diikuti />} />
              <Route path="/akun" element={<Akun />} />
              <Route path="/akun/kebijakan" element={<Kebijakan />} />
              {/* Admin (A46): hanya akun is_admin; tamu dan akun lain diarahkan ke beranda */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/lapak/:id" element={<AdminDetail />} />
              {/* Beranda pemilik: status harian (S3.2) dan ajakan pasang V30 setelah tayang (A38) */}
              <Route
                path="/lapakku"
                element={
                  <>
                    <Lapakku />
                    <AjakanPasang />
                  </>
                }
              />
              <Route path="/daftar" element={<Daftar />} />
              <Route path="/daftar/1" element={<Daftar1 />} />
              <Route path="/daftar/2" element={<Daftar2 />} />
              <Route path="/daftar/3" element={<Daftar3 />} />
              <Route path="/daftar/tayang" element={<Tayang />} />
              <Route path="/lapakku/qr" element={<QRGerobak />} />
              {/* Profil lapak (V16) dan Tutup lapak permanen (V51) */}
              <Route path="/lapakku/profil" element={<ProfilLapak />} />
              {/* Ubah profil (V42) */}
              <Route path="/lapakku/profil/ubah" element={<UbahProfil />} />
              {/* Ubah jadwal (V44) */}
              <Route path="/lapakku/profil/jadwal" element={<UbahJadwal />} />
              {/* Tempat baru (V43) dan Ubah tempat (V31) */}
              <Route path="/lapakku/tempat/baru" element={<KelolaTempat key="baru" mode="baru" />} />
              <Route path="/lapakku/tempat/:id" element={<KelolaTempat key="ubah" mode="ubah" />} />
              <Route path="/daftar/:langkah" element={<Sementara judul="Daftar lapak" />} />
              {/* Detail lapak (A36): paling akhir, rute aplikasi di atas selalu menang atas slug */}
              <Route path="/:slug" element={<DetailLapak />} />
            </Routes>
          </Pengarah>
        </BrowserRouter>
      </PenyediaPesan>
    </PenyediaSesi>
  )
}
