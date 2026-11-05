import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { bacaLingkungan, bacaSitusUrl, type Lingkungan } from './src/lib/situs.ts'

// Nilai per lingkungan dari variabel build (Cloudflare: Settings > Build > Variables, per Worker; laptop: .env.local).
// Produksi tidak perlu variabel baru: VITE_SITUS_URL kosong = https://noantree.id, VITE_LINGKUNGAN kosong = produksi.
type Nilai = { supabaseUrl?: string; kunciAnon?: string; situsUrl: string; lingkungan: Lingkungan }

// Alamat situs untuk og:url dan og:image di index.html, judul [STAGING] di staging, dan supabase-publik.json di dist
// untuk Worker pratinjau lapak (worker/index.ts). Isi berkas itu hanya URL Supabase, kunci anon, dan alamat situs:
// nilai publik yang juga ada di JavaScript aplikasi; tidak ada kunci rahasia.
function situs(n: Nilai): Plugin {
  return {
    name: 'noantree-situs',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const isi = html.replaceAll('%SITUS_URL%', n.situsUrl)
        return n.lingkungan === 'staging' ? isi.replace(/<title>([^<]*)<\/title>/, '<title>[STAGING] $1</title>') : isi
      },
    },
    generateBundle() {
      if (!n.supabaseUrl || !n.kunciAnon) return
      this.emitFile({
        type: 'asset',
        fileName: 'supabase-publik.json',
        source: JSON.stringify({ url: n.supabaseUrl, kunciAnon: n.kunciAnon, situsUrl: n.situsUrl }),
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // loadEnv membaca .env.local dan variabel lingkungan proses (variabel build Cloudflare) berawalan VITE_
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const n: Nilai = {
    supabaseUrl: env.VITE_SUPABASE_URL,
    kunciAnon: env.VITE_SUPABASE_ANON_KEY,
    // Melempar galat (build gagal) jika bentuknya salah
    situsUrl: bacaSitusUrl(env.VITE_SITUS_URL),
    lingkungan: bacaLingkungan(env.VITE_LINGKUNGAN),
  }

  // Tanpa dua nilai ini aplikasi hasil build hanya menampilkan layar kosong (src/lib/supabase.ts). Build dihentikan
  // supaya Worker yang lupa diisi variabelnya tidak ter-deploy diam-diam. npm run dev cukup memberi peringatan.
  if (!n.supabaseUrl || !n.kunciAnon) {
    const pesan =
      'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus diisi. Di Cloudflare: Worker > Settings > Build > Variables; di laptop: .env.local.'
    if (command === 'build') throw new Error(pesan)
    console.warn(pesan)
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      situs(n),
      VitePWA({
        registerType: 'autoUpdate',
        // Sinyal putus (V20, A8): kerangka aplikasi disimpan supaya tetap terbuka tanpa sinyal, dan foto lapak publik
        // disimpan sebentar. Data dari Supabase (REST, Auth, Edge Function) sengaja tidak disimpan service worker:
        // data terakhir disimpan aplikasi sendiri (src/lib/dataTerakhir.ts) beserta jamnya, tanpa lokasi pelanggan (A21).
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          // Gambar pratinjau link hanya dibaca WhatsApp dan media sosial, tidak perlu disimpan di HP
          globIgnores: ['og-noantree.png'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/foto-lapak/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'foto-lapak',
                expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          // Di staging nama aplikasi berbeda, supaya ikon di layar utama HP tidak tertukar dengan produksi
          name: n.lingkungan === 'staging' ? 'noantree staging' : 'noantree',
          short_name: n.lingkungan === 'staging' ? 'staging' : 'noantree',
          description: 'Lihat lapak yang sedang buka di Sragen',
          lang: 'id',
          theme_color: '#1F5FE6',
          background_color: '#FFFFFF',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
  }
})
