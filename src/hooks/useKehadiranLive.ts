'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export type StatusPeta = Record<string, string>

// Status dari server dipakai sebagai dasar; perubahan realtime ditumpuk sebagai delta.
export function useKehadiranLive(sessionId: string | null, awal: StatusPeta) {
  const [wadah, setWadah] = useState<{ id: string | null; delta: StatusPeta }>({
    id: sessionId,
    delta: {},
  })

  // Ganti sesi = buang delta lama (pola render-phase reset, bukan setState di dalam effect).
  if (wadah.id !== sessionId) {
    setWadah({ id: sessionId, delta: {} })
  }

  useEffect(() => {
    if (!sessionId) return

    const supabase = createBrowserSupabase()
    const kanal = supabase
      .channel(`sesi-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const baris = (payload.new ?? {}) as { student_id?: string; status?: string }
          if (!baris.student_id || !baris.status) return
          setWadah((kini) => ({
            ...kini,
            delta: { ...kini.delta, [baris.student_id as string]: baris.status as string },
          }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(kanal)
    }
  }, [sessionId])

  return { ...awal, ...wadah.delta }
}
