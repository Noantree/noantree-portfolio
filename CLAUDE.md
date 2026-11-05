# CLAUDE.md: aturan kerja untuk noantree

Noantree adalah PWA untuk pedagang keliling di Sragen. Pelanggan melihat lapak yang sedang buka, di mana, dan sampai jam berapa, tanpa instal aplikasi. Pemilik lapak menandai status dengan satu tombol.

## Sumber kebenaran (urutan prioritas)

1. `docs/PRD.md`: aturan bisnis (A1 sampai A51), model data, sprint, dan daftar uji. Ikuti aturan nomor A yang disebut dalam tugas.
2. `docs/desain/png/` dan `docs/desain/html/`: tampilan setiap layar (V0 sampai V55). Untuk nilai persis (warna, jarak, teks), pakai file HTML-nya.
3. `docs/README.md`: daftar layar dan cara memakai paket ini.
4. `docs/PROSES.md`: tiga lingkungan, alur kerja, dan aturan migrasi.
5. File ini.

Kalau ada pertentangan, PRD yang menang. Kalau PRD dan desain berbeda, tanyakan dulu sebelum mengubah apa pun.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, PWA (vite-plugin-pwa).
- Backend: Supabase (Postgres, Auth dengan Google dan magic link, RLS, Storage, Edge Function).
- Hosting: Cloudflare Workers dengan static assets (`wrangler.jsonc`, folder `dist`), terhubung ke repo ini lewat Workers Builds. Dua Worker: `noantree` dari branch `main` (produksi) dan `noantree-staging` dari branch `staging`. Build pratinjau hanya di Worker staging; produksi tidak membangun pratinjau.
- Font: Plus Jakarta Sans.
- Palet: biru utama #1F5FE6, hijau buka #16A86A, oranye habis #F08A24, abu tutup #8A93A1, merah #B42318. Nilai lengkap ada di PRD bagian 4.

## Istilah

Pakai istilah dari PRD bagian 3. Jangan membuat sinonim baru. Di layar, status ditulis: **Lagi buka**, **Habis**, **Biasanya buka**, **Tutup**.

## Aturan wajib

- **Zona waktu**: semua perhitungan jam memakai WIB (Asia/Jakarta). Jangan pakai waktu server atau UTC untuk logika bisnis.
- **Database hanya lewat migrasi.** Setiap perubahan tabel, view, fungsi, atau RLS ditulis sebagai file bernomor di `supabase/migrations/` (003, 004, 005, dan seterusnya). Jangan mengubah tabel langsung dari dashboard Supabase.
- **Sesi buka hanya lewat fungsi.** Tabel `sesi_buka` tidak boleh ditulis langsung dari aplikasi. Gunakan fungsi `mulai_buka`, `ubah_status`, `perpanjang`, `selesai`, dan `batalkan_selesai`.
- **Status publik hanya lewat view `lapak_publik`.** Jangan membaca `sesi_buka` atau `lapak` langsung untuk tampilan publik.
- **Kunci rahasia tidak boleh masuk kode.** Service role key, secret Google, dan API key email hanya di variabel lingkungan. Aplikasi hanya memakai kunci anon.
- **Setiap tabel memakai RLS.** Tabel baru tanpa kebijakan RLS tidak boleh dirilis.
- **Foto**: pilih tanpa batas ukuran, kompres di HP ke sisi terpanjang 1600 px (lapak) atau 512 px (profil), lalu simpan maks. 3 MB untuk lapak dan 500 KB untuk profil (A40).
- **Deskripsi lapak** tidak boleh berisi link (`http` atau `www.`) (A37).
- **Batas**: maks. 10 tempat per lapak, maks. 4 foto per lapak, 10 cek link Maps per pemilik per hari WIB, 1 laporan per pelanggan per lapak per hari WIB.
- **Lokasi pelanggan** tidak pernah dikirim ke server (A21).
- **Kerja selalu dari branch staging dan PR ke staging, kecuali diminta lain.**
- **Migrasi baru dijalankan di staging dulu; Claude Code tidak pernah menjalankan SQL ke database mana pun, hanya menulis berkasnya.**
- **Uji SQL dijalankan Aji di staging.**

## Cara bekerja

- Kerjakan satu sprint dan satu tugas per waktu, sesuai urutan di PRD bagian 9.
- Sebelum menandai tugas selesai, jalankan daftar uji yang relevan di PRD bagian 10.
- Setiap tugas yang menyentuh aturan bisnis menyebut nomor A-nya dalam pesan commit, misalnya `feat: mulai buka dengan toleransi jadwal (A30)`.
- Jangan menambah fitur di luar MVP. Daftar yang ditunda ada di PRD bagian 11.
- Kalau desain dan PRD tidak sama, atau ada yang tidak jelas, berhenti dan tanyakan. Jangan menebak.

## Yang belum final

- Isi Kebijakan Privasi dan S&K (V38) belum ditulis.
- Alamat email admin banding belum diputuskan.
