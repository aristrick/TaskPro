# Logo TaskPro dan animasi loading

## Sumber dan berkas

Logo berasal dari berkas resmi `TaskPro_Logo.png` (huruf "Task" slate, "Pro" teal, dan ikon gir-centang sebagai huruf "o"). Berkas aslinya berlatar putih penuh, jadi tintanya dipisahkan dari latar (bukan sekadar menghapus warna putih) lalu dilacak menjadi vektor.

| Berkas | Isi |
|---|---|
| `lib/logo.ts` | Data vektor: huruf, gir, dan centang sebagai bagian terpisah. Hasil pelacakan, jangan diedit tangan |
| `components/Logo.tsx` | `Logo` (tulisan lengkap) dan `LogoMark` (hanya gir dan centang), dengan opsi `animated` |
| `public/logo.svg`, `public/logo-putih.svg` | SVG untuk latar terang dan latar gelap ("Task" putih) |
| `public/logo.png` | PNG transparan 1600 px, untuk dokumen atau tempat lain di luar aplikasi |
| `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon-maskable-512.png` | Ikon aplikasi: kotak biru, gir putih, centang teal |

## Warna dan latar gelap

Warna diatur lewat CSS variable: `--logo-task` (bawaan slate `#324555`) dan `--logo-pro` (bawaan teal `#34BCB5`). Sidebar menyetel `--logo-task: #fff` karena slate hampir tak terlihat di latar biru tua. Gunakan variable yang sama di tempat baru yang gelap.

## Animasi loading

`PageLoader` (`components/Loaders.tsx`) memakai `<Logo animated />`. Satu putaran 2,6 detik: gir berputar satu kali penuh, centang tergambar dari kiri ke kanan, bertahan sebentar, lalu memudar dan mengulang; tulisan "TaskPro" sedikit "bernapas". Semuanya CSS (tanpa JavaScript tambahan dan tanpa berkas gambar). Perangkat yang meminta gerak dikurangi (`prefers-reduced-motion`) menampilkan logo diam.

## Mengganti logo

1. Pisahkan tinta dari latar, lacak tiap komponen terhubung (huruf, gir, centang) menjadi path, dan tulis ulang `lib/logo.ts`. Jaga agar gir dan centang tetap bagian terpisah, karena animasi memutar gir dan membuka centang secara terpisah.
2. Buat ulang `public/logo*.svg`, `public/logo.png`, dan keempat ikon aplikasi.
3. Periksa tampilannya di sidebar (latar gelap), halaman login, dan layar loading.
