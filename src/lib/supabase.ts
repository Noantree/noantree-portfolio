import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const kunciAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !kunciAnon) {
  throw new Error('VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus diisi di variabel lingkungan.')
}

// Hanya kunci anon yang boleh masuk ke aplikasi. Service role key tidak pernah di sini (CLAUDE.md).
export const supabase = createClient(url, kunciAnon)
