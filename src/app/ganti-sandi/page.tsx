import FormGantiSandi from '@/components/FormGantiSandi'

export default function HalamanGantiSandi() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-bold text-[#111827]">Ganti Sandi</h1>
        <p className="mb-6 text-xs text-[#6B7280]">
          Sandi awal sama dengan NISN/NIP. Ganti dulu sebelum memakai sistem.
        </p>

        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.06)]">
          <FormGantiSandi />
        </div>
      </div>
    </main>
  )
}
