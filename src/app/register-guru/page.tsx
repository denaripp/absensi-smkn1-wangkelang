import Link from 'next/link'
import FormDaftarGuru from '@/components/FormDaftarGuru'

export default function HalamanDaftarGuru() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-bold text-[#111827]">Daftar Akun Guru</h1>
        <p className="mb-6 text-xs text-[#6B7280]">
          Wajib memakai kode rahasia sekolah. Kode tidak dikirim ke browser.
        </p>

        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.06)]">
          <FormDaftarGuru />
        </div>

        <p className="mt-4 text-center text-xs text-[#6B7280]">
          Sudah punya akun?{' '}
          <Link className="font-semibold text-[#111827] underline" href="/">
            Masuk
          </Link>
        </p>
      </div>
    </main>
  )
}
