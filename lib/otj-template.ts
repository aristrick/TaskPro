// Checklist OTJ (On-the-Job Assessment) mengikuti template resmi "Taskforce OTJ Template" dan "MD GT OTJ Template" dari Tracking Go.
// Setiap bagian punya sepasang isian "Akar Masalah" dan "Action Plan". Id butir (mis. "kunjungan-2-1") dipakai sebagai kunci jawaban
// yang disimpan di database, jadi JANGAN mengubah urutan butir di template yang sudah dipakai: tambahkan butir baru di akhir subbagiannya.

export type TipeOtj = 'Taskforce' | 'MD GT'
export type KunciBagian = 'pra' | 'kunjungan' | 'pasca'
export type Jawaban = 'Ya' | 'Tidak' | 'N/A'
export const JAWABAN: Jawaban[] = ['Ya', 'Tidak', 'N/A']
export type JawabanMap = Record<string, string>

export type SubBagian = { title: string | null; items: string[] }
export type Bagian = { key: KunciBagian; title: string; subsections: SubBagian[] }
export type Template = { label: TipeOtj; divisiOptions: string[]; sections: Bagian[] }
export type Butir = { id: string; sectionKey: KunciBagian; sectionTitle: string; subTitle: string | null; label: string }

export const OTJ_TEMPLATES: Record<TipeOtj, Template> = {
  Taskforce: {
    label: 'Taskforce',
    divisiOptions: ['TFC', 'TFB', 'TFO', 'TF BONTEH'],
    sections: [
      { key: 'pra', title: '[A] Penilaian Pra-Kunjungan', subsections: [{ title: null, items: [
        'Menghadiri briefing pagi (minimal telpon untuk Taskforce di SP/FS)',
        'Pemahaman terhadap target harian in qty dan value',
        'Pemahaman terhadap target NOA',
        'Menyiapkan handheld (setting android) / DKM Manual jika tidak ada handheld',
        'Menyiapkan dokumen (form pelanggan baru, DMP, form survey (jika ada))',
        'Menyiapkan POSM',
        'Melakukan Loading barang jualan di gudang',
      ] }] },
      { key: 'kunjungan', title: '[B] Penilaian selama kunjungan', subsections: [
        { title: '1. Pelayanan Pelanggan', items: [
          'Sapa dengan senyum dan kontak mata',
          'Memperkenalkan diri (Hanya untuk kunjungan ke outlet baru / NOA)',
          'Memberikan kontak (Hanya untuk kunjungan ke outlet baru / NOA)',
        ] },
        { title: '2. Branding Display', items: [
          'Melakukan pemasangan POSM',
          'Merapihkan Display produk Kapal Api Grup Di Outlet',
        ] },
        { title: '3. Penjualan', items: [
          'Menunjukkan barang yang dibawa kepada toko',
          'Menginformasikan semua program yang sedang berjalan',
          'Menawarkan semua produk fokus',
          'Menginformasikan USP (Unique Selling Point) produk yang ditawarkan',
          'Melakukan upaya up-selling',
          'Melakukan upaya cross-selling (menambah availability)',
        ] },
        { title: '4. Penutupan', items: [
          'Menyampaikan rangkuman pesanan toko secara verbal (jika toko melakukan pembelian)',
          'Melakukan inputan pesanan ke dalam android/manual DKM (jika toko melakukan pembelian)',
          'Menanyakan alasan jika toko tidak melakukan pembelian',
          'Mengucapkan terima kasih',
          'Apakah Taskforce berhasil melakukan penjualan?',
        ] },
      ] },
      { key: 'pasca', title: '[C] Penilaian - Pasca Kunjungan', subsections: [{ title: null, items: [
        'Administrasi hasil penjualan/tagihan dan setoran margin',
        'Lapor hasil penjualan dan distribusi melalui DKS',
        'Menyampaikan kendala yang ada',
      ] }] },
    ],
  },
  'MD GT': {
    label: 'MD GT',
    divisiOptions: ['MD GT', 'SE-ALL', 'SE-KOPI', 'SE-BEVERAGE', 'SE-SNACK', 'TO-ALL', 'TO-KOPI', 'TO-BEVERAGE', 'TO-SNACK', 'MOTORIS', 'CANVAS'],
    sections: [
      { key: 'pra', title: '[A] Penilaian Pra-Kunjungan', subsections: [{ title: null, items: [
        'Menghadiri briefing pagi / minimal telpon untuk MD yang berada di Stock point',
        'Pemahaman target harian',
        'Target Outlet / NOA',
        'Menyiapkan handheld (setting android)',
        'Menyiapkan DKM Manual',
        'Menyiapkan POSM / hanger',
        'Menyiapkan dokumen (DMP, form NoA, form inaktif outlet, form survey (jika ada), buku catatan, rekap program)',
      ] }] },
      { key: 'kunjungan', title: '[B] Penilaian selama kunjungan', subsections: [
        { title: '1. Pelayanan Pelanggan', items: [
          'Sapa dengan senyum dan kontak mata',
          'Hanya untuk NOA, memperkenalkan diri',
          'Memberikan kontak kepada pelanggan baru',
        ] },
        { title: '2. Activity MD', items: [
          'Periksa kebersihan dan kerapihan pajangan',
          'Periksa tanggal kedaluwarsa produk',
          'Periksa apakah ada keluhan / masalah dengan stok dan produk',
        ] },
        { title: '3. Cek Stock', items: [
          'Melakukan cek stock produk digudang untuk produk display',
          'Melakukan cek kondisi dan expired date produk display',
        ] },
        { title: '4. Display dan Planogram', items: [
          'Memastikan produk display terlihat dan dalam kondisi baik',
          'Pemasangan planogram di tempat strategis',
          'Memastikan produk yang terdisplay sesuai dengan produk fokus Planogram',
          'Melakukan instalasi display tambahan (additional display)',
          'Pemasangan POSM di outlet',
          'Memberikan ide - media promosi baru',
        ] },
        { title: '5. NOA (Jika bukan NOA, silahkan pilih N/A)', items: [
          'Mendaftarkan NOA potensi dari DMP sales',
          'Display Kompetitor teridentifikasi yang terpajang di outlet prospek',
          'Mendorong produk yang cocok (setelah mengidentifikasi jenis bisnis, produk pesaing, dll.)',
          'Catat detail pelanggan dan alasan penolakan (jika tidak berhasil)',
        ] },
      ] },
      { key: 'pasca', title: '[C] Penilaian - Pasca Kunjungan', subsections: [{ title: null, items: [
        'Administrasi hasil kunjungan harian MD',
        'Lapor hasil kunjungan MD melalui DKM dan raport',
        'Menyampaikan kendala yang ada',
      ] }] },
    ],
  },
}

