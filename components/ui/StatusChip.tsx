// Status berupa chip berwarna lembut (aktif = teal, tidak aktif = abu, peringatan = kuning).
export default function StatusChip({ tone = 'off', children, title }: { tone?: 'on' | 'off' | 'warn' | 'bad'; children: React.ReactNode; title?: string }) {
  return <span className={`schip ${tone}`} title={title}><i aria-hidden="true" />{children}</span>
}
