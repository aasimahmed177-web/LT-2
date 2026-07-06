export const STAGES = [
  { key: 'Lead', label: 'Lead' },
  { key: 'Contact', label: 'Contact' },
  { key: 'Prospect', label: 'Prospect' },
  { key: 'ConversionLead', label: 'Conversion Lead' },
  { key: 'Purchase', label: 'Purchase' },
  { key: 'NotQualified', label: 'Not Qualified' },
  { key: 'NoResponse', label: 'No Response' },
  { key: 'Duplicate', label: 'Duplicate' },
  { key: 'Invalid', label: 'Invalid' },
] as const

export const POSITIVE_STAGES = new Set(['Contact', 'Prospect', 'ConversionLead', 'Purchase'])
export const NEGATIVE_STAGES = new Set(['NotQualified', 'NoResponse', 'Invalid', 'Duplicate'])
export const DISQUALIFICATION_STAGES = new Set(['NotQualified', 'NoResponse', 'Duplicate', 'Invalid'])

export function stageClass(s: string): string {
  return `stage-badge stage-${s}`
}