import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendQualifiedLeadWebhook } from '@/lib/make'
import type { Lead, LeadStatus } from '@/lib/types'

const ALLOWED_STATUSES: LeadStatus[] = ['pending', 'qualified', 'rejected']

/**
 * POST /api/leads/[id]/status
 * Body: { "status": "pending" | "qualified" | "rejected" }
 *
 * - Clients duerfen nur eigene Leads aendern (erzwungen durch RLS).
 * - Admins duerfen alle Leads aendern.
 * - Beim Uebergang auf 'qualified' wird der Make.com Webhook
 *   (Meta CAPI Feedback-Loop) ausgeloest.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // --- 1. Auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Nicht authentifiziert' },
      { status: 401 }
    )
  }

  // --- 2. Validierung ---
  let body: { status?: LeadStatus }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body muss valides JSON sein' },
      { status: 400 }
    )
  }

  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status muss einer der Werte sein: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // --- 3. Lead laden (RLS: Client sieht nur eigene Leads) ---
  const { data: existing, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Lead nicht gefunden oder kein Zugriff' },
      { status: 404 }
    )
  }

  const previousStatus = (existing as Lead).status

  // --- 4. Update ---
  const { data: updated, error } = await supabase
    .from('leads')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // --- 5. Meta CAPI Feedback-Loop: nur beim Uebergang -> qualified ---
  let webhook: { sent: boolean; status?: number; reason?: string } = {
    sent: false,
  }

  if (body.status === 'qualified' && previousStatus !== 'qualified') {
    webhook = await sendQualifiedLeadWebhook(updated as Lead)
  }

  return NextResponse.json({ success: true, lead: updated, webhook })
}
