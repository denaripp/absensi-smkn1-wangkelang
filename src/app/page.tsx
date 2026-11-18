import { connection } from 'next/server'

export const instant = false

export default async function HalamanMasuk() {
  await connection()

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Sistem Absensi SMK Negeri 1 Wangkelang</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Fondasi proyek siap. Halaman login dibangun pada Batch 4.
        </p>
      </div>
    </main>
  )
}
