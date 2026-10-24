'use client'
import { useEffect, useState } from 'react'
import Shell from '../../components/Shell'
import PageHead from '../../components/PageHead'
import { supabase } from '../../lib/supabase'
import { parseDmp } from '../../lib/dmp'

function Import() {
  const [cabang, setCabang] = useState<any[]>([])
  const [cid, setCid] = useState('')
  const [res, setRes] = useState<any>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('cabang').select('id,kode,nama').order('kode').then(({ data }) => setCabang(data || [])) }, [])
  const kode = cabang.find(c => c.id === cid)?.kode

  async function pick(file: File) {
    setRes(null); setMsg('Membaca file…')
    try {
      const { bacaXlsx } = await import('../../lib/excel')
      const sheets = await bacaXlsx(await file.arrayBuffer())
      let out: any = null, lastErr = ''
      for (const sh of sheets) {
        try { out = parseDmp(sh.baris, kode!); break }
        catch (e: any) { lastErr = e.message }
      }
      if (!out) throw new Error(lastErr)
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
    <PageHead title="Import DMP" desc="Unggah file DMP (.xlsx). Outlet baru, duplikat, dan baris yang ditolak ditampilkan dulu sebelum disimpan." />
    <div className="row">
      <select value={cid} onChange={e => { setCid(e.target.value); setRes(null) }}>
        <option value="">Pilih cabang…</option>{cabang.map(c => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}
      </select>
      <input type="file" accept=".xlsx" disabled={!cid} onChange={e => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
    {msg && <p className={msg.startsWith('Selesai') || msg.endsWith('…') ? 'muted' : 'err'}>{msg}</p>}
    {res && <div className="card">
      <p><b>{res.baru.length}</b> outlet siap disimpan · {res.sudahAda} sudah ada · {res.dupes.length} data ganda dilewati · <b>{res.rejected.length}</b> ditolak
        · {res.baru.filter((v: any) => v.lat === null).length} tanpa koordinat (tetap disimpan)</p>
      {[...res.rejected, ...res.dupes].length > 0 && <div className="scroll" style={{ maxHeight: 260 }}><table>
        <thead><tr><th>Baris Excel</th><th>Alasan</th></tr></thead>
        <tbody>{[...res.rejected, ...res.dupes].slice(0, 200).map((x: any, i: number) => <tr key={i}><td>{x.row}</td><td>{x.reason}</td></tr>)}</tbody>
      </table></div>}
      <div className="row" style={{ marginTop: 12 }}><button disabled={!res.baru.length} onClick={save}>Simpan {res.baru.length} outlet</button></div>
    </div>}
  </>)
}
export default function Page() { return <Shell roles={['mds', 'mdm', 'rmdm']}><Import /></Shell> }
