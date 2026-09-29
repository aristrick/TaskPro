'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { alamatDari } from '../lib/geo'
import Icon from './Icon'
import { KATEGORI, ACCOUNTS, PREFIX } from '../lib/const'

// Tambah/Edit outlet di HP. Nilai awal diisi otomatis (lokasi, rayon aktif, kategori umum) -> pengguna cukup memeriksa.
export default function OutletForm({ me, rayon, pos, outlet, onClose, onSaved }: any) {
  const baru = !outlet
  const [f, setF] = useState<any>(outlet ? { ...outlet, lat: outlet.lat ?? '', long: outlet.long ?? '', owner: outlet.owner ?? '', phone: outlet.phone ?? '' }
    : { prefix: 'Wr', name: '', address: '', lat: pos?.lat ?? '', long: pos?.lng ?? '', category: 'General Trade', account: 'Retail', owner: '', phone: '', rayon, status: 'AKTIF' })
  const [geo, setGeo] = useState<any>({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [out, setOut] = useState(false)
  const close = () => { setOut(true); setTimeout(onClose, 220) }
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))
  async function isiAlamat(lat: number, lng: number) {
    const g = await alamatDari(lat, lng); if (g) { setGeo(g); if (g.address) set('address', g.address) } else setErr('Alamat otomatis gagal. Isi manual.')
  }
  useEffect(() => { if (baru && f.lat !== '') isiAlamat(+f.lat, +f.long) }, [])
  function pakaiLokasi() {
    navigator.geolocation.getCurrentPosition(p => { setErr(''); set('lat', p.coords.latitude); set('long', p.coords.longitude); isiAlamat(p.coords.latitude, p.coords.longitude) },
      () => setErr('Lokasi tidak terbaca. Aktifkan GPS.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  async function simpan() {
    const la = Number(f.lat), lo = Number(f.long)
    const why = !String(f.name).trim() ? 'Nama outlet wajib diisi' : !String(f.address).trim() ? 'Alamat wajib diisi'
      : f.lat === '' || f.long === '' || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180 ? 'Lokasi (lat/long) wajib valid'
      : !String(f.owner).trim() ? 'Nama pemilik wajib diisi' : !/^[0-9+\- ]{8,16}$/.test(String(f.phone).trim()) ? 'No. HP tidak valid (8–16 angka)'
      : !(+f.rayon >= 1 && +f.rayon <= 24) ? 'Rayon harus 1–24' : ''
    if (why) return setErr(why)
    setBusy(true)
    const d: any = { address: f.address.trim(), lat: la, long: lo, category: f.category, account: f.account, owner: f.owner.trim(), phone: f.phone.trim(), rayon: +f.rayon,
      ...(geo.province_name ? { province_name: geo.province_name, city_name: geo.city_name, district: geo.district } : {}) }
    const { error } = baru
      ? await supabase.from('outlets').insert({ ...d, name: `${f.prefix} ${f.name.trim()}`, cabang_id: me.cabang_id, kode_md: me.user_id, status: 'AKTIF' })
      : await supabase.from('outlets').update({ ...d, name: f.name.trim(), status: f.status }).eq('id', outlet.id)
    setBusy(false); if (error) return setErr(error.message); setOut(true); setTimeout(onSaved, 220)
  }
  const fld = (label: string, el: any) => <label className="fld"><span className="label">{label}</span>{el}</label>
  return (
    <div className={`modal ${out ? 'out' : ''}`}><div>
      <div className="row"><h3 style={{ margin: 0 }}>{baru ? 'Tambah Outlet' : 'Edit Outlet'}</h3><div className="grow" /><button className="ghost" onClick={close}><Icon name="close" size={16} /> Tutup</button></div>
      {!baru && <p className="muted" style={{ margin: '0 0 12px' }}>{outlet.code}</p>}
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        {baru && fld('Jenis', <select value={f.prefix} onChange={e => set('prefix', e.target.value)}>{PREFIX.map(p => <option key={p}>{p}</option>)}</select>)}
        <div className="grow">{fld('Nama outlet', <input value={f.name} onChange={e => set('name', e.target.value)} placeholder={baru ? 'mis. Ibu Yuni' : ''} />)}</div>
      </div>
      {fld('Alamat', <input value={f.address} onChange={e => set('address', e.target.value)} />)}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="grow">{fld('Latitude', <input inputMode="decimal" value={f.lat} onChange={e => set('lat', e.target.value)} />)}</div>
        <div className="grow">{fld('Longitude', <input inputMode="decimal" value={f.long} onChange={e => set('long', e.target.value)} />)}</div>
      </div>
      <div className="row"><button className="ghost" onClick={pakaiLokasi}><Icon name="pin" size={16} /> Pakai lokasi saya</button>
        <button className="ghost" disabled={f.lat === '' || f.long === ''} onClick={() => isiAlamat(+f.lat, +f.long)}>Isi alamat dari titik</button></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="grow">{fld('Kategori', <select value={f.category || ''} onChange={e => set('category', e.target.value)}>{KATEGORI.map(x => <option key={x}>{x}</option>)}</select>)}</div>
        <div style={{ width: 96 }}>{fld('Rayon', <select value={f.rayon} onChange={e => set('rayon', e.target.value)}>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select>)}</div>
      </div>
      {fld('Account', <select value={f.account || ''} onChange={e => set('account', e.target.value)}>{ACCOUNTS.map(x => <option key={x}>{x}</option>)}</select>)}
      {fld('Nama pemilik', <input value={f.owner} onChange={e => set('owner', e.target.value)} />)}
      {fld('No. HP', <input inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} />)}
      {!baru && fld('Status', <select value={f.status} onChange={e => set('status', e.target.value)}><option>AKTIF</option><option>INAKTIF</option></select>)}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stickybar"><button disabled={busy} style={{ width: '100%' }} onClick={simpan}>{busy ? 'Menyimpan…' : baru ? 'Simpan Outlet Baru' : 'Simpan Perubahan'}</button></div>
    </div></div>)
}