// Daftar butir datar dengan id unik: "<bagian>-<urutan subbagian>-<urutan butir>".
export function flattenItems(t: Template): Butir[] {
  const out: Butir[] = []
  for (const s of t.sections) s.subsections.forEach((sub, si) => sub.items.forEach((label, ii) =>
    out.push({ id: `${s.key}-${si}-${ii}`, sectionKey: s.key, sectionTitle: s.title, subTitle: sub.title, label })))
  return out
}
export const butirBagian = (t: Template, k: KunciBagian) => flattenItems(t).filter(i => i.sectionKey === k)

// Skor = jumlah "Ya" dibagi (jumlah terjawab dikurangi "N/A"), dalam persen. Belum ada yang dinilai = null.
export function skorPersen(nilai: (string | undefined | null)[]): number | null {
  const jawab = nilai.filter((v): v is string => !!v)
  const ya = jawab.filter(v => v === 'Ya').length, na = jawab.filter(v => v === 'N/A').length, bagi = jawab.length - na
  return bagi > 0 ? Math.round((ya / bagi) * 100) : null
}
export const skorButir = (butir: Butir[], jawab: JawabanMap) => skorPersen(butir.map(b => jawab[b.id]))

// Nilai total seluruh hari: bagian A + semua toko di bagian B + bagian C digabung lalu dihitung sekali (bukan rata-rata skor bagian).
export function skorTotal(t: Template, pra: JawabanMap, kunjungan: { jawaban: JawabanMap }[], pasca: JawabanMap): number | null {
  const b = butirBagian(t, 'kunjungan')
  return skorPersen([...butirBagian(t, 'pra').map(i => pra[i.id]), ...kunjungan.flatMap(k => b.map(i => k.jawaban[i.id])), ...butirBagian(t, 'pasca').map(i => pasca[i.id])])
}
