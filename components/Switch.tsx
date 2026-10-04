import type { ReactNode } from 'react'
import Icon from './Icon'

// Saklar on/off yang seragam di seluruh aplikasi (pengganti centang): sama dengan saklar GPS di halaman Frontliner.
export function Switch({ checked, onChange, disabled, label, title }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; title?: string }) {
  return (
    <label className="switch" title={title}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span />
    </label>)
}

// Baris pengaturan: ikon, judul, keterangan status, dan saklar. Jika pengguna tidak berhak mengubah, tampil lencana status saja.
export function SettingRow({ icon, title, desc, checked, onChange, canEdit, noteNoEdit = 'Hanya MDM yang dapat mengubah' }:
  { icon: string; title: string; desc: ReactNode; checked: boolean | null; onChange: (v: boolean) => void; canEdit: boolean; noteNoEdit?: string }) {
  return (
    <div className="setrow">
      <span className="setico"><Icon name={icon} size={20} /></span>
      <div className="setmain">
        <b>{title}</b>
        {checked === null ? <span className="skel" style={{ display: 'block', width: '75%', height: 12, marginTop: 8 }} /> : <p>{desc}</p>}
        {!canEdit && <small className="setnote"><Icon name="lock" size={13} /> {noteNoEdit}</small>}
      </div>
      {checked === null ? null : canEdit
        ? <Switch checked={checked} onChange={onChange} label={title} />
        : <span className={checked ? 'on-badge' : 'off-badge'}>{checked ? 'Aktif' : 'Nonaktif'}</span>}
    </div>)
}
