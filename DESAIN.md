# Panduan Desain TaskPro
TaskPro adalah alat kerja internal (kunjungan dan penjualan), bukan toko online. Karena itu hukum psikologi yang bersifat
membujuk (Reciprocity, IKEA/Endowment, Anchoring harga) tidak dipakai secara harfiah. Yang dipakai hanya yang membantu kerja lapangan.

## Hukum UX
| Hukum | Penerapan |
|---|---|
| Smart Defaults | Form outlet baru terisi otomatis: lokasi GPS, alamat dari titik, rayon aktif, kategori General Trade, account Retail. Pengguna tinggal memeriksa. "Isi seperti kunjungan terakhir" pada input penjualan. Rentang tanggal Report default awal bulan sampai hari ini. |
| Goal Gradient | Bar progres "X dari Y outlet sudah dikunjungi hari ini" memakai data nyata. Progres buatan (mulai 20%) sengaja tidak dipakai karena akan menyesatkan angka kerja. |
| Loss Aversion | Layar penjualan mengingatkan: "Penjualan baru tersimpan saat Check-out... belum terhitung". |
| Contrast Effect | Rekap membandingkan penjualan hari itu dengan rata-rata harian (▲/▼ persen). |
| Quick Select | Tombol jumlah cepat 1, 2, 5, 10 per produk. |

## Aturan UI
Satu keluarga font (system-ui) dengan hierarki lewat ukuran, bobot, dan line-height 1.5. Palet navy desaturasi dengan hijau/merah hanya untuk status.
Label kapital kecil ber-letter-spacing dan badge ringkas (FOKUS, ✓ SUDAH). Grid 8/16/24 px. Divider 1px abu muda. Ikon di header memakai
lingkaran latar agar terbaca. Tanpa kata redundan ("Harga:" dihapus, cukup "Rp"). Kuantitas terpisah dari judul produk.
CTA gabungan: tombol "Check-out · Rp total" melayang di bawah (sticky bottom bar). Layar penjualan berupa kartu bergulir
berujung tumpul di atas hero berwarna navy.
