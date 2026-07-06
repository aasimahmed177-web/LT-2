import type { Lead, DashboardStats, MetaConnection, LeadForm, TeamMember, AssignmentRule, LeadStatusChange } from '../types';

export const mockLeads: Lead[] = [
  {
    id: 'LD-1001',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@email.com',
    phone: '+91 98765 43210',
    status: 'new',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Luxury Apartments - Phase 3',
    propertyInterest: '3BHK Apartment',
    budget: '₹80L - ₹1.2Cr',
    notes: '',
    assignedTo: undefined,
    createdAt: '2026-06-17T09:30:00Z',
    updatedAt: '2026-06-17T09:30:00Z',
    customFields: { city: 'Mumbai', pincode: '400001' },
  },
  {
    id: 'LD-1002',
    name: 'Priya Patel',
    email: 'priya.patel@email.com',
    phone: '+91 99887 76655',
    status: 'new',
    source: 'instagram',
    formName: 'IG Lead - Property Query',
    adName: 'Instagram Story - Villa Collection',
    propertyInterest: '4BHK Villa',
    budget: '₹1.5Cr - ₹2Cr',
    notes: '',
    assignedTo: undefined,
    createdAt: '2026-06-17T08:15:00Z',
    updatedAt: '2026-06-17T08:15:00Z',
    customFields: { city: 'Pune', pincode: '411001' },
  },
  {
    id: 'LD-1003',
    name: 'Amit Kumar',
    email: 'amit.k@email.com',
    phone: '+91 87654 32109',
    status: 'contacted',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Budget Homes - Starting ₹35L',
    propertyInterest: '2BHK Apartment',
    budget: '₹35L - ₹50L',
    notes: 'Called at 10 AM. Interested in visiting site this weekend.',
    assignedTo: 'Anjali Mehta',
    createdAt: '2026-06-16T14:20:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    customFields: { city: 'Delhi', pincode: '110001' },
  },
  {
    id: 'LD-1004',
    name: 'Sneha Reddy',
    email: 'sneha.r@email.com',
    phone: '+91 76543 21098',
    status: 'pre-qualified',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Luxury Apartments - Phase 3',
    propertyInterest: '3BHK Apartment',
    budget: '₹1Cr - ₹1.5Cr',
    notes: 'Has pre-approval from bank. Looking for high floor.',
    assignedTo: 'Vikram Singh',
    createdAt: '2026-06-15T11:00:00Z',
    updatedAt: '2026-06-16T16:30:00Z',
    customFields: { city: 'Bangalore', pincode: '560001' },
  },
  {
    id: 'LD-1005',
    name: 'Vijay Deshmukh',
    email: 'vijay.d@email.com',
    phone: '+91 65432 10987',
    status: 'qualified',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Premium Plots - Gated Community',
    propertyInterest: 'Plot 1500sqft',
    budget: '₹60L - ₹80L',
    notes: 'Serious buyer. Visited site twice. Ready for booking.',
    assignedTo: 'Anjali Mehta',
    createdAt: '2026-06-14T09:00:00Z',
    updatedAt: '2026-06-16T12:00:00Z',
    customFields: { city: 'Hyderabad', pincode: '500001' },
  },
  {
    id: 'LD-1006',
    name: 'Neha Gupta',
    email: 'neha.g@email.com',
    phone: '+91 54321 09876',
    status: 'converted',
    source: 'instagram',
    formName: 'IG Lead - Property Query',
    adName: 'Instagram Story - Villa Collection',
    propertyInterest: '3BHK Villa',
    budget: '₹1.2Cr - ₹1.8Cr',
    notes: 'Booked villa in Phase 2. Payment completed.',
    assignedTo: 'Vikram Singh',
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-15T14:00:00Z',
    customFields: { city: 'Mumbai', pincode: '400001' },
  },
  {
    id: 'LD-1007',
    name: 'Arun Nair',
    email: 'arun.nair@email.com',
    phone: '+91 43210 98765',
    status: 'not-qualified',
    source: 'website',
    formName: 'Website Contact Form',
    adName: 'Organic',
    propertyInterest: 'Commercial Space',
    budget: '₹5Cr+',
    notes: 'Budget too high for current inventory.',
    assignedTo: undefined,
    createdAt: '2026-06-13T15:00:00Z',
    updatedAt: '2026-06-14T09:00:00Z',
    customFields: { city: 'Chennai', pincode: '600001' },
  },
  {
    id: 'LD-1008',
    name: 'Deepa Iyer',
    email: 'deepa.iyer@email.com',
    phone: '+91 32109 87654',
    status: 'junk',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Budget Homes - Starting ₹35L',
    propertyInterest: '1BHK',
    budget: '₹15L - ₹20L',
    notes: 'Not a genuine lead. Wrong number.',
    assignedTo: undefined,
    createdAt: '2026-06-12T08:00:00Z',
    updatedAt: '2026-06-12T17:00:00Z',
    customFields: {},
  },
  {
    id: 'LD-1009',
    name: 'Karan Joshi',
    email: 'karan.joshi@email.com',
    phone: '+91 21098 76543',
    status: 'new',
    source: 'facebook',
    formName: 'Instant Form - Real Estate Enquiry',
    adName: 'Luxury Apartments - Phase 3',
    propertyInterest: 'Penthouse',
    budget: '₹3Cr+',
    notes: '',
    assignedTo: undefined,
    createdAt: '2026-06-17T07:45:00Z',
    updatedAt: '2026-06-17T07:45:00Z',
    customFields: { city: 'Mumbai', pincode: '400001' },
  },
  {
    id: 'LD-1010',
    name: 'Meera Chopra',
    email: 'meera.c@email.com',
    phone: '+91 10987 65432',
    status: 'contacted',
    source: 'instagram',
    formName: 'IG Lead - Property Query',
    adName: 'Instagram Story - Villa Collection',
    propertyInterest: '3BHK Villa',
    budget: '₹1Cr - ₹1.5Cr',
    notes: 'Left voicemail. Will call back tomorrow.',
    assignedTo: 'Anjali Mehta',
    createdAt: '2026-06-16T10:30:00Z',
    updatedAt: '2026-06-16T18:00:00Z',
    customFields: { city: 'Delhi', pincode: '110001' },
  },
];

