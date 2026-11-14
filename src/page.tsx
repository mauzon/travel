import {
  Page,
  Section,
  Text,
  Callout,
  Metrics,
  Select,
  Input,
  Toggle,
  Status,
  Footnote,
  Properties,
  BackToTop,
  useState,
  useMemo,
  useEffect,
  useGrokTheme,
} from "./ui";
import { MapsActions, HotelMapsActions, ShareToast } from "./share";
import type { CSSProperties } from "react";
import cityData from "./city-data.json";
import siteConfig from "./site-config.json";
import buildMeta from "./build-meta.json";
import type { CityData, PlaceRow } from "./types";
import { messages, reviewWord, type Locale, type Messages } from "./i18n";
import { UserNoteBlock, DescriptionBlock } from "./UserNote";
import {
  placeName,
  placeDescription,
  placeUserNote,
  placeWarning,
  placeSchedule,
  placeDistrict,
  transitDescription,
  walkLabel,
  taxiLabel,
  cityDisplayName,
  uiCallout,
  hotelTransit,
  hotelDistrict,
} from "./i18n/locale";
import { SiteHeader } from "./SiteHeader";
import { SourceIconBadge } from "./source-icons";
import {
  defaultOriginId,
  originLabel,
  originMatchesHotel,
  originsSectionHeading,
  parseSortKey,
  persistOrigin,
  placeWithOrigin,
  readInitialOrigin,
  resolveOrigins,
  sortKeyForOrigin,
  syncOriginQuery,
} from "./origins";
import { CategoryPill, CategoryChips, categorySlug } from "./CategoryUi";
import { resolveHotelMapsUrl, resolveOriginMapsUrl, resolvePlaceMapsUrl } from "./maps-link";
import { registerServiceWorkerHandlers } from "./pwa-client";

type DisplayPlace = {
  s: "u" | "a" | "e";
  n: string;
  c: string;
  a: string;
  maps: string;
  walk: string;
  taxi: string;
  pub: string;
  km: number;
  userNote?: string;
  description?: string;
  warn?: string;
  day?: boolean;
  icon?: string;
  rating?: number;
  reviews?: number;
  when?: string;
};

const data = cityData as CityData;

function catLabel(c: string, t: Messages): string {
  const cats = t.categories as Record<string, string>;
  return cats[c] ?? c;
}

function toDisplay(p: PlaceRow, locale: Locale): DisplayPlace {
  const s = p.source === "added" ? "a" : p.source === "event" ? "e" : "u";
  return {
    s,
    n: placeName(p, locale),
    c: p.category,
    a: placeDistrict(p, locale) || "",
    maps: resolvePlaceMapsUrl(p, data.name_en || data.name_ru),
    walk: walkLabel(p, locale),
    taxi: taxiLabel(p, locale),
    pub: transitDescription(p, locale),
    km: p.sort_km,
    userNote: placeUserNote(p),
    description: placeDescription(p, locale),
    warn: placeWarning(p, locale),
    day: p.daytrip,
    icon: p.icon,
    rating: p.rating?.value,
    reviews: p.rating?.count,
    when: placeSchedule(p, locale),
  };
}

function formatRating(hit: { value: number; count?: number }, t: Messages, locale: Locale): string {
  const r = String(hit.value).replace(".", locale === "ru" ? "," : ".");
  return hit.count ? `${r} · ${reviewWord(hit.count, t)}` : r;
}

function TravelIcon({ kind, label }: { kind: "walk" | "taxi" | "transit"; label: string }) {
  const theme = useGrokTheme();
  const color = theme.text.tertiary;
  return (
    <div className="travel-cell-icon" title={label} aria-label={label} style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
      {kind === "walk" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={color} role="img" aria-label={label}>
          <title>{label}</title>
          <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z" />
        </svg>
      ) : kind === "taxi" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={color} role="img" aria-label={label}>
          <title>{label}</title>
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={color} role="img" aria-label={label}>
          <title>{label}</title>
          <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z" />
        </svg>
      )}
    </div>
  );
}

