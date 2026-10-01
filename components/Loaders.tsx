// Indikator loading yang konsisten: spinner, layar pemuatan, dan kerangka (skeleton) daftar.
export const Spinner = ({ size = 20 }: { size?: number }) => <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Memuat" />
export const PageLoader = ({ text = 'Memuat…' }: { text?: string }) => (
  <div className="pageload" role="status"><span className="spinner lg" /><span>{text}</span></div>)
export const SkelRows = ({ n = 5 }: { n?: number }) => (
  <div aria-busy="true" aria-label="Memuat daftar">{Array.from({ length: n }, (_, i) =>
    <div className="skrow" key={i} style={{ animationDelay: `${i * 60}ms` }}>
      <span className="skel" style={{ width: 52, height: 52, borderRadius: '50%', flex: 'none' }} />
      <div className="grow"><span className="skel" style={{ display: 'block', width: `${55 + (i % 3) * 12}%`, height: 14 }} />
        <span className="skel" style={{ display: 'block', width: `${82 - (i % 2) * 18}%`, height: 12, marginTop: 9 }} /></div></div>)}</div>)
