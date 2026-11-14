export type CityConfig = {
  defaultCity: string;
  siteTitle: string;
  cities: { slug: string; title: string; dates: string }[];
};

export type BuildMeta = {
  currentSlug: string;
  locale: "ru" | "en";
  defaultCity: string;
  alternates?: { lang: string; href: string }[];
};

export type Rating = { value: number; count?: number };

export type GoogleMapsFields = {
  cid?: string;
  place_id?: string;
  mid?: string;
  /** Original user/list maps link when it is already a valid Maps URL */
  maps_url?: string;
  feature_id?: string;
};

export type OriginRow = {
  id: string;
  label_ru: string;
  label_en: string;
  kind: "hotel" | "venue" | "other";
  default?: boolean;
  lat: number;
  lng: number;
  google_maps_url?: string;
  google?: GoogleMapsFields;
};

export type OriginRouteBundle = {
  walk?: PlaceRow["walk"];
  taxi?: PlaceRow["taxi"];
  transit?: PlaceRow["transit"];
  sort_km?: number;
};

export type CityData = {
  slug: string;
  name_ru: string;
  name_en?: string;
  timezone?: string;
  origins?: OriginRow[];
  hotel: {
    name: string;
    name_en?: string;
    address: string;
    lat: number;
    lng: number;
    maps_url: string;
    google?: GoogleMapsFields;
    district?: string;
    district_en?: string;
    rating?: Rating;
    stay: { check_in: string; check_out: string; label?: string };
    transit_description?: string;
    transit_description_en?: string;
  };
  places: PlaceRow[];
  events: PlaceRow[];
  sources: string[];
  ui?: {
    summary?: string;
    callouts?: {
      warning?: { lead: string; body: string; lead_en?: string; body_en?: string };
      info?: { lead: string; body: string; lead_en?: string; body_en?: string };
    };
    summary_en?: string;
    routing_section?: boolean;
  };
};

export type PlaceRow = {
  id: string;
  name: string;
  name_ru?: string;
  name_en?: string;
  category: string;
  source: "list" | "added" | "event";
  user_note?: string;
  description?: string;
  description_en?: string;
  note_en?: string;
  warning?: string;
  warning_en?: string;
  icon?: string;
  district?: string;
  lat?: number;
  lng?: number;
  maps_url: string;
  maps_place_id?: string;
  google?: GoogleMapsFields;
  address?: string;
  rating?: Rating;
  walk?: { km?: number; min?: number; label?: string; practical?: boolean };
  taxi?: {
    km?: number;
    min_low?: number;
    min_high?: number;
    thb_min?: number;
    thb_max?: number;
    label?: string;
  };
  transit?: { min?: number; description?: string; description_en?: string; mode?: string };
  routes?: Record<string, OriginRouteBundle>;
  sort_km: number;
  daytrip?: boolean;
  schedule_text?: string;
  schedule_en?: string;
};
