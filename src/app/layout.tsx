import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: 'Absensi SMK Negeri 1 Wangkelang',
  description: 'Sistem absensi siswa berbasis QR dinamis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
