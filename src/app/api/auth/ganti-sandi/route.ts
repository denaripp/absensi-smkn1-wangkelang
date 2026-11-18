import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

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
  const { error: galatTandai } = await admin
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)
  if (galatTandai) {
    return NextResponse.json({ error: 'sandi tersimpan tapi status gagal diperbarui' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
