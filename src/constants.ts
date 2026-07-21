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

// Single source of truth for "what color means this stage" wherever a raw
// color is needed instead of a .stage-badge pill (funnel bands, the Pipeline
// board's column accents, dashboard KPI dots). Backed by CSS custom
// properties (defined in index.css, themed for dark mode) so every one of
// these consumers re-themes together instead of drifting into separate
// hand-picked palettes.
export const STAGE_COLOR_VAR: Record<string, string> = {
  Lead: 'var(--stage-lead)',
  Contact: 'var(--stage-contact)',
  Prospect: 'var(--stage-prospect)',
  ConversionLead: 'var(--stage-conversionlead)',
  Purchase: 'var(--stage-purchase)',
  NotQualified: 'var(--stage-notqualified)',
  NoResponse: 'var(--stage-noresponse)',
  Invalid: 'var(--stage-invalid)',
  Duplicate: 'var(--stage-duplicate)',
}