import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export type Peran = 'GURU' | 'SISWA'

export type Profil = {
  id: string
  identifier: string
  full_name: string
  role: Peran
  class_id: string | null
  must_change_password: boolean
}

export type HasilAuth = { profil: Profil; galat: null } | { profil: null; galat: NextResponse }

// Dipakai route handler: satu baris di awal fungsi, sisanya bebas dari cek auth berulang.
export async function requireRole(peran: Peran): Promise<HasilAuth> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { profil: null, galat: NextResponse.json({ error: 'belum login' }, { status: 401 }) }
  }

  const { data } = await supabase
    .from('users')
    .select('id, identifier, full_name, role, class_id, must_change_password')
    .eq('id', user.id)
    .single()

  if (!data) {
    return { profil: null, galat: NextResponse.json({ error: 'profil tidak ditemukan' }, { status: 403 }) }
  }
  if (data.role !== peran) {
    return { profil: null, galat: NextResponse.json({ error: 'akses ditolak' }, { status: 403 }) }
  }

  return { profil: data as Profil, galat: null }
}
