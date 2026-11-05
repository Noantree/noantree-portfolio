// Pemasangan ke layar utama (A38). Chrome Android mengirim beforeinstallprompt sekali di awal,
// jadi ditangkap saat aplikasi dimuat dan dipakai nanti oleh ajakan V30.

type PermintaanPasang = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let permintaan: PermintaanPasang | null = null

export function tangkapPermintaanPasang() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    permintaan = e as PermintaanPasang
  })
  window.addEventListener('appinstalled', () => {
    permintaan = null
  })
}

export const bisaPasangLangsung = () => permintaan !== null

// Sudah dibuka sebagai aplikasi terpasang: ajakan tidak perlu muncul
export const sudahTerpasang = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export async function pasangSekarang(): Promise<boolean> {
  if (!permintaan) return false
  await permintaan.prompt()
  const { outcome } = await permintaan.userChoice
  permintaan = null
  return outcome === 'accepted'
}
