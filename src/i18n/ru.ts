export type Locale = "ru" | "en";

export const ru = {
  siteTitle: "Места для поездки",
  pageTitleSuffix: "места",
  countries: { TH: "Таиланд" } as Record<string, string>,
  categories: {
    events: "Events",
    food: "Еда",
    cafe: "Кафе",
    sights: "Храмы и достопримечательности",
    markets: "Рынки",
    nightlife: "Ночная жизнь",
    shopping: "Шопинг",
    spa: "Массаж и спа",
    parks: "Парки и природа",
    hotels: "Отели",
    coworking: "Коворкинг",
    activities: "Активности",
    uncategorized: "Без категории",
  } as Record<string, string>,
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
    fromList: "из вашего списка",
    added: "agent's choice",
    events: "Events",
    onScreen: "сейчас на экране",
    addedDetail: "нет в вашем Google-списке",
    eventsDetail: "праздники и фестивали вокруг дат поездки",
    onScreenDetail: "после фильтров",
    cityDetail: (city: string) => `${city} и ближайшие окрестности`,
  },
  badges: {
    yourList: "ваш список",
    addedByMe: "agent's choice",
    dayTrip: "дневная поездка",
  },
  tripNotes: {
    section: "Заметки к поездке",
  },
  summary: {
    expand: "Показать сводку и заметки",
    collapse: "Скрыть сводку и заметки",
  },
  hotel: {
    section: "Мой отель",
    hotel: "Отель",
    dates: "Даты",
    address: "Адрес",
    district: "Район",
    transit: "Как добираться",
    rating: "Рейтинг Google Maps",
    map: "Карта",
    openMaps: "Открыть в Google Maps",
    categoryShare: "Отели",
  },
  filters: {
    section: "Фильтры",
    category: "Категория",
    allCategories: "Все категории",
    sort: "Сортировка",
    sortDistanceFrom: (label: string) => `Сортировка: расстояние от ${label}`,
    sortCategory: "Сортировка: по категории",
    sortName: "Сортировка: по названию",
    search: "Поиск",
    searchPlaceholder: "Название, район, заметка",
    onlyAdded: "Только agent's choice",
    hideHotels: "Скрыть отели",
  },
  places: {
    sectionTitle: "Места",
    section: (n: number) => `Места · ${n}`,
    emptyLead: "Ничего не нашлось",
    emptyBody: (n: number) =>
      `Сбросьте категорию или поисковый запрос — в этой вкладке есть ${n} точек.`,
    yourNote: (note: string) => `Ваша заметка: ${note}`,
    myGoogleNote: "Моя заметка",
    googleMaps: "Google Maps",
    walk: "Пешком",
    taxi: "Такси (Grab / Bolt)",
    transit: "Общественный транспорт",
    mapsRating: (r: string) => `Рейтинг Google Maps: ${r}`,
  },
  routing: {
    section: "Как считать такси и маршруты",
    p1:
      "Цены на такси — грубая оценка по полям тарифа в JSON примера. Для реального города настройте `transport.taxi` и валюту.",
    p2:
      "Автомобильные расстояния и время считаются через публичный OSRM при `npm run enrich-routes`, плюс коэффициент пробок в файле города. Пешком — прямая × 1,25 со скоростью из `routing.walk_speed_kmh` (по умолчанию 4,7 км/ч).",
    p3:
      "Страницы статические. После импорта мест снова запустите обогащение маршрутов и сборку перед деплоем.",
  },
  footnote:
    "Заметки `user_note` у мест из списка Google Maps сохраняются при импорте и не перезаписываются агентами. Оценки маршрутов и цен не заменяют живые расчёты в приложениях такси и официальное расписание.",
  sources: "Источники",
  backToTop: "Наверх",
  share: {
    label: "Поделиться",
    toast: "Ссылка скопирована",
    shareText: (name: string, cat: string) => `${name} — ${cat}`,
  },
  origins: {
    sectionOne: (label: string) => `Мои точки: ${label}`,
    sectionTwo: (a: string, b: string) => `Мои точки: ${a} и ${b}`,
    sectionMany: (leading: string, last: string) => `Мои точки: ${leading} и ${last}`,
    routesFrom: (label: string) => `от ${label}`,
  },
  theme: {
    switchToDark: "Включить тёмную тему",
    switchToLight: "Включить светлую тему",
  },
  nav: {
    collapse: "Свернуть панель навигации",
    expand: "Показать язык и город",
    reload: "Обновить",
  },
  offline: {
    banner: "Офлайн — показана сохранённая копия",
    updated: "Обновлено — обновите страницу",
  },
  lang: {
    switcher: "Язык",
    ru: "RU",
    en: "EN",
    hint: "English version →",
    dismiss: "Закрыть",
  },
  city: {
    switcher: "Город",
  },
  reviews: {
    one: (n: number) => `${n} отзыв`,
    few: (n: number) => `${n} отзыва`,
    many: (n: number) => `${n} отзывов`,
  },
  formatStayRange: (checkIn: string, checkOut: string, timeZone: string) => {
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    });
    return `${fmt.format(new Date(checkIn + "T12:00:00"))} – ${fmt.format(new Date(checkOut + "T12:00:00"))}`;
  },
  formatStayLabel: (label: string | undefined, checkIn: string, checkOut: string, timeZone: string) =>
    label?.trim() || ru.formatStayRange(checkIn, checkOut, timeZone),
};
