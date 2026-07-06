export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'pre-qualified'
  | 'qualified'
  | 'converted'
  | 'not-qualified'
  | 'junk';

export type LeadSource = 'facebook' | 'instagram' | 'website' | 'manual';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  formName: string;
  adName: string;
  propertyInterest?: string;
  budget?: string;
  notes: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, string>;
}

export interface DashboardStats {
  totalLeads: number;
  newToday: number;
  qualified: number;
  converted: number;
  conversionRate: number;
}

export interface LeadStatusChange {
  id: string;
  leadId: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  timestamp: string;
  syncedToMeta: boolean;
}

export interface MetaConnection {
  pixelId: string;
  accessToken: string;
  facebookPageId: string;
  connected: boolean;
  lastSync: string | null;
}

export interface LeadForm {
  id: string;
  name: string;
  pageName: string;
  status: 'active' | 'paused';
  leadCount: number;
  lastLeadAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  active: boolean;
  assignedLeads: number;
}

export interface AssignmentRule {
  id: string;
  name: string;
  source?: LeadSource;
  maxLeadsPerDay: number;
  roundRobin: boolean;
  active: boolean;
}