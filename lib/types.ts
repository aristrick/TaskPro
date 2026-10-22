// Tipe data inti yang dipakai layar frontliner (menggantikan `any`). Hanya kolom yang benar-benar dipakai aplikasi.
export type Me = {
  id: string; user_id: string; nama: string; role: string; cabang_id: string | null
  project_id?: string | null; gps_required?: boolean | null; min_checkout_menit?: number | null
}
export type Outlet = { id: number; name: string; address: string; lat: number | null; long: number | null; kode_md?: string; rayon?: number; status?: string; [kolom: string]: unknown }
export type Kunjungan = {
  id: string; outlet_id: number; checkin_at: string; project_id: string | null
  outlets: { name: string; address: string; lat: number | null; long: number | null } | null
}
export type Produk = { id: string; product: string; brand?: string | null; price: number | string; active?: boolean }
export type StokMap = Record<string, { dibawa: number; terjual: number }>
export type Posisi = { lat: number; lng: number }
