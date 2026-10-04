'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { alamatDari } from '../lib/geo'
import Icon from './Icon'
import { Spinner } from './Loaders'
import { PROVINSI } from '../lib/wilayah'
import { useDialog } from './Dialog'
import { hapusOutlet } from '../lib/outlet'
import { KATEGORI, ACCOUNTS, PREFIX } from '../lib/const'

// Tambah/Edit outlet di HP. Nilai awal diisi otomatis (lokasi, alamat, kota/kecamatan/kelurahan, rayon aktif).
export default function OutletForm({ me, rayon, pos, outlet, onClose, onSaved, onDeleted }: any) {
  const dlg = useDialog()
  const baru = !outlet
  const wilayah = { province_name: '', city_name: '', district: '', village: '' }
  const [f, setF] = useState<any>(outlet
    ? { ...wilayah, ...Object.fromEntries(Object.entries(outlet).map(([k, v]) => [k, v ?? ''])) }
    : { ...wilayah, prefix: 'Wr', name: '', owner: '', phone: '', address: '', lat: pos?.lat ?? '', long: pos?.lng ?? '', category: 'General Trade', account: 'Retail', rayon, status: 'AKTIF' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [out, setOut] = useState(false)
  const [tried, setTried] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false); const [addrBusy, setAddrBusy] = useState(false)
  const close = () => { setOut(true); setTimeout(onClose, 220) }
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))
  async function isiAlamat(lat: number, lng: number) {
    setAddrBusy(true); const g = await alamatDari(lat, lng); setAddrBusy(false)
    if (g) setF((x: any) => ({ ...x, address: g.address || x.address, province_name: g.province_name || x.province_name, city_name: g.city_name || x.city_name, district: g.district || x.district, village: g.village || x.village }))
    else setErr('Alamat otomatis gagal. Isi manual.')
  }
  // Outlet baru: isi semua dari titik. Edit outlet lama: hanya melengkapi kolom wilayah yang masih kosong (data yang sudah ada tidak ditimpa).
  async function lengkapiKosong(lat: number, lng: number) {
    setAddrBusy(true); const g = await alamatDari(lat, lng); setAddrBusy(false)
    if (g) setF((x: any) => ({ ...x, province_name: x.province_name || g.province_name || '', city_name: x.city_name || g.city_name || '', district: x.district || g.district || '', village: x.village || g.village || '' }))
  }
  useEffect(() => {
    if (f.lat === '' || f.long === '') return
    if (baru) isiAlamat(+f.lat, +f.long)
    else if (!f.province_name || !f.city_name || !f.district || !f.village) lengkapiKosong(+f.lat, +f.long)
  }, [])
  function pakaiLokasi() {
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(p => { setGpsBusy(false); setErr(''); set('lat', p.coords.latitude); set('long', p.coords.longitude); isiAlamat(p.coords.latitude, p.coords.longitude) },
      () => { setGpsBusy(false); setErr('Lokasi tidak terbaca. Aktifkan GPS.') }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  // Kolom wajib yang belum benar. Dipakai untuk status di bar bawah, penyorotan merah, dan fokus otomatis saat simpan.
  const la = Number(f.lat), lo = Number(f.long)
  const lokOk = !(f.lat === '' || f.long === '' || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180)
  const masalah = ([
    !String(f.name).trim() && { k: 'name', label: 'Nama outlet', msg: 'Nama outlet wajib diisi' },
    !String(f.owner).trim() && { k: 'owner', label: 'Nama pemilik', msg: 'Nama pemilik wajib diisi' },
    !/^[0-9+\- ]{8,16}$/.test(String(f.phone).trim()) && { k: 'phone', label: 'No. HP', msg: 'No. HP tidak valid (8–16 angka)' },
    !String(f.address).trim() && { k: 'address', label: 'Alamat', msg: 'Alamat wajib diisi' },
    !lokOk && { k: 'lat', label: 'Lokasi', msg: 'Lokasi (lat/long) wajib valid' },
    !(+f.rayon >= 1 && +f.rayon <= 24) && { k: 'rayon', label: 'Rayon', msg: 'Rayon harus 1–24' },
  ].filter(Boolean)) as { k: string; label: string; msg: string }[]
  const salah = (k: string) => tried && masalah.some(x => x.k === k)
  async function simpan() {
    if (masalah.length) {
      setTried(true); setErr(masalah[0].msg)
      const el = document.querySelector<HTMLElement>(`[data-f="${masalah[0].k}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus({ preventScroll: true })
      return
    }
    setBusy(true)
    const n = (v: any) => (String(v).trim() ? String(v).trim() : null)
    const d: any = { address: f.address.trim(), lat: la, long: lo, category: f.category, account: f.account, owner: f.owner.trim(), phone: f.phone.trim(), rayon: +f.rayon,
      province_name: n(f.province_name), city_name: n(f.city_name), district: n(f.district), village: n(f.village) }
    const { error } = baru
      ? await supabase.from('outlets').insert({ ...d, name: `${f.prefix} ${f.name.trim()}`, cabang_id: me.cabang_id, kode_md: me.user_id, status: 'AKTIF' })
      : await supabase.from('outlets').update({ ...d, name: f.name.trim(), status: f.status }).eq('id', outlet.id)
    setBusy(false); if (error) return setErr(error.message); setOut(true); setTimeout(onSaved, 220)
  }
  async function hapus() {
    const r = await hapusOutlet(dlg, outlet)
    if (r === 'deleted' || r === 'inactive') { setOut(true); setTimeout(() => onDeleted?.(r), 220) }
  }
  const fld = (label: string, el: any, k?: string, req = false) => <label className={`fld ${k && salah(k) ? 'bad' : ''}`}><span className="label">{label}{req && <i className="req" aria-hidden="true"> *</i>}</span>{el}</label>
  return (
    <div className={`modal ${out ? 'out' : ''}`}><div>
      <div className="row"><h3 style={{ margin: 0 }}>{baru ? 'Tambah Outlet' : 'Edit Outlet'}</h3><div className="grow" /><button className="ghost" onClick={close}><Icon name="close" size={16} /> Tutup</button></div>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>{baru ? 'Outlet ID dan kode outlet dibuat otomatis saat disimpan.' : `Kode ${outlet.code} · Outlet ID ${outlet.ext_id || '-'}`} · <i className="req">*</i> wajib diisi</p>
      <section className="fsec rayon">
        <div className="fsec-h"><span className="fico"><Icon name="list" size={18} /></span><div><b>Rayon kunjungan</b><small>Outlet ini masuk ke rayon yang dipilih</small></div></div>
        <select data-f="rayon" className="bigsel" aria-label="Rayon" value={f.rayon} onChange={e => set('rayon', e.target.value)}>
          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>R{String(i + 1).padStart(2, '0')}</option>)}</select>
      </section>

      <section className="fsec">
        <div className="fsec-t">Data outlet</div>
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end', marginBottom: 0 }}>
          {baru && fld('Jenis', <select value={f.prefix} onChange={e => set('prefix', e.target.value)}>{PREFIX.map(p => <option key={p}>{p}</option>)}</select>)}
          <div className="grow">{fld('Nama outlet', <input data-f="name" value={f.name} onChange={e => set('name', e.target.value)} placeholder={baru ? 'mis. Ibu Yuni' : ''} />, 'name', true)}</div>
        </div>
        {fld('Account', <select value={f.account || ''} onChange={e => set('account', e.target.value)}>{ACCOUNTS.map(x => <option key={x}>{x}</option>)}</select>)}
        {fld('Nama pemilik', <input data-f="owner" value={f.owner} onChange={e => set('owner', e.target.value)} />, 'owner', true)}
        {fld('No. HP', <input data-f="phone" inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} />, 'phone', true)}
      </section>

      <section className="fsec">
        <div className="fsec-t">Lokasi</div>
      <div className="tiles">
        <button className="tile primary" onClick={pakaiLokasi} disabled={gpsBusy}>
          <span className="tico">{gpsBusy ? <Spinner size={22} /> : <Icon name="locate" size={22} />}</span>
          <b>{gpsBusy ? 'Mencari lokasi…' : 'Pakai lokasi saya'}</b><small>Ambil titik dari GPS HP</small></button>
        <button className="tile" onClick={() => isiAlamat(+f.lat, +f.long)} disabled={addrBusy || f.lat === '' || f.long === ''}>
          <span className="tico">{addrBusy ? <Spinner size={22} /> : <Icon name="search" size={22} />}</span>
          <b>{addrBusy ? 'Mencari alamat…' : 'Isi alamat dari titik'}</b><small>Dari koordinat di bawah</small></button>
      </div>
        <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 0 }}>
          <div className="grow">{fld('Latitude', <input data-f="lat" inputMode="decimal" value={f.lat} onChange={e => set('lat', e.target.value)} />, 'lat', true)}</div>
          <div className="grow">{fld('Longitude', <input inputMode="decimal" value={f.long} onChange={e => set('long', e.target.value)} />, 'lat', true)}</div>
        </div>
        {fld('Alamat', <input data-f="address" value={f.address} onChange={e => set('address', e.target.value)} />, 'address', true)}
        {fld('Provinsi', <><input list="daftar-provinsi" value={f.province_name} onChange={e => set('province_name', e.target.value)} /><datalist id="daftar-provinsi">{PROVINSI.map(p => <option key={p} value={p} />)}</datalist></>)}
        <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 0 }}>
          <div className="grow">{fld('Kota', <input value={f.city_name} onChange={e => set('city_name', e.target.value)} />)}</div>
          <div className="grow">{fld('Kecamatan', <input value={f.district} onChange={e => set('district', e.target.value)} />)}</div>
        </div>
        {fld('Kelurahan', <input value={f.village} onChange={e => set('village', e.target.value)} />)}
      </section>

      <section className="fsec">
        <div className="fsec-t">{baru ? 'Kategori' : 'Kategori dan status'}</div>
        {fld('Kategori', <select value={f.category || ''} onChange={e => set('category', e.target.value)}>{KATEGORI.map(x => <option key={x}>{x}</option>)}</select>)}
        {!baru && fld('Status', <select value={f.status} onChange={e => set('status', e.target.value)}><option>AKTIF</option><option>INAKTIF</option></select>)}
      </section>
      {err && <p className="err" role="alert">{err}</p>}
      {!baru && <button className="ghost danger" style={{ width: '100%', marginTop: 8, minHeight: 48 }} onClick={hapus}><Icon name="trash" size={18} /> Hapus outlet</button>}
      <div className="stickybar">
        <div className={`fstat ${masalah.length ? '' : 'ok'}`} aria-live="polite">{masalah.length ? <>Lengkapi: <b>{masalah.map(x => x.label).join(', ')}</b></> : <><Icon name="check" size={14} /> Semua data wajib sudah terisi</>}</div>
        <button disabled={busy} aria-busy={busy} style={{ width: '100%' }} onClick={simpan}>{busy ? 'Menyimpan…' : baru ? 'Simpan Outlet Baru' : 'Simpan Perubahan'}</button>
      </div>
    </div></div>)
}
