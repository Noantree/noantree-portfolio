import { usePesan } from './Pesan'
import { linkDaftar, PESAN_AJAK, salinTeks } from '../lib/bagikan'

// "Ajak lapak langgananmu" (A50, V20, V53, V54): menu bagikan HP dengan pesan dan link daftar.
// Tanpa menu bagikan, pesan dan link disalin.
export function TombolAjak({ className }: { className: string }) {
  const { tampilkan } = usePesan()
  const ajak = async () => {
    const url = linkDaftar()
    if (navigator.share) {
      try {
        await navigator.share({ text: PESAN_AJAK, url })
      } catch {
        // Menu bagikan ditutup tanpa memilih: tidak perlu pesan
      }
      return
    }
    if (await salinTeks(`${PESAN_AJAK} ${url}`)) tampilkan({ teks: 'Pesan ajakan disalin.', jenis: 'berhasil' })
    else tampilkan({ teks: 'Pesan belum bisa disalin.', jenis: 'merah' })
  }
  return (
    <button type="button" onClick={ajak} className={className}>
      Ajak lapak langgananmu
    </button>
  )
}
