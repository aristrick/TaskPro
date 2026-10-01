'use client'
import DialogProvider from './Dialog'
import NetBar from './NetBar'
export default function Providers({ children }: { children: React.ReactNode }) { return <DialogProvider><NetBar />{children}</DialogProvider> }
