'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ClientOption {
  id: string
  company_name: string | null
}

interface LeadAssignmentProps {
  leadId: string
  currentClientId: string | null
  clients: ClientOption[]
}

const UNASSIGNED = '__unassigned__'

/**
 * Dropdown zum Re-Routing eines Leads an einen anderen Kunden.
 * Ruft PATCH /api/admin/leads/[id] auf. Der Lead-Preis wird dabei
 * automatisch auf den default_lead_price des neuen Kunden gesetzt.
 */
export function LeadAssignment({
  leadId,
  currentClientId,
  clients,
}: LeadAssignmentProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function assign(value: string) {
    const clientId = value === UNASSIGNED ? null : value
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Fehler (HTTP ${res.status})`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={currentClientId ?? UNASSIGNED}
        onValueChange={assign}
        disabled={saving}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Kunde waehlen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>
            <span className="text-muted-foreground">Nicht zugewiesen</span>
          </SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.company_name ?? client.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
