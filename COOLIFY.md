# Deployment mit Coolify

Diese App ist fuer Coolify mit dem **Dockerfile-Build-Pack** vorbereitet (Multi-Stage-Build, Next.js Standalone-Output, laeuft auf Port 3000).

## Voraussetzungen

1. Supabase-Projekt angelegt und [`supabase/schema.sql`](supabase/schema.sql) im SQL Editor ausgefuehrt.
2. Das GitHub-Repo ist in Coolify erreichbar (GitHub App oder Deploy Key fuer private Repos).

## Schritt fuer Schritt

### 1. Resource anlegen

1. In Coolify: **+ Add Resource -> Application**
2. Source: dein GitHub-Repo `leadroutingportal`, Branch `main`
3. **Build Pack: `Dockerfile`** auswaehlen (wichtig - sonst versucht Coolify Nixpacks)
4. Port: `3000` (ist im Dockerfile exposed)

### 2. Environment Variables setzen

Unter **Environment Variables** in der Coolify-App:

| Variable | Typ | Hinweis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Build Variable** | Haken bei "Available at Build Time" setzen! |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build Variable** | Haken bei "Available at Build Time" setzen! |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime (Secret) | Niemals als Build-Variable, nur Runtime |
| `INBOUND_API_KEY` | Runtime (Secret) | z. B. `openssl rand -hex 32` |
| `MAKE_WEBHOOK_URL` | Runtime (Secret) | Custom Webhook URL aus Make.com |

**Wichtig:** `NEXT_PUBLIC_*` Variablen brennt Next.js zur **Build-Zeit** ins Client-Bundle. Wenn du sie aenderst, reicht kein Restart - du musst in Coolify **neu deployen (Rebuild)**.

### 3. Deployen & Domain

1. **Deploy** klicken - Coolify baut das Image und startet den Container.
2. Unter **Domains** deine Domain eintragen (z. B. `portal.deine-agentur.de`). Coolify uebernimmt Traefik-Routing und Let's-Encrypt-SSL automatisch.
3. Health Check (optional): Pfad `/login` (liefert HTTP 200 ohne Auth).

### 4. Verifizieren

```bash
# App erreichbar?
curl -I https://portal.deine-agentur.de/login

# Inbound API testen (muss 201 liefern)
curl -X POST https://portal.deine-agentur.de/api/v1/leads/inbound \
  -H "Content-Type: application/json" \
  -H "x-api-key: DEIN_INBOUND_API_KEY" \
  -d '{"email":"test@lead.de","source":"meta_lead_form","fbclid":"test123"}'
```

## Updates

- Coolify kann per **GitHub Webhook** automatisch bei jedem Push auf `main` neu deployen (in der App unter "Webhooks" aktivieren bzw. in den GitHub-App-Settings).

## Troubleshooting

| Problem | Loesung |
|---|---|
| Build schlaegt fehl mit `supabaseUrl is required` | `NEXT_PUBLIC_SUPABASE_URL` ist nicht als Build-Variable markiert |
| Seite laedt, aber Login/Api wirft 500 | Runtime-Variablen (`SUPABASE_SERVICE_ROLE_KEY` etc.) fehlen oder falsch |
| Aenderung an `NEXT_PUBLIC_*` greift nicht | Rebuild statt Restart noetig |
| 502 Bad Gateway | Pruefen, ob Port 3000 in den Coolify-App-Settings eingetragen ist |
