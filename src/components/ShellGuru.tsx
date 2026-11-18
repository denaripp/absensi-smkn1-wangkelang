import { connection } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { tanggalPanjangWIB } from '@/lib/format'
import Dock from '@/components/Dock'
import TopBar from '@/components/TopBar'

export default async function ShellGuru({ children }: { children: React.ReactNode }) {
  await connection() // wajib: layout request-time; auth-js + tanggalPanjangWIB memakai jam
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profil } = user
    ? await supabase
        .from('users')
        .select('full_name, identifier')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  return (
    <div className="min-h-screen bg-kanvas p-3 md:p-6">
      <div className="mx-auto flex max-w-[1400px] gap-3 md:gap-4">
        <Dock />
        <div className="min-w-0 flex-1">
          <TopBar
            nama={profil?.full_name ?? 'Guru'}
            nip={profil?.identifier ?? '-'}
            tanggal={tanggalPanjangWIB(new Date())}
          />
          <main className="mt-3 md:mt-4">{children}</main>
          <p className="mt-6 pb-2 text-xs text-teks-2">Sistem Absensi: SMK Negeri 1 Wangkelang</p>
        </div>
      </div>
    </div>
  )
}
