'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LeadStatus } from '@/lib/types'

interface StatusButtonsProps {
  leadId: string
  currentStatus: LeadStatus
}

/**
 * Interaktive Status-Buttons fuer die Lead-Tabelle.
 * Setzt den Status ueber /api/leads/[id]/status.
 * Bei 'qualified' wird serverseitig der Make.com Webhook ausgeloest.
 */
export function StatusButtons({ leadId, currentStatus }: StatusButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<LeadStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(status: LeadStatus) {
    setLoading(status)
    setError(null)

    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Fehler (HTTP ${res.status})`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={currentStatus === 'qualified' ? 'default' : 'outline'}
          disabled={loading !== null || currentStatus === 'qualified'}
          onClick={() => updateStatus('qualified')}
        >
          <Check className="h-4 w-4" />
          {loading === 'qualified' ? 'Speichere...' : 'Qualifiziert'}
        </Button>
        <Button
          size="sm"
          variant={currentStatus === 'rejected' ? 'destructive' : 'outline'}
          disabled={loading !== null || currentStatus === 'rejected'}
          onClick={() => updateStatus('rejected')}
        >
          <X className="h-4 w-4" />
          {loading === 'rejected' ? 'Speichere...' : 'Ablehnen'}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
