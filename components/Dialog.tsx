'use client'
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import Icon from './Icon'

// Pop up milik aplikasi (pengganti confirm/alert/prompt bawaan browser). Semua berbasis Promise:
//   if (await dlg.confirm({ title: 'Hapus?' })) { ... }
type Tone = 'default' | 'danger' | 'ok'
type Base = { title: string; message?: React.ReactNode; icon?: string; tone?: Tone; okText?: string; cancelText?: string }
export type Field = { key: string; label: string; value?: string; placeholder?: string; inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' }
type Item = Base & { kind: 'confirm' | 'alert' | 'form'; fields?: Field[]; resolve: (v: any) => void }
type Api = {
  confirm: (o: Base) => Promise<boolean>
  alert: (o: Base) => Promise<void>
  form: (o: Base & { fields: Field[] }) => Promise<Record<string, string> | null>
}
const Ctx = createContext<Api | null>(null)
export const useDialog = () => { const c = useContext(Ctx); if (!c) throw new Error('DialogProvider belum dipasang'); return c }

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Item[]>([])
  const [leaving, setLeaving] = useState(false)
  const push = useCallback((i: Omit<Item, 'resolve'>) => new Promise<any>(resolve => setQueue(q => [...q, { ...i, resolve } as Item])), [])
  const api = useRef<Api>({
    confirm: o => push({ ...o, kind: 'confirm' }),
    alert: o => push({ ...o, kind: 'alert' }),
    form: o => push({ ...o, kind: 'form' }),
  }).current
  const cur = queue[0]
  const done = (v: any) => {
    if (!cur) return
    setLeaving(true)
    setTimeout(() => { cur.resolve(v); setQueue(q => q.slice(1)); setLeaving(false) }, 150)
  }
  return <Ctx.Provider value={api}>{children}{cur && <Sheet key={queue.length + cur.title} item={cur} leaving={leaving} done={done} />}</Ctx.Provider>
}

function Sheet({ item, leaving, done }: { item: Item; leaving: boolean; done: (v: any) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries((item.fields || []).map(f => [f.key, f.value ?? ''])))
  const box = useRef<HTMLDivElement>(null)
  const back = useRef<Element | null>(null)
  const tone = item.tone || 'default'
  const icon = item.icon || (tone === 'danger' ? 'trash' : tone === 'ok' ? 'check' : item.kind === 'alert' ? 'info' : 'info')
  const cancel = () => done(item.kind === 'confirm' ? false : item.kind === 'form' ? null : undefined)
  const ok = () => done(item.kind === 'confirm' ? true : item.kind === 'form' ? vals : undefined)
  useEffect(() => {
    back.current = document.activeElement
    const el = box.current?.querySelector<HTMLElement>('input') || box.current?.querySelector<HTMLElement>('button.primary')
    el?.focus()
    return () => { (back.current as HTMLElement | null)?.focus?.() }
  }, [])
  function key(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); cancel() }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') ok()
    else if (e.key === 'Tab') {   // fokus tidak keluar dari dialog
      const f = Array.from(box.current!.querySelectorAll<HTMLElement>('button,input')).filter(x => !(x as any).disabled)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const ttl = 'dlg-t' + item.title.length
  return (
    <div className={`overlay ${leaving ? 'out' : ''}`} onMouseDown={e => e.target === e.currentTarget && item.kind !== 'form' && cancel()} onKeyDown={key}>
      <div className={`dialog ${item.kind === 'form' ? 'left' : ''}`} role={item.kind === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={ttl} ref={box}>
        {item.kind !== 'form' && <div className={`dicon ${tone}`}><Icon name={icon} size={28} /></div>}
        <h3 id={ttl}>{item.title}</h3>
        {item.message && <p>{item.message}</p>}
        {item.kind === 'form' && (item.fields || []).map(f => <label className="fld" key={f.key}><span className="label">{f.label}</span>
          <input value={vals[f.key]} placeholder={f.placeholder} inputMode={f.inputMode} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} /></label>)}
        <div className="dbtns">
          {item.kind !== 'alert' && <button className="ghost" onClick={cancel}>{item.cancelText || 'Batal'}</button>}
          <button className={`primary ${tone === 'danger' ? 'dangerfill' : ''}`} onClick={ok}>{item.okText || (item.kind === 'alert' ? 'Mengerti' : item.kind === 'form' ? 'Simpan' : 'OK')}</button>
        </div>
      </div>
    </div>)
}
