import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { simpanTujuan, type Tujuan } from './pengarah'
import { hapusDataAkun } from './dataTerakhir'

type Konteks = {
  sesi: Session | null
  memuat: boolean
  masukGoogle: (tujuan?: Tujuan) => Promise<void>
  gantiAkun: () => Promise<void>
  kirimLinkEmail: (email: string, tujuan?: Tujuan) => Promise<boolean>
  keluar: () => Promise<void>
}

const KonteksSesi = createContext<Konteks | null>(null)

// Menyimpan status masuk di seluruh aplikasi. Kembali dari Google ditangani Supabase otomatis.
export function PenyediaSesi({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<Session | null>(null)
  const [memuat, setMemuat] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesi(data.session)
      setMemuat(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSesi(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const masukGoogle = async (tujuan: Tujuan = { asal: 'umum' }) => {
    simpanTujuan(tujuan)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
  }

  // Ganti akun: keluar dulu, lalu Google diminta memilih akun. Tanpa prompt=select_account, Google langsung
  // memakai akun yang terakhir dipakai di browser ini.
  const gantiAkun = async () => {
    await supabase.auth.signOut()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/', queryParams: { prompt: 'select_account' } },
    })
  }

  // Link masuk lewat email (A25). Masa berlaku 1 jam dan jeda kirim ulang 60 detik diatur di Supabase Auth.
  const kirimLinkEmail = async (email: string, tujuan: Tujuan = { asal: 'umum' }) => {
    simpanTujuan(tujuan)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/' },
    })
    return !error
  }

  // Keluar juga menghapus data milik akun dari HP: data terakhir Diikuti dan Lapakku, dan antrean Mulai buka (V20)
  const keluar = async () => {
    hapusDataAkun()
    await supabase.auth.signOut()
  }

  return (
    <KonteksSesi.Provider value={{ sesi, memuat, masukGoogle, gantiAkun, kirimLinkEmail, keluar }}>{children}</KonteksSesi.Provider>
  )
}

export function useSesi() {
  const k = useContext(KonteksSesi)
  if (!k) throw new Error('useSesi harus dipakai di dalam PenyediaSesi')
  return k
}
