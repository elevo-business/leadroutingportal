import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import type { Lead } from '@/lib/types'
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

function statusVariant(status: Lead['status']) {
  if (status === 'qualified') return 'default' as const
  if (status === 'rejected') return 'destructive' as const
  return 'secondary' as const
}

export default async function DashboardPage() {
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

  // RLS sorgt dafuer, dass nur eigene Leads zurueckkommen
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const allLeads = (leads ?? []) as Lead[]

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLeads = allLeads.filter(
    (lead) => new Date(lead.created_at) >= startOfMonth
  )
  const monthCost = monthLeads.reduce((sum, lead) => sum + Number(lead.price), 0)
  const totalCost = allLeads.reduce((sum, lead) => sum + Number(lead.price), 0)
  const qualifiedCount = allLeads.filter(
    (lead) => lead.status === 'qualified'
  ).length

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">Meine Leads</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.company_name ?? user.email}
            </p>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">
              Abmelden
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* KPI-Karten */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads diesen Monat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{monthLeads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Kosten diesen Monat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(monthCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads gesamt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{allLeads.length}</p>
              <p className="text-xs text-muted-foreground">
                {qualifiedCount} qualifiziert
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Kosten gesamt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lead-Tabelle */}
        <Card>
          <CardHeader>
            <CardTitle>Zugewiesene Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                  <TableHead>Status</TableHead>
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
                      Noch keine Leads zugewiesen.
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
                      <TableCell>{lead.email ?? '-'}</TableCell>
                      <TableCell>{lead.phone ?? '-'}</TableCell>
                      <TableCell>{sourceLabels[lead.source]}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lead.price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)}>
                          {statusLabels[lead.status]}
                        </Badge>
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
