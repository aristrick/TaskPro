import Icon from '../Icon'
import { inisial } from '../mds/AkunCard'
import Combobox, { type Opsi } from '../Combobox'

export type Fl = { id: string; user_id: string; nama: string; project_id: string | null }
export type Prod = { id: string; product: string }
export type Proj = { id: string; name: string }

// Daftar pilihan untuk kolom tambah. Frontliner yang sudah di project ini tidak ditawarkan lagi; produk yang sudah fokus juga tidak.
export const opsiFrontliner = (lainnya: Fl[], namaProject: (id: string) => string | undefined): Opsi[] =>
  lainnya.map(f => ({ value: f.id, label: f.nama, sub: `${f.user_id}${f.project_id ? ` · sekarang di ${namaProject(f.project_id)}` : ' · belum punya project'}` }))
export const opsiFokus = (prods: Prod[], fokus: string[]): Opsi[] => prods.filter(x => !fokus.includes(x.id)).map(x => ({ value: x.id, label: x.product }))

// Kartu satu project. Dua kolom sejajar: siapa anggotanya (kiri) dan produk fokusnya (kanan). Tiap kolom: judul, isi, lalu satu aksi tambah.
export default function ProjectCard({ p, anggota, lainnya, fokus, prods, sumber, namaProject, onGanti, onHapus, onAnggota, onTambahFokus, onLepasFokus, onSalin }: {
  p: Proj; anggota: Fl[]; lainnya: Fl[]; fokus: string[]; prods: Prod[]; sumber: Proj[]; namaProject: (id: string) => string | undefined
  onGanti: () => void; onHapus: () => void; onAnggota: (fid: string, pid: string | null) => void
  onTambahFokus: (prod: string) => void; onLepasFokus: (prod: string) => void; onSalin: (from: string) => void }) {
  const pn = (id: string) => prods.find(x => x.id === id)?.product || '-'
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
          <div className="projsech"><h4 className="projsh"><Icon name="users" size={16} /> Frontliner <span className="cnt">{anggota.length}</span></h4></div>
          {anggota.length > 0
            ? <ul className="lrows">{anggota.map(f => <li className="lrow" key={f.id}>
                <span className="lrow-ic" aria-hidden="true">{inisial(f.nama)}</span>
                <span className="lrow-tx"><b>{f.nama}</b><small>{f.user_id}</small></span>
                <button type="button" className="lrow-act" aria-label={`Keluarkan ${f.nama} dari project`} title="Keluarkan dari project" onClick={() => onAnggota(f.id, null)}>Keluarkan</button></li>)}</ul>
            : <p className="projempty">Belum ada frontliner di project ini.</p>}
          <Combobox label="Tambah frontliner" placeholder="+ Tambah frontliner… (ketik untuk mencari)" kosong="Tidak ada frontliner lain di cabang ini" onPilih={fid => onAnggota(fid, p.id)}
            opsi={opsiFrontliner(lainnya, namaProject)} />
        </section>

        <section className="projsec" aria-label="Produk fokus">
          <div className="projsech"><h4 className="projsh"><Icon name="box" size={16} /> Produk fokus <span className="cnt">{fokus.length}</span></h4>
            {sumber.length > 0 && <select className="addsel quiet" value="" aria-label="Salin produk fokus" onChange={e => e.target.value && onSalin(e.target.value)}>
              <option value="">Salin dari project lain…</option>{sumber.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</div>
          {fokus.length > 0
            ? <ul className="lrows">{fokus.map(x => <li className="lrow" key={x}>
                <span className="lrow-ic" aria-hidden="true"><Icon name="box" size={18} /></span>
                <span className="lrow-tx"><b>{pn(x)}</b></span>
                <button type="button" className="lrow-act" aria-label={`Lepas ${pn(x)} dari fokus`} title="Lepas dari fokus" onClick={() => onLepasFokus(x)}>Lepas</button></li>)}</ul>
            : <p className="projempty">Belum ada produk fokus.</p>}
          <Combobox label="Tambah produk fokus" placeholder="+ Tambah produk fokus… (ketik untuk mencari)" kosong="Semua produk sudah jadi fokus" onPilih={onTambahFokus}
            opsi={opsiFokus(prods, fokus)} />
        </section>
      </div>
    </article>)
}
