import { Suspense } from 'react'
import ShellGuru from '@/components/ShellGuru'

export default function LayoutGuru({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-teks-2">Memuat…</div>}>
      <ShellGuru>{children}</ShellGuru>
    </Suspense>
  )
}
