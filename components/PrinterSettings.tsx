'use client'
import { useState } from 'react'
import Icon from './Icon'
import SwipeHandle from './ui/SwipeHandle'
import { SettingRow } from './Switch'
import { Spinner } from './Loaders'
import { friendly } from '../lib/friendly'
import { adaAndroid, adaIOS, btTerpasang, cetak, dukungBluetooth, pasangBt, simpanPref, strukContoh, type Metode, type Pref } from '../lib/printer'

const METODE: { k: Metode; judul: string; desk: string }[] = [
  { k: 'bt', judul: 'Printer Bluetooth', desk: 'Hubungkan printer langsung dari HP ini. Cara termudah di Android.' },
  { k: 'rawbt', judul: 'Lewat aplikasi RawBT', desk: 'Untuk printer Bluetooth jenis lama. Perlu aplikasi RawBT dari Play Store.' },
  { k: 'system', judul: 'Dialog cetak sistem', desk: 'Printer yang terdaftar di perangkat, mis. AirPrint di iPhone.' },
]

// Pengaturan printer portable (tersimpan di perangkat ini).
export default function PrinterSettings({ pref, onChange, onClose, onToast }: { pref: Pref; onChange: (p: Pref) => void; onClose: () => void; onToast: (t: string) => void }) {
  const [out, setOut] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('')
  const ubah = (patch: Partial<Pref>) => { const p = { ...pref, ...patch }; onChange(p); simpanPref(p) }
  const tutup = () => { setOut(true); setTimeout(onClose, 220) }
  const ada = (k: Metode) => (k === 'bt' ? dukungBluetooth() : k === 'rawbt' ? adaAndroid() : true)
  async function pasang() {
    setBusy('pasang'); setErr('')
    try { const nama = await pasangBt(); ubah({ btNama: nama }); onToast('Printer terhubung') } catch (e: any) { if (e?.name !== 'NotFoundError') setErr(friendly(e, 'Gagal memasangkan printer')) }
    setBusy('')
  }
  async function tes() {
    setBusy('tes'); setErr('')
    try { await cetak(strukContoh(pref), pref); onToast('Tes cetak dikirim') } catch (e: any) { setErr(friendly(e, 'Gagal mencetak')) }
    setBusy('')
  }
  return (
    <div className={`modal ${out ? 'out' : ''}`}><div>
      <SwipeHandle onClose={tutup} />
      <div className="row"><h3 style={{ margin: 0 }}>Printer dan struk</h3><div className="grow" /><button className="ghost" onClick={tutup}><Icon name="close" size={16} /> Tutup</button></div>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Pengaturan ini tersimpan di perangkat ini saja.</p>

      <section className="fsec">
        <div className="fsec-t">Cara mencetak</div>
        {METODE.filter(m => ada(m.k)).map(m => <button key={m.k} className={`opt ${pref.metode === m.k ? 'on' : ''}`} onClick={() => ubah({ metode: m.k })} role="radio" aria-checked={pref.metode === m.k}>
          <span className="optdot" aria-hidden="true" /><span><b>{m.judul}</b><small>{m.desk}</small></span></button>)}
        {adaIOS() && <p className="hint-box" style={{ margin: '4px 0 0' }}>iPhone/iPad (Safari) tidak mendukung Bluetooth langsung. Pakai dialog cetak sistem dengan printer AirPrint.</p>}
      </section>

      {pref.metode === 'bt' && <section className="fsec">
        <div className="fsec-t">Hubungkan printer</div>
        <p className={`conn ${btTerpasang() ? 'ok' : ''}`}><Icon name={btTerpasang() ? 'check' : 'info'} size={16} /> <b>{btTerpasang() ? `Terhubung: ${pref.btNama || 'Printer'}` : 'Belum terhubung'}</b></p>
        <ol className="langkah">
          <li>Nyalakan printer dan dekatkan ke HP.</li>
          <li>Ketuk <b>Hubungkan printer</b> di bawah.</li>
          <li>Pilih nama printer dari daftar yang muncul.</li>
        </ol>
        <button disabled={!!busy} onClick={pasang}>{busy === 'pasang' ? <Spinner size={16} /> : <Icon name="locate" size={18} />} {btTerpasang() ? 'Hubungkan ulang' : 'Hubungkan printer'}</button>
        <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Jika halaman dimuat ulang, hubungkan printer sekali lagi.</p>
      </section>}

      <section className="fsec">
        <div className="fsec-t">Kertas</div>
        <div className="seg segsm" role="radiogroup" aria-label="Lebar kertas">
          {([[32, '58 mm'], [48, '80 mm']] as [32 | 48, string][]).map(([w, t]) => <button key={w} role="radio" aria-checked={pref.lebar === w} className={pref.lebar === w ? 'on' : ''} onClick={() => ubah({ lebar: w })}>{t}</button>)}</div>
      </section>

      <section className="fsec">
        <div className="fsec-t">Struk</div>
        <SettingRow icon="receipt" title="Tanya cetak setelah check-out" checked={pref.tanya} canEdit onChange={v => ubah({ tanya: v })}
          desc={pref.tanya ? 'Aktif: setelah check-out dengan penjualan, muncul pilihan Cetak atau Tidak cetak.' : 'Nonaktif: struk tidak ditawarkan. Struk terakhir tetap bisa dicetak dari Profile.'} />
        {pref.metode !== 'system' && <SettingRow icon="printer" title="Balik urutan cetak" checked={pref.balik} canEdit onChange={v => ubah({ balik: v })}
          desc={pref.balik ? 'Aktif: struk di kertas terbaca dari atas ke bawah: outlet, frontliner, produk, terima kasih.' : 'Nonaktif: matikan hanya jika hasil cetak di printer Anda sudah terbalik (terima kasih di atas).'} />}
        <label className="fld" style={{ marginTop: 12 }}><span className="label">Judul struk</span><input value={pref.judul} maxLength={32} onChange={e => ubah({ judul: e.target.value })} /></label>
        <label className="fld"><span className="label">Catatan bawah</span><input value={pref.footer} maxLength={48} onChange={e => ubah({ footer: e.target.value })} /></label>
      </section>

      {err && <p className="err" role="alert">{err}</p>}
      <div className="bar-spacer" aria-hidden="true" />
      <div className="stickybar"><button style={{ width: '100%' }} disabled={!!busy} aria-busy={busy === 'tes'} onClick={tes}><Icon name="printer" size={18} /> Tes cetak</button></div>
    </div></div>)
}
