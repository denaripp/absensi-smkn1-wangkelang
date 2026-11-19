import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { buatSesiToken } from '@/lib/sesi-cookie'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 })
  }

  const password = String(body.password ?? '')
  if (password.length < 8) {
    return NextResponse.json({ error: 'password baru minimal 8 karakter' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'belum login' }, { status: 401 })

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return NextResponse.json({ error: 'gagal ganti sandi: ' + error.message }, { status: 400 })

  const admin = createAdminClient()
  const { data: profil, error: galatTandai } = await admin
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)
    .select('id, role, full_name, identifier')
    .single()
  if (galatTandai || !profil) {
    return NextResponse.json({ error: 'sandi tersimpan tapi status gagal diperbarui' }, { status: 500 })
  }

  const respons = NextResponse.json({ ok: true })
  const sesiToken = buatSesiToken({
    id: profil.id,
    role: profil.role,
    mustChange: false,
    nama: profil.full_name,
    nip: profil.identifier,
  })
  respons.cookies.set('app_session', sesiToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })

  return respons
}
