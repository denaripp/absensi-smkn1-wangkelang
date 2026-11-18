import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import ShellSiswa from '@/components/ShellSiswa'

export default async function LayoutSiswa({ children }: { children: React.ReactNode }) {
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
