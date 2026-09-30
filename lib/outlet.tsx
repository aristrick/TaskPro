import { supabase } from './supabase'
import type { useDialog } from '../components/Dialog'

// Hapus outlet dengan konfirmasi. Outlet yang sudah punya riwayat kunjungan tidak boleh dihapus (data laporan utuh);
// sebagai gantinya ditawarkan menonaktifkan. Hasil: 'deleted' | 'inactive' | 'cancel' | 'error'
export async function hapusOutlet(dlg: ReturnType<typeof useDialog>, o: { id: number; name: string; code?: string }) {
  const yes = await dlg.confirm({ title: 'Hapus outlet ini?', tone: 'danger', okText: 'Hapus',
    message: <><b>{o.name}</b>{o.code ? ` (${o.code})` : ''} akan dihapus permanen dan tidak bisa dikembalikan.</> })
  if (!yes) return 'cancel' as const
  const { data, error } = await supabase.from('outlets').delete().eq('id', o.id).select('id')
  if (error) {
    if (error.code === '23503') {
      const off = await dlg.confirm({ title: 'Outlet tidak bisa dihapus', icon: 'info', okText: 'Nonaktifkan',
        message: <><b>{o.name}</b> sudah punya riwayat kunjungan, jadi datanya dipertahankan untuk laporan. Nonaktifkan saja agar tidak muncul lagi di daftar kunjungan?</> })
      if (!off) return 'cancel' as const
      const { error: e2 } = await supabase.from('outlets').update({ status: 'INAKTIF' }).eq('id', o.id)
      if (e2) { await dlg.alert({ title: 'Gagal menonaktifkan', message: e2.message, tone: 'danger', icon: 'close' }); return 'error' as const }
      return 'inactive' as const
    }
    await dlg.alert({ title: 'Gagal menghapus', message: error.message, tone: 'danger', icon: 'close' }); return 'error' as const
  }
  if (!data?.length) { await dlg.alert({ title: 'Tidak bisa menghapus', message: 'Anda tidak punya izin menghapus outlet ini, atau outlet sudah tidak ada.', tone: 'danger', icon: 'close' }); return 'error' as const }
  return 'deleted' as const
}
