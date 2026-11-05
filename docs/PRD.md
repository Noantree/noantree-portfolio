# PRD noantree MVP

Oct 25, 2026 · @Aji

## 1. Ringkasan

noantree adalah aplikasi web (PWA) gratis yang menunjukkan lapak mana yang sedang buka, di mana, dan sampai jam berapa. Pemilik lapak cukup menekan satu tombol setiap mulai buka, dan pelanggan tidak perlu memasang aplikasi.

**Masalah.** Pedagang keliling dan lapak kecil tidak punya tempat atau jam tetap. Pelanggan sering datang sia-sia, dan pedagang kehilangan pembeli yang sebenarnya mencari mereka.

**Segmen awal.** Pedagang keliling dan lapak kecil di Kabupaten Sragen, Jawa Tengah. Contoh: bakso, es dawet, cilok, tahu kupat, cukur keliling.

**Lingkup MVP.** Pemilik lapak mendaftar, mengatur tempat dan jadwal, lalu menandai status (Mulai buka, Habis, Selesai). Pelanggan melihat, memfilter, dan mencari lapak tanpa login. Login hanya untuk mengikuti dan melaporkan lapak. Admin menyembunyikan lapak yang dilaporkan.

**Ukuran keberhasilan** (angka target diisi Aji sebelum rilis):

| Ukuran | Cara hitung | Target |
| --- | --- | --- |
| Lapak aktif mingguan | Lapak dengan minimal 1 kali Mulai buka dalam 7 hari | \[diisi\] |
| Kebiasaan pemilik | Rata-rata sesi buka per lapak aktif per minggu | \[diisi\] |
| Status yang jujur | Persen sesi yang diakhiri manual (Selesai), bukan otomatis | \[diisi\] |
| Minat pelanggan | Akun yang mengikuti minimal 1 lapak | \[diisi\] |
| Laporan | Laporan per 100 lapak per minggu (makin kecil makin baik) | \[diisi\] |

**Sumber desain.** Semua kode layar (V0–V55) merujuk ke kanvas Desain visual. Sketsa alur akun (K0–K10) ada di halaman Sketsa kasar kanvas yang sama. Catatan keputusan lama ada di dokumen spesifikasi.

## 2. Cara memakai PRD ini untuk vibe coding

