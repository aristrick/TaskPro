'use client'
import { useState } from 'react'
import Icon from './Icon'
import { barisStruk, teksPolos, type Struk } from '../lib/escpos'
import { cetak, type Pref } from '../lib/printer'
import { friendly } from '../lib/friendly'

// Muncul setelah check-out yang ada penjualannya: pratinjau struk, lalu pilih Cetak atau Tidak cetak (lewati).
export default function ReceiptDialog({ struk, pref, onClose, onDone, onSettings }: { struk: Struk; pref: Pref; onClose: () => void; onDone: () => void; onSettings: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function cetakSekarang() {
    setBusy(true); setErr('')
    try { await cetak(struk, pref); onDone() } catch (e: any) { setErr(friendly(e, 'Gagal mencetak')) }
    setBusy(false)
  }
  return (
    <div className="overlay top" onClick={() => !busy && onClose()}>
      <div className="dialog receipt" role="dialog" aria-modal="true" aria-label="Cetak struk" onClick={e => e.stopPropagation()}>
        <div className="dicon"><Icon name="receipt" size={28} /></div>
        <h3>Cetak struk?</h3>
        <p>Penjualan sudah tersimpan. Struk bisa dicetak untuk pelanggan, atau dilewati.</p>
        <pre className="strukprev" aria-label="Pratinjau struk">{teksPolos(barisStruk(struk, pref.lebar), pref.lebar)}</pre>
        {err && <p className="err" role="alert" style={{ textAlign: 'left' }}>{err}</p>}
        <div className="dbtns">
          <button className="ghost" onClick={onClose} disabled={busy}>Tidak cetak</button>
          <button onClick={cetakSekarang} disabled={busy} aria-busy={busy}><Icon name="printer" size={18} /> {err ? 'Coba lagi' : 'Cetak'}</button>
        </div>
        <button className="linkbtn" style={{ margin: '12px auto 0' }} onClick={onSettings}>Pengaturan printer</button>
      </div>
    </div>)
}
