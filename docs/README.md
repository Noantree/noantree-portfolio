# Acuan noantree untuk coding

Folder ini berisi acuan yang dibaca Claude Code sebelum menulis kode. Isinya bukan kode aplikasi.

| Isi | Untuk apa |
| --- | --- |
| `PRD.md` | Sumber kebenaran: aturan bisnis (A1–A51), model data, sprint, daftar uji |
| `desain/png/` | Gambar tiap layar (V0–V55). Dilihat untuk tata letak dan tampilan |
| `desain/html/` | Sumber desain tiap layar. Dibaca untuk nilai persis: teks, warna, ukuran huruf, jarak, sudut |

## Aturan pakai untuk AI

1. Baca `PRD.md` bagian yang disebut tugas, lalu lihat PNG layar yang disebut (contoh V12).
2. Ambil teks, warna (hex), ukuran, dan jarak dari file HTML layar yang sama. Teks di layar ditulis persis.
3. File HTML adalah gambar rancangan, bukan komponen siap pakai. Bangun ulang dengan React + Tailwind + komponen bersama di `src/components`. Jangan menyalin markup apa adanya.
4. Bagian `<script>` di file HTML hanya berisi data contoh (nama lapak, jam). Data asli datang dari Supabase.
5. Jika PNG, HTML, dan PRD berbeda, yang menang: PRD, lalu PNG, lalu HTML. Tulis perbedaannya di PR.
6. V40 dan V41 sengaja tidak ada (sudah digabung ke V21).

## Cara memperbarui

Setiap kali PRD atau desain berubah di claude.ai, ganti isi folder ini dengan ekspor terbaru dalam satu commit berjudul `docs: perbarui acuan desain dan PRD`.

## Daftar layar

