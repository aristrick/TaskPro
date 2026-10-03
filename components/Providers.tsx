'use client'
import DialogProvider from './Dialog'
import NetBar from './NetBar'
import OnlineBanner from './OnlineBanner'
import ErrorReporter from './ErrorReporter'
import SwRegister from './SwRegister'
export default function Providers({ children }: { children: React.ReactNode }) {
  return <DialogProvider><NetBar /><OnlineBanner /><ErrorReporter /><SwRegister />{children}</DialogProvider>
}
