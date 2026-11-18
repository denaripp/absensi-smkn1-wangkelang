import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Absensi SMK Negeri 1 Wangkelang',
  description: 'Sistem absensi siswa berbasis QR dinamis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
