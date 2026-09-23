import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InboundLeadPayload } from '@/lib/types'

const VALID_SOURCES = ['meta_lead_form', 'landingpage'] as const

/**
 * POST /api/v1/leads/inbound
 *
 * Nimmt Leads von Meta Lead Forms / Landingpages entgegen.
 * Auth: x-api-key Header (INBOUND_API_KEY aus .env).
 *
 * Bei uebergebener client_id wird der Lead direkt zugewiesen und
 * mit dem default_lead_price des Kunden bepreist.
 */
export async function POST(request: Request) {
  // --- 1. API-Key pruefen ---
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.INBOUND_API_KEY

  if (!expectedKey) {
    console.error('[inbound] INBOUND_API_KEY ist nicht konfiguriert')
    return NextResponse.json(
      { error: 'Server-Konfigurationsfehler' },
      { status: 500 }
    )
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Ungueltiger API-Key' }, { status: 401 })
  }

  // --- 2. Payload parsen & validieren ---
  let body: InboundLeadPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body muss valides JSON sein' },
      { status: 400 }
    )
  }

  const {
    first_name = null,
    last_name = null,
    email = null,
    phone = null,
    source,
    fbclid = null,
    custom_data = {},
    client_id = null,
  } = body

  if (!source || !VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `source muss einer der Werte sein: ${VALID_SOURCES.join(', ')}` },
      { status: 400 }
    )
  }

  if (!email && !phone) {
    return NextResponse.json(
      { error: 'Mindestens email oder phone ist erforderlich' },
      { status: 400 }
    )
  }

  // --- 3. Speichern (Service Role umgeht RLS) ---
  const supabase = createAdminClient()

  let price = 0
  if (client_id) {
    const { data: client, error: clientError } = await supabase
      .from('profiles')
      .select('id, default_lead_price')
      .eq('id', client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'client_id nicht gefunden' },
        { status: 404 }
      )
    }
    price = Number(client.default_lead_price)
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      client_id,
      first_name,
      last_name,
      email,
      phone,
      custom_data,
      source,
      fbclid,
      price,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[inbound] Insert fehlgeschlagen:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { success: true, lead_id: lead.id, client_id: lead.client_id, price: lead.price },
    { status: 201 }
  )
}