| Kode | Layar | Gambar | Sumber |
| --- | --- | --- | --- |
| V0 | Panduan visual | `png/V00-panduan-visual.png` | `html/V00-panduan-visual.dc.html` |
| V1 | Beranda pelanggan | `png/V01-beranda-pelanggan.png` | `html/V01-beranda-pelanggan.dc.html` |
| V2 | Detail lapak | `png/V02-detail-lapak.png` | `html/V02-detail-lapak.dc.html` |
| V3 | Pemilik lapak: Tutup | `png/V03-pemilik-lapak-tutup.png` | `html/V03-pemilik-lapak-tutup.dc.html` |
| V4 | Pemilik lapak: Lagi buka | `png/V04-pemilik-lapak-lagi-buka.png` | `html/V04-pemilik-lapak-lagi-buka.dc.html` |
| V5 | Hasil cari | `png/V05-hasil-cari.png` | `html/V05-hasil-cari.dc.html` |
| V6 | Masuk untuk ikuti atau lapor | `png/V06-masuk-untuk-ikuti-atau-lapor.png` | `html/V06-masuk-untuk-ikuti-atau-lapor.dc.html` |
| V7 | Diikuti (sudah masuk) | `png/V07-diikuti-sudah-masuk.png` | `html/V07-diikuti-sudah-masuk.dc.html` |
| V8 | Akun saya (belum punya lapak) | `png/V08-akun-saya-belum-punya-lapak.png` | `html/V08-akun-saya-belum-punya-lapak.dc.html` |
| V9 | Laporkan lapak | `png/V09-laporkan-lapak.png` | `html/V09-laporkan-lapak.dc.html` |
| V10 | Daftarkan lapakmu (juga masuk pemilik) | `png/V10-daftarkan-lapakmu-juga-masuk-pemilik.png` | `html/V10-daftarkan-lapakmu-juga-masuk-pemilik.dc.html` |
| V11 | Daftar 1/3: Profil lapak | `png/V11-daftar-1-3-profil-lapak.png` | `html/V11-daftar-1-3-profil-lapak.dc.html` |
| V12 | Daftar 2/3: Tempat | `png/V12-daftar-2-3-tempat.png` | `html/V12-daftar-2-3-tempat.dc.html` |
| V13 | Daftar 3/3: Jadwal | `png/V13-daftar-3-3-jadwal.png` | `html/V13-daftar-3-3-jadwal.dc.html` |
| V14 | Tutup: 1 tempat, tanpa jadwal | `png/V14-tutup-1-tempat-tanpa-jadwal.png` | `html/V14-tutup-1-tempat-tanpa-jadwal.dc.html` |
| V15 | Habis + pesan Batalkan | `png/V15-habis-pesan-batalkan.png` | `html/V15-habis-pesan-batalkan.dc.html` |
| V16 | Profil lapak & tempat | `png/V16-profil-lapak-dan-tempat.png` | `html/V16-profil-lapak-dan-tempat.dc.html` |
| V17 | Disembunyikan karena laporan | `png/V17-disembunyikan-karena-laporan.png` | `html/V17-disembunyikan-karena-laporan.dc.html` |
| V18 | Admin: Dilaporkan | `png/V18-admin-dilaporkan.png` | `html/V18-admin-dilaporkan.dc.html` |
| V19 | Admin: Semua lapak | `png/V19-admin-semua-lapak.png` | `html/V19-admin-semua-lapak.dc.html` |
| V20 | Keadaan khusus: memuat, belum ada yang buka, offline | `png/V20-keadaan-khusus-memuat-belum-ada-yang-buka-offline.png` | `html/V20-keadaan-khusus-memuat-belum-ada-yang-buka-offline.dc.html` |
| V21 | Filter: Wilayah | `png/V21-filter-wilayah.png` | `html/V21-filter-wilayah.dc.html` |
| V22 | Detail lapak: Biasanya buka | `png/V22-detail-lapak-biasanya-buka.png` | `html/V22-detail-lapak-biasanya-buka.dc.html` |
| V23 | Kartu status detail: Habis & Tutup | `png/V23-kartu-status-detail-habis-dan-tutup.png` | `html/V23-kartu-status-detail-habis-dan-tutup.dc.html` |
| V24 | Cek email (link masuk) | `png/V24-cek-email-link-masuk.png` | `html/V24-cek-email-link-masuk.dc.html` |
| V25 | Lapak sudah tayang | `png/V25-lapak-sudah-tayang.png` | `html/V25-lapak-sudah-tayang.dc.html` |
| V26 | QR untuk gerobak | `png/V26-qr-untuk-gerobak.png` | `html/V26-qr-untuk-gerobak.dc.html` |
| V27 | Lapak tidak tersedia | `png/V27-lapak-tidak-tersedia.png` | `html/V27-lapak-tidak-tersedia.dc.html` |
| V28 | Status berakhir otomatis | `png/V28-status-berakhir-otomatis.png` | `html/V28-status-berakhir-otomatis.dc.html` |
| V29 | Lagi buka: batas perpanjangan 8 jam | `png/V29-lagi-buka-batas-perpanjangan-8-jam.png` | `html/V29-lagi-buka-batas-perpanjangan-8-jam.dc.html` |
| V30 | Pasang ke layar utama | `png/V30-pasang-ke-layar-utama.png` | `html/V30-pasang-ke-layar-utama.dc.html` |
| V31 | Mode ubah: Ubah tempat | `png/V31-mode-ubah-ubah-tempat.png` | `html/V31-mode-ubah-ubah-tempat.dc.html` |
| V32 | Konfirmasi hapus akun | `png/V32-konfirmasi-hapus-akun.png` | `html/V32-konfirmasi-hapus-akun.dc.html` |
| V33 | Pesan sukses & tombol Diikuti | `png/V33-pesan-sukses-dan-tombol-diikuti.png` | `html/V33-pesan-sukses-dan-tombol-diikuti.dc.html` |
| V34 | Beranda: izin lokasi ditolak | `png/V34-beranda-izin-lokasi-ditolak.png` | `html/V34-beranda-izin-lokasi-ditolak.dc.html` |
| V35 | Admin: Disembunyikan | `png/V35-admin-disembunyikan.png` | `html/V35-admin-disembunyikan.dc.html` |
| V36 | Bagikan lapak (QR, salin, kirim) | `png/V36-bagikan-lapak-qr-salin-kirim.png` | `html/V36-bagikan-lapak-qr-salin-kirim.dc.html` |
| V37 | Lihat foto lapak | `png/V37-lihat-foto-lapak.png` | `html/V37-lihat-foto-lapak.dc.html` |
| V38 | Halaman Kebijakan Privasi / S&K | `png/V38-halaman-kebijakan-privasi-sdank.png` | `html/V38-halaman-kebijakan-privasi-sdank.dc.html` |
| V39 | Filter: Urutkan | `png/V39-filter-urutkan.png` | `html/V39-filter-urutkan.dc.html` |
| V42 | Ubah profil lapak | `png/V42-ubah-profil-lapak.png` | `html/V42-ubah-profil-lapak.dc.html` |
| V43 | Tempat baru | `png/V43-tempat-baru.png` | `html/V43-tempat-baru.dc.html` |
| V44 | Ubah jadwal | `png/V44-ubah-jadwal.png` | `html/V44-ubah-jadwal.dc.html` |
| V45 | Beranda bagian bawah: jalan ke daftar lapak | `png/V45-beranda-bagian-bawah-jalan-ke-daftar-lapak.png` | `html/V45-beranda-bagian-bawah-jalan-ke-daftar-lapak.dc.html` |
| V46 | Daftarkan lapakmu (sudah masuk) | `png/V46-daftarkan-lapakmu-sudah-masuk.png` | `html/V46-daftarkan-lapakmu-sudah-masuk.dc.html` |
| V47 | Beranda: daftar lapak belum selesai | `png/V47-beranda-daftar-lapak-belum-selesai.png` | `html/V47-beranda-daftar-lapak-belum-selesai.dc.html` |
| V48 | Beranda pelanggan saat punya lapak | `png/V48-beranda-pelanggan-saat-punya-lapak.png` | `html/V48-beranda-pelanggan-saat-punya-lapak.dc.html` |
| V49 | Detail lapak milik sendiri | `png/V49-detail-lapak-milik-sendiri.png` | `html/V49-detail-lapak-milik-sendiri.dc.html` |
| V50 | Akun saya (punya lapak) | `png/V50-akun-saya-punya-lapak.png` | `html/V50-akun-saya-punya-lapak.dc.html` |
| V51 | Tutup lapak permanen | `png/V51-tutup-lapak-permanen.png` | `html/V51-tutup-lapak-permanen.dc.html` |
| V52 | Masuk lagi ke lapakmu (sesi habis) | `png/V52-masuk-lagi-ke-lapakmu-sesi-habis.png` | `html/V52-masuk-lagi-ke-lapakmu-sesi-habis.dc.html` |
| V53 | Kosong: belum ada lapak di wilayah | `png/V53-kosong-belum-ada-lapak-di-wilayah.png` | `html/V53-kosong-belum-ada-lapak-di-wilayah.dc.html` |
| V54 | Kosong: hasil cari tidak ada | `png/V54-kosong-hasil-cari-tidak-ada.png` | `html/V54-kosong-hasil-cari-tidak-ada.dc.html` |
| V55 | Admin: detail laporan lapak | `png/V55-admin-detail-laporan.png` | `html/V55-admin-detail-laporan.dc.html` |
