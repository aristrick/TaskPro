import { useId } from 'react'
import { LOGO } from '../lib/logo'

// Logo TaskPro (vektor). Warna "Task" diatur lewat --logo-task (putih di sidebar gelap), "Pro" dan ikon selalu teal.
// animated: gir berputar lalu centang tergambar dari kiri ke kanan, berulang. Tanpa animasi jika perangkat meminta gerak dikurangi.
export function Logo({ className = '', animated = false, label = 'TaskPro' }: { className?: string; animated?: boolean; label?: string }) {
  const id = useId().replace(/:/g, ''), [cx0, cy0, cx1, cy1] = LOGO.checkBox
  return (
    <svg className={`logo-svg ${animated ? 'anim' : ''} ${className}`} viewBox={`0 0 ${LOGO.w} ${LOGO.h}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id={`wipe-${id}`}><rect className="lg-wipe" x={cx0 - 4} y={cy0 - 4} width={cx1 - cx0 + 8} height={cy1 - cy0 + 8} /></clipPath></defs>
      <path className="lg-task" fillRule="evenodd" d={LOGO.task} />
      <path className="lg-pro" fillRule="evenodd" d={LOGO.pro} />
      <path className="lg-gear" fillRule="evenodd" d={LOGO.gear} />
      <g clipPath={`url(#wipe-${id})`}><path className="lg-check" fillRule="evenodd" d={LOGO.check} /></g>
    </svg>)
}

// Hanya ikon gir dan centang (untuk ruang sempit seperti ikon aplikasi).
export function LogoMark({ className = '', animated = false, label = 'TaskPro' }: { className?: string; animated?: boolean; label?: string }) {
  const id = useId().replace(/:/g, ''), [gx0, gy0, gx1, gy1] = LOGO.gearBox, [cx0, cy0, cx1, cy1] = LOGO.checkBox, p = 6
  return (
    <svg className={`logo-svg mark ${animated ? 'anim' : ''} ${className}`} viewBox={`${gx0 - p} ${gy0 - p} ${gx1 - gx0 + 2 * p} ${gy1 - gy0 + 2 * p}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id={`wipe-${id}`}><rect className="lg-wipe" x={cx0 - 4} y={cy0 - 4} width={cx1 - cx0 + 8} height={cy1 - cy0 + 8} /></clipPath></defs>
      <path className="lg-gear" fillRule="evenodd" d={LOGO.gear} />
      <g clipPath={`url(#wipe-${id})`}><path className="lg-check" fillRule="evenodd" d={LOGO.check} /></g>
    </svg>)
}