function PlaceCard({
  p,
  t,
  locale,
  onCopied,
  routesFromLabel,
}: {
  p: DisplayPlace;
  t: Messages;
  locale: Locale;
  onCopied: () => void;
  routesFromLabel?: string;
}) {
  const theme = useGrokTheme();
  const added = p.s === "a";
  const isEvent = p.s === "e";
  const hit = p.rating != null ? { value: p.rating, count: p.reviews } : null;
  const card: CSSProperties = {
    border: `1px solid ${added || isEvent ? theme.border.strong : theme.border.default}`,
    borderRadius: theme.radius.lg,
    padding: 14,
    background: added || isEvent ? theme.fill.accentSubtle : theme.bg.elevated,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 };
  const cols: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 4,
  };
  const cell: CSSProperties = {
    background: theme.bg.subtle,
    borderRadius: theme.radius.md,
    padding: "5px 8px",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
  const v: CSSProperties = {
    fontFamily: theme.font.family,
    fontSize: theme.font.subtext.fontSize,
    lineHeight: theme.font.subtext.lineHeight,
    color: theme.text.primary,
    fontWeight: theme.weight.medium,
    flex: "1 1 auto",
    minWidth: 0,
  };
  return (
    <div className="place-card" style={card}>
      <div style={row}>
        <div
          style={{
            flex: "1 1 180px",
            fontFamily: theme.font.family,
            fontSize: theme.font.body1.fontSize,
            lineHeight: theme.font.body1.lineHeight,
            color: theme.text.primary,
            fontWeight: theme.weight.semibold,
          }}
        >
          {p.icon ? <span style={{ marginRight: 6 }}>{p.icon}</span> : null}
          {p.n}
        </div>
        <MapsActions
          mapsUrl={p.maps}
          name={p.n}
          categoryLabel={catLabel(p.c, t)}
          shareLabel={t.share.label}
          mapsLinkLabel={t.places.googleMaps}
          onCopied={onCopied}
        />
      </div>
      <div style={row}>
        {isEvent ? (
          <Status tone="warning">{t.metrics.events}</Status>
        ) : added ? (
          <SourceIconBadge kind="sparkles" label={t.badges.addedByMe} tone="accent" />
        ) : (
          <SourceIconBadge kind="list" label={t.badges.yourList} tone="success" />
        )}
        <CategoryPill category={p.c}>{catLabel(p.c, t)}</CategoryPill>
        {p.day ? <Status tone="warning">{t.badges.dayTrip}</Status> : null}
        {hit ? (
          <span
            title={t.places.mapsRating(formatRating(hit, t, locale))}
            aria-label={t.places.mapsRating(formatRating(hit, t, locale))}
            style={{
              fontFamily: theme.font.family,
              fontSize: theme.font.caption.fontSize,
              color: theme.text.secondary,
              fontWeight: theme.weight.medium,
            }}
          >
            ★ {formatRating(hit, t, locale)}
          </span>
        ) : null}
        {p.a ? (
          <span style={{ fontFamily: theme.font.family, fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>
            {p.a}
            {p.km
              ? locale === "ru"
                ? ` · ${String(p.km).replace(".", ",")} км`
                : ` · ${p.km.toFixed(1)} km`
              : ""}
          </span>
        ) : null}
      </div>
      {p.when ? (
        <div
          style={{
            fontFamily: theme.font.family,
            fontSize: theme.font.subtext.fontSize,
            color: theme.text.accent,
            fontWeight: theme.weight.semibold,
          }}
        >
          {p.when}
        </div>
      ) : null}
      {p.userNote ? <UserNoteBlock note={p.userNote} label={t.places.myGoogleNote} /> : null}
      {p.description ? <DescriptionBlock text={p.description} /> : null}
      {p.warn ? (
        <div style={{ fontFamily: theme.font.family, fontSize: theme.font.subtext.fontSize, color: theme.text.warning }}>
          {p.warn}
        </div>
      ) : null}
      {routesFromLabel ? (
        <div
          className="routes-from-label"
          style={{
            fontFamily: theme.font.family,
            fontSize: theme.font.caption.fontSize,
            color: theme.text.tertiary,
          }}
        >
          {t.origins.routesFrom(routesFromLabel)}
        </div>
      ) : null}
      <div className="travel-cols" style={cols}>
        <div className="travel-cell" style={cell}>
          <TravelIcon kind="walk" label={t.places.walk} />
          <span style={v}>{p.walk}</span>
        </div>
        <div className="travel-cell" style={cell}>
          <TravelIcon kind="taxi" label={t.places.taxi} />
          <span style={v}>{p.taxi}</span>
        </div>
        <div className="travel-cell" style={cell}>
          <TravelIcon kind="transit" label={t.places.transit} />
          <span style={v}>{p.pub}</span>
        </div>
      </div>
    </div>
  );
}

export default function TravelCityPage() {
  const meta = buildMeta as { locale: Locale; currentSlug: string; defaultCity: string };
  const locale = meta.locale === "en" ? "en" : "ru";
  const t = messages[locale];
  const cfg = siteConfig as { siteTitle: string; siteTitle_en?: string; defaultCity: string };

  const [shareToast, setShareToast] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [updatedToast, setUpdatedToast] = useState(false);
  useEffect(() => {
    if (!shareToast) return;
    const id = window.setTimeout(() => setShareToast(false), 2000);
    return () => window.clearTimeout(id);
  }, [shareToast]);
  useEffect(() => {
    if (!updatedToast) return;
    const id = window.setTimeout(() => setUpdatedToast(false), 4000);
    return () => window.clearTimeout(id);
  }, [updatedToast]);
  useEffect(() => {
    registerServiceWorkerHandlers({
      onOffline: () => setOfflineBanner(true),
      onOnline: () => setOfflineBanner(false),
      onUpdated: () => setUpdatedToast(true),
    });
  }, []);
  const onMapsCopied = () => setShareToast(true);

  const [cat, setCat] = useState<string>("all");
  const origins = useMemo(() => resolveOrigins(data), [data]);
  const defaultOid = defaultOriginId(origins);
  const initialOrigin = readInitialOrigin(meta.currentSlug, origins);
  const [originId, setOriginId] = useState(initialOrigin);
  const [sortKey, setSortKey] = useState(() => sortKeyForOrigin(initialOrigin));
  const [q, setQ] = useState("");
  const [onlyAdded, setOnlyAdded] = useState(false);
  const [hideHotels, setHideHotels] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const sortMode = parseSortKey(sortKey).mode;

  useEffect(() => {
    const parsed = parseSortKey(sortKey);
    if (parsed.originId) setOriginId(parsed.originId);
  }, [sortKey]);

  useEffect(() => {
    syncOriginQuery(defaultOid, originId);
    persistOrigin(meta.currentSlug, originId);
  }, [originId, defaultOid, meta.currentSlug]);

  const onSortKeyChange = (key: string) => {
    setSortKey(key);
    const parsed = parseSortKey(key);
    if (parsed.originId) setOriginId(parsed.originId);
  };

  const activeOriginLabel = originLabel(
    origins.find((o) => o.id === originId) ?? origins[0],
    locale,
  );
  const showRoutesFrom = origins.length > 1;

  const rawPlaces = useMemo(() => [...data.places, ...data.events], [data]);
  const places = useMemo(
    () => rawPlaces.map((p) => toDisplay(placeWithOrigin(p, originId), locale)),
    [rawPlaces, locale, originId],
  );
  const catOrder = t.catOrder;

  const hotel = data.hotel;
  const hotelRating = hotel.rating;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let rows = places.filter((p) => {
      if (cat !== "all" && p.c !== cat) return false;
      if (onlyAdded && p.s !== "a") return false;
      if (hideHotels && p.c === "hotels") return false;
      if (query) {
        const blob = `${p.n} ${p.a} ${p.userNote ?? ""} ${p.description ?? ""} ${p.when ?? ""} ${catLabel(p.c, t)}`.toLowerCase();
        if (!blob.includes(query)) return false;
      }
      return true;
    });
    rows = rows.slice();
    const loc = locale === "en" ? "en" : "ru";
    if (sortMode === "name") rows.sort((a, b) => a.n.localeCompare(b.n, loc));
    else if (sortMode === "category") {
      rows.sort((a, b) => {
        const ca = catOrder.indexOf(a.c);
        const cb = catOrder.indexOf(b.c);
        if (ca !== cb) return ca - cb;
        return a.km - b.km;
      });
    } else rows.sort((a, b) => a.km - b.km);
    return rows;
  }, [places, cat, sortMode, q, onlyAdded, hideHotels, locale, catOrder, t]);

  const userN = places.filter((p) => p.s === "u").length;
  const addedN = places.filter((p) => p.s === "a").length;
  const eventN = places.filter((p) => p.s === "e").length;
  const presentCats = catOrder.filter((c) => places.some((p) => p.c === c));
  const catOptions = [
    { value: "all", label: t.filters.allCategories },
    ...presentCats.map((c) => ({ value: c, label: catLabel(c, t) })),
  ];

  const grouped =
    sortMode === "category"
      ? presentCats
          .map((c) => ({ c, rows: filtered.filter((p) => p.c === c) }))
          .filter((g) => g.rows.length > 0)
      : [{ c: "", rows: filtered }];

  const warnCallout = uiCallout(data, "warning", locale);
  const infoCallout = uiCallout(data, "info", locale);
  const tripNotes = useMemo(() => {
    const items: Array<{ lead: string; body: string; tone: "warning" | "info" }> = [];
    if (warnCallout) items.push({ ...warnCallout, tone: "warning" });
    if (infoCallout) items.push({ ...infoCallout, tone: "info" });
    return items;
  }, [warnCallout, infoCallout]);
  const stayDates = t.formatStayLabel(
    hotel.stay.label,
    hotel.stay.check_in,
    hotel.stay.check_out,
    data.timezone || "Asia/Bangkok",
  );
  const countryLabel = t.countries[data.country] || data.country;
  const headerTitle = cityDisplayName(data, locale);
  const theme = useGrokTheme();
  const subtitleLeading = `${countryLabel} · ${stayDates} · `;

  return (
    <>
      <SiteHeader t={t} locale={locale} />
      <Page
        title={headerTitle}
        subtitle={
          <button
            type="button"
            className="page-subtitle page-summary-toggle"
            data-testid="page-summary-toggle"
            aria-expanded={summaryOpen}
            aria-label={summaryOpen ? t.summary.collapse : t.summary.expand}
            onClick={() => setSummaryOpen((v) => !v)}
            style={{
              ...theme.font.subtext,
              color: theme.text.secondary,
              margin: "8px 0 0",
            }}
          >
            <span className="page-subtitle-leading">{subtitleLeading}</span>
            <span className="page-subtitle-tail">
              {hotel.name}
              <span className={`chevron summary-chevron${summaryOpen ? " open" : ""}`} aria-hidden="true" />
            </span>
          </button>
        }
        width="wide"
        sources={data.sources}
        sourcesHeading={t.sources}
        belowHeader={
          summaryOpen ? (
            <div className="page-summary-inner">
              <Metrics
                metrics={[
                  {
                    value: String(userN),
                    icon: "list",
                    label: t.metrics.fromList,
                    detail: t.metrics.cityDetail(cityDisplayName(data, locale)),
                    key: "from-list",
                  },
                  {
                    value: String(addedN),
                    icon: "sparkles",
                    label: t.metrics.added,
                    detail: t.metrics.addedDetail,
                    key: "added",
                  },
                  { value: String(eventN), label: t.metrics.events, detail: t.metrics.eventsDetail, key: "events" },
                  {
                    value: String(filtered.length),
                    label: t.metrics.onScreen,
                    detail: t.metrics.onScreenDetail,
                    key: "on-screen",
                  },
                ]}
              />
              {tripNotes.length > 0 ? (
                <div className="page-trip-notes">
                  <h3 className="page-trip-notes-title">{`${t.tripNotes.section} (${tripNotes.length})`}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {tripNotes.map((note) => (
                      <Callout key={note.lead} tone={note.tone} lead={note.lead}>
                        {note.body}
                      </Callout>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
        }
      >
      <Section heading={originsSectionHeading(origins, locale, t)} collapsible defaultOpen={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {origins.map((o) => (
            <div key={o.id}>
              {origins.length > 1 ? (
                <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 600 }}>{originLabel(o, locale)}</h3>
              ) : null}
              {originMatchesHotel(o, hotel) ? (
                <Properties
                  items={[
                    { label: t.hotel.hotel, value: hotel.name },
                    { label: t.hotel.dates, value: stayDates },
                    { label: t.hotel.address, value: hotel.address },
                    { label: t.hotel.district, value: hotelDistrict(hotel, locale) },
                    { label: t.hotel.transit, value: hotelTransit(hotel, locale) },
                    ...(hotelRating
                      ? [{ label: t.hotel.rating, value: `★ ${formatRating(hotelRating, t, locale)}` }]
                      : []),
                    {
                      label: t.hotel.map,
                      value: (
                        <HotelMapsActions
                          mapsUrl={resolveHotelMapsUrl(hotel, data.name_en || data.name_ru)}
                          name={hotel.name}
                          categoryLabel={t.hotel.categoryShare}
                          shareLabel={t.share.label}
                          openMapsLabel={t.hotel.openMaps}
                          onCopied={onMapsCopied}
                        />
                      ),
                    },
                  ]}
                />
              ) : (
                <Properties
                  items={[
                    ...(o.google_maps_url || o.google
                      ? [
                          {
                            label: t.hotel.map,
                            value: (
                              <a
                                href={resolveOriginMapsUrl(o, data.name_en || data.name_ru)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t.hotel.openMaps}
                              </a>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section heading={t.filters.section}>
        <CategoryChips
          ariaLabel={t.filters.category}
          options={catOptions}
          value={cat}
          onChange={setCat}
        />
        <div className="filters-controls">
          <div className="cat-filter-native">
            <Select
              label={t.filters.category}
              value={cat}
              onChange={setCat}
              options={catOptions}
              selectClassName={`cat-filter-select cat-filter-select--${categorySlug(cat)}`}
            />
          </div>
          <Select
            label={t.filters.sort}
            value={sortKey}
            onChange={onSortKeyChange}
            selectDataTestId="sort-select"
            options={[
              ...origins.map((o) => ({
                value: sortKeyForOrigin(o.id),
                label: t.filters.sortDistanceFrom(originLabel(o, locale)),
              })),
              { value: "category", label: t.filters.sortCategory },
              { value: "name", label: t.filters.sortName },
            ]}
          />
          <div className="filters-search-cell">
            <Input label={t.filters.search} value={q} onChange={setQ} placeholder={t.filters.searchPlaceholder} />
          </div>
        </div>
        <div className="filters-toggles">
          <Toggle label={t.filters.onlyAdded} value={onlyAdded} onChange={setOnlyAdded} />
          <Toggle label={t.filters.hideHotels} value={hideHotels} onChange={setHideHotels} />
        </div>
      </Section>

      {filtered.length === 0 ? (
        <Callout tone="info" lead={t.places.emptyLead}>
          {t.places.emptyBody(places.length)}
        </Callout>
      ) : (
        grouped.map((g) => (
          <Section
            key={g.c || "all"}
            heading={g.c ? catLabel(g.c, t) : t.places.sectionTitle}
            headingCount={g.c ? g.rows.length : filtered.length}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.rows.map((p) => (
                <PlaceCard
                  key={`${p.s}-${p.n}-${p.km}`}
                  p={p}
                  t={t}
                  locale={locale}
                  onCopied={onMapsCopied}
                  routesFromLabel={showRoutesFrom ? activeOriginLabel : undefined}
                />
              ))}
            </div>
          </Section>
        ))
      )}

      {data.ui?.routing_section !== false ? (
        <Section heading={t.routing.section} collapsible defaultOpen={false}>
          <Text>{t.routing.p1}</Text>
          <Text>{t.routing.p2}</Text>
          <Text>{t.routing.p3}</Text>
        </Section>
      ) : null}

      <Footnote>{t.footnote}</Footnote>
      <BackToTop label={t.backToTop} />
      <ShareToast visible={shareToast} message={t.share.toast} />
      <ShareToast visible={updatedToast} message={t.offline.updated} />
      {offlineBanner ? (
        <div role="status" aria-live="polite" className="offline-banner">
          {t.offline.banner}
        </div>
      ) : null}
    </Page>
    </>
  );
}
