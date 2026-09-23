import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/admin/clients/[id]
 * Body: { "default_lead_price"?: number, "company_name"?: string }
 *
 * Nur Admins. Passt Preis / Firmenname eines Kunden-Profils an.
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
      { error: 'Nur Admins duerfen Profile bearbeiten' },
      { status: 403 }
    )
  }

  // --- Payload ---
  let body: { default_lead_price?: number; company_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body muss valides JSON sein' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}

  if (body.default_lead_price !== undefined) {
    const price = Number(body.default_lead_price)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: 'default_lead_price muss eine Zahl >= 0 sein' },
        { status: 400 }
      )
    }
    updateData.default_lead_price = price
  }

  if (body.company_name !== undefined) {
    updateData.company_name = body.company_name
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'Keine Felder zum Aktualisieren uebergeben' },
      { status: 400 }
    )
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, profile: updated })
}
