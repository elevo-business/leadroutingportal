'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PriceEditorProps {
  clientId: string
  currentPrice: number
}

/**
 * Inline-Editor fuer den default_lead_price eines Kunden.
 * Ruft PATCH /api/admin/clients/[id] auf.
 */
export function PriceEditor({ clientId, currentPrice }: PriceEditorProps) {
  const router = useRouter()
  const [price, setPrice] = useState(currentPrice.toFixed(2))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const value = Number(price.replace(',', '.'))
    if (Number.isNaN(value) || value < 0) {
      setError('Bitte eine gueltige Zahl >= 0 eingeben')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_lead_price: value }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Fehler (HTTP ${res.status})`)
      }

      setMessage('Gespeichert')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value)
            setMessage(null)
            setError(null)
          }}
          className="h-9 w-[110px]"
          aria-label="Standard-Lead-Preis in EUR"
        />
        <span className="text-sm text-muted-foreground">EUR</span>
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Speichere...' : 'Speichern'}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-green-600">{message}</p> : null}
    </div>
  )
}
