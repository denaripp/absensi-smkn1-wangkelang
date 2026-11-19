import { connection } from 'next/server'
import Link from 'next/link'
import FormMasuk from '@/components/FormMasuk'

export const instant = false

export default async function HalamanMasuk() {
  await connection()

  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#8CE827] text-lg font-black text-[#0F172A]">
            SM
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#111827]">Absensi SMK Negeri 1 Wangkelang</h1>
            <p className="text-xs text-[#6B7280]">Pilih peran Anda untuk masuk ke sistem</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.06)]">
          <FormMasuk />
        </div>

        <p className="mt-4 text-center text-xs text-[#6B7280]">
          Guru belum memiliki akun?{' '}
          <Link className="font-semibold text-[#111827] underline" href="/register-guru">
            Daftar menggunakan kode sekolah
          </Link>
        </p>
      </div>
    </main>
  )
}
