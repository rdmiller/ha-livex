// The livex.earth link a card shows: every key in the card's YAML that isn't the card's own
// becomes a URL parameter, so any view livex.earth can show, a dashboard can too, including
// parameters added to livex after this card was released. Where the YAML is silent, the card
// asks for livex's embedded view (just the globe; `embed: false` brings the full page back)
// without city names, and fills in what Home Assistant already knows: the home's position, its
// units and its clock.

export const DEFAULT_BASE = 'https://livex.earth/';

/** A value a YAML key can hold that becomes a parameter: `true`/`false` are 1/0, a list is joined with commas. */
export type ParamValue = string | number | boolean | readonly (string | number)[];

export interface LivexCardConfig {
  type: string;
  /** A header above the globe. */
  title?: string;
  /** Another livex host, for a self-hosted copy. */
  base_url?: string;
  /** The globe's shape outside a sections view, as CSS `aspect-ratio` (`1`, `16/9`, `4:3`). */
  aspect_ratio?: string | number;
  /** A fixed height (CSS length) in place of the aspect ratio. */
  height?: string;
  /** false: the globe can't be dragged or clicked, so a phone scrolls past it. */
  interactive?: boolean;
  /** false: leave out the home's position when the YAML gives none. */
  home?: boolean;
  [param: string]: unknown;
}

/** The keys the card reads itself, and the ones Home Assistant adds to every card. */
export const CARD_KEYS: ReadonlySet<string> = new Set([
  'type', 'title', 'base_url', 'aspect_ratio', 'height', 'interactive', 'home',
  'view_layout', 'layout_options', 'grid_options', 'visibility', 'card_mod',
]);

/** The parts of Home Assistant's `hass` object the link reads. */
export interface HassLike {
  config?: {
    latitude?: number;
    longitude?: number;
    unit_system?: { length?: string };
  };
  locale?: { time_format?: string };
}

/** Views where `lat`/`lon` name a place on the ground; elsewhere they mean something else. */
const PLACE_VIEWS = new Set(['fixed', 'sky']);

/** One decimal place, about 10 km: enough to face the home, not enough to find the house. */
const roundHome = (v: number) => Math.round(v * 10) / 10;

export function paramValue(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : undefined;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(String).join(',');
  return undefined;
}

/** The livex parameters a config sets, in YAML order, with Home Assistant's defaults where it's silent. */
export function livexParams(config: LivexCardConfig, hass?: HassLike): [string, string][] {
  const out: [string, string][] = [];
  const set = new Set<string>();
  for (const [key, raw] of Object.entries(config)) {
    if (CARD_KEYS.has(key)) continue;
    const v = paramValue(raw);
    if (v === undefined) continue;
    out.push([key, v]);
    set.add(key);
  }

  const view = typeof config.view === 'string' ? config.view : 'fixed';
  const lat = hass?.config?.latitude;
  const lon = hass?.config?.longitude;
  if (config.home !== false && PLACE_VIEWS.has(view) && !set.has('lat') && !set.has('lon') &&
      typeof lat === 'number' && typeof lon === 'number') {
    out.unshift(['lat', String(roundHome(lat))], ['lon', String(roundHome(lon))]);
  }

  const length = hass?.config?.unit_system?.length;
  if (!set.has('units') && (length === 'km' || length === 'mi')) out.push(['units', length === 'mi' ? 'imperial' : 'metric']);
  const hours = hass?.locale?.time_format;
  if (!set.has('hours') && (hours === '12' || hours === '24')) out.push(['hours', hours]);
  if (!set.has('clock')) out.push(['clock', 'local']);
  if (!set.has('markers')) out.push(['markers', '0']);
  if (!set.has('embed')) out.push(['embed', '1']);
  return out;
}

/** The base must be an http(s) URL; anything else is a config error. */
export function baseUrl(config: LivexCardConfig): URL {
  const base = config.base_url ?? DEFAULT_BASE;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`base_url isn't a URL: ${base}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`base_url must be http or https: ${base}`);
  return url;
}

export function livexUrl(config: LivexCardConfig, hass?: HassLike): string {
  const url = baseUrl(config);
  for (const [k, v] of livexParams(config, hass)) url.searchParams.set(k, v);
  return url.toString();
}

/** CSS `aspect-ratio` from YAML's `16:9`, `16/9`, `1.5` or `56%` (the Webpage card's form, height over width). */
export function aspectRatio(v: string | number | undefined): string {
  if (v === undefined || v === '') return '1';
  if (typeof v === 'number') return v > 0 ? String(v) : '1';
  const s = v.trim();
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(s);
  if (pct) return Number(pct[1]) > 0 ? `100 / ${pct[1]}` : '1';
  const pair = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (pair) return `${pair[1]} / ${pair[2]}`;
  return Number(s) > 0 ? s : '1';
}
