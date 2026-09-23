import { createClient } from '@supabase/supabase-js'

/**
 * Service-Role-Client: umgeht RLS komplett.
 * NUR in serverseitigem Code verwenden (z. B. Inbound API).
 * NIEMALS an den Browser ausliefern!
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
