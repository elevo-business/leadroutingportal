import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { LeadSource, LeadStatus } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export const statusLabels: Record<LeadStatus, string> = {
  pending: 'Offen',
  qualified: 'Qualifiziert',
  rejected: 'Abgelehnt',
}

export const sourceLabels: Record<LeadSource, string> = {
  meta_lead_form: 'Meta Lead Form',
  landingpage: 'Landingpage',
}
