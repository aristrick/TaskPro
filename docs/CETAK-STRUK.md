# Cetak struk dengan printer portable

Setelah check-out yang ada penjualannya, muncul pratinjau struk dengan dua pilihan: **Cetak** atau **Tidak cetak** (dilewati).
Struk terakhir juga bisa dicetak ulang dari **Profile > Cetak ulang struk terakhir**. Pengaturan ada di **Profile > Printer dan struk**
dan tersimpan di perangkat itu saja.

## Pilih cara mencetak (tidak ada satu cara yang cocok untuk semua perangkat)
| Perangkat | Cara yang disarankan | Catatan |
|---|---|---|
| **Android** + printer Bluetooth klasik (kebanyakan printer portable murah) | **RawBT** | Pasang aplikasi RawBT dari Play Store, pasangkan printer di RawBT. Versi gratis menambahkan satu baris keterangan pada hasil cetak. |
| **Android** + printer Bluetooth LE | **Bluetooth langsung** | Browser Chrome/Edge/Samsung Internet. Tekan *Pasangkan printer* dan pilih dari daftar. |
| **iPhone / iPad** | **Dialog cetak sistem** | Safari di iPhone tidak mendukung Bluetooth langsung. Perlu printer AirPrint. Alternatif: browser Bluefy untuk printer Bluetooth LE. |
| **Laptop** | Bluetooth langsung atau dialog cetak sistem | Printer yang terpasang di sistem bisa dipakai lewat dialog cetak. |

Bagaimana mengetahui printer Anda Bluetooth klasik atau LE? Jika *Bluetooth langsung* gagal dengan pesan "tidak punya jalur tulis", printer itu
kemungkinan Bluetooth klasik: gunakan RawBT. Selalu pakai **Tes cetak** setelah memilih cara.

## Kertas
Pilih 58 mm (32 kolom) atau 80 mm (48 kolom). Teks dicetak sebagai ASCII (aksen dihapus) karena printer thermal murah tidak mendukung huruf lain.

## Catatan
- Struk hanya dibuat di perangkat; tidak ada data struk yang disimpan di server.
- Pelanggan menerima struk berisi nama outlet, waktu, daftar produk, jumlah, harga, dan total. Nomor struk adalah 8 karakter pertama ID kunjungan.
- Jika dialog cetak muncul tetapi tidak mencetak, buka *Pengaturan printer* dan coba cara lain.
