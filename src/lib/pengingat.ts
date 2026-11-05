import { baca, tulis } from './pengarah'

// Status pengingat yang disimpan di HP saja (localStorage, dibungkus try/catch di baca/tulis), tanpa kolom database.

// Banner V47 "Daftar lapakmu belum selesai" (A31): per akun, supaya akun lain di HP yang sama tetap melihatnya.
const kunciBanner = (uid: string) => `noantree.banner-daftar-ditutup.${uid}`
export const bannerDaftarDitutup = (uid: string) => baca<boolean>(kunciBanner(uid)) === true
export const tutupBannerDaftar = (uid: string) => tulis(kunciBanner(uid), true)
// Lanjutkan nanti membawa ke beranda dengan banner, jadi banner yang pernah ditutup dimunculkan lagi
export const munculkanBannerDaftar = (uid: string) => tulis(kunciBanner(uid), null)

// Ajakan pasang V30 (A38): muncul setelah tayang, lalu maks. sekali seminggu jika ditolak.
type StatusPasang = { ditolakPada?: number; terpasang?: boolean }
const KUNCI_PASANG = 'noantree.ajakan-pasang'
const SEMINGGU = 7 * 24 * 60 * 60 * 1000

export function bolehAjakPasang(): boolean {
  const s = baca<StatusPasang>(KUNCI_PASANG)
  if (s?.terpasang) return false
  return !s?.ditolakPada || Date.now() - s.ditolakPada >= SEMINGGU
}
export const tolakAjakanPasang = () => tulis(KUNCI_PASANG, { ditolakPada: Date.now() })
export const tandaiTerpasang = () => tulis(KUNCI_PASANG, { terpasang: true })
