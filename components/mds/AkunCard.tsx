import type { ReactNode } from 'react'
import Icon from '../Icon'

export type Cabang = { id: string; kode: string; nama: string; mds_id: string | null; rmdm_id: string | null }
export type Akun = { id: string; user_id: string; nama: string; role: 'mds' | 'rmdm' | 'mdm' }
export type Konfirmasi = { title: string; message: ReactNode }
export type Op = (body: Record<string, unknown>, konfirmasi?: Konfirmasi) => void

export const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'
const cb = (c: Cabang) => `${c.kode} ${c.nama}`

// Kartu satu akun MDS/RMDM/MDM. Urutan baca: siapa (nama, peran, ID, status) > apa yang dipegang (cabang) > tindakan berisiko di kaki kartu.
export default function AkunCard({ m, cabang, bebasMds, bebasR, viewerRole, status, bisaPaksa, onHapus, onPaksa, onOp }: {
  m: Akun; cabang: Cabang[]; bebasMds: Cabang[]; bebasR: Cabang[]; viewerRole: string; status: ReactNode; bisaPaksa: boolean
  onHapus: () => void; onPaksa: () => void; onOp: Op }) {
  const punya = cabang.filter(c => (m.role === 'mds' ? c.mds_id : c.rmdm_id) === m.id)
  const adaAksi = bisaPaksa || m.role !== 'mdm'   // MDS selalu bisa dihapus, jadi kaki kartu juga memuat Lepas cabang
  return (
    <article className="acc">
      <header className="acch">
        <span className={`avt ${m.role}`} aria-hidden="true">{inisial(m.nama)}</span>
        <div className="accid">
          <b className="accname">{m.nama}</b>
          <div className="accsub"><span className={`rb ${m.role}`}>{m.role.toUpperCase()}</span><span className="uid">{m.user_id}</span></div>
          <div className="accstat">{status}</div>
        </div>
      </header>

      {m.role === 'mds' && <div className="accbody">
        <span className="label">Cabang yang dipegang</span>
        <ul className="lrows">
          {punya.length > 0
            ? punya.map(c => <li className="lrow" key={c.id}><span className="lrow-ic" aria-hidden="true"><Icon name="building" size={18} /></span><span className="lrow-tx"><b>{cb(c)}</b></span></li>)
            : <li className="lrow none"><span className="lrow-ic" aria-hidden="true"><Icon name="alert" size={18} /></span><span className="lrow-tx"><b>Belum punya cabang</b></span></li>}
        </ul>
        <label className="movefield">
          <span className="label">{punya.length ? 'Pindah ke cabang lain' : 'Tetapkan cabang'}</span>
          <select value="" aria-label={punya.length ? 'Pindah ke cabang lain' : 'Tetapkan cabang'} onChange={e => e.target.value && onOp({ id: m.id, op: 'mds_cabang', cabang_id: e.target.value },
            punya.length ? { title: 'Pindahkan cabang MDS?', message: <><b>{m.nama}</b> hanya bisa memegang 1 cabang, jadi cabang lamanya akan dilepas.</> } : undefined)}>
            <option value="">Pilih cabang tujuan…</option>{bebasMds.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
          {punya.length > 0 && <small className="fhint">Cabang lama otomatis dilepas.</small>}
        </label>
      </div>}

      {m.role === 'rmdm' && <div className="accbody">
        <span className="label">Cabang yang dicover ({punya.length})</span>
        {punya.length > 0
          ? <ul className="lrows">{punya.map(c => <li className="lrow" key={c.id}>
              <span className="lrow-ic" aria-hidden="true"><Icon name="building" size={18} /></span><span className="lrow-tx"><b>{cb(c)}</b></span>
              {viewerRole === 'mdm' && <button type="button" className="lrow-act" aria-label={`Lepas ${c.kode}`} title={`Lepas ${cb(c)}`} onClick={() => onOp({ id: m.id, op: 'rmdm_remove', cabang_id: c.id })}>Lepas</button>}</li>)}</ul>
          : <p className="projempty">Belum mengcover cabang</p>}
        {viewerRole === 'mdm'
          ? <select className="addrow" value="" aria-label="Tambah cabang yang dicover" onChange={e => e.target.value && onOp({ id: m.id, op: 'rmdm_add', cabang_id: e.target.value })}>
              <option value="">+ Tambah cabang…</option>{bebasR.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
          : <span className="setnote"><Icon name="lock" size={13} /> Hanya MDM yang bisa mengatur cakupan RMDM.</span>}
      </div>}

      {adaAksi && <footer className="accfoot">
        {m.role === 'mds' && punya.length > 0 && <button className="ghost small" onClick={() => onOp({ id: m.id, op: 'mds_cabang', cabang_id: null }, { title: 'Lepas cabang dari MDS?', message: <>Cabang akan kosong sampai diberikan ke MDS lain.</> })}><Icon name="minus" size={16} /> Lepas cabang</button>}
        {bisaPaksa && <button className="ghost danger small" onClick={onPaksa}><Icon name="logout" size={16} /> Logout paksa</button>}
        {m.role !== 'mdm' && <button className="ghost danger small" onClick={onHapus}><Icon name="trash" size={16} /> Hapus</button>}
      </footer>}
    </article>
  )
}
