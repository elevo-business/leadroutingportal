# syntax=docker/dockerfile:1

# ============================================================
# Lead Routing Portal - Multi-Stage Dockerfile (Next.js 15)
# Optimiert fuer Coolify (Build Pack: "Dockerfile")
# ============================================================

FROM node:20-alpine AS base

# ---------- Stufe 1: Abhaengigkeiten ----------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json ./
# Hinweis: Sobald ein package-lock.json committed ist (npm install lokal ausfuehren),
# hier auf "npm ci" umstellen fuer reproduzierbare Builds.
RUN npm install --no-audit --no-fund

# ---------- Stufe 2: Build ----------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* Variablen werden zur Build-Zeit ins JS-Bundle gebacken.
# In Coolify unter "Environment Variables" als Build-Variable markieren!
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- Stufe 3: Runtime (schlankes Image) ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
