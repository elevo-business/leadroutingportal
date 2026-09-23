import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/admin/leads/[id]
 * Body: { "client_id": string | null, "apply_default_price"?: boolean }
 *
 * Nur Admins. Weist einen Lead einem Kunden zu (Re-Routing).
 * Bei Zuweisung wird der Preis standardmaessig auf den
 * default_lead_price des neuen Kunden gesetzt
 * (abschaltbar mit apply_default_price: false).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // --- Auth & Admin-Check ---
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Nicht authentifiziert' },
      { status: 401 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Nur Admins duerfen Leads zuweisen' },
      { status: 403 }
    )
  }

  // --- Payload ---
  let body: { client_id?: string | null; apply_default_price?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body muss valides JSON sein' },
      { status: 400 }
    )
  }

  if (body.client_id === undefined) {
    return NextResponse.json(
      { error: 'client_id ist erforderlich (null = Zuweisung aufheben)' },
      { status: 400 }
    )
  }

  const applyDefaultPrice = body.apply_default_price !== false
  const clientId = body.client_id

  // --- Neuen Kunden laden (fuer Preis) ---
  let price: number | undefined
  if (clientId) {
    const { data: client, error: clientError } = await supabase
      .from('profiles')
      .select('id, default_lead_price')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Kunde nicht gefunden' },
        { status: 404 }
      )
    }
    if (applyDefaultPrice) {
      price = Number(client.default_lead_price)
    }
  } else if (applyDefaultPrice) {
    price = 0
  }

  // --- Update ---
  const updateData: Record<string, unknown> = { client_id: clientId }
  if (price !== undefined) {
    updateData.price = price
  }

  const { data: updated, error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, lead: updated })
}
