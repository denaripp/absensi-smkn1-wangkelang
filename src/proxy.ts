import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'

const PUBLIK = ['/', '/register-guru']

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const jalur = request.nextUrl.pathname

  // Route handler mengurus auth sendiri (dan butuh mengembalikan JSON 401, bukan redirect 307).
  if (jalur.startsWith('/api')) return response

  const publik = PUBLIK.includes(jalur)

  // 1. FAST PATH (<0.2ms, zero network roundtrip): Validasi signed cookie app_session
  const tokenSesi = request.cookies.get('app_session')?.value
  const sesi = verifikasiSesiToken(tokenSesi)

  if (sesi) {
    if (sesi.mustChange && jalur !== '/ganti-sandi') {
      return NextResponse.redirect(new URL('/ganti-sandi', request.url))
    }

    const rumah = sesi.role === 'GURU' ? '/guru' : '/siswa'

    if (publik || jalur === '/ganti-sandi') {
      if (jalur === '/ganti-sandi' && sesi.mustChange) return response
      return NextResponse.redirect(new URL(rumah, request.url))
    }

    if (sesi.role === 'GURU' && jalur.startsWith('/siswa')) {
      return NextResponse.redirect(new URL('/guru', request.url))
    }
    if (sesi.role === 'SISWA' && jalur.startsWith('/guru')) {
      return NextResponse.redirect(new URL('/siswa', request.url))
    }

    return response
  }

  // 2. FALLBACK PATH: Membaca auth Supabase jika app_session belum terbentuk
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return publik ? response : NextResponse.redirect(new URL('/', request.url))

  const { data: profil } = await supabase
    .from('users')
    .select('role, must_change_password')
    .eq('id', user.id)
    .single()

  if (!profil) return NextResponse.redirect(new URL('/api/auth/logout', request.url))

  if (profil.must_change_password && jalur !== '/ganti-sandi') {
    return NextResponse.redirect(new URL('/ganti-sandi', request.url))
  }

  const rumah = profil.role === 'GURU' ? '/guru' : '/siswa'

  if (publik || jalur === '/ganti-sandi') {
    if (jalur === '/ganti-sandi' && profil.must_change_password) return response
    return NextResponse.redirect(new URL(rumah, request.url))
  }

  if (profil.role === 'GURU' && jalur.startsWith('/siswa')) {
    return NextResponse.redirect(new URL('/guru', request.url))
  }
  if (profil.role === 'SISWA' && jalur.startsWith('/guru')) {
    return NextResponse.redirect(new URL('/siswa', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
