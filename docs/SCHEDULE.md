# Schedule Taskforce

Menu **Schedule** (MDS, RMDM, MDM). Jadwal rayon per frontliner untuk siklus 4 minggu x 6 hari (Senin sampai Sabtu) = 24 hari, sesuai 24 rayon. **Satu hari diisi satu rayon**, dan outlet yang dikunjungi hari itu adalah outlet rayon tersebut milik KODE MD si frontliner. Daftar outlet dibaca langsung dari data outlet (tidak disalin), jadi outlet baru atau yang berpindah rayon otomatis ikut.

Butuh **`19_migration.sql`**. Tanpa itu halaman menampilkan pesan "Fitur Schedule belum aktif di database" dan HP frontliner berjalan seperti biasa (tidak terkunci).

## Halaman admin

1. Cari frontliner (nama atau User ID). Kartu info menampilkan ID/nama, project aktif, dan check-in terakhir.
2. Empat bagian "Minggu ke 1" sampai "Minggu ke 4", masing-masing enam kartu hari. Kartu hari yang sama dengan hari ini (di zona waktu cabang) diberi tanda **Hari ini**.
3. Tombol **+** pada hari kosong membuka dialog pilih rayon: tombol cepat R01 sampai R24, ringkasan jumlah outlet rayon itu, dan peringatan jika rayon yang sama sudah dijadwalkan di hari lain (tidak dilarang). Tombol pensil mengganti rayon, tombol **Hapus** mengosongkan hari. Semua perubahan memberi tombol **Urungkan**.
4. Kartu yang sudah berisi menampilkan rayon, jumlah outlet aktif, dan daftar outlet dengan **Outlet ID di sebelah nama** (bisa dicari dan digulir).

## Kunci schedule (khusus MDM dan RMDM)

Saklar **Kunci schedule** pada kartu info. Jika aktif, di HP frontliner itu:
- pilihan rayon diganti penanda terkunci (mis. "R05"), dan daftar outlet hanya rayon jadwal hari ini;
- jika hari ini belum ada rayon (atau hari Minggu), muncul pesan "Tidak ada jadwal rayon hari ini" dan daftar outlet kosong;
- perubahan kunci atau jadwal berlaku saat aplikasi kembali ke layar atau paling lama 5 menit, tanpa muat ulang.

MDS bisa mengatur jadwal tetapi tidak bisa mengunci. RMDM hanya untuk frontliner di cabang yang dicovernya. Hak ini dijaga di database. Dialog kunci menyebut jadwal hari ini dan memperingatkan jika hari ini belum ada rayon.

## Aturan "Minggu ke berapa"

Satu-satunya tempat aturan ini ditulis: `slotDariTanggal` di `lib/schedule.ts` (dengan tes di `tests/unit/schedule.test.ts`).

- Minggu dihitung **Senin sampai Sabtu**, mulai dari **Senin pertama setiap bulan**. Minggu 1 = minggu yang berisi Senin pertama.
- Tanggal **sebelum** Senin pertama dianggap lanjutan **Minggu 4** (minggu terakhir bulan sebelumnya).
- Senin ke-5 dan seterusnya dalam bulan tetap **Minggu 4**.
- **Hari Minggu** tidak punya jadwal.

Contoh Oktober 2026 (Senin pertama = 5): 1–3 Okt = Minggu 4; 5–10 Okt = Minggu 1; 12–17 = Minggu 2; 19–24 = Minggu 3; 26–31 = Minggu 4. **Periksa dengan cara tim menghitung minggu sebelum mengunci frontliner sungguhan.** Kartu "Hari ini" di halaman admin menunjukkan slot yang dipakai HP hari ini, jadi mudah dicocokkan.

## Batasan yang perlu diketahui

- Kunci bekerja di **tampilan HP**: rayon tidak bisa dipilih dan outlet yang tampil hanya rayon jadwal. Database belum menolak check-in di outlet rayon lain (frontliner yang sengaja mengakali aplikasi masih bisa). Jika dibutuhkan, penolakan di sisi database bisa ditambahkan.
- Jika jadwal gagal dimuat di HP (mis. tanpa sinyal atau migrasi belum dijalankan), frontliner dianggap tidak terkunci supaya pekerjaan lapangan tidak terhenti.
- Satu hari hanya satu rayon (dijaga database). Satu frontliner satu jadwal 24 hari.

## Data

| Tabel | Isi |
|---|---|
| `schedule_rayon` | satu baris = satu hari (frontliner, minggu 1–4, hari 1–6, rayon 1–24), unik per frontliner dan hari |
| `schedule_status` | status kunci per frontliner |

Perubahan jadwal tercatat otomatis di `audit_log` (INSERT/UPDATE/DELETE pada `schedule_rayon`), dan perubahan kunci tercatat sebagai `SCHEDULE_KUNCI` atau `SCHEDULE_BUKA`. Kedua tabel baru, tidak menyentuh tabel lama.

## Pengujian

`tests/sql/97_v19_test.sql` (hak akses, batas nilai, satu hari satu rayon, lingkup RMDM/MDS, audit), `tests/unit/schedule.test.ts` (aturan minggu), `tests/e2e/schedule.spec.ts` (halaman admin dan layar HP), serta pemeriksaan aksesibilitas di `tests/e2e/aksesibilitas.spec.ts`.
