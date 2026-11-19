import FormGantiSandi from '@/components/FormGantiSandi'

export default function HalamanGantiSandi() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-bold text-[#111827]">Perbarui Kata Sandi</h1>
        <p className="mb-6 text-xs text-[#6B7280]">
          Kata sandi awal Anda sama dengan nomor NISN/NIP. Silakan buat kata sandi baru demi keamanan akun Anda.
        </p>

        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.06)]">
          <FormGantiSandi />
        </div>
      </div>
    </main>
  )
}
