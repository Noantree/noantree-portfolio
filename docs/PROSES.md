# Proses kerja noantree

Dokumen ini menjelaskan tiga lingkungan, alur kerja dari fitur sampai produksi, dan aturan migrasi database. Dibaca Aji dan Claude Code di setiap sesi.

## 1. Tiga lingkungan

| Lingkungan | Alamat | Branch | Worker Cloudflare | Database Supabase | Isi data |
| --- | --- | --- | --- | --- | --- |
| Laptop | localhost:5173 | branch kerja | (dev server) | staging (`.env.local` diarahkan ke staging) | Data uji |
| Staging | staging.noantree.id | `staging` | `noantree-staging` | proyek `REF-PROYEK-STAGING` | Data uji, tidak diindeks mesin pencari |
| Produksi | noantree.id | `main` | `noantree` | proyek `REF-PROYEK-PRODUKSI` | Data pelanggan asli |

Aturan:
- Laptop memakai database staging, jadi tidak pernah menyentuh data pelanggan.
- Data produksi tidak pernah disalin ke staging.
- Build pratinjau (link sementara per branch) hanya ada di Worker staging. Worker produksi tidak membangun pratinjau.

## 2. Alur kerja

1. Buat branch fitur dari `staging` terbaru.
2. Kerjakan, lalu buka Pull Request (PR) ke `staging`. Jangan langsung ke `main`.
3. Jika ada migrasi baru, jalankan di staging dulu: `npm run db -- staging push`.
4. Merge PR ke `staging`.
5. Uji di staging.noantree.id (di HP dan di PC). Uji SQL di `supabase/tests/` dijalankan Aji di staging.
6. Jika semua lulus, buka PR `staging` ke `main`.
7. Tepat sebelum merge, jalankan migrasi yang sama di produksi: `npm run db -- produksi push`, lalu ketik `PRODUKSI`.
8. Merge PR ke `main`. Worker produksi membangun sendiri. Uji singkat di noantree.id.
9. Jika Edge Function `cek-link-maps` ikut berubah: pastikan secret `ALLOWED_ORIGINS` di dashboard Supabase produksi memuat `https://noantree.id`. Lalu, dari folder yang sudah di `main`, jalankan `npm run db -- produksi fungsi` dan ketik `PRODUKSI`. Uji cek link Maps di noantree.id. Tanpa langkah ini, cek link di produksi bisa ditolak tanpa error di kode.

## 3. Aturan migrasi

- Setiap berkas migrasi dijalankan tepat sekali per database. Alat `npm run db` mencatat apa yang sudah jalan dan menolak mengulang.
- Migrasi baru diberi nomor berikutnya (030, 031, dan seterusnya).
- Berkas migrasi yang sudah pernah jalan tidak diubah. Perbaikan dibuat sebagai migrasi baru.
- Claude Code tidak pernah menjalankan SQL ke database mana pun. Claude Code hanya menulis berkasnya.
- Produksi (`produksi push`) hanya setelah migrasi itu lulus di staging.
- Setiap tabel memakai RLS. Tabel baru tanpa kebijakan RLS tidak boleh dirilis.

## 4. Catatan migrasi (tabel hidup)

Setiap migrasi baru ditambahkan barisnya, dan kolomnya diisi saat dijalankan. Perintah `npm run db -- <lingkungan> cek` membandingkan daftar ini dengan database.

| No | Berkas | Staging | Produksi |
| --- | --- | --- | --- |
| 0 | Skrip awal staging (`supabase/staging/awal-sebelum-003.sql`) | sudah | tidak dijalankan |
| 1 | 003_wilayah_ringkas.sql | sudah | sudah |
| 2 | 004_hapus_tabel_lama.sql | sudah | sudah |
| 3 | 005_model_data.sql | sudah | sudah |
| 4 | 006_wilayah_lengkap.sql | sudah | sudah |
| 5 | 007_storage_foto_profil.sql | sudah | sudah |
| 6 | 008_hak_tabel_profil.sql | sudah | sudah |
| 7 | 009_profil_tambah_sendiri.sql | sudah | sudah |
| 8 | 010_hak_baca_lapak.sql | sudah | sudah |
| 9 | 011_daftar_1.sql | sudah | sudah |
| 10 | 012_daftar_2.sql | sudah | sudah |
| 11 | 013_daftar_3.sql | sudah | sudah |
| 12 | 014_daftar_3_jam.sql | sudah | sudah |
| 13 | 015_tayang.sql | sudah | sudah |
| 14 | 016_status_harian.sql | sudah | sudah |
| 15 | 017_status_efektif.sql | sudah | sudah |
| 16 | 018_lapak_publik_beranda.sql | sudah | sudah |
| 17 | 019_detail_lapak_publik.sql | sudah | sudah |
| 18 | 020_ikuti.sql | sudah | sudah |
| 19 | 021_laporkan_admin.sql | sudah | sudah |
| 20 | 022_admin_dilaporkan.sql | sudah | sudah |
| 21 | 023_admin_semua_disembunyikan.sql | sudah | sudah |
| 22 | 024_info_disembunyikan_pemilik.sql | sudah | sudah |
| 23 | 025_tutup_lapak_hapus_akun.sql | sudah | sudah |
| 24 | 026_ubah_profil_lapak.sql | sudah | sudah |
| 25 | 027_kelola_tempat.sql | sudah | sudah |
| 26 | 028_ubah_jadwal.sql | sudah | sudah |
| 27 | 029_cek_link_maps.sql | sudah | sudah |
| 28 | 030_daftar_1_pindah_mingguan.sql | sudah | belum (isi setelah `produksi push`) |

Catatan: kolom produksi 003 sampai 029 diisi lewat `npm run db -- produksi tandai-lama` pada 3 November 2026. Perintah itu hanya mencatat, tidak menjalankan SQL.

## 5. Yang hanya bisa dilakukan Aji

- Mengatur dashboard Supabase, Cloudflare, Google Cloud, dan Resend (termasuk membuat kunci).
- Menjalankan `npm run db` dan SQL Editor.
- Menyimpan kunci, password, dan secret di pengelola password. Jangan pernah menempelkannya ke chat.
