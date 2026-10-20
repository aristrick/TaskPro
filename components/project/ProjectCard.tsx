import Icon from '../Icon'
import { inisial } from '../mds/AkunCard'

export type Fl = { id: string; user_id: string; nama: string; project_id: string | null }
export type Prod = { id: string; product: string }
export type Proj = { id: string; name: string }

// Kartu satu project. Dua kolom sejajar: siapa anggotanya (kiri) dan produk fokusnya (kanan). Tiap kolom: judul, isi, lalu satu aksi tambah.
export default function ProjectCard({ p, anggota, lainnya, fokus, prods, sumber, namaProject, onGanti, onHapus, onAnggota, onTambahFokus, onLepasFokus, onSalin }: {
  p: Proj; anggota: Fl[]; lainnya: Fl[]; fokus: string[]; prods: Prod[]; sumber: Proj[]; namaProject: (id: string) => string | undefined
  onGanti: () => void; onHapus: () => void; onAnggota: (fid: string, pid: string | null) => void
  onTambahFokus: (prod: string) => void; onLepasFokus: (prod: string) => void; onSalin: (from: string) => void }) {
  const pn = (id: string) => prods.find(x => x.id === id)?.product || '-'
  const sisa = prods.filter(x => !fokus.includes(x.id))
  return (
    <article className="proj" aria-label={`Project ${p.name}`}>
      <header className="projh">
        <div className="projt"><h3>{p.name}</h3><p className="projmeta">{anggota.length} frontliner · {fokus.length} produk fokus</p></div>
        <div className="projact">
          <button className="ghost small" onClick={onGanti}><Icon name="edit" size={16} /> Ganti nama</button>
          <button className="ghost danger small" onClick={onHapus}><Icon name="trash" size={16} /> Hapus</button>
        </div>
      </header>

      <div className="projgrid">
        <section className="projsec" aria-label="Frontliner">
          <h4 className="projsh"><Icon name="users" size={16} /> Frontliner <span className="cnt">{anggota.length}</span></h4>
          {anggota.length > 0
            ? <ul className="tags">{anggota.map(f => <li className="tag" key={f.id}>
                <span className="tagav" aria-hidden="true">{inisial(f.nama)}</span>
                <span className="tagtx"><b>{f.nama}</b><small>{f.user_id}</small></span>
                <button type="button" className="tagx" aria-label={`Keluarkan ${f.nama} dari project`} title="Keluarkan dari project" onClick={() => onAnggota(f.id, null)}><Icon name="close" size={12} /></button></li>)}</ul>
            : <p className="projempty">Belum ada frontliner di project ini.</p>}
          <select className="addsel" value="" aria-label="Tambah frontliner" onChange={e => e.target.value && onAnggota(e.target.value, p.id)}>
            <option value="">+ Tambah frontliner…</option>
            {lainnya.map(f => <option key={f.id} value={f.id}>{f.user_id} · {f.nama}{f.project_id ? ` (dari ${namaProject(f.project_id)})` : ''}</option>)}</select>
        </section>

        <section className="projsec" aria-label="Produk fokus">
          <h4 className="projsh"><Icon name="box" size={16} /> Produk fokus <span className="cnt">{fokus.length}</span></h4>
          {fokus.length > 0
            ? <ul className="tags">{fokus.map(x => <li className="tag prod" key={x}>
                <span className="tagtx"><b>{pn(x)}</b></span>
                <button type="button" className="tagx" aria-label={`Lepas ${pn(x)} dari fokus`} title="Lepas dari fokus" onClick={() => onLepasFokus(x)}><Icon name="close" size={12} /></button></li>)}</ul>
            : <p className="projempty">Belum ada produk fokus.</p>}
          <div className="accctl">
            <select className="addsel" value="" aria-label="Tambah produk fokus" onChange={e => e.target.value && onTambahFokus(e.target.value)}>
              <option value="">+ Tambah produk fokus…</option>{sisa.map(x => <option key={x.id} value={x.id}>{x.product}</option>)}</select>
            {sumber.length > 0 && <select className="addsel quiet" value="" aria-label="Salin produk fokus" onChange={e => e.target.value && onSalin(e.target.value)}>
              <option value="">Salin dari project lain…</option>{sumber.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          </div>
        </section>
      </div>
    </article>)
}
