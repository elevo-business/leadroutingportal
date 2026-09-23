export type Role = 'admin' | 'client'

export type LeadSource = 'meta_lead_form' | 'landingpage'

export type LeadStatus = 'pending' | 'qualified' | 'rejected'

export interface Profile {
  id: string
  role: Role
  company_name: string | null
  default_lead_price: number
  created_at: string
}

export interface Lead {
  id: string
  client_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  custom_data: Record<string, unknown>
  source: LeadSource
  fbclid: string | null
  status: LeadStatus
  price: number
  created_at: string
  updated_at: string
}

export interface InboundLeadPayload {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  source: LeadSource
  fbclid?: string | null
  custom_data?: Record<string, unknown>
  client_id?: string | null
}

export interface MakeCapiWebhookPayload {
  lead_id: string
  email: string | null
  phone: string | null
  fbclid: string | null
  event_name: 'QualifiedLead'
}
