import { Suspense } from 'react'
import { connection } from 'next/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'
import ShellSiswa from '@/components/ShellSiswa'

// Isi layout dipisah ke komponen async dan dibungkus <Suspense>.
// Membaca fast-session cookie `app_session` agar tidak perlu roundtrip berulang ke Tokyo.
async function IsiSiswa({ children }: { children: React.ReactNode }) {
  await connection() // wajib: tandai layout ini request-time

  const jar = await cookies()
  const tokenSesi = jar.get('app_session')?.value
  const sesi = verifikasiSesiToken(tokenSesi)

  const admin = createAdminClient()
  let userId = sesi?.id

  if (!userId) {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kanvas p-4 md:p-8">
        <div className="w-full max-w-md rounded-2xl bg-kartu p-6 text-center shadow-bento">
          <h2 className="text-base font-bold text-teks-1">Sesi Masuk Telah Berakhir</h2>
          <p className="mt-2 text-xs text-teks-2">
            Silakan login kembali untuk mengakses portal presensi siswa.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-aksen px-5 py-2.5 text-xs font-bold text-gelap hover:brightness-105"
          >
            Kembali ke Halaman Login
          </Link>
        </div>
      </div>
    )
  }

  const { data: profil } = await admin
    .from('users')
    .select('full_name, identifier, class_id, device_lock_id')
    .eq('id', userId)
    .maybeSingle()

  const { data: kelas } = profil?.class_id
    ? await admin.from('classes').select('class_name').eq('id', profil.class_id).maybeSingle()
    : { data: null }

  return (
    <ShellSiswa
      nama={profil?.full_name ?? sesi?.nama ?? 'Siswa'}
      nisn={profil?.identifier ?? sesi?.nip ?? '-'}
      kelas={kelas?.class_name ?? '-'}
      terkunci={Boolean(profil?.device_lock_id)}
    >
      {children}
    </ShellSiswa>
  )
}

export default function LayoutSiswa({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-teks-2">Memuat…</div>}>
      <IsiSiswa>{children}</IsiSiswa>
    </Suspense>
  )
}
