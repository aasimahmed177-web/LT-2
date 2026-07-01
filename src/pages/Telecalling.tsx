import { useState, useEffect, useMemo } from 'react'
import { getLeads } from '../api'
import { useClient } from '../ClientContext'

// ─── Types ──────────────────────────────────────────────────────────

interface TeleCsvEntry {
  adName: string
  connected: string
  interested: string
  meeting: string
  purchase: string
  finalStage: string
  comments: string
  lastCallDate: string
}

interface FunnelMetrics {
  total: number
  notAttempted: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  purchase: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface CallerRow {
  caller: string
  total: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface AdRow {
  adName: string
  caller: string
  total: number
  attempted: number
  connected: number
  interested: number
  conversionLeads: number
  noResponse: number
  notQualified: number
  invalid: number
}

interface ReasonBucket {
  label: string
  count: number
  leads: string[]
}

// ─── CSV Data (78 leads) ───────────────────────────────────────────

const CSV_DATA: Record<string, TeleCsvEntry> = {
  "2256609938208020": { "adName": "aparna_tamil_ registration free", "connected": "Yes", "interested": "Yes", "meeting": "Yes", "purchase": "", "finalStage": "ConversionLead", "comments": "not interested in peacehomes project,asked for a colling time as of now", "lastCallDate": "" },
  "1015499954503136": { "adName": "aparna_tamil_ registration free", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not looking for anything right now", "lastCallDate": "" },
  "942934792080626": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Switched Off", "lastCallDate": "" },
  "1314801077469895": { "adName": "aparna_tamil_ registration free", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "Switched Off", "lastCallDate": "" },
  "1026740796975622": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not Interested", "lastCallDate": "" },
  "1293191969517383": { "adName": "aparna_tamil_ registration free", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not Qualified", "lastCallDate": "" },
  "1548185776801172": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "ConversionLead", "comments": "Zoom Call not done yet", "lastCallDate": "" },
  "982806241227929": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour \u2013 Copy", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not Qualified", "lastCallDate": "" },
  "1751453312487302": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "2 calls done, coming to dubai soon", "lastCallDate": "" },
  "978386811669873": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "Zoom Call not done yet", "lastCallDate": "" },
  "1544115517187499": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1518276376511556": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "Retail shop, Asking for more time, seeking family decision", "lastCallDate": "" },
  "1299010888969086": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1486022169885819": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Interested, but doesn;t have money, Will pitch plan", "lastCallDate": "" },
  "1872115643750151": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "No response", "lastCallDate": "" },
  "4413817372230152": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "No response", "lastCallDate": "" },
  "1007575318521634": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not Interested", "lastCallDate": "" },
  "3881549372141060": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour \u2013 Copy", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Not Qualified", "lastCallDate": "" },
  "879201414586736": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour \u2013 Copy", "connected": "Yes", "interested": "Yes", "meeting": "Yes", "purchase": "", "finalStage": "ConversionLead", "comments": "Follow-up", "lastCallDate": "" },
  "1259129046138638": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Language problem, Will update", "lastCallDate": "" },
  "1821178168863268": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1674781150454075": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "Not connected", "lastCallDate": "" },
  "1286264990163356": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "Invalid", "comments": "Wrong number", "lastCallDate": "" },
  "2711415532563468": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1711931063328800": { "adName": "parna_tamil_aldar_ athlon_ApartmentTour \u2013 Copy", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1517408363190068": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1728033158237294": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1595557115239929": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Need retail shop, Not interested", "lastCallDate": "" },
  "1318854050410887": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "Coming to dubai next month, will update tomorrow", "lastCallDate": "" },
  "1167384088897058": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "1537189591371793": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "Yes", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "Lead transfer", "lastCallDate": "" },
  "1646917790771356": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "", "lastCallDate": "" },
  "2009469146333210": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "984261224376456": { "adName": "Suganya_Tamil_Project_Raw by Imtiaz", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1725196232054111": { "adName": "Suganya_Tamil_Project_Raw by Imtiaz", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1321344990112819": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1347189540706417": { "adName": "Aparna tamil imtiaz 97 lakhs_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1645938083363926": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1334598694733309": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "Client is Busy, will confirm about meeting", "lastCallDate": "" },
  "1370742041820203": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "2196147511179999": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "778128635388942": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1026264673121257": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1396782139224000": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "NotQualified", "comments": "Junk lead", "lastCallDate": "" },
  "1004655809095950": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call Not connected, Number not available on whatsapp", "lastCallDate": "" },
  "1523536869213881": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "2076494959597501": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "Invalid", "comments": "Junk lead", "lastCallDate": "" },
  "1675082057098046": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "Invalid", "comments": "Junk Lead", "lastCallDate": "" },
  "1401085918736454": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "1497435768230767": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "27301918972762354": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "", "lastCallDate": "" },
  "2800489726973022": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "", "purchase": "", "finalStage": "Invalid", "comments": "Junk Lead", "lastCallDate": "" },
  "1036671742156503": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "ConversionLead", "comments": "Meeting done, Given Requirements.", "lastCallDate": "" },
  "1791322915558842": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "815118391554804": { "adName": "Suganya_Tamil_Dubai Jabel Ali project", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "2125359638389108": { "adName": "Aparna tamil imtiaz 97 lakhs_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "Yes", "purchase": "", "finalStage": "ConversionLead", "comments": "meeting not done yet", "lastCallDate": "" },
  "1213246927531886": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "", "meeting": "", "purchase": "", "finalStage": "", "comments": "Same number as above", "lastCallDate": "" },
  "987032294118112": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Messages not seen", "lastCallDate": "" },
  "991342487046663": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "", "purchase": "", "finalStage": "Prospect", "comments": "call connected, agreed for meeting , but no reply after that", "lastCallDate": "" },
  "1008918558570902": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, not on whatsapp", "lastCallDate": "" },
  "1519121359779815": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "No", "meeting": "No", "purchase": "", "finalStage": "NotQualified", "comments": "Call connected, hasn't given any inquiry, Not interested", "lastCallDate": "" },
  "2182104152704423": { "adName": "Aparna tamil imtiaz 97 lakhs_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Messages not seen", "lastCallDate": "" },
  "756297257565093": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "Yes", "interested": "Yes", "meeting": "Yes", "purchase": "", "finalStage": "ConversionLead", "comments": "Call Connected, Client will come to Dubai and attend face to face meeting", "lastCallDate": "" },
  "1180434020935927": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "1014306490962191": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, received reply on whatsapp , asked for a meeting.", "lastCallDate": "" },
  "1737487303959142": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "997764493236476": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "27471087179248275": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "1018038653923132": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, received reply on whatsapp , asked for a meeting.", "lastCallDate": "" },
  "2571778533239746": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not Connected, replied on whatsapp Client right now busy. will connect after some time.", "lastCallDate": "" },
  "1545486713882181": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "Call Connected, Client right now busy unable to attend meeting, asked for details in whatsapp", "lastCallDate": "" },
  "1538951874393126": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "No", "interested": "", "meeting": "", "purchase": "", "finalStage": "NoResponse", "comments": "Call not connected, Whatsapp voice note also not seen", "lastCallDate": "" },
  "1551594123092474": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "2489499314831251": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1594931885383894": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1434766301746575": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1022144776960778": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
  "1759369488738936": { "adName": "Aparna tamil imtiaz 20_booking_17-06-2026", "connected": "", "interested": "", "meeting": "", "purchase": "", "finalStage": "Lead", "comments": "", "lastCallDate": "" },
}

