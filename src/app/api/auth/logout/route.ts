import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

async function keluar() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
}

export async function POST() {
  await keluar()
  return NextResponse.json({ ok: true })
}

// Dipakai proxy saat profil tidak ditemukan: redirect GET, bukan fetch.
export async function GET(request: Request) {
  await keluar()
  return NextResponse.redirect(new URL('/', request.url))
}
