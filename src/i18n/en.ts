import type { ru } from "./ru";

export const en: typeof ru = {
  siteTitle: "Travel places",
  pageTitleSuffix: "places",
  countries: { TH: "Thailand" },
  categories: {
    events: "Events",
    food: "Food",
    cafe: "Cafés",
    sights: "Temples & sights",
    markets: "Markets",
    nightlife: "Nightlife",
    shopping: "Shopping",
    spa: "Massage & spa",
    parks: "Parks & nature",
    hotels: "Hotels",
    coworking: "Coworking",
    activities: "Activities",
    uncategorized: "Uncategorized",
  },
  catOrder: [
    "events",
    "food",
    "cafe",
    "sights",
    "markets",
    "nightlife",
    "shopping",
    "spa",
    "parks",
    "hotels",
    "coworking",
    "activities",
  ],
  metrics: {
    fromList: "from your list",
    added: "agent's choice",
    events: "Events",
    onScreen: "on screen now",
    addedDetail: "not in your Google list",
    eventsDetail: "holidays and festivals around your trip dates",
    onScreenDetail: "after filters",
    cityDetail: (city: string) => `${city} and nearby areas`,
  },
  badges: {
    yourList: "your list",
    addedByMe: "agent's choice",
    dayTrip: "day trip",
  },
  tripNotes: {
    section: "Trip notes",
  },
  summary: {
    expand: "Show stats and trip notes",
    collapse: "Hide stats and trip notes",
  },
  hotel: {
    section: "My hotel",
    hotel: "Hotel",
    dates: "Dates",
    address: "Address",
    district: "Area",
    transit: "Getting around",
    rating: "Google Maps rating",
    map: "Map",
    openMaps: "Open in Google Maps",
    categoryShare: "Hotels",
  },
  filters: {
    section: "Filters",
    category: "Category",
    allCategories: "All categories",
    sort: "Sort",
    sortDistanceFrom: (label: string) => `Sort: distance from ${label}`,
    sortCategory: "Sort: by category",
    sortName: "Sort: by name",
    search: "Search",
    searchPlaceholder: "Name, area, note",
    onlyAdded: "Only agent's choice",
    hideHotels: "Hide hotels",
  },
  places: {
    sectionTitle: "Places",
    section: (n: number) => `Places · ${n}`,
    emptyLead: "Nothing matched",
    emptyBody: (n: number) => `Reset category or search — this city tab has ${n} places.`,
    yourNote: (note: string) => `Your note: ${note}`,
    myGoogleNote: "My note",
    googleMaps: "Google Maps",
    walk: "Walk",
    taxi: "Taxi (Grab / Bolt)",
    transit: "Public transit",
    mapsRating: (r: string) => `Google Maps rating: ${r}`,
  },
  routing: {
    section: "How taxi fares and routes are estimated",
    p1:
      "Taxi prices are rough estimates from the city file’s currency and tariff fields. Tune `transport.taxi` for your destination.",
    p2:
      "Driving distance and time use the public OSRM API when you run `npm run enrich-routes`, plus an optional traffic factor in the city file. Walking uses straight-line distance × 1.25 at the configured walk speed (default 4.7 km/h).",
    p3:
      "Each city page is static HTML. After you import places, re-run enrichment and rebuild before deploy.",
  },
  footnote:
    "`user_note` on list-sourced places is preserved from your Google Maps import and is not overwritten by agents. Route and price estimates do not replace live quotes from ride-hail apps or official departures.",
  sources: "Sources",
  backToTop: "Back to top",
  share: {
    label: "Share",
    toast: "Link copied",
    shareText: (name: string, cat: string) => `${name} — ${cat}`,
  },
  origins: {
    sectionOne: (label: string) => `My ${label}`,
    sectionTwo: (a: string, b: string) => `My ${a} and ${b}`,
    sectionMany: (leading: string, last: string) => `My ${leading} and ${last}`,
    routesFrom: (label: string) => `from ${label}`,
  },
  nav: {
    collapse: "Collapse navigation bar",
    expand: "Show language and city",
    reload: "Reload",
  },
  offline: {
    banner: "Offline — showing saved copy",
    updated: "Updated — refresh for latest",
  },
  theme: {
    switchToDark: "Switch to dark theme",
    switchToLight: "Switch to light theme",
  },
  lang: {
    switcher: "Language",
    ru: "RU",
    en: "EN",
    hint: "English version →",
    dismiss: "Dismiss",
  },
  city: {
    switcher: "City",
  },
  reviews: {
    one: (n: number) => `${n} review`,
    few: (n: number) => `${n} reviews`,
    many: (n: number) => `${n} reviews`,
  },
  formatStayRange: (checkIn: string, checkOut: string, timeZone: string) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    });
    return `${fmt.format(new Date(checkIn + "T12:00:00"))} – ${fmt.format(new Date(checkOut + "T12:00:00"))}`;
  },
  formatStayLabel: (label: string | undefined, checkIn: string, checkOut: string, timeZone: string) => {
    if (label?.trim()) {
      if (/[А-Яа-яЁё]/.test(label) || label.includes("–")) {
        return en.formatStayRange(checkIn, checkOut, timeZone);
      }
      return label;
    }
    return en.formatStayRange(checkIn, checkOut, timeZone);
  },
};