// ─── Helpers ───────────────────────────────────────────────────────

function determineCaller(adName: string): string {
  const lower = adName.toLowerCase()
  if (lower.includes("aparna")) return "Aparna"
  if (lower.includes("suganya")) return "Suganya"
  return "Unknown"
}

function bucketReason(comments: string): string {
  const c = comments.toLowerCase()
  if (c.includes("junk")) return "Junk lead"
  if (c.includes("wrong number")) return "Wrong number"
  if (c.includes("not interested")) return "Not interested"
  if (c.includes("no response") || c.includes("not connected")) return "No response"
  if (c.includes("switched off")) return "Switched off"
  if (c.includes("language")) return "Language problem"
  if (c.includes("follow") || c.includes("will update")) return "Follow-up needed"
  if (c.includes("meeting") || c.includes("zoom") || c.includes("face to face")) return "Meeting scheduled"
  if (c.trim()) return "Other"
  return ""
}

function pct(n: number, d: number): string {
  if (!d) return "—"
  return (n / d * 100).toFixed(1) + "%"
}

// ─── Main Component ────────────────────────────────────────────────

export default function Telecalling() {
  const { currentClientId } = useClient()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [callerFilter, setCallerFilter] = useState("")
  const [adFilter, setAdFilter] = useState("")
  const [stageFilter, setStageFilter] = useState("")

  useEffect(() => {
    setLoading(true)
    getLeads(currentClientId)
      .then((data) => {
        const ls = data.leads || []
        // Filter to real leads (78) by checking if metaLeadId is in CSV data
        setLeads(ls.filter((l: any) => l.metaLeadId && CSV_DATA[l.metaLeadId]))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentClientId])

  // Enrich leads with CSV data
  const enriched = useMemo(() => {
    return leads.map((lead) => {
      const csv = CSV_DATA[lead.metaLeadId]
      const adName = csv?.adName || ""
      const caller = determineCaller(adName)
      return { ...lead, _csv: csv, _adName: adName, _caller: caller }
    })
  }, [leads])

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter((l) => {
      if (callerFilter && l._caller !== callerFilter) return false
      if (adFilter && l._adName !== adFilter) return false
      if (stageFilter && l.stage !== stageFilter) return false
      return true
    })
  }, [enriched, callerFilter, adFilter, stageFilter])

  // Funnel calculations
  const metrics = useMemo((): FunnelMetrics => {
    const m: FunnelMetrics = { total: 0, notAttempted: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, purchase: 0, noResponse: 0, notQualified: 0, invalid: 0 }

    for (const l of filtered) {
      const csv = l._csv
      const stage = l.stage
      m.total++
      if (!csv) continue

      const connectedCsv = csv.connected === "Yes"
      const connectedStage = ["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(stage) && stage !== "NoResponse" && stage !== "Invalid"
      const isConnected = connectedCsv || connectedStage

      const isAttempted = stage !== "Lead" || csv.connected !== "" || csv.comments !== ""
      const isInterested = csv.interested === "Yes" || ["Prospect", "ConversionLead", "Purchase"].includes(stage)
      const isConvLead = ["ConversionLead", "Purchase"].includes(stage)
      const isPurchase = stage === "Purchase" || csv.purchase === "Yes"
      const isNoResponse = stage === "NoResponse"
      const isNotQualified = stage === "NotQualified"
      const isInvalid = stage === "Invalid" || stage === "Duplicate" || csv.comments.toLowerCase().includes("wrong number") || csv.comments.toLowerCase().includes("junk")

      if (isAttempted) m.attempted++
      else m.notAttempted++
      if (isConnected) m.connected++
      if (isInterested) m.interested++
      if (isConvLead) m.conversionLeads++
      if (isPurchase) m.purchase++
      if (isNoResponse) m.noResponse++
      if (isNotQualified) m.notQualified++
      if (isInvalid) m.invalid++
    }
    return m
  }, [filtered])

  // Caller breakdown
  const callerData = useMemo(() => {
    const map = new Map<string, CallerRow>()
    for (const l of enriched) {
      const caller = l._caller
      if (!map.has(caller)) map.set(caller, { caller, total: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, noResponse: 0, notQualified: 0, invalid: 0 })
      const r = map.get(caller)!
      r.total++
      const csv = l._csv
      if (!csv) continue
      if (l.stage !== "Lead" || csv.connected !== "" || csv.comments !== "") r.attempted++
      const isConnected = csv.connected === "Yes" || (["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(l.stage) && l.stage !== "NoResponse" && l.stage !== "Invalid")
      if (isConnected) r.connected++
      if (csv.interested === "Yes" || ["Prospect", "ConversionLead", "Purchase"].includes(l.stage)) r.interested++
      if (["ConversionLead", "Purchase"].includes(l.stage)) r.conversionLeads++
      if (l.stage === "NoResponse") r.noResponse++
      if (l.stage === "NotQualified") r.notQualified++
      if (l.stage === "Invalid" || l.stage === "Duplicate" || csv.comments.toLowerCase().includes("wrong number") || csv.comments.toLowerCase().includes("junk")) r.invalid++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [enriched])

  // Ad breakdown
  const adData = useMemo(() => {
    const map = new Map<string, AdRow>()
    for (const l of enriched) {
      const adName = l._adName
      if (!adName) continue
      if (!map.has(adName)) map.set(adName, { adName, caller: l._caller, total: 0, attempted: 0, connected: 0, interested: 0, conversionLeads: 0, noResponse: 0, notQualified: 0, invalid: 0 })
      const r = map.get(adName)!
      r.total++
      const csv = l._csv
      if (!csv) continue
      if (l.stage !== "Lead" || csv.connected !== "" || csv.comments !== "") r.attempted++
      const isConnected = csv.connected === "Yes" || (["Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified"].includes(l.stage) && l.stage !== "NoResponse" && l.stage !== "Invalid")
      if (isConnected) r.connected++
      if (csv.interested === "Yes" || ["Prospect", "ConversionLead", "Purchase"].includes(l.stage)) r.interested++
      if (["ConversionLead", "Purchase"].includes(l.stage)) r.conversionLeads++
      if (l.stage === "NoResponse") r.noResponse++
      if (l.stage === "NotQualified") r.notQualified++
      if (l.stage === "Invalid" || l.stage === "Duplicate" || csv.comments.toLowerCase().includes("wrong number") || csv.comments.toLowerCase().includes("junk")) r.invalid++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [enriched])

  // Reason buckets
  const reasonBuckets = useMemo(() => {
    const map = new Map<string, ReasonBucket>()
    for (const l of enriched) {
      const csv = l._csv
      const comments = csv?.comments || ""
      const bucket = bucketReason(comments)
      if (!bucket) continue
      if (!map.has(bucket)) map.set(bucket, { label: bucket, count: 0, leads: [] })
      const b = map.get(bucket)!
      b.count++
      b.leads.push(l.name || l._csv?.fullName || "Unknown")
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [enriched])

  // Unique values for filters
  const uniqueCallers = useMemo(() => Array.from(new Set(enriched.map((l) => l._caller))).sort(), [enriched])
  const uniqueAds = useMemo(() => Array.from(new Set(enriched.map((l) => l._adName).filter(Boolean))).sort(), [enriched])
  const uniqueStages = useMemo(() => Array.from(new Set(enriched.map((l) => l.stage))).sort(), [enriched])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-muted text-sm">Loading telecalling data...</div></div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-tight">Telecalling Funnel</h1>
        <p className="text-sm text-muted mt-0.5">Read-only calling funnel analytics ({metrics.total} real leads)</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-muted font-medium">Filters:</span>
        <select value={callerFilter} onChange={(e) => setCallerFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All callers</option>
          {uniqueCallers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All ads</option>
          {uniqueAds.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="text-xs border border-card-border rounded-md px-2.5 py-1.5 bg-white text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-all-expo">
          <option value="">All stages</option>
          {uniqueStages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(callerFilter || adFilter || stageFilter) && (
          <button onClick={() => { setCallerFilter(""); setAdFilter(""); setStageFilter("") }} className="text-[11px] text-muted hover:text-[#0a0a0a] underline">Clear</button>
        )}
      </div>

      {/* Funnel Visualization */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Funnel</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-0">
            {[
              { label: "Total", value: metrics.total, color: "bg-[#0a0a0a]" },
              { label: "Attempted", value: metrics.attempted, color: "bg-[#2a2a2a]" },
              { label: "Connected", value: metrics.connected, color: "bg-[#4a4a4a]" },
              { label: "Interested", value: metrics.interested, color: "bg-[#6a6a6a]" },
              { label: "Conv. Lead", value: metrics.conversionLeads, color: "bg-[#8a8a8a]" },
              { label: "Purchase", value: metrics.purchase || 0, color: "bg-[#aaaaaa]" },
            ].map((s) => {
              const pctVal = metrics.total ? s.value / metrics.total : 0
              return (
                <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full mx-1 rounded-lg overflow-hidden" style={{ height: `${Math.max(pctVal * 120, 8)}px`, backgroundColor: s.color, opacity: pctVal > 0 ? 1 : 0.15 }} />
                  <span className="text-lg font-bold tabular-nums">{s.value}</span>
                  <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Funnel Table */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Stage</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Count</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">% of Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">% of Previous</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Total Leads", value: metrics.total, prev: metrics.total },
              { label: "Call Attempted", value: metrics.attempted, prev: metrics.total },
              { label: "Connected", value: metrics.connected, prev: metrics.attempted },
              { label: "Interested", value: metrics.interested, prev: metrics.connected },
              { label: "Conversion Lead", value: metrics.conversionLeads, prev: metrics.interested },
              { label: "Purchase", value: metrics.purchase, prev: metrics.conversionLeads },
            ].map((row) => (
              <tr key={row.label} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{row.label}</td>
                <td className="py-3 tabular-nums font-semibold">{row.value}</td>
                <td className="py-3 tabular-nums text-muted">{pct(row.value, metrics.total)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(row.value, row.prev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Leads", value: metrics.total },
          { label: "Not Attempted", value: metrics.notAttempted },
          { label: "Attempted", value: metrics.attempted, sub: pct(metrics.attempted, metrics.total), subLabel: "Attempt Rate" },
          { label: "Connected", value: metrics.connected, sub: pct(metrics.connected, metrics.attempted), subLabel: "Connect Rate" },
          { label: "Interested", value: metrics.interested, sub: pct(metrics.interested, metrics.connected), subLabel: "Interest Rate" },
          { label: "Conv. Leads", value: metrics.conversionLeads, sub: pct(metrics.conversionLeads, metrics.interested), subLabel: "Meeting Rate" },
          { label: "No Response", value: metrics.noResponse, sub: pct(metrics.noResponse, metrics.attempted), subLabel: "No-Resp Rate" },
          { label: "Not Qualified", value: metrics.notQualified, sub: pct(metrics.notQualified, metrics.connected), subLabel: "NQ Rate" },
          { label: "Invalid", value: metrics.invalid, sub: pct(metrics.invalid, metrics.total), subLabel: "Invalid Rate" },
          { label: "Purchase", value: metrics.purchase, sub: pct(metrics.purchase, metrics.conversionLeads), subLabel: "Purchase Rate" },
        ].map((card) => (
          <div key={card.label} className="kpi-card">
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{card.label}</p>
            <p className="text-[26px] font-bold text-[#0a0a0a] mt-1.5 tabular-nums tracking-tight leading-none">{card.value}</p>
            {card.sub && (
              <p className="text-xs text-muted mt-1">{card.sub} <span className="text-[9px]">({card.subLabel})</span></p>
            )}
          </div>
        ))}
      </div>

      {/* Caller Breakdown */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Caller Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Caller</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Attempted</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Attempt %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Connected</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Connect %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Interested</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Interest %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Conv. Leads</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Meeting %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">No Resp.</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">NQ</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-wider font-medium text-muted sticky top-0 z-2 bg-[#fafafa]">Invalid</th>
            </tr>
          </thead>
          <tbody>
            {callerData.map((r) => (
              <tr key={r.caller} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{r.caller}</td>
                <td className="py-3 tabular-nums font-semibold">{r.total}</td>
                <td className="py-3 tabular-nums">{r.attempted}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.attempted, r.total)}</td>
                <td className="py-3 tabular-nums">{r.connected}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.connected, r.attempted)}</td>
                <td className="py-3 tabular-nums">{r.interested}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.interested, r.connected)}</td>
                <td className="py-3 tabular-nums">{r.conversionLeads}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.conversionLeads, r.interested)}</td>
                <td className="py-3 tabular-nums text-muted">{r.noResponse}</td>
                <td className="py-3 tabular-nums text-muted">{r.notQualified}</td>
                <td className="py-3 pr-5 tabular-nums text-muted">{r.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ad Breakdown */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Ad Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Ad Name</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Caller</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Total</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Attempt %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Connect %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Interest %</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Conv. Leads</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">No Resp.</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">NQ</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-wider font-medium text-muted">Invalid</th>
            </tr>
          </thead>
          <tbody>
            {adData.map((r) => (
              <tr key={r.adName} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm max-w-[200px] truncate" title={r.adName}>{r.adName}</td>
                <td className="py-3 text-muted text-xs">{r.caller}</td>
                <td className="py-3 tabular-nums font-semibold">{r.total}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.attempted, r.total)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.connected, r.attempted)}</td>
                <td className="py-3 tabular-nums text-muted">{pct(r.interested, r.connected)}</td>
                <td className="py-3 tabular-nums">{r.conversionLeads}</td>
                <td className="py-3 tabular-nums text-muted">{r.noResponse}</td>
                <td className="py-3 tabular-nums text-muted">{r.notQualified}</td>
                <td className="py-3 pr-5 tabular-nums text-muted">{r.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reason Buckets */}
      <div className="border border-card-border rounded-xl overflow-hidden transition-all-expo hover:border-[#d4d4d4]">
        <div className="px-5 py-3 border-b border-card-border bg-[#fafafa]">
          <h2 className="text-[11px] uppercase tracking-wider font-medium text-muted">Reason Buckets (from Call Comments)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-card-border bg-[#fafafa]">
              <th className="px-5 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Reason</th>
              <th className="py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted">Count</th>
              <th className="py-2.5 pr-5 text-[11px] uppercase tracking-wider font-medium text-muted">Leads</th>
            </tr>
          </thead>
          <tbody>
            {reasonBuckets.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-6 text-center text-muted text-xs">No comments to bucket</td></tr>
            ) : reasonBuckets.map((b) => (
              <tr key={b.label} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-all-expo">
                <td className="px-5 py-3 font-medium text-[#0a0a0a] text-sm">{b.label}</td>
                <td className="py-3 tabular-nums font-semibold">{b.count}</td>
                <td className="py-3 pr-5 text-muted text-xs max-w-[400px] truncate" title={b.leads.join(", ")}>
                  {b.leads.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}