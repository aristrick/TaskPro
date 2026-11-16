'use client'
import PilihanOpsi, { OPSI_JAWAB } from './PilihanOpsi'
import type { Butir, JawabanMap } from '../../lib/otj-template'

// Daftar butir penilaian dengan tombol Ya / Tidak / N/A. Judul subbagian muncul saat berganti subbagian.
export default function ChecklistOtj({ butir, jawab, onJawab }: { butir: Butir[]; jawab: JawabanMap; onJawab: (id: string, v: string) => void }) {
  let sub: string | null = null
  return (
    <div>
      {butir.map(b => {
        const judul = b.subTitle !== sub && b.subTitle ? <p className="tg-sub">{b.subTitle}</p> : null
        sub = b.subTitle
        return (
          <div key={b.id}>{judul}
            <div className="tg-ceklis"><span>{b.label}</span>
              <PilihanOpsi label={b.label} nilai={jawab[b.id] as 'Ya' | 'Tidak' | 'N/A' | undefined} opsi={OPSI_JAWAB} onPilih={v => onJawab(b.id, v)} /></div>
          </div>)
      })}
    </div>)
}
