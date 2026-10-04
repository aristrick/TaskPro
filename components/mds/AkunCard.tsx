import type { ReactNode } from 'react'
import Icon from '../Icon'

export type Cabang = { id: string; kode: string; nama: string; mds_id: string | null; rmdm_id: string | null }
export type Akun = { id: string; user_id: string; nama: string; role: 'mds' | 'rmdm' | 'mdm' }
export type Konfirmasi = { title: string; message: ReactNode }
export type Op = (body: Record<string, unknown>, konfirmasi?: Konfirmasi) => void

export const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'
const cb = (c: Cabang) => `${c.kode} ${c.nama}`

// Kartu satu akun MDS/RMDM/MDM: identitas, status sesi, cabang yang dipegang/dicover, dan aksinya.
export default function AkunCard({ m, cabang, bebasMds, bebasR, viewerRole, status, bisaPaksa, onHapus, onPaksa, onOp }: {
  m: Akun; cabang: Cabang[]; bebasMds: Cabang[]; bebasR: Cabang[]; viewerRole: string; status: ReactNode; bisaPaksa: boolean
  onHapus: () => void; onPaksa: () => void; onOp: Op }) {
  const punya = cabang.filter(c => (m.role === 'mds' ? c.mds_id : c.rmdm_id) === m.id)
  return (
    <article className="acc">
      <header className="acch">
        <span className={`avt ${m.role}`} aria-hidden="true">{inisial(m.nama)}</span>
        <div className="accid">
          <div className="accname"><b>{m.nama}</b><span className={`rb ${m.role}`}>{m.role.toUpperCase()}</span></div>
          <div className="accsub"><span className="uid">{m.user_id}</span>{status}</div>
        </div>
        <div className="accact">
          {bisaPaksa && <button className="ghost danger small" onClick={onPaksa}><Icon name="logout" size={16} /> Logout paksa</button>}
          {m.role !== 'mdm' && <button className="ghost danger small" onClick={onHapus}><Icon name="trash" size={16} /> Hapus</button>}
        </div>
      </header>

      {m.role === 'mds' && <div className="accbody">
        <span className="label">Cabang yang dipegang</span>
        <div className="row" style={{ marginBottom: 0 }}>
          {punya.map(c => <span className="chip" key={c.id}>{cb(c)}</span>)}
          {punya.length === 0 && <span className="err" style={{ fontSize: 13 }}>Belum punya cabang</span>}
          <select value="" aria-label="Atur cabang MDS" onChange={e => e.target.value && onOp({ id: m.id, op: 'mds_cabang', cabang_id: e.target.value },
            punya.length ? { title: 'Pindahkan cabang MDS?', message: <><b>{m.nama}</b> hanya bisa memegang 1 cabang, jadi cabang lamanya akan dilepas.</> } : undefined)}>
            <option value="">{punya.length ? 'Pindah ke cabang…' : 'Pilih cabang…'}</option>{bebasMds.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
          {punya.length > 0 && <button className="ghost small" onClick={() => onOp({ id: m.id, op: 'mds_cabang', cabang_id: null }, { title: 'Lepas cabang dari MDS?', message: <>Cabang akan kosong sampai diberikan ke MDS lain.</> })}>Lepas cabang</button>}
        </div>
      </div>}

      {m.role === 'rmdm' && <div className="accbody">
        <span className="label">Cabang yang dicover ({punya.length})</span>
        <div className="row" style={{ marginBottom: 0 }}>
          {punya.map(c => <span className="chip" key={c.id}>{cb(c)}{viewerRole === 'mdm' &&
            <button className="chipx" aria-label={`Lepas ${c.kode}`} onClick={() => onOp({ id: m.id, op: 'rmdm_remove', cabang_id: c.id })}><Icon name="close" size={12} /></button>}</span>)}
          {punya.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Belum mengcover cabang</span>}
          {viewerRole === 'mdm'
            ? <select value="" aria-label="Tambah cabang yang dicover" onChange={e => e.target.value && onOp({ id: m.id, op: 'rmdm_add', cabang_id: e.target.value })}>
                <option value="">+ Tambah cabang yang dicover…</option>{bebasR.map(c => <option key={c.id} value={c.id}>{cb(c)}</option>)}</select>
            : <span className="setnote"><Icon name="lock" size={13} /> Hanya MDM yang bisa mengatur cakupan RMDM.</span>}
        </div>
      </div>}
    </article>
  )
}
