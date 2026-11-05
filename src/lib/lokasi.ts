// Lokasi pelanggan untuk urutan Terdekat (A12, A21).
// Titik hanya dikembalikan ke pemanggil dan disimpan di state layar. Modul ini sengaja tidak
// mengimpor supabase dan tidak menulis ke penyimpanan HP; `npm run cek:a21` memeriksanya.

export type Titik = { lat: number; lng: number }

// Ditolak, diblokir, tidak didukung, atau waktu habis: semuanya dianggap tanpa lokasi (V34)
export function mintaLokasi(): Promise<Titik> {
  return new Promise((selesai, gagal) => {
    if (!('geolocation' in navigator)) return gagal(new Error('tidak didukung'))
    navigator.geolocation.getCurrentPosition(
      (p) => selesai({ lat: p.coords.latitude, lng: p.coords.longitude }),
      gagal,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    )
  })
}

// Status izin tanpa memunculkan pertanyaan browser. Null jika browser tidak bisa memberi tahu.
export async function statusIzinLokasi(): Promise<PermissionState | null> {
  try {
    const izin = await navigator.permissions.query({ name: 'geolocation' })
    return izin.state
  } catch {
    return null
  }
}

// Jarak garis lurus (haversine) dalam meter, cukup untuk mengurutkan
export function jarakMeter(a: Titik, b: Titik): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
