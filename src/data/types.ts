export interface RawLocation {
  name: string | null
  longitude: number | null
  latitude: number | null
  description?: string
}

export interface Person {
  name: string
  title: string
  organization: string
  party?: string
}

export interface ContactPerson {
  name: string
  title: string
  org: string
  phone?: string
  email?: string
}

export interface EventColor {
  main: string
  item: string
  itemSecondary: string
}

export interface EventUrls {
  url1?: string
  url2?: string
  url3?: string
  url4?: string
  facebookUrl?: string
  twitterUrl?: string
  instagramUrl?: string
  linkedinUrl?: string
  youtubeUrl?: string
}

/** Raw event as returned by gotland.se */
export interface RawEvent {
  id: string
  title: string
  uri: string
  url: string
  lastChange: string
  eventId: string
  location: RawLocation | null
  status: string
  date: string
  shortDate: string
  dateISO: string | null
  startTime: string
  endTime: string
  category: string | null
  eventType: string | null
  topic: string | null
  topic2: string | null
  languages: string | null
  accessibility: string | null
  urls: EventUrls | null
  interactiveLink: string
  interactiveLinkDescription: string
  digitalMeeting: string
  digitalArchiveUrl: string
  digitalStream: string
  streamService: string
  digitalStreamUrl: string
  organizer: string[]
  contactPerson1: ContactPerson | null
  contactPerson2: ContactPerson | null
  persons: Person[]
  showEmail: string
  showPhone: string
  description: string
  socialIssue: string
  color: EventColor
  weekDay: number
  weekDayName: string
}

/** Event after the enrich.ts pipeline pass — adds derived fields used by views. */
export interface EnrichedEvent extends RawEvent {
  /** Date+startTime as a real Date / ISO string for sorting and ranges. */
  startISO: string
  endISO: string
  /** Minutes between start and end. Null if endTime missing/malformed. */
  durationMin: number | null
  /** Day-of-week index 0..6 (Mon=0). */
  dayBucket: number
  /** Hour of day from startTime, 0..23. */
  hourBucket: number
  /** Unique non-"none" party affiliations among speakers. */
  parties: string[]
  /** Concatenated text used for keyword search + embeddings. */
  searchText: string
  /** Lowercased tags for filter chips. */
  topics: string[]
}

export interface EventsFile {
  generatedAt: string
  count: number
  events: EnrichedEvent[]
}
