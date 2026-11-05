import { supabase } from './supabase'
import { simpanTandaPemilik } from './pengarah'
import { hapusAntreanMulai, hapusDataAkun, hapusGrupTerakhir } from './dataTerakhir'

// Hapus akun (A28; V32) dan Tutup lapak permanen (A29; V51). Logika data ada di fungsi hapus_akun_saya dan
// tutup_lapak_saya (025). Foto di Storage dihapus dari sini lewat API Storage, karena kunci service role tidak
// boleh ada di aplikasi.

export type IsiHapusAkun = {
  lapak: { id: string; nama: string; slug: string | null; jumlahTempat: number | null; jumlahPengikut: number | null } | null
}

// Isi daftar "yang ikut terhapus" di V32 dan "yang dihapus" di V51. Angka yang gagal dibaca dikosongkan;
// daftarnya tetap tampil.
export async function muatIsiHapusAkun(uid: string): Promise<IsiHapusAkun> {
  const { data: lapak, error } = await supabase.from('lapak').select('id, nama, slug').eq('pemilik_id', uid).limit(1).maybeSingle()
  if (error) throw error
  if (!lapak) return { lapak: null }
  const { id, nama, slug } = lapak as { id: string; nama: string; slug: string | null }
  const [tempat, publik] = await Promise.all([
    supabase.from('tempat').select('id', { count: 'exact', head: true }).eq('lapak_id', id),
    // Jumlah pengikut hanya ada untuk lapak yang tayang; lapak draf atau disembunyikan tidak ada di lapak_publik
    supabase.from('lapak_publik').select('jumlah_pengikut').eq('id', id).maybeSingle(),
  ])
  return {
    lapak: {
      id,
      nama,
      slug,
      jumlahTempat: tempat.error ? null : (tempat.count ?? null),
      jumlahPengikut: (publik.data as { jumlah_pengikut: number } | null)?.jumlah_pengikut ?? null,
    },
  }
}

// Semua file di folder <uid>/ milik sendiri (kebijakan hapus pemilik: foto-lapak 011, foto-profil 025).
// Gagal menghapus tidak menghentikan hapus akun: file yang tersisa tidak lagi tertaut ke data apa pun.
async function hapusFolderFoto(bucket: string, uid: string) {
  try {
    const { data } = await supabase.storage.from(bucket).list(uid, { limit: 1000 })
    const jalur = (data ?? []).map((f) => `${uid}/${f.name}`)
    if (jalur.length > 0) await supabase.storage.from(bucket).remove(jalur)
  } catch {
    // Lanjut ke penghapusan akun
  }
}

// Tutup lapak permanen (A29; V51). Logika data ada di tutup_lapak_saya (025): sesi diakhiri, slug dicadangkan,
// lapak dan semua datanya dihapus; akun dan daftar Diikuti tetap. Foto lapak di folder sendiri dihapus lebih dulu,
// sama dengan alur Hapus akun; konfirmasi yang salah tidak menyentuh foto. Galat dari fungsi dilempar apa adanya.
export async function tutupLapakSaya(uid: string, lapakId: string, konfirmasi: string) {
  if (konfirmasi === 'TUTUP') await hapusFolderFoto('foto-lapak', uid)
  const { error } = await supabase.rpc('tutup_lapak_saya', { p_lapak: lapakId, p_konfirmasi: konfirmasi })
  if (error) throw error
  // Bukan pemilik lagi: tanda pemilik di HP dihapus supaya V52 "Masuk lagi ke lapakmu" tidak muncul,
  // begitu pula data terakhir Lapakku dan antrean Mulai buka (V20)
  simpanTandaPemilik(null)
  hapusGrupTerakhir('lapakku')
  hapusAntreanMulai()
}

// Foto dihapus dulu, karena setelah akun terhapus izin ke folder itu ikut hilang.
// Galat dari fungsi database dilempar apa adanya.
// Konfirmasi yang salah tidak menyentuh foto; server yang menolaknya.
export async function hapusAkunSaya(uid: string, konfirmasi: string) {
  if (konfirmasi === 'HAPUS') {
    await hapusFolderFoto('foto-lapak', uid)
    await hapusFolderFoto('foto-profil', uid)
  }
  const { error } = await supabase.rpc('hapus_akun_saya', { p_konfirmasi: konfirmasi })
  if (error) throw error
  // Sesi di server sudah ikut terhapus; cukup bersihkan sesi di HP. Tanda pemilik dihapus supaya V52 tidak muncul.
  simpanTandaPemilik(null)
  hapusDataAkun()
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
}
