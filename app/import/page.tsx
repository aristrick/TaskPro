'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import PageHead from '../../components/PageHead'
import { supabase } from '../../lib/supabase'
import { parseDmp, periksaFormatDmp, type Pemeriksaan } from '../../lib/dmp'
import PemeriksaanFormat from '../../components/import/PemeriksaanFormat'
import Icon from '../../components/Icon'

function Import() {
  const [cabang, setCabang] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [cid, setCid] = useState('')
  const [cek, setCek] = useState<Pemeriksaan | null>(null)    // hasil pemeriksaan format file
  const [namaFile, setNamaFile] = useState('')
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabang(data || [])) }, [])
  const kode = cabang.find(c => c.id === cid)?.kode

  async function unduhContoh() {
    if (!kode) return
    const [{ buatTemplateDmp }, { unduhBuffer }] = await Promise.all([import('../../lib/dmp-template'), import('../../lib/excel')])
    unduhBuffer(`Format_DMP_${kode}.xlsx`, await buatTemplateDmp(kode))
  }

  // Urutan pemeriksaan: jenis file, bisa dibaca, format kolom sesuai, baru isinya (baris demi baris). Yang gagal di tahap awal tidak diproses.
  async function pick(file: File) {
    setRes(null); setCek(null); setNamaFile(file.name); setMsg('Memeriksa file…')
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('File harus berformat .xlsx (Excel). Buka file di Excel, pilih Save As, lalu pilih Excel Workbook (.xlsx). File .xls dan .csv tidak diterima.')
      const { bacaXlsx } = await import('../../lib/excel')
      const sheets = await bacaXlsx(await file.arrayBuffer())
      const c = periksaFormatDmp(sheets); setCek(c)
      if (!c.ok) { setMsg(''); return }
      if (c.jumlahBaris === 0) { setMsg('Format sudah sesuai, tetapi belum ada baris data. Isi data outlet mulai baris di bawah judul kolom, lalu unggah lagi.'); return }
      const out = parseDmp(sheets.find(x => x.nama === c.sheet)!.baris, kode!)
      // buang yang sudah ada di database (halaman per 1000 baris)
      const have = new Set<string>()
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('outlets').select('src_id').eq('cabang_id', cid).not('src_id', 'is', null).range(from, from + 999)
        ;(data || []).forEach(x => have.add(x.src_id)); if (!data || data.length < 1000) break
      }
      const baru = out.valid.filter((v: any) => !have.has(v.src_id))
      setRes({ ...out, baru, sudahAda: out.valid.length - baru.length }); setMsg('')
    } catch (e: any) { setMsg(e.message) }
  }

  async function save() {
    setMsg('Menyimpan…')
    const rows = res.baru.map(({ _row, ...r }: any) => ({ ...r, cabang_id: cid }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('outlets').insert(rows.slice(i, i + 500))
      if (error) return setMsg(`Gagal di baris ke-${i + 1}: ${error.message}. Upload ulang aman: yang sudah tersimpan dilewati.`)
    }
    setMsg(`Selesai: ${rows.length} outlet tersimpan.`); setRes(null)
  }

  return (<>
    <PageHead title="Import DMP" desc="Unggah file DMP (.xlsx). Formatnya diperiksa dulu; outlet baru, duplikat, dan baris yang ditolak ditampilkan sebelum disimpan." />
    <section className="card" aria-label="Langkah 1: pilih cabang dan siapkan file">
      <div className="sech-in"><h3>1. Pilih cabang dan siapkan file</h3></div>
      <div className="row" style={{ margin: 0, alignItems: 'flex-end' }}>
        <label className="fld" style={{ margin: 0, minWidth: 220 }}><span className="label">Cabang tujuan</span>
          <select aria-label="Cabang tujuan impor" value={cid} onChange={e => { setCid(e.target.value); setRes(null); setCek(null); setMsg(''); setNamaFile('') }}>
            <option value="">Pilih cabang…</option>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}</select></label>
        <button className="ghost" disabled={!cid} onClick={unduhContoh}><Icon name="download" size={18} /> Unduh format contoh</button>
      </div>
      <p className="muted" style={{ margin: '12px 0 0', fontSize: 14 }}>{cid
        ? <>Format contoh berisi sheet <b>DMP</b> (kosong, isi di sini), <b>CONTOH</b> (pola pengisian), dan <b>PETUNJUK</b> (aturan tiap kolom). KODE MD harus diawali <b>{kode}-</b>.</>
        : 'Pilih cabang dulu agar format contoh memakai kode cabang yang benar.'}</p>
    </section>
    <section className="card" aria-label="Langkah 2: unggah file">
      <div className="sech-in"><h3>2. Unggah file</h3></div>
      <label className="fld" style={{ margin: 0 }}><span className="label">File DMP (.xlsx, maksimal 10 MB)</span>
        <input type="file" aria-label="File DMP (.xlsx)" accept=".xlsx" disabled={!cid} onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} /></label>
      {msg && <p className={msg.startsWith('Selesai') || msg.endsWith('…') ? 'muted' : 'err'} style={{ margin: '12px 0 0' }} role={msg.endsWith('…') ? undefined : 'alert'}>{msg}</p>}
      {cek && <div style={{ marginTop: 12 }}><PemeriksaanFormat cek={cek} namaFile={namaFile} onUnduh={unduhContoh} /></div>}
    </section>
    {res && <section className="card" aria-label="Langkah 3: tinjau dan simpan">
      <div className="sech-in"><h3>3. Tinjau dan simpan</h3></div>
      <p><b>{res.baru.length}</b> outlet siap disimpan · {res.sudahAda} sudah ada · {res.dupes.length} data ganda dilewati · <b>{res.rejected.length}</b> ditolak
        · {res.baru.filter((v: any) => v.lat === null).length} tanpa koordinat (tetap disimpan)</p>
      {[...res.rejected, ...res.dupes].length > 0 && <div className="scroll" style={{ maxHeight: 260 }}><table>
        <thead><tr><th>Baris Excel</th><th>Alasan</th></tr></thead>
        <tbody>{[...res.rejected, ...res.dupes].slice(0, 200).map((x: any, i: number) => <tr key={i}><td>{x.row}</td><td>{x.reason}</td></tr>)}</tbody>
      </table></div>}
      <div className="row" style={{ marginTop: 12 }}><button disabled={!res.baru.length} onClick={save}>Simpan {res.baru.length} outlet</button></div>
    </section>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Import /></Shell> }
