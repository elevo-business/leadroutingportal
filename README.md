# Lead Routing Portal

Pay-Per-Lead-Portal fuer Leadgen-Agenturen: Leads werden **direkt Kunden zugewiesen** (kein Kampagnen-Layer), Kunden qualifizieren ihre Leads selbst, und jede Qualifizierung loest einen **Meta Conversions API Feedback-Loop** ueber Make.com aus.

## Tech-Stack

- **Frontend & Backend:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Shadcn UI
- **Datenbank & Auth:** Supabase (PostgreSQL + Supabase Auth, Row Level Security)
- **Automatisierung:** Make.com Webhooks (Inbound-Routing optional, Outbound Meta CAPI)

## Architektur

```
Meta Lead Form / Landingpage
        |
        |  POST /api/v1/leads/inbound  (x-api-key)
        v
+---------------------+        +----------------------+
|  Supabase Postgres  |        |  Kunde im Dashboard  |
|  leads (RLS)        | <----> |  Status: qualified   |
+---------------------+        +----------+-----------+
                                          |
                                          v
                                  Make.com Webhook
                                  { lead_id, email, phone,
                                    fbclid, event_name:
                                    "QualifiedLead" }
                                          |
                                          v
                                   Meta Conversions API
```

## Setup

### 1. Supabase

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Im **SQL Editor** das Script [`supabase/schema.sql`](supabase/schema.sql) ausfuehren. Es erstellt:
   - Tabellen `profiles` und `leads`
   - RLS-Policies (Client sieht nur eigene Leads, Admin alles)
   - Trigger: Profil-Anlage bei Signup, `updated_at`, Schutz sensibler Felder (Clients koennen nur den Status aendern)
   - Helper `is_admin()` und View `lead_revenue_by_client` (Monatsabrechnung pro Kunde)
3. Unter **Authentication -> Users** Benutzer anlegen. Das Profil wird per Trigger automatisch erstellt.
4. Ersten Admin setzen:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@deine-agentur.de');
```

### 2. Umgebungsvariablen

`.env.example` nach `.env.local` kopieren und ausfuellen:

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (nur serverseitig!) |
| `INBOUND_API_KEY` | Shared Secret fuer die Inbound API (`openssl rand -hex 32`) |
| `MAKE_WEBHOOK_URL` | Custom Webhook URL aus Make.com |

### 3. Starten

```bash
npm install
npm run dev
```

- Kunden-Dashboard: `http://localhost:3000/dashboard`
- Admin-Bereich: `http://localhost:3000/admin`

### 4. Deployment (Vercel)

Repo mit Vercel verbinden, dieselben Env-Variablen hinterlegen, fertig.

## API

### Inbound Lead API

```
POST /api/v1/leads/inbound
Headers:
  Content-Type: application/json
  x-api-key: <INBOUND_API_KEY>
```

```json
{
  "first_name": "Max",
  "last_name": "Mustermann",
  "email": "max@example.de",
  "phone": "+49 170 1234567",
  "source": "meta_lead_form",
  "fbclid": "IwAR...",
  "client_id": "uuid-des-kunden-oder-null",
  "custom_data": {
    "budget": "5000-10000",
    "anliegen": "Beratung"
  }
}
```

- `source`: `meta_lead_form` oder `landingpage` (Pflicht)
- `email` **oder** `phone` ist Pflicht
- Wird `client_id` uebergeben, wird der Lead direkt zugewiesen und mit dem `default_lead_price` des Kunden bepreist. Ohne `client_id` bleibt er unassigned und wartet auf Routing im Admin-Bereich.

**Test:**

```bash
curl -X POST https://deine-domain.de/api/v1/leads/inbound \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INBOUND_API_KEY" \
  -d '{"email":"test@lead.de","source":"meta_lead_form","fbclid":"test123"}'
```

### Status-Update (authentifiziert, Cookie-Session)

```
POST /api/leads/{id}/status
Body: { "status": "qualified" }
```

Clients koennen nur eigene Leads aendern (RLS), Admins alle. Beim Uebergang auf `qualified` wird der Make.com Webhook gefeuert.

### Admin: Lead zuweisen / Re-Routing

```
PATCH /api/admin/leads/{id}
Body: { "client_id": "uuid-oder-null", "apply_default_price": true }
```

Bei Zuweisung wird der Preis automatisch auf den `default_lead_price` des neuen Kunden gesetzt (mit `apply_default_price: false` abschaltbar).

### Admin: Preis eines Kunden anpassen

```
PATCH /api/admin/clients/{id}
Body: { "default_lead_price": 49.90 }
```

## Make.com Szenario (Meta CAPI Feedback-Loop)

1. **Custom Webhook**-Modul anlegen, URL als `MAKE_WEBHOOK_URL` hinterlegen.
2. Payload-Mapping: `lead_id`, `email`, `phone`, `fbclid`, `event_name`.
3. **HTTP-Modul** an die Meta Conversions API (`POST https://graph.facebook.com/v21.0/{PIXEL_ID}/events`):
   - `event_name`: `QualifiedLead`
   - `event_time`: aktueller Unix-Timestamp
   - `action_source`: `system_generated`
   - `user_data`: gehashte `em`, `ph` (SHA-256, lowercase), plus `fbc` aus `fbclid` (`fb.1.{timestamp}.{fbclid}`)
4. Optional: Filter, dass nur `event_name == "QualifiedLead"` weiterlaeuft.

Damit lernt der Meta-Algorithmus, welche Leads tatsaechlich qualifiziert waren, und optimiert die Ausspielung entsprechend.

## Sicherheit

- **RLS** erzwingt datenbankseitig: Clients sehen/bearbeiten nur Leads mit `client_id = auth.uid()`; Admins haben Vollzugriff.
- Ein **Trigger** verhindert, dass Clients Preis, Zuweisung oder Kontaktdaten aendern - nur der Status ist erlaubt.
- Die Inbound API nutzt die Service Role, liegt aber hinter einem API-Key und laeuft rein serverseitig.
- Der Service Role Key wird niemals an den Browser ausgeliefert.
