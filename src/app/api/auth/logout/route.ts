import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

async function keluar() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
}

export async function POST() {
  await keluar()
  const respons = NextResponse.json({ ok: true })
  respons.cookies.set('app_session', '', { maxAge: 0, path: '/' })
  return respons
}

// Dipakai proxy saat profil tidak ditemukan: redirect GET, bukan fetch.
export async function GET(request: Request) {
  await keluar()
  const respons = NextResponse.redirect(new URL('/', request.url))
  respons.cookies.set('app_session', '', { maxAge: 0, path: '/' })
  return respons
}
