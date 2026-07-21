// Single source of truth for "what has actually happened to this lead" —
// derived from its CRM `stage` plus whatever call-activity data (from
// telecalling CSV imports) refines it. Used by both the Dashboard's funnel
// and the Telecalling page's metrics/breakdown tables, which previously each
// reimplemented this independently and drifted out of sync with each other.
export interface CallActivityLike {
  callPicked?: string
  interested?: string
  purchase?: string
  callComments?: string
}

export interface LeadJourneyStatus {
  isAttempted: boolean
  isContacted: boolean
  isInterested: boolean
  isMeetingBooked: boolean
  isPurchased: boolean
  isNoResponse: boolean
  isNotQualified: boolean
  isInvalid: boolean
  isStalledAtContact: boolean
}

export function deriveLeadJourneyStatus(stage: string, activity?: CallActivityLike): LeadJourneyStatus {
  const outcome = (activity?.callPicked || '').trim()
  const hasCallOutcome = outcome === 'Yes' || outcome === 'No'
  const callPicked = activity?.callPicked === 'Yes'
  const callInterested = activity?.interested === 'Yes'
  const callPurchase = activity?.purchase === 'Yes'
  const comments = (activity?.callComments || '').toLowerCase()

  // Attempted needs a recorded call outcome (Yes/No) or a stage past Lead —
  // the mere existence of a call-activity row isn't proof (CSV import writes
  // one for every matched lead, including ones never actually reached).
  const isAttempted = hasCallOutcome || stage !== 'Lead'

  const isContacted = callPicked || ['Contact', 'Prospect', 'ConversionLead', 'Purchase', 'NotQualified'].includes(stage)
  const isInterested = callInterested || ['Prospect', 'ConversionLead', 'Purchase'].includes(stage)
  const isMeetingBooked = ['ConversionLead', 'Purchase'].includes(stage)
  const isPurchased = stage === 'Purchase' || callPurchase
  const isNoResponse = stage === 'NoResponse'
  const isNotQualified = stage === 'NotQualified'
  const isInvalid = stage === 'Invalid' || stage === 'Duplicate' || comments.includes('wrong number') || comments.includes('junk')
  const isStalledAtContact = stage === 'Contact'

  return {
    isAttempted,
    isContacted,
    isInterested,
    isMeetingBooked,
    isPurchased,
    isNoResponse,
    isNotQualified,
    isInvalid,
    isStalledAtContact,
  }
}
