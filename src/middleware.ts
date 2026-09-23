import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Auf alle Pfade anwenden ausser:
     * - _next/static, _next/image ( statische Dateien)
     * - favicon.ico, Bilddateien
     * - /api/v1 (API-Key-Auth, keine Session noetig)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
