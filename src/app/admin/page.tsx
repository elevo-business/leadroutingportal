import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import type { Lead, Profile } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  sourceLabels,
  statusLabels,
} from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusButtons } from '@/components/status-buttons'
import { LeadAssignment } from '@/components/admin/lead-assignment'
import { PriceEditor } from '@/components/admin/price-editor'

function statusVariant(status: Lead['status']) {
  if (status === 'qualified') return 'default' as const
  if (status === 'rejected') return 'destructive' as const
  return 'secondary' as const
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Admin sieht dank RLS alle Datensaetze
  const [{ data: profiles }, { data: leads }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
  ])

  const allProfiles = (profiles ?? []) as Profile[]
  const clients = allProfiles.filter((p) => p.role === 'client')
  const allLeads = (leads ?? []) as Lead[]

  const unassignedCount = allLeads.filter((lead) => !lead.client_id).length
  const totalRevenue = allLeads.reduce(
    (sum, lead) => sum + Number(lead.price),
    0
  )

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">Admin-Bereich</h1>
            <p className="text-sm text-muted-foreground">
              {clients.length} Kunden &middot; {allLeads.length} Leads &middot;{' '}
              {unassignedCount} nicht zugewiesen &middot;{' '}
              {formatCurrency(totalRevenue)} Gesamtvolumen
            </p>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">
              Abmelden
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {/* Kunden & Preise */}
        <Card>
          <CardHeader>
            <CardTitle>Kunden &amp; Lead-Preise</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Standard-Lead-Preis</TableHead>
                  <TableHead className="text-right">Kunde seit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Noch keine Profile vorhanden.
                    </TableCell>
                  </TableRow>
                ) : (
                  allProfiles.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.company_name ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            client.role === 'admin' ? 'default' : 'secondary'
                          }
                        >
                          {client.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PriceEditor
                          clientId={client.id}
                          currentPrice={Number(client.default_lead_price)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDate(client.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alle Leads + Routing */}
        <Card>
          <CardHeader>
            <CardTitle>Alle Leads &amp; Routing</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                  <TableHead>Kunde (Zuweisung)</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Noch keine Leads vorhanden.
                    </TableCell>
                  </TableRow>
                ) : (
                  allLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {[lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(' ') || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead.email ?? '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.phone ?? ''}
                        </div>
                      </TableCell>
                      <TableCell>{sourceLabels[lead.source]}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)}>
                          {statusLabels[lead.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lead.price)}
                      </TableCell>
                      <TableCell>
                        <LeadAssignment
                          leadId={lead.id}
                          currentClientId={lead.client_id}
                          clients={clients.map((c) => ({
                            id: c.id,
                            company_name: c.company_name,
                          }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusButtons
                          leadId={lead.id}
                          currentStatus={lead.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
