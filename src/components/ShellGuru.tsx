import { connection } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabase } from '@/lib/supabase/server'
import { tanggalPanjangWIB } from '@/lib/format'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'
import Dock from '@/components/Dock'
import TopBar from '@/components/TopBar'

export default async function ShellGuru({ children }: { children: React.ReactNode }) {
  await connection() // wajib: layout request-time; auth-js + tanggalPanjangWIB memakai jam

  const jar = await cookies()
  const tokenSesi = jar.get('app_session')?.value
  const sesi = verifikasiSesiToken(tokenSesi)

  let nama = sesi?.nama ?? ''
  let nip = sesi?.nip ?? ''

  // Fallback hanya jika app_session belum terbentuk
  if (!nama || !nip) {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profil } = await supabase
        .from('users')
        .select('full_name, identifier')
        .eq('id', user.id)
        .maybeSingle()
      nama = profil?.full_name ?? 'Guru'
      nip = profil?.identifier ?? '-'
    }
  }

  return (
    <div className="min-h-screen bg-kanvas p-3 md:p-6">
      <div className="mx-auto flex max-w-[1400px] gap-3 md:gap-4">
        <Dock />
        <div className="min-w-0 flex-1">
          <TopBar
            nama={nama || 'Guru'}
            nip={nip || '-'}
            tanggal={tanggalPanjangWIB(new Date())}
          />
          <main className="mt-3 md:mt-4">{children}</main>
          <p className="mt-6 pb-2 text-xs text-teks-2">Sistem Absensi: SMK Negeri 1 Wangkelang</p>
        </div>
      </div>
    </div>
  )
}
