export const isNetworkError = (e: any) => /failed to fetch|networkerror|load failed|network request failed|fetch failed|internet connection/i.test(String(e?.message ?? e))
// Pesan ramah untuk pengguna; error jaringan diterjemahkan, error lain apa adanya.
export const friendly = (e: any, fallback = 'Terjadi kesalahan') =>
  isNetworkError(e) ? 'Tidak ada koneksi internet. Isian Anda aman di perangkat. Coba lagi saat sinyal kembali.' : (e?.message || fallback)
