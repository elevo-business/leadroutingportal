import type { Lead, MakeCapiWebhookPayload } from '@/lib/types'

/**
 * Outbound Webhook an Make.com, sobald ein Lead auf 'qualified' gesetzt wird.
 * Make.com leitet daraus das 'QualifiedLead'-Event an die Meta Conversions API weiter.
 */
export async function sendQualifiedLeadWebhook(
  lead: Lead
): Promise<{ sent: boolean; status?: number; reason?: string }> {
  const url = process.env.MAKE_WEBHOOK_URL

  if (!url) {
    console.warn('[make] MAKE_WEBHOOK_URL nicht konfiguriert - Webhook uebersprungen')
    return { sent: false, reason: 'MAKE_WEBHOOK_URL nicht konfiguriert' }
  }

  const payload: MakeCapiWebhookPayload = {
    lead_id: lead.id,
    email: lead.email,
    phone: lead.phone,
    fbclid: lead.fbclid,
    event_name: 'QualifiedLead',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error(`[make] Webhook fehlgeschlagen: HTTP ${res.status}`)
      return { sent: false, status: res.status }
    }

    return { sent: true, status: res.status }
  } catch (error) {
    console.error('[make] Webhook-Fehler:', error)
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }
  }
}