Setiap tugas coding harus menyebut sprint, kode layar (V#), dan nomor aturan (A#) yang dikerjakan. Dengan begitu AI tidak menebak, dan hasilnya bisa dicek terhadap dokumen ini.

**Urutan sumber kebenaran.** Kalau ada yang bertentangan, yang di atas menang. Kalau masih ragu, AI berhenti dan bertanya ke Aji.

1. PRD ini.
2. Kanvas Desain visual (tampilan, teks, warna, ukuran).
3. Dokumen spesifikasi (riwayat keputusan).
4. CLAUDE.md di repo (aturan teknis harian).

**Aturan kerja untuk AI (Claude Code):**

- Kerjakan satu sprint dalam satu waktu. Setiap tugas = satu cabang dan satu pull request kecil.
- Teks di layar ditulis persis seperti di kanvas dan daftar istilah (bagian 3). Jangan mengarang kata baru.
- Semua perubahan database lewat file migrasi bernomor di repo (003, 004, dan seterusnya). Jangan ubah tabel langsung dari dashboard Supabase.
- Semua aturan waktu (buka, berakhir, perpanjang, batas harian) dihitung di database dengan zona waktu Asia/Jakarta, bukan di HP pengguna.
- Jangan menambah fitur dari bagian "Di luar MVP". Jika sebuah tugas butuh keputusan baru, tulis pertanyaannya di PR dan tunggu jawaban.
- Setiap PR menyertakan cara menguji di HP dan centang daftar uji sprint itu (bagian 10). Claude Code tidak bisa membuka kanvas atau dokumen di claude.ai, jadi AI membaca PRD dan file desain dari folder docs/ di repo (S0.6).
- Kunci rahasia (service role, secret Google, API email) tidak pernah masuk kode atau repo. Simpan di variabel lingkungan Cloudflare dan Supabase.

**Tugas Aji:**

- Memberi perintah per tugas dengan template di bawah.
- Menguji hasil di HP sendiri di staging.noantree.id setelah PR digabung ke staging, lalu di noantree.id setelah merge ke main (alur di docs/PROSES.md).
- Memutuskan pertanyaan terbuka (bagian 11) sebelum sprint yang membutuhkannya dimulai.

**Template perintah:**

```
Kerjakan Sprint [nomor], tugas [nomor tugas].
Baca PRD bagian [5, 6, 7] dan layar [V..] di kanvas.
Ikuti aturan [A..]. Jangan menambah fitur lain.
Setelah selesai: jelaskan cara menguji di HP dan centang daftar uji Sprint [nomor].
```

## 3. Pengguna, peran, dan istilah

Satu email = satu akun, dan satu akun bisa menjadi pelanggan sekaligus pemilik lapak. Peran pemilik tidak dipilih saat mendaftar; peran itu ada karena akunnya punya lapak.

| Peran | Siapa | Bisa apa |
| --- | --- | --- |
| Tamu | Siapa pun tanpa login | Melihat beranda, detail lapak, filter, cari, bagikan |
| Pelanggan | Akun yang sudah masuk | Semua yang tamu bisa, plus ikuti lapak, laporkan lapak, kelola Akun saya |
| Pemilik lapak | Akun yang punya lapak | Semua yang pelanggan bisa, plus kelola lapak, tempat, jadwal, status |
| Admin | Akun yang ditandai admin di database | Melihat laporan, menyembunyikan dan menampilkan lagi lapak |

**Istilah baku di layar.** Pakai kata di kolom kiri persis seperti tertulis. Kata di kolom kanan tidak boleh muncul di layar.

| Istilah | Arti | Jangan pakai |
| --- | --- | --- |
| Lapak | Unit jualan yang buka-tutup, diikuti, dan dilaporkan | toko, warung, merchant |
| Pemilik lapak | Orang yang mengelola lapak | penjual, pedagang, seller |
| Pelanggan | Orang yang melihat dan mengikuti lapak | pembeli, user |
| Tempat | Titik tempat lapak biasa buka (maks. 10 per lapak) | lokasi jualan, cabang |
| Jadwal | Jam buka yang diisi pemilik | jam operasional, Biasa buka |
| Lagi buka | Status: pemilik sudah menekan Mulai buka | Online, Aktif |
| Habis | Status: masih di tempat, stok habis | Sold out |
| Tutup | Status: tidak sedang buka | Offline |
| Biasanya buka | Status hitungan dari jadwal, belum dikonfirmasi pemilik | Mungkin buka |
| Mulai buka, Selesai | Tombol pemilik untuk memulai dan mengakhiri sesi | Buka toko, Tutup toko |
| Perpanjang | Menambah 1 jam ke sesi yang sedang berjalan | Extend |
| Buka lagi | Memulai sesi baru setelah sesi berakhir otomatis | Lanjutkan |
| Ikuti, Diikuti | Menyimpan lapak ke daftar pelanggan | Follow, Favorit |
| Laporkan | Mengirim laporan tentang lapak | Report, Adukan |
| Sembunyikan | Tindakan admin: lapak hilang dari publik, data tetap | Blokir, Hapus |
| Tutup lapak permanen | Pemilik menghapus lapaknya, akun tetap ada | Nonaktifkan |
| Hapus akun | Menghapus akun dan semua datanya | Deaktivasi |
| Wilayah | Gabungan provinsi, kabupaten/kota, dan kecamatan | Area, Zona |
| Terdekat, Terpopuler, Abjad | Tiga pilihan urutan | Baru buka, Segera tutup |

## 4. Teknologi dan arsitektur

Aplikasi berupa satu PWA React yang di-deploy ke Cloudflare. Semua data, login, aturan, dan foto ada di Supabase, sehingga tidak ada server sendiri yang perlu dirawat.

| Bagian | Pilihan | Catatan |
| --- | --- | --- |
| Tampilan | React + Vite + TypeScript, Tailwind, shadcn/ui | Token warna dan huruf dari V0 Panduan visual; huruf Plus Jakarta Sans |
| PWA | vite-plugin-pwa (manifest + service worker) | Bisa dipasang ke layar utama (V30); data terakhir tampil saat sinyal putus (V20) |
| Hosting | Cloudflare Workers dengan Workers Builds, terhubung repo GitHub Noantree/noantree (privat). Dua Worker: `noantree` (produksi, branch main) dan `noantree-staging` (staging.noantree.id, branch staging) | PR ke staging punya build pratinjau untuk diuji; build pratinjau Worker produksi dimatikan (docs/PROSES.md) |
| Database | Supabase Postgres | Proyek produksi REF-PROYEK-PRODUKSI dan proyek staging REF-PROYEK-STAGING; repo berisi migrasi 003 sampai 029 (001 dan 002 tidak ada di repo; staging dibuat dengan skrip awal supabase/staging/awal-sebelum-003.sql) |
| Login | Supabase Auth: Google OAuth + link email (magic link) | Satu email = satu akun; identitas Google dan email dengan alamat sama harus tergabung (uji di Sprint 1) |
| Email | Resend dipasang sebagai SMTP Supabase di staging dan produksi, alamat pengirim noreply@noantree.id | Email bawaan Supabase dibatasi beberapa per jam dan tidak dipakai lagi |
| Foto | Supabase Storage, bucket publik baca, tulis hanya pemilik | Dikecilkan di HP sebelum diunggah (A40) |
| Cek link Maps | Supabase Edge Function | Membuka link pendek Google Maps di server, mengambil lat/lng; maks. 10 kali per pemilik per hari (A33) |
| Status otomatis | View database yang menghitung status efektif saat dibaca | Tidak perlu job per menit; job tiap jam membersihkan sesi lama (A6) |
| Lokasi pelanggan | Geolocation API browser | Hanya untuk mengurutkan Terdekat, tidak dikirim atau disimpan di server (A21) |
| Data wilayah | Tabel wilayah (satu tabel, migrasi 003) | Dipakai untuk filter Wilayah dan isian tempat |

**Struktur folder yang disarankan:** `src/routes` (satu file per layar), `src/components` (kartu lapak, chip status, tombol, lembar bawah), `src/lib` (supabase client, format waktu WIB, kompres foto), `supabase/migrations`, `supabase/functions`.

**Nama rute:** `/` beranda, `/cari`, `/daftar` (V10), `/daftar/1..3`, `/daftar/tayang` (V25), `/lapakku` (beranda pemilik), `/lapakku/qr` (V26), `/lapakku/profil`, `/akun`, `/diikuti`, `/admin`, dan `/:slug` untuk detail lapak (contoh noantree.id/bakso-pak-slamet, juga tujuan QR dan link bagikan). Nama rute lain tidak boleh dipakai sebagai slug (A36).

## 5. Model data

Struktur tiga tingkat Usaha → Lapak → Tempat disiapkan sejak awal, tetapi di MVP satu usaha otomatis punya satu lapak. Status disimpan per sesi buka, dan status yang tampil dihitung saat dibaca. Semua ini dibuat di migrasi 005 (wilayah di migrasi 003, tabel lama dihapus di 004).

| Tabel | Kolom penting | Aturan |
| --- | --- | --- |
| profil | id (= auth.users.id), nama\_tampilan, foto\_url, is\_admin | Dibuat otomatis saat akun pertama kali masuk |
| usaha | id, pemilik\_id, nama | MVP: 1 akun = 1 usaha = 1 lapak |
| lapak | id, usaha\_id, pemilik\_id, nama, slug (unik), deskripsi, foto\_url, status\_tayang (draf, tayang, disembunyikan), langkah\_daftar (1–3) | Tayang setelah langkah 2 selesai (A30). Slug tidak berubah walau nama diganti (A36) |
| foto\_lapak | id, lapak\_id, url, urutan | Maks. 4 per lapak |
| tempat | id, lapak\_id, nama, lat, lng (boleh kosong), link\_maps, kecamatan\_id, terakhir\_dipakai | Maks. 10 per lapak. Tanpa lat/lng: tidak masuk urutan Terdekat |
| jadwal | id, lapak\_id, hari (0 = Minggu … 6 = Sabtu), jam\_mulai, jam\_selesai | Boleh beberapa sesi per hari. Jam selesai lebih kecil dari jam mulai berarti lewat tengah malam. Satu sesi kurang dari 24 jam dan dihitung milik hari mulainya |
| sesi\_buka | id, lapak\_id, tempat\_id, mulai\_pada, berakhir\_pada, status (buka, habis), status\_sejak, diakhiri\_pada, cara\_akhir (manual, otomatis), total\_perpanjangan\_menit, dari\_jadwal, akhir\_dilihat\_pemilik | Maks. 1 sesi aktif per lapak. Aturan durasi di bawah |
| pengikut | pelanggan\_id, lapak\_id, dibuat\_pada | Kunci gabungan; pemilik tidak bisa mengikuti lapaknya sendiri |
| laporan | id, lapak\_id, pelapor\_id (kosong setelah akun dihapus), alasan, catatan, dibuat\_pada, pernyataan\_pada, status (baru, diabaikan, ditindak) | 1 laporan per akun per lapak per 30 hari, dihitung dari laporan terakhir akun itu. Pernyataan "melihat sendiri" wajib (V9). Pelapor tidak pernah terlihat oleh pemilik |
| tindakan\_admin | id, lapak\_id, admin\_id (kosong setelah akun dihapus), aksi (abaikan, sembunyikan, tampilkan), laporan\_id (kosong jika berlaku untuk semua laporan), catatan, dibuat\_pada | Riwayat moderasi. Setiap tindakan dicatat lewat fungsi `admin_tindak_lapak` |
| cek\_link | pemilik\_id, dibuat\_pada | Penghitung batas 10 cek link per hari WIB |
| wilayah (003) | satu tabel untuk provinsi, kabupaten, dan kecamatan (kolom tingkat) | Dibuat di migrasi 003; tabel lama dihapus di 004 |

**Status efektif** (dihitung di view `lapak_publik`, urutan pengecekan):

1. Lapak disembunyikan atau masih draf → tidak tampil ke publik.
2. Ada sesi dengan `diakhiri_pada` kosong dan `berakhir_pada` masih di depan → **Lagi buka** atau **Habis** sesuai kolom status.
3. Tidak ada sesi aktif, tetapi waktu sekarang ada di dalam sesi jadwal hari ini dan belum ada sesi buka milik sesi jadwal itu, yaitu sesi dengan `dari_jadwal` dan `berakhir_pada` − `total_perpanjangan_menit` sama dengan akhir sesi jadwal itu, termasuk sesi yang dimulai sampai 3 jam lebih awal (Selesai hanya berlaku untuk sesi itu; sesi jadwal berikutnya kembali ke Biasanya buka tanpa tindakan pemilik) → **Biasanya buka**. Tempat yang tampil = tempat yang terakhir dipakai.
4. Selain itu → **Tutup**.

**Aturan durasi sesi:**

| Kejadian | Hasil |
| --- | --- |
| Mulai buka di dalam sesi jadwal, termasuk sebelum sesi jadwal mulai (pemilik boleh memulai 2–3 jam lebih awal) | `berakhir_pada` = akhir sesi jadwal itu |
| Mulai buka di luar jadwal, atau lapak tanpa jadwal | `berakhir_pada` = mulai + 4 jam |
| Perpanjang | +60 menit, hanya jika `total_perpanjangan_menit` + 60 ≤ 480 (maks. 8 jam per sesi) |
| Waktu `berakhir_pada` lewat | Sesi dianggap selesai otomatis (`cara_akhir` = otomatis); pemilik melihat V28 sekali saat membuka aplikasi. V28 hanya muncul untuk sesi yang berakhir dalam 24 jam terakhir; sesi yang lebih lama langsung ditandai dilihat tanpa layar |
| Buka lagi (dari V28 atau setelah batas 8 jam) | Sesi baru, aturan di atas berlaku lagi |
| Habis | Sesi yang sama, status = habis, `berakhir_pada` tidak berubah. Stok ada lagi → status = buka |
| Selesai | `diakhiri_pada` = sekarang, `cara_akhir` = manual. Batalkan dalam 5 detik mengosongkan lagi `diakhiri_pada` |

Contoh: lapak tanpa jadwal paling lama buka 4 + 8 = 12 jam per sesi. Lapak dengan jadwal 06.00–14.00 paling lama sampai 22.00.

## 6. Aturan bisnis

Ada 51 aturan, diberi nomor A1–A51 supaya setiap tugas coding bisa menyebut aturan yang dikerjakan. Aturan ini mengikat; tampilan di kanvas mengikuti aturan ini.

**Status dan sesi**

- **A1** Status di database: buka, habis, tutup. Label di layar: Lagi buka, Habis, Tutup, ditambah Biasanya buka (hitungan dari jadwal).
- **A2** Mulai buka memakai tempat yang dipilih. Pilihan bawaan = tempat yang terakhir dipakai (V3). Lapak dengan satu tempat langsung memakai tempat itu (V14).
- **A3** Habis dan Selesai langsung berlaku tanpa dialog konfirmasi, lalu muncul pesan dengan tombol Batalkan selama 5 detik (V15, V33).
- **A4** Tombol Perpanjang berwarna abu, berubah biru saat sisa waktu kurang dari 1 jam, dan nonaktif setelah total perpanjangan 8 jam (V4, V29).
- **A5** Banner "Lupa mulai buka?" muncul di beranda pemilik jika sesi jadwal sudah mulai dan lapak belum buka. Hanya di aplikasi, bukan notifikasi HP (V3).
- **A6** Sesi yang melewati `berakhir_pada` dianggap selesai saat dibaca. Job tiap jam menandai `cara_akhir` = otomatis untuk sesi lama.
- **A7** Layar Berakhir (V28) muncul sekali saat pemilik membuka aplikasi setelah sesinya berakhir otomatis.
- **A8** Mulai buka saat sinyal putus disimpan di HP dan dikirim begitu sinyal kembali, dengan waktu saat tombol ditekan (V20).
- **A9** Lapak yang disembunyikan tidak bisa Mulai buka (V17).

**Beranda dan daftar lapak**

- **A10** Beranda menampilkan kelompok "Lagi buka di \[wilayah\]" (Lagi buka dan Habis), lalu "Biasanya buka jam segini". Lapak berstatus Tutup tidak tampil di beranda, hanya di hasil cari dan Diikuti.
- **A11** Judul kelompok menyebut jumlah lapak di kelompok itu ("12 lapak").
- **A12** Urutan: Terdekat (bawaan, butuh izin lokasi, lapak tanpa titik di paling bawah), Terpopuler (pengikut terbanyak), Abjad (A–Z). Jika izin lokasi ditolak, otomatis Terpopuler (V34). Urutan berlaku di dalam setiap kelompok.
- **A13** Lapak tanpa foto memakai inisial 2 huruf dari 2 kata pertama, atau 2 huruf pertama jika namanya satu kata. Warna latar dari palet tetap; hijau dan oranye tidak dipakai karena itu warna status.
- **A14** Kartu izin lokasi tampil sampai pelanggan memilih Izinkan lokasi atau Pilih wilayah (V1).
- **A15** Di ujung daftar beranda ada kartu "Punya lapak atau jualan keliling? Daftar lapak gratis" (V45).
- **A16** Pemilik yang menjelajah sebagai pelanggan melihat tombol Lapakku di header, dengan titik hijau jika lapaknya sedang buka. Kartu lapaknya sendiri diberi label "Lapakmu" (V48).

**Filter wilayah**

- **A17** Satu filter Wilayah (V21): provinsi, lalu kabupaten/kota (boleh "Semua kabupaten/kota"), lalu kecamatan (pilih satu; "Semua" di urutan pertama dan menjadi bawaan).
- **A18** Wilayah bawaan = Kabupaten Sragen, segmen awal MVP. Izin lokasi hanya dipakai untuk urutan Terdekat, tidak untuk menebak wilayah. Pilihan terakhir diingat di HP.
- **A19** Chip wilayah menampilkan tingkat yang paling spesifik: "Jawa Tengah", "Sragen", atau "Masaran".
- **A20** Titik hijau di samping nama daerah = ada lapak yang lagi buka. Tidak ada angka per daerah. Tombol "Tampilkan N lapak" menunjukkan jumlah hasil.
- **A21** Lokasi pelanggan hanya dipakai di HP untuk menghitung jarak dan urutan. Tidak dikirim ke server dan tidak disimpan.

**Cari**

- **A22** Mencari di nama dan deskripsi lapak, di dalam wilayah yang aktif. Hasil dikelompokkan: Lagi buka, Biasanya buka jam segini, Sedang tutup (V5).
- **A23** Tombol "Cari … di semua wilayah (+N)" muncul jika ada hasil di luar wilayah aktif.
- **A24** Halaman kosong: tidak ada lapak di wilayah (V53, menawarkan wilayah satu tingkat lebih luas) dan hasil cari kosong (V54). Ada lapak tapi belum ada yang buka bukan halaman kosong; tampilkan jadwalnya (V20).

**Akun dan masuk**

- **A25** Cara masuk sama di semua tempat: Masuk dengan Google (utama) dan Masuk lewat email (kedua) (V6, V10, V52). Link email berlaku 1 jam dan bisa dikirim ulang setelah 60 detik (V24).
- **A26** Setelah masuk: aksi yang tertunda (ikuti atau lapor) langsung dijalankan. Datang dari Daftarkan lapakmu: belum punya lapak → Daftar 1, ada draf → langkah yang belum selesai, sudah punya lapak → beranda pemilik. Selain itu: punya lapak → beranda pemilik, tidak → beranda pelanggan.
- **A27** Membuka aplikasi dengan sesi login aktif: punya lapak → beranda pemilik. Memuat ulang halaman beranda (tarik ke bawah atau refresh) tetap di beranda, tidak dibawa ke Lapakku. Sesi habis dan HP pernah dipakai pemilik (tanda di HP) → Masuk lagi ke lapakmu (V52).
- **A28** Keluar = keluar dari kedua peran. Hapus akun: ketik HAPUS, terhapus permanen dalam 30 hari, laporan yang pernah dikirim dan riwayat tindakan admin disimpan tanpa nama. Daftar "yang ikut terhapus" menyesuaikan isi akun; untuk pelanggan tanpa lapak hanya profil dan lapak yang diikuti (V32).
- **A29** Tutup lapak permanen: ketik TUTUP. Sesi yang sedang berjalan diakhiri dulu. Lapak, tempat, jadwal, foto, dan pengikut dihapus; link lapak menampilkan V27. Akun dan daftar Diikuti tetap (V51).

**Pendaftaran lapak**

- **A30** Lapak tayang setelah langkah 2 (profil dan satu tempat). Langkah 3 (jadwal) boleh dilewati: "Simpan dan selesai" maupun "Lewati, jadwal saya tidak tetap" di Daftar 3 membuat lapak tayang, lalu menampilkan V25. Syarat tayang: lapak masih draf, langkah_daftar sudah 3, dan ada minimal 1 tempat (A39).
- **A31** Isian disimpan per langkah. "Lanjutkan nanti" di Daftar 1, 2, dan 3 menyimpan isian yang sudah diisi, lalu membawa ke beranda dengan banner "Daftar lapakmu belum selesai" (V47); banner bisa ditutup (×) dan pengingatnya pindah ke Akun saya (kartu "Lanjutkan daftar lapakmu"). Status banner disimpan di HP (localStorage).
- **A32** Persetujuan bertingkat: S&K dan Kebijakan Privasi disetujui saat masuk. Izin nama, foto, dan tempat tampil untuk umum wajib dicentang di Daftar 1.
- **A33** Titik lokasi: Pakai lokasiku sekarang (GPS, link Google Maps dibuat otomatis), atau tempel link Google Maps yang diperiksa di server, atau cari tempat lalu geser titik di peta. Peta memakai OpenStreetMap (Leaflet); pencarian nama tempat memakai layanan geocoding pihak ketiga (Photon/Nominatim) dan ditampilkan dengan atribusi "© OpenStreetMap". Peta hanya dipakai untuk memilih titik; lokasi pelanggan tidak pernah dikirim ke server (A21). Dari PC, peta menampilkan peringatan bahwa lokasi dari PC bisa meleset jauh, dan pemilik diminta mengecek titiknya di peta. Maks. 10 cek link per pemilik per hari WIB. Tempat boleh disimpan tanpa titik.
- **A34** Kabupaten dan kecamatan tempat dipilih manual; tidak ditebak dari link.
- **A35** Jadwal: 7 hari (Senin sampai Minggu), setiap hari boleh beberapa sesi; hari tanpa sesi berarti libur. Ada tombol "Samakan jam Senin ke semua hari aktif". Sesi diedit langsung di jamnya, tanpa tombol edit terpisah; tombol × menghapus sesi. Jam dipilih lewat dua dropdown (jam 00 sampai 23, menit kelipatan 5), bukan pemilih jam bawaan HP. Format jam 24 jam tanpa AM/PM, misalnya 08.00 dan 22.00. Menit hanya kelipatan 5 (00, 05, 10, … 55), dan aturan ini juga dijaga di database. Jam boleh melewati tengah malam dan semua jam memakai WIB (Asia/Jakarta). Ditolak: jam mulai sama dengan jam selesai, dan sesi yang bertumpuk, termasuk sesi lewat tengah malam yang menabrak hari berikutnya (Sabtu ke Minggu juga dihitung). Hanya satu tombol aktif pada satu waktu: "Simpan dan selesai" jika minimal ada 1 sesi, "Lewati, jadwal saya tidak tetap" jika formulir kosong. Lewati menghapus jadwal yang sebelumnya tersimpan (setelah konfirmasi), jadi untuk menghapus jadwal tersimpan pemilik menghapus semua sesi di formulir dulu.
- **A36** Slug dibuat dari nama lapak saat pertama tayang (huruf kecil, spasi jadi tanda hubung, karakter lain dibuang). Jika sudah dipakai, tambah angka (-2, -3). Slug tidak berubah walau nama diganti, supaya QR tetap jalan. Nama rute aplikasi tidak boleh jadi slug: daftar, cari, lapakku, akun, diikuti, admin, komponen; jika bentrok, tambah angka. Link dan QR dari V25 harus bisa dibuka lagi oleh pemilik nanti (belum dikerjakan di S2.4).
- **A37** Deskripsi berupa teks biasa, maks. 300 karakter, tanpa link.
- **A38** Ajakan pasang ke layar utama (V30) muncul setelah tayang. "Nanti saja" menunda, lalu ajakan muncul lagi maks. sekali seminggu jika ditolak. Jika HP tidak mendukung pemasangan langsung, tampilkan petunjuk menu. Status ajakan disimpan di HP (localStorage).

**Kelola lapak dan foto**

- **A39** Minimal 1 tempat. Tempat yang sedang dipakai buka tidak bisa dihapus.
- **A40** Foto: ukuran file yang dipilih pengguna tidak dibatasi. Aplikasi mengecilkan di HP sebelum unggah: foto lapak ke sisi terpanjang 1600 px, foto profil 512 px, format JPEG atau WebP. Batas tersimpan maks. 3 MB per foto lapak dan 500 KB per foto profil. Jika hasil kompres masih di atas batas, kualitas diturunkan bertahap sampai masuk. Maks. 4 foto lapak.

**Ikuti**

- **A41** Ikuti perlu masuk. Sesudah mengikuti muncul pesan biru "Kamu mengikuti …". Berhenti mengikuti memunculkan pesan abu dengan Batalkan.
- **A42** Di lapak sendiri, tombol Ikuti dan Laporkan diganti kotak "Ini lapakmu" (V49). Tombol Buka di Google Maps tetap aktif untuk pemilik, supaya titik lapak bisa dicek di Maps.
- **A43** Notifikasi saat lapak yang diikuti mulai buka tidak masuk MVP. Daftar Diikuti (V7) tetap ada.

**Lapor dan admin**

- **A44** Lapor perlu masuk dan hanya bisa untuk lapak yang sedang tayang. Lima alasan, tanpa pilihan awal: Lapak tidak ada / akun iseng, Status tidak sesuai, Tempat salah, Konten tidak pantas, Lainnya. Pelapor wajib mencentang pernyataan "Saya melaporkan berdasarkan kondisi yang saya lihat sendiri" sebelum tombol Kirim laporan aktif. Catatan opsional maks. 200 karakter. Satu akun hanya bisa melaporkan satu lapak yang sama satu kali per 30 hari, dihitung dari laporan terakhir akun itu. Pemilik tidak tahu siapa pelapornya.
- **A45** Tidak ada persetujuan admin sebelum tayang. Admin bekerja setelah ada laporan.
- **A46** Admin punya tiga tab: Dilaporkan (lapak dengan jumlah laporan aktif terbanyak di atas), Semua lapak (terbaru di atas), Disembunyikan. Tab Dilaporkan menampilkan daftar lapak, bukan daftar laporan: setiap lapak memuat jumlah laporan aktif, jumlah total, dan alasan terbanyak. Ketuk lapak untuk membuka detail (V55) yang berisi semua laporan lapak itu, dengan nama dan email pelapor, alasan, catatan, pernyataan, dan status. Aksi: Abaikan (satu laporan, atau semua laporan aktif sekaligus dengan Abaikan semua; lapak tetap tayang), Sembunyikan lapak, Tampilkan lagi, plus catatan admin. Setiap tindakan dicatat di riwayat.
- **A47** Sembunyikan lapak: lapak hilang dari beranda, cari, dan halaman publik; data dan pengikut tetap. Semua laporan yang masih baru ditandai ditindak. Pemilik melihat V17 dan menerima email. Tampilkan lagi: lapak kembali tayang, laporan yang ditandai ditindak kembali menjadi diabaikan, dan pemilik diberi tahu lewat email. Admin hanya bisa menyembunyikan lapak yang sedang tayang, dan menampilkan lapak yang sedang disembunyikan. Laporan tidak pernah dihapus oleh tindakan admin.
- **A48** Tombol WhatsApp admin disembunyikan di MVP. Pemilik yang ingin banding membalas email pemberitahuan.

**Bagikan**

- **A49** Lembar Bagikan (V36): QR, link + Salin, Bagikan ke WhatsApp dan lainnya. Pesan otomatis menyesuaikan status (buka atau tutup). QR gerobak bisa disimpan sebagai gambar dan dicetak ukuran A6 (V26). Di detail lapak, tombol Bagikan untuk pelanggan membuka menu bagikan HP dengan link lapak (V2).
- **A50** "Ajak lapak langgananmu" membuka menu bagikan HP dengan pesan siap kirim dan link noantree.id/daftar.

**Data segar**

- **A51** Beranda, hasil cari, detail, dan Diikuti memuat ulang data saat aplikasi kembali dibuka dan setiap 30 detik selama layar terbuka. Pelanggan juga bisa menarik layar ke bawah untuk memuat ulang. Perubahan status pemilik terlihat di HP lain dalam kurang dari 1 menit.
- **A52** Daftar 1 memuat pertanyaan "Dalam 1 minggu, apakah lapakmu pindah ke tempat lain?" dengan dua pilihan: "Tidak, tetap di satu tempat" dan "Ya, berpindah tempat dalam 1 minggu". Belum ada pilihan yang terpilih sejak awal, dan jawaban wajib diisi saat Lanjut. "Lanjutkan nanti" boleh menyimpan tanpa jawaban. Jawaban disimpan di lapak (kolom pindah_mingguan, migrasi 030) dan tidak mengubah apa pun di MVP; jadwal tetap per lapak (A35). Jawaban ini dipakai untuk memutuskan jadwal per tempat nanti kalau permintaannya sudah ramai.

## 7. Spesifikasi per layar

Ada 54 layar di kanvas Desain visual (V0–V55; V40 dan V41 sudah digabung ke V21). Tabel ini menyebut isi, aksi, dan aturan tiap layar; tampilan persisnya dilihat di kanvas. Semua layar dirancang untuk lebar HP 390 px dan target sentuh minimal 44 px.

**Panduan**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V0 | Panduan visual | Warna, huruf, chip status, tombol, aturan bayangan tipis | Sumber token Tailwind |
| V33 | Pesan dan tombol Diikuti | Warna pesan per jenis: biru info, abu netral, hijau berhasil, oranye habis, merah disembunyikan. Satu pesan dalam satu waktu, hilang 5 detik | A3, A41 |

**Pelanggan: melihat dan mencari**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V1 | Beranda pelanggan | Header + Masuk, kartu izin lokasi, chip Urutkan dan Wilayah, kotak cari, kelompok Lagi buka dan Biasanya buka | A10–A14 |
| V45 | Beranda bagian bawah | Akhir daftar, kartu Daftar lapak gratis, tautan S&K dan Privasi | A15 |
| V34 | Izin lokasi ditolak | Chip Terpopuler, keterangan urutan, tautan Pakai lokasi | A12 |
| V39 | Urutkan | Terdekat, Terpopuler, Abjad | A12 |
| V21 | Wilayah | Provinsi, kabupaten/kota, kecamatan (pilih satu), Atur ulang, Tampilkan N lapak | A17–A20 |
| V5 | Hasil cari | Kotak cari aktif, tiga kelompok hasil, Cari di semua wilayah | A22, A23 |
| V53 | Kosong: wilayah | Tidak ada lapak; tombol wilayah lebih luas, Ajak lapak langgananmu, Daftar gratis | A24, A50 |
| V54 | Kosong: cari | Tidak ada hasil; saran kata, Cari di semua wilayah, ajak, daftar | A24 |
| V2 | Detail lapak | Status, tempat, Buka di Google Maps, Ikuti, Tentang, foto, Jadwal (daftar Senin sampai Minggu; hari tanpa sesi ditulis Libur), Laporkan, Bagikan | A35, A41, A44 |
| V22 | Detail: Biasanya buka | Kartu bergaris putus-putus, keterangan belum dikonfirmasi, Lihat tempat biasanya di Maps | A1 |
| V23 | Varian status detail | Habis (oranye), Tutup dengan jadwal (Buka lagi besok 06.00), Tutup tanpa jadwal | A1 |
| V37 | Lihat foto | Layar gelap, geser antarfoto. Di PC: tombol panah kiri dan kanan, panah keyboard, dan geser dengan mouse | A40 |
| V27 | Lapak tidak tersedia | Untuk link lama, lapak disembunyikan, atau lapak yang sudah ditutup | A29, A47 |

**Masuk dan akun**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V6 | Masuk | Lembar bawah: Masuk dengan Google, Masuk lewat email, persetujuan, Punya lapak? Daftarkan lapakmu | A25, A26 |
| V24 | Cek email | Alamat tujuan, Buka aplikasi email, Kirim ulang (hitung mundur), Ganti email | A25 |
| V7 | Diikuti | Kelompok Lagi buka dan Sedang tutup, tombol Berhenti | A41, A43 |
| V8 | Akun saya (belum punya lapak) | Foto, nama, email, Buka lapakmu di noantree (hanya jika belum ada lapak sama sekali, menuju /daftar), Diikuti, Kebijakan, Keluar, Ganti akun (memilih akun Google lain), Hapus akun. Lapak draf: kartu "Lanjutkan daftar lapakmu" menuju langkah yang belum selesai (belum ada di desain, disetujui di S2.4) | A26, A28, A31 |
| V50 | Akun saya (punya lapak) | Sama dengan V8, tetapi ada kartu Lapakku menuju Profil lapak (V16, /lapakku/profil) untuk lapak tayang dan disembunyikan; jangan menambah kartu yang mengarah ke halaman sementara. Tombol Ganti akun di bawah Keluar | A28 |
| V32 | Hapus akun | Daftar yang terhapus, saran Tutup lapak saja, ketik HAPUS | A28 |
| V38 | Kebijakan Privasi dan S&K | Dua tab, ringkasan, bagian bernomor (isi masih placeholder) | A32 |
| V52 | Masuk lagi ke lapakmu | Nama lapak terakhir, email disamarkan, Google, email, Lihat lapak lain | A27 |

**Pendaftaran lapak**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V10 | Daftarkan lapakmu | Tiga langkah, Lanjut dengan Google, email + Kirim link. Juga pintu masuk pemilik lama | A25, A26 |
| V46 | Daftarkan lapakmu (sudah masuk) | Akun yang dipakai, tiga langkah, Lanjut daftar lapak, Ganti akun | A26 |
| V11 | Daftar 1: Profil | Foto profil, nama lapak, jual apa, foto lapak (maks. 4), pindah tempat dalam 1 minggu (wajib saat Lanjut), izin tampil umum, Lanjutkan nanti | A31, A32, A37, A40, A52 |
| V12 | Daftar 2: Tempat | Nama tempat, Pakai lokasiku sekarang, tempel link, kabupaten + kecamatan, Lanjutkan nanti | A30, A33, A34 |
| V13 | Daftar 3: Jadwal | 7 hari Senin–Minggu, beberapa sesi per hari (hari tanpa sesi = libur), + Sesi, dropdown jam (00–23) dan menit (kelipatan 5) untuk edit, × hapus sesi, Samakan jam Senin. Hanya satu tombol aktif: Simpan dan selesai (minimal 1 sesi) atau Lewati, jadwal saya tidak tetap (formulir kosong). Lewati dengan jadwal tersimpan: konfirmasi "Hapus jadwalmu?", lalu jadwal dihapus | A35 |
| V47 | Daftar belum selesai | Banner di beranda: Lanjutkan daftar, tutup (×) | A31 |
| V25 | Lapak sudah tayang | Rute /daftar/tayang (lapak belum tayang atau belum ada: ke /daftar). Link + Salin, Bagikan link, QR gerobak, cara pakai, Ke beranda lapak. Link dan QR harus bisa dibuka lagi oleh pemilik nanti (belum di S2.4) | A30, A36 |
| V30 | Pasang ke layar utama | Pasang sekarang, Nanti saja, petunjuk iPhone | A38 |

**Pemilik lapak: harian**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V3 | Tutup (beberapa tempat, ada jadwal) | Status Tutup, pilih tempat, + Tempat baru, banner Lupa mulai buka, Mulai buka | A2, A5 |
| V14 | Tutup (satu tempat, tanpa jadwal) | Tempat + Ganti, Atur jadwal, Mulai buka | A2 |
| V4 | Lagi buka | Status besar, sisa waktu, pengikut, Perpanjang 1 jam, Kabari pelanggan, Habis, Selesai | A3, A4 |
| V15 | Habis | Status Habis, Stok ada lagi, Selesai, pesan Batalkan | A3 |
| V29 | Batas perpanjangan | Perpanjang nonaktif, penjelasan batas 8 jam | A4 |
| V28 | Berakhir otomatis | Penjelasan, Buka lagi (sesi baru), Oke sudah pulang | A6, A7 |
| V17 | Disembunyikan | Alasan laporan, tanggal, Periksa profil, Mulai buka nonaktif | A9, A47, A48 |
| V36 | Bagikan lapak | QR, link, Salin, Bagikan ke WhatsApp, Lihat halamanku, QR gerobak | A49 |
| V26 | QR gerobak | Kartu siap cetak, Simpan gambar, Cetak A6 | A49 |

**Pemilik lapak: kelola**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V16 | Profil lapak | Profil + Ubah, Lihat halamanku, QR, daftar tempat, Jadwal, Akun saya, Jelajahi sebagai pelanggan, Tutup lapak permanen | A39 |
| V42 | Ubah profil | Foto, nama (slug tetap), deskripsi, foto lapak | A36, A37, A40 |
| V43 | Tempat baru | Sama dengan Daftar 2, tanpa penanda langkah | A33, A34 |
| V31 | Ubah tempat | Sama dengan Tempat baru, plus Hapus tempat ini | A39 |
| V44 | Ubah jadwal | Pola edit sama dengan Daftar 3 (dropdown jam dan menit, × hapus sesi), plus Hapus jadwal | A35 |
| V48 | Beranda pelanggan saat punya lapak | Tombol Lapakku, kartu "Lapakmu" | A16 |
| V49 | Detail lapak sendiri | Kotak Ini lapakmu: Kelola lapak, Bagikan. Tanpa Ikuti dan Laporkan. Buka di Google Maps tetap aktif | A42 |
| V51 | Tutup lapak permanen | Yang dihapus, yang tetap, ketik TUTUP | A29 |

**Admin dan keadaan khusus**

| Kode | Layar | Isi dan aksi | Aturan |
| --- | --- | --- | --- |
| V18 | Admin: Dilaporkan | Daftar lapak dengan jumlah laporan aktif dan total, alasan terbanyak, Abaikan semua, Sembunyikan lapak; ketuk lapak untuk V55 | A46, A47 |
| V19 | Admin: Semua lapak | Cari, daftar terbaru, Sembunyikan | A46 |
| V35 | Admin: Disembunyikan | Catatan admin, Tampilkan lagi | A46, A47 |
| V55 | Admin: detail laporan lapak | Nama lapak dan status, ringkasan laporan baru, total, dan alasan terbanyak; daftar pelapor dengan nama dan email, alasan, catatan, pernyataan, dan status; Abaikan per laporan; Abaikan semua, Sembunyikan lapak atau Tampilkan lagi; catatan admin | A44, A46, A47 |
| V9 | Laporkan lapak | Lima alasan tanpa pilihan awal, catatan opsional, centang pernyataan, Kirim laporan | A44 |
| V20 | Keadaan khusus | Memuat, ada lapak tapi belum buka, sinyal putus, Mulai buka belum terkirim, gagal cek link, batas cek habis | A8, A24, A33 |

## 8. Keamanan, privasi, dan batas pemakaian

Semua tabel memakai Row Level Security (RLS). Aplikasi di HP hanya memakai kunci publik (anon), jadi aturan akses di database adalah satu-satunya pagar.

| Tabel | Baca | Tulis |
| --- | --- | --- |
| profil | Pemilik baris sendiri dan admin; tidak dibaca publik | Pemilik baris sendiri; `is_admin` hanya lewat SQL oleh Aji |
| lapak, tempat, jadwal, foto\_lapak | Publik hanya lewat view `lapak_publik` (yang tayang); pemilik melihat semua miliknya; admin melihat semua lapak (V18, V55) | Hanya pemilik lapak |
| sesi\_buka | Publik lewat view; pemilik melihat semua miliknya | Hanya lewat fungsi database `mulai_buka`, `ubah_status`, `perpanjang`, `selesai`, `batalkan_selesai` yang memeriksa aturan durasi |
| pengikut | Pelanggan melihat miliknya; jumlah pengikut publik lewat view | Pelanggan sendiri; ditolak jika lapak milik sendiri |
| laporan | Hanya admin. Email pelapor dibaca lewat fungsi `admin_detail_laporan` | Pelanggan yang masuk, lewat fungsi `lapor_lapak` yang memeriksa centang pernyataan, batas 30 hari, dan menolak lapak sendiri |
| tindakan\_admin | Hanya admin | Hanya lewat fungsi `admin_tindak_lapak` |
| cek\_link | Pemilik sendiri | Hanya Edge Function |

**Privasi (UU PDP):**

- Persetujuan bertingkat sesuai A32. Teks persetujuan menyebut data yang disimpan: nama, email, foto profil.
- Lokasi pelanggan tidak pernah dikirim ke server (A21).
- Pemilik tidak pernah melihat identitas pelapor atau daftar nama pengikut; pemilik hanya melihat jumlah pengikut.
- Hapus akun selesai paling lambat 30 hari; laporan disimpan tanpa nama (A28).
- Isi Kebijakan Privasi dan S&K harus selesai sebelum rilis publik (bagian 11).

**Batas dan perlindungan:**

- Cek link Maps maks. 10 kali per pemilik per hari WIB, ditegakkan di server (A33).
- Laporan 1 per akun per lapak per 30 hari (A44).
- Deskripsi tanpa link; teks yang mengandung `http` atau `www.` ditolak (A37).
- Foto diperiksa jenisnya (JPEG, PNG, WebP) dan ukurannya di aturan Storage (A40).
- Service role key, secret Google, dan API key email hanya di variabel lingkungan; tidak pernah di kode, repo, atau tangkapan layar.

## 9. Rencana sprint

Ada tujuh sprint, masing-masing berakhir dengan sesuatu yang bisa dicoba di HP. Urutannya mengikuti risiko: login dan status pemilik dibangun dulu karena itu inti produk, sisi pelanggan setelahnya. Perkiraan 1 minggu per sprint untuk kerja paruh waktu dengan vibe coding; Aji boleh menggeser.

**Sprint 0: Fondasi**

- **S0.1** Repo Vite + React + TypeScript + Tailwind + shadcn/ui, token dari V0, huruf Plus Jakarta Sans.
- **S0.2** Hubungkan ke Cloudflare Workers (Workers Builds) dengan build pratinjau per PR di Worker staging; variabel lingkungan Supabase per Worker.
- **S0.3** Pastikan migrasi 003 dan 004 sudah jalan, lalu jalankan migrasi 005 (bagian 5) beserta RLS (bagian 8). Kode kecamatan sudah memakai kode resmi (migrasi 006, 7.285 kecamatan); tidak ada lagi kode sementara.
- **S0.4** Perbarui CLAUDE.md: istilah, aturan waktu WIB, aturan migrasi, rujukan ke PRD ini.
- **S0.5** Komponen dasar: tombol (utama, kedua, netral), chip status, kartu lapak, lembar bawah, pesan 5 detik.

* **S0.6** Salin folder `docs/` dari paket ekspor ke repo: `docs/PRD.md`, gambar tiap layar di `docs/desain/png/`, sumber desain tiap layar di `docs/desain/html/`, dan `docs/README.md` berisi aturan pakai dan daftar layar. Perbarui setiap kali PRD atau desain berubah.

**Sprint 1: Masuk dan akun**

- **S1.1** Masuk dengan Google dan link email; layanan email (SMTP) terpasang (V6, V24).
- **S1.2** Profil otomatis dibuat; Akun saya: ganti foto, nama, Keluar (V8, V50).
- **S1.3** Pengarah setelah masuk dan saat aplikasi dibuka (A26, A27), termasuk V52. *(selesai, diuji di HP)*
- **S1.4** Uji gabung identitas Google + email dengan alamat sama. *(selesai, diuji di HP dan di Supabase)*

**Sprint 2: Daftar lapak**

- **S2.1** V10 dan V46, lalu Daftar 1 dengan izin tampil umum dan unggah foto yang dikecilkan (A32, A40). *(selesai, diuji di HP)*
- **S2.2** Daftar 2: Pakai lokasiku sekarang, Edge Function cek link Maps dengan batas 10 per hari, pilih kabupaten dan kecamatan (A33, A34). *(selesai, diuji di HP; Edge Function cek link di PR #49)*
- **S2.3** Daftar 3: jadwal dengan beberapa sesi dan lewat tengah malam (A35). *(selesai, diuji di HP; menit kelipatan 5 dan dropdown 24 jam ada di PR #20)*
- **S2.4** Draf per langkah, Lanjutkan nanti, banner V47 (A31). Slug dan V25 Tayang (A36), V30 Pasang (A38). *(selesai, diuji di HP; PR #24. Sisa yang menyusul: link dan QR V25 bisa dibuka lagi oleh pemilik (A36, A49), /lapakku/profil (V16), dan kartu Lapakku (V50))*

**Sprint 3: Status harian pemilik**

- **S3.1** Fungsi database `mulai_buka`, `ubah_status`, `perpanjang`, `selesai`, `batalkan_selesai` dengan aturan durasi (bagian 5).
- **S3.2** Layar V3, V14, V4, V15, V29 dengan pesan Batalkan 5 detik (A2–A4).
- **S3.3** View status efektif, layar Berakhir V28, banner Lupa mulai buka (A5–A7).
- **S3.4** Bagikan V36 dan QR gerobak V26 (A49).

**Sprint 4: Sisi pelanggan**

- **S4.1** Beranda V1 dan V45: kelompok Lagi buka dan Biasanya buka, kartu lapak, inisial (A10–A15).
- **S4.2** Urutkan V39 dan Wilayah V21, izin lokasi dan V34 (A12, A17–A21).
- **S4.3** Detail lapak V2, V22, V23, V37, dan halaman `/:slug` (A1).
- **S4.4** Cari V5 dan halaman kosong V53, V54 (A22–A24).

**Sprint 5: Ikuti, lapor, kelola, admin**

- **S5.1** Ikuti dan Diikuti V7, pesan V33, detail lapak sendiri V49, Lapakku V48 (A16, A41–A43).
- **S5.2** Laporkan V9 dengan centang pernyataan (A44). Uji SQL: supabase/tests/s5_2_uji.sql.
- **S5.3** Kelola lapak: V16, V42, V43, V31, V44 (A39).
- **S5.4** Admin V18, detail laporan V55, V19, V35, layar Disembunyikan V17, email pemberitahuan (A45–A48).
- **S5.5** Tutup lapak permanen V51, Hapus akun V32, Lapak tidak tersedia V27 (A28, A29).

**Sprint 6: Rapikan dan pilot**

- **S6.1** Keadaan khusus V20: memuat, sinyal putus, Mulai buka tertunda (A8).
- **S6.2** Isi Kebijakan Privasi dan S&K (V38), judul dan gambar pratinjau link lapak untuk WhatsApp.
- **S6.3** Uji penuh di 2 HP (Android Chrome dan iPhone Safari), perbaikan bug.
- **S6.4** Pilot dengan 5–10 lapak di Sragen, catat masukan, putuskan rilis publik.

## 10. Definisi selesai dan daftar uji

Sebuah tugas baru dianggap selesai jika lolos definisi selesai umum dan uji otomatis sprintnya (tsc, build, skrip SQL, dan tata letak di PC). Uji HP dilakukan pada dua titik saja, bukan setiap tugas: setelah Sprint 3 selesai, dan di akhir MVP sebagai tes penuh. Uji HP berjalan di staging.noantree.id setelah PR digabung ke staging, lalu di noantree.id setelah merge ke main, karena pratinjau produksi dimatikan (docs/PROSES.md). Keputusan ini disetujui Aji pada 28 Oktober 2026.

**Definisi selesai (setiap tugas):**

- [ ] Tampilan, teks, dan warna sama dengan layar di kanvas; tidak ada istilah dari kolom "Jangan pakai".
- [ ] Rapi di lebar 360–430 px, tanpa geser ke samping; target sentuh minimal 44 px.
- [ ] Keadaan memuat, kosong, dan gagal sudah ditangani.
- [ ] Aturan A# yang disebut tugas sudah berjalan, dan pelanggaran aturan ditolak oleh database, bukan hanya disembunyikan di layar.
- [ ] Tidak ada kunci rahasia di kode; migrasi baru tersimpan di repo.

**Daftar uji per sprint:**

- **Sprint 0**
  - [ ] Halaman staging.noantree.id terbuka di HP, huruf dan warna sesuai V0.
  - [ ] Akun tamu tidak bisa menulis ke tabel mana pun (dicoba lewat konsol).
- **Sprint 1**
  - [ ] Masuk dengan Google lalu Keluar, berhasil di Android dan iPhone.
  - [ ] Masuk lewat email: link datang dalam 1 menit, tidak masuk Spam.
  - [x] Email yang sama lewat Google dan link email menghasilkan satu akun.
  - [x] Keluar, lalu buka aplikasi di HP yang pernah dipakai pemilik: muncul Masuk lagi ke lapakmu (V52).
- **Sprint 2**
  - [ ] Daftar sampai tayang dalam kurang dari 3 menit.
  - [ ] Berhenti di langkah 2, tutup aplikasi, buka lagi: banner Lanjutkan daftar muncul dan isian langkah 1 masih ada.
  - [ ] Cek link ke-11 dalam sehari ditolak; tempat tetap bisa disimpan tanpa titik.
  - [ ] Foto 20 MB dari kamera terunggah sebagai file maks. 3 MB.
  - [ ] Dua lapak bernama sama mendapat slug berbeda.
- **Sprint 3**
  - [ ] Mulai buka di dalam jadwal berakhir di akhir jadwal; di luar jadwal berakhir 4 jam kemudian.
  - [ ] Perpanjang ke-9 ditolak; total maks. 8 jam.
  - [ ] Selesai lalu Batalkan dalam 5 detik mengembalikan status Lagi buka.
  - [ ] Biarkan sesi lewat waktu: status publik Tutup, dan pemilik melihat V28 sekali.
  - [ ] Jadwal yang lewat tengah malam (misal 18.00–02.00) dihitung benar. Mulai buka 05.30 untuk jadwal 06.00–14.00 berakhir 14.00. Setelah Selesai di tengah jadwal, status publik Tutup, bukan Biasanya buka.
- **Sprint 4**
  - [ ] Lapak yang baru Mulai buka muncul di beranda HP lain dalam kurang dari 1 menit.
  - [ ] Izin lokasi ditolak: urutan jadi Terpopuler.
  - [ ] Filter Masaran hanya menampilkan lapak dengan tempat di Masaran.
  - [ ] Cari "bakso" menemukan lapak lewat nama dan deskripsi, termasuk yang tutup.
- **Sprint 5**
  - [ ] Tekan Ikuti sebagai tamu, masuk, lalu lapak langsung terikuti tanpa ketuk ulang. Pemilik tidak bisa mengikuti atau melaporkan lapaknya sendiri, juga lewat konsol.
  - [ ] Lapor tanpa centang pernyataan ditolak. Lapor lapak yang tidak tayang ditolak.
  - [ ] Laporan kedua dari akun yang sama untuk lapak yang sama ditolak dalam 30 hari, dan boleh lagi setelah 30 hari.
  - [ ] Admin: Abaikan satu laporan, Abaikan semua, Sembunyikan lapak, dan Tampilkan lagi berjalan sesuai A47; setiap tindakan tercatat di riwayat.
  - [ ] Hapus akun pelapor: laporannya tetap ada tanpa nama (A28).
  - [ ] Sembunyikan: lapak hilang dari beranda, cari, dan link; pemilik menerima email.
  - [ ] Tutup lapak permanen: akun tetap bisa masuk dan daftar Diikuti masih ada.
  - [ ] Akun non-admin tidak bisa membuka /admin.
- **Sprint 6**
  - [ ] Matikan data seluler: beranda menampilkan data terakhir, dan Mulai buka yang ditekan saat itu terkirim begitu sinyal kembali.
  - [ ] Pasang ke layar utama berhasil di Android; petunjuk iPhone benar.
  - [ ] Link lapak dibagikan ke WhatsApp menampilkan nama dan foto lapak.
  - [ ] 5 pemilik lapak pilot bisa Mulai buka dan Selesai tanpa dibantu.

## 11. Di luar MVP dan keputusan terbuka

Hal-hal di bawah sengaja tidak dibangun di MVP. AI tidak boleh mengerjakannya kecuali Aji memindahkannya ke sprint.

**Di luar MVP:**

- Notifikasi HP saat lapak yang diikuti mulai buka (A43), termasuk pengingat "Lupa mulai buka?" lewat notifikasi.
- Daftar "Diikuti yang lagi buka" di paling atas beranda.
- Tombol "Ternyata tutup" dari pelanggan.
- Satu usaha dengan banyak lapak (contoh waralaba di beberapa kabupaten).
- Peta lapak (menjelajah lapak di peta), pemesanan, dan pembayaran. Peta untuk memilih titik tempat masuk MVP lewat A33.
- Tombol hubungi admin lewat WhatsApp (A48).
- Statistik untuk pemilik selain jumlah pengikut.

**Keputusan yang sudah diambil sejak dokumen spesifikasi:**

| Keputusan | Isi |
| --- | --- |
| Akun | Satu email = satu akun dengan dua peran; tidak ada pilihan "daftar sebagai" |
| Masuk | Google dan link email untuk semua pengguna |
| Pintu pemilik | V10 Daftarkan lapakmu melayani daftar dan masuk pemilik |
| Urutan | Terdekat, Terpopuler, Abjad; Baru buka dan Segera tutup dihapus |
| Wilayah | Satu filter berjenjang, kecamatan pilih satu, tanpa angka per daerah |
| Foto lapak | Ukuran file tidak dibatasi; dikompres di HP dan disimpan maks. 3 MB per foto (A40) |
| Notifikasi | Tidak masuk MVP |
| WhatsApp admin | Disembunyikan dulu |
| Hapus akun | Isi daftar yang terhapus menyesuaikan peran, dicatat di A28 tanpa layar baru |

**Keputusan S2.4 (disetujui Aji, 28 Oktober 2026):**

Isinya sudah dipindah ke A30, A31, A36, A38, nama rute (bagian 4), dan tabel layar V8, V50, V25.

| Keputusan | Isi | Aturan | Status |
| --- | --- | --- | --- |
| Alur setelah Daftar 3 | "Simpan dan selesai" dan "Lewati, jadwal saya tidak tetap" di Daftar 3 membuat lapak tayang, lalu menampilkan V25 (Lapak sudah tayang). Alasannya: V13 adalah langkah terakhir dan boleh dilewati, jadi kedua tombol sama-sama mengakhiri pendaftaran | A30, A35, V13, V25 | Disetujui |
| Rute V25 | /daftar/tayang. Lapak belum tayang atau belum punya lapak: diarahkan ke /daftar | A36, V25 | Disetujui |
| Tayang dan slug | Slug dibuat dari nama lapak saat pertama tayang: huruf kecil, spasi jadi tanda hubung, karakter lain dibuang. Jika sudah dipakai, tambah angka (-2, -3). Slug tidak boleh sama dengan nama rute (daftar, cari, lapakku, akun, diikuti, admin, komponen); jika bentrok, tambah angka. Slug tidak berubah walau nama diganti. Tayang hanya bisa jika lapak masih draf, langkah_daftar sudah 3, dan ada minimal 1 tempat | A36, A39 | Disetujui |
| Link dan QR V25 | Link dan QR dari V25 harus bisa dibuka lagi oleh pemilik nanti. Belum dikerjakan di S2.4 | A36, A49 | Disetujui, menyusul |
| Lanjutkan nanti | Di Daftar 1, 2, dan 3, "Lanjutkan nanti" menyimpan isian yang sudah diisi, lalu membawa ke beranda dengan banner V47. Banner bisa ditutup (×). Setelah ditutup, pengingatnya ada di Akun saya. Status banner disimpan di localStorage | A31, V11, V12, V13, V47 | Disetujui |
| Kartu di Akun saya | Belum punya lapak sama sekali: kartu "Buka lapakmu di noantree" (V8) menuju /daftar (PR #22 dan #23). Punya lapak draf: kartu "Lanjutkan daftar lapakmu" menuju langkah yang belum selesai. Punya lapak tayang atau disembunyikan: kartu "Lapakku" (V50) menuju Profil lapak (V16, /lapakku/profil); tidak ada kartu yang mengarah ke halaman sementara | A26, A31, V8, V50 | Disetujui; kartu Lapakku dipasang di S5.3a |
| Ajakan pasang V30 | Muncul setelah tayang. "Nanti saja" menunda, dan ajakan muncul lagi paling sering sekali seminggu jika ditolak. Jika HP tidak mendukung pemasangan langsung, tampilkan petunjuk menu. Status disimpan di localStorage | A38, V30 | Disetujui |

**Keputusan terbuka:**

- [ ] Target angka ukuran keberhasilan (bagian 1), sebelum Sprint 6.
- [ ] Isi Kebijakan Privasi dan S&K, sebelum Sprint 6.
- [x] Domain: noantree.id (sudah diputuskan; situs.ts memakai noantree.id).
- [x] Layanan pengirim email: Resend, alamat pengirim noreply@noantree.id (dipasang di staging dan produksi, 3 November 2026).
- [ ] Alamat email admin untuk balasan banding (A48), sebelum Sprint 5.
- [x] Migrasi 003 sampai 029 sudah dijalankan di staging dan produksi (dicatat di docs/PROSES.md). Aturan Mulai buka kapan saja pada sesi jadwal sudah final (bagian 5).

**Ditunda (pekerjaan infrastruktur, bukan fitur):**

- CI GitHub Actions (sebelum ada tim).
- Data palsu (seed) untuk staging.
- Supabase CLI dan catatan migrasi otomatis (sudah dipakai untuk migrasi, tapi belum otomatis di setiap PR).
- Membersihkan branch lama dan menghapus branch otomatis setelah merge.
- Kunci Supabase model baru (publishable dan secret) di Worker, sebelum kunci legacy dihentikan (awal 2027).