export const mockStats: DashboardStats = {
  totalLeads: 127,
  newToday: 3,
  qualified: 42,
  converted: 18,
  conversionRate: 14.2,
};

export const mockMetaConnection: MetaConnection = {
  pixelId: '123456789012345',
  accessToken: 'EAA***',
  facebookPageId: '987654321098765',
  connected: true,
  lastSync: '2026-06-17T09:00:00Z',
};

export const mockLeadForms: LeadForm[] = [
  { id: 'form-1', name: 'Instant Form - Real Estate Enquiry', pageName: 'Logam Properties', status: 'active', leadCount: 89, lastLeadAt: '2026-06-17T09:30:00Z' },
  { id: 'form-2', name: 'IG Lead - Property Query', pageName: 'Logam Properties', status: 'active', leadCount: 34, lastLeadAt: '2026-06-17T08:15:00Z' },
  { id: 'form-3', name: 'Website Contact Form', pageName: 'Logam Website', status: 'active', leadCount: 4, lastLeadAt: '2026-06-13T15:00:00Z' },
];

export const mockTeamMembers: TeamMember[] = [
  { id: 'team-1', name: 'Anjali Mehta', email: 'anjali@logam.com', role: 'manager', active: true, assignedLeads: 23 },
  { id: 'team-2', name: 'Vikram Singh', email: 'vikram@logam.com', role: 'agent', active: true, assignedLeads: 18 },
  { id: 'team-3', name: 'Rajesh Kumar', email: 'rajesh@logam.com', role: 'agent', active: true, assignedLeads: 15 },
  { id: 'team-4', name: 'Pooja Sharma', email: 'pooja@logam.com', role: 'agent', active: true, assignedLeads: 12 },
  { id: 'team-5', name: 'Amit Verma', email: 'amit@logam.com', role: 'agent', active: false, assignedLeads: 0 },
];

export const mockAssignmentRules: AssignmentRule[] = [
  { id: 'rule-1', name: 'Round Robin - Facebook', source: 'facebook', maxLeadsPerDay: 10, roundRobin: true, active: true },
  { id: 'rule-2', name: 'Round Robin - Instagram', source: 'instagram', maxLeadsPerDay: 8, roundRobin: true, active: true },
  { id: 'rule-3', name: 'Website Leads', source: 'website', maxLeadsPerDay: 5, roundRobin: true, active: false },
];

export const mockStatusChanges: LeadStatusChange[] = [
  { id: 'ch-1', leadId: 'LD-1003', fromStatus: 'new', toStatus: 'contacted', timestamp: '2026-06-17T10:00:00Z', syncedToMeta: true },
  { id: 'ch-2', leadId: 'LD-1004', fromStatus: 'contacted', toStatus: 'pre-qualified', timestamp: '2026-06-16T16:30:00Z', syncedToMeta: true },
  { id: 'ch-3', leadId: 'LD-1005', fromStatus: 'pre-qualified', toStatus: 'qualified', timestamp: '2026-06-16T12:00:00Z', syncedToMeta: true },
  { id: 'ch-4', leadId: 'LD-1006', fromStatus: 'qualified', toStatus: 'converted', timestamp: '2026-06-15T14:00:00Z', syncedToMeta: true },
  { id: 'ch-5', leadId: 'LD-1007', fromStatus: 'new', toStatus: 'not-qualified', timestamp: '2026-06-14T09:00:00Z', syncedToMeta: true },
  { id: 'ch-6', leadId: 'LD-1008', fromStatus: 'new', toStatus: 'junk', timestamp: '2026-06-12T17:00:00Z', syncedToMeta: true },
];

export const weeklyData = [
  { day: 'Mon', leads: 5, qualified: 2, converted: 1 },
  { day: 'Tue', leads: 8, qualified: 3, converted: 0 },
  { day: 'Wed', leads: 4, qualified: 1, converted: 1 },
  { day: 'Thu', leads: 7, qualified: 4, converted: 2 },
  { day: 'Fri', leads: 6, qualified: 2, converted: 1 },
  { day: 'Sat', leads: 3, qualified: 1, converted: 0 },
  { day: 'Sun', leads: 2, qualified: 0, converted: 0 },
];

export function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'pre-qualified': return 'bg-purple-100 text-purple-800';
    case 'qualified': return 'bg-green-100 text-green-800';
    case 'converted': return 'bg-emerald-100 text-emerald-800';
    case 'not-qualified': return 'bg-orange-100 text-orange-800';
    case 'junk': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'new': return '●';
    case 'contacted': return '◎';
    case 'pre-qualified': return '◉';
    case 'qualified': return '✓';
    case 'converted': return '★';
    case 'not-qualified': return '○';
    case 'junk': return '✕';
    default: return '●';
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}