'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'

// Sesi aktif kelas berubah (dibuka/ditutup) → minta server render ulang.
export function useSesiAktif(classId: string | null) {
  const router = useRouter()

  useEffect(() => {
    if (!classId) return

    const supabase = createBrowserSupabase()
    const kanal = supabase
      .channel(`kelas-${classId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `class_id=eq.${classId}` },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(kanal)
    }
  }, [classId, router])
}
