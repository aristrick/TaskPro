# Import DMP: format file dan pemeriksaan

Menu **Outlet > Import DMP**. Alurnya tiga langkah: pilih cabang (dan unduh format contoh), unggah file (formatnya diperiksa), lalu tinjau dan simpan.

## Format contoh yang bisa diunduh

Tombol **Unduh format contoh** (aktif setelah memilih cabang) menghasilkan `Format_DMP_<kode cabang>.xlsx` dengan tiga sheet:

| Sheet | Fungsi |
|---|---|
| `DMP` | Kosong, hanya judul kolom. **Isi data di sini**, mulai baris 2. Judul kolom wajib berlatar biru, opsional berlatar abu-abu. Sel punya catatan penjelasan dan aturan isian: dropdown RAYON (R01–R24) dan STATUS (AKTIF/INAKTIF), batas latitude (-90 sampai 90) dan longitude (-180 sampai 180), serta KODE MD harus diawali kode cabang. Kolom berformat teks agar angka nol di depan ID tidak hilang |
| `CONTOH` | Tiga baris contoh pola pengisian (termasuk satu outlet tanpa koordinat). Tidak dibaca saat diunggah |
| `PETUNJUK` | Aturan pengisian dan tabel semua kolom: wajib atau tidak, keterangan, dan contoh isi |

KODE MD pada contoh memakai kode cabang yang dipilih, jadi contoh untuk cabang 2100 berbeda dengan cabang 0300.

## Pemeriksaan sebelum file diproses

Pemeriksaan berjalan berurutan dan berhenti di tahap yang gagal, dengan pesan yang menjelaskan cara memperbaikinya:

1. **Jenis file.** Harus `.xlsx`. File `.xls` dan `.csv` ditolak dengan petunjuk Save As > Excel Workbook.
2. **Bisa dibaca dan ukuran.** File rusak atau di atas 10 MB ditolak dengan pesan jelas.
3. **Format kolom** (`periksaFormatDmp` di `lib/dmp.ts`). Kolom wajib: `code outlet`, `name`, `full_address`, `latitude`, `longitude`, `KODE MD`, `RAYON`. Huruf besar/kecil dan spasi di tepi diabaikan. Jika ada yang kurang, pesan menyebut kolom apa. Jika ada kolom yang namanya hampir sama (misalnya `kode_md`, `Lat`, `Alamat`), pesan menyebut nama yang harus dipakai. File tidak diterima begitu saja dengan nama yang salah: nama kolom harus persis. Kolom opsional yang tidak ada dikosongkan, dan kolom lain di file diabaikan (disebutkan di hasil).
4. **Pemilihan sheet.** Sheet bernama `DMP` dibaca jika formatnya sesuai; jika tidak ada, sheet sesuai pertama yang berisi data. Sheet `CONTOH` dan `PETUNJUK` tidak pernah dibaca.
5. **Isi per baris** (`parseDmp`). Baris yang gagal ditolak dan ditampilkan beserta nomor baris Excel dan alasannya sebelum apa pun disimpan: ID kosong atau ganda, nama atau alamat kosong, KODE MD bukan milik cabang tujuan, RAYON di luar R01–R24, koordinat tidak valid atau hanya sebagian, **STATUS selain AKTIF/INAKTIF**, dan **baris contoh** (ID diawali `CONTOH`).

Aturan STATUS dan baris contoh sengaja ketat. Status yang salah ketik (misalnya "Active") tidak ditolak database, tetapi aplikasi hanya menampilkan outlet berstatus AKTIF kepada frontliner, sehingga outletnya akan tersimpan tetapi tidak pernah muncul di HP. STATUS huruf kecil dirapikan menjadi huruf besar, dan STATUS kosong dianggap AKTIF.

## Pengujian

Logika format dan isi format contoh ada di `tests/unit/dmp-format.test.ts` (termasuk mengisi format contoh lalu memprosesnya). Alur di browser (unduh, unggah berbagai file, simpan) ada di `tests/e2e/import.spec.ts`, dan tampilan hasil pemeriksaan ikut diperiksa aksesibilitasnya di `tests/e2e/aksesibilitas.spec.ts`.
