import { supabase } from './supabase'

// Foto lapak di bucket foto-lapak, folder <uid>/ milik pemilik (kebijakan Storage 011). Dipakai Daftar 1 (V11)
// dan Ubah profil (V42).

export const MAKS_FOTO_LAPAK = 4
// A40: foto profil lapak 512 px maks. 500 KB; foto lapak 1600 px maks. 3 MB
export const UKURAN_FOTO_PROFIL = { sisi: 512, batasByte: 500 * 1024 }
export const UKURAN_FOTO_LAPAK = { sisi: 1600, batasByte: 3 * 1024 * 1024 }

// Foto yang sudah tersimpan punya id; foto baru masih berupa blob hasil kompres yang belum diunggah.
export type FotoLapak = { kunci: string; id?: string; url: string; blob?: Blob }

export const kunciBaru = () => Math.random().toString(36).slice(2)

export async function unggahFotoLapak(uid: string, blob: Blob, awalan: string): Promise<string> {
  const path = `${uid}/${awalan}${Date.now()}-${kunciBaru()}.jpg`
  const { error } = await supabase.storage.from('foto-lapak').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error('Foto belum terunggah. Coba lagi.')
  return supabase.storage.from('foto-lapak').getPublicUrl(path).data.publicUrl
}

// Jalur file di bucket dari alamat publiknya; hanya file di folder milik sendiri
function jalurFoto(uid: string, url: string): string | null {
  const tanda = '/storage/v1/object/public/foto-lapak/'
  const i = url.indexOf(tanda)
  if (i < 0) return null
  const jalur = decodeURIComponent(url.slice(i + tanda.length).split('?')[0])
  return jalur.startsWith(`${uid}/`) ? jalur : null
}

// Menghapus file foto yang sudah tidak dipakai. Gagal menghapus tidak menggagalkan simpan:
// file yang tersisa tidak tertaut ke data apa pun.
export async function hapusFileFotoLapak(uid: string, url: (string | null)[]) {
  const jalur = url.map((u) => (u ? jalurFoto(uid, u) : null)).filter((j): j is string => Boolean(j))
  if (jalur.length === 0) return
  try {
    await supabase.storage.from('foto-lapak').remove(jalur)
  } catch {
    // Lanjut; file yatim tidak mengganggu tampilan
  }
}
