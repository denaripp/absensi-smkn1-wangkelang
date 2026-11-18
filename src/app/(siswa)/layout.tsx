import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import ShellSiswa from '@/components/ShellSiswa'

// Isi layout dipisah ke komponen async dan dibungkus <Suspense>.
// Tanpa boundary ini, `cacheComponents` mencoba memprerender layout (yang membaca
// cookie lewat Supabase Auth, dan auth-js memanggil Date.now()) lalu build/dev
// gagal: 'Route "/siswa": unstable value Date.now() while prerendering'.
// Pola sama dipakai di (guru)/layout.tsx.
async function IsiSiswa({ children }: { children: React.ReactNode }) {
  await connection() // wajib: tandai layout ini request-time sebelum auth-js memanggil Date.now()
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: profil } = await supabase
    .from('users')
    .select('full_name, identifier, class_id, device_lock_id')
    .eq('id', user.id)
    .maybeSingle()

  const { data: kelas } = profil?.class_id
    ? await supabase.from('classes').select('class_name').eq('id', profil.class_id).maybeSingle()
    : { data: null }

  return (
    <ShellSiswa
      nama={profil?.full_name ?? 'Siswa'}
      nisn={profil?.identifier ?? '-'}
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
