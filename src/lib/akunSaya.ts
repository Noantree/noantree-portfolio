import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useSesi } from './sesi'
import { muatLapakSaya } from './pengarah'
import { jumlahDiikuti } from './ikuti'

// Data akun yang sedang masuk untuk header pelanggan (V48, V7), label "Lapakmu" (A16), dan V49 (A42).
// lapak hanya terisi untuk pemilik (tayang atau disembunyikan); draf belum dihitung punya lapak, sama dengan Pengarah.
export type AkunSaya = {
  id: string
  nama: string | null
  fotoUrl: string | null
  lapak: { id: string; slug: string | null; status: string | null } | null
  jumlahDiikuti: number | null
}

// null = tamu atau belum selesai dimuat. Bagian yang gagal dibaca dikosongkan, tidak menggagalkan layar.
export function useAkunSaya(): AkunSaya | null {
  const { sesi } = useSesi()
  const uid = sesi?.user.id ?? null
  const email = sesi?.user.email ?? ''
  // Foto yang diunggah didahulukan; kalau belum ada, pakai foto dari akun Google (sama seperti Akun saya)
  const fotoGoogle = (sesi?.user.user_metadata?.avatar_url as string | undefined) ?? null
  const [akun, setAkun] = useState<AkunSaya | null>(null)

  useEffect(() => {
    if (!uid) return
    let batal = false
    ;(async () => {
      const [profil, lapak, jumlah] = await Promise.all([
        supabase
          .from('profil')
          .select('nama_tampilan, foto_url')
          .eq('id', uid)
          .maybeSingle()
          .then(({ data }) => data as { nama_tampilan: string | null; foto_url: string | null } | null),
        muatLapakSaya(uid).catch(() => null),
        jumlahDiikuti().catch(() => null),
      ])
      let milik: AkunSaya['lapak'] = null
      if (lapak && lapak.status_tayang !== 'draf') {
        // Status publik hanya dari lapak_publik; lapak disembunyikan tidak ada di sana (status kosong)
        const { data } = await supabase.from('lapak_publik').select('status').eq('id', lapak.id).maybeSingle()
        milik = { id: lapak.id, slug: lapak.slug, status: (data as { status: string } | null)?.status ?? null }
      }
      if (batal) return
      setAkun({
        id: uid,
        nama: profil?.nama_tampilan ?? (email.split('@')[0] || null),
        fotoUrl: profil?.foto_url ?? fotoGoogle,
        lapak: milik,
        jumlahDiikuti: jumlah,
      })
    })()
    return () => {
      batal = true
    }
  }, [uid, email, fotoGoogle])

  // Data akun lain (sebelum keluar atau berganti akun) tidak pernah ditampilkan
  return uid && akun?.id === uid ? akun : null
}
