// What the visual editor offers: the options most dashboards want, each with livex's own default
// for an embedded globe (embed=1, which the card asks for), so the form shows what it will do. A field set back to its default leaves the
// YAML, which keeps a card's config down to what it changes. Everything else stays YAML only.

import type { LivexCardConfig } from './url';

type Selector =
  | { text: Record<string, never> }
  | { boolean: Record<string, never> }
  | { number: { min: number; max: number; step: number | 'any'; mode: 'box' | 'slider' } }
  | { select: { mode: 'dropdown'; options: { value: string; label: string }[] } };

export interface Field {
  name: string;
  label: string;
  selector: Selector;
  /** What livex (or the card) does when the key is absent; undefined: nothing until it's set. A value livex doesn't take (`tracked`) only stands for the key's absence. */
  default?: string | number | boolean;
  helper?: string;
}

const choice = (...options: [string, string][]): Selector => ({
  select: { mode: 'dropdown', options: options.map(([value, label]) => ({ value, label })) },
});
const toggle = (name: string, label: string, def: boolean): Field => ({ name, label, selector: { boolean: {} }, default: def });

export const VIEW_FIELDS: Field[] = [
  { name: 'title', label: 'Title', selector: { text: {} } },
  {
    name: 'view', label: 'View', default: 'fixed',
    selector: choice(['fixed', 'Fixed over a place'], ['sky', 'Sky from a place'], ['sunrel', 'Following the Sun'],
      ['orbit', 'Orbiting'], ['moon', 'From the Moon'], ['track', 'Tracking a satellite']),
  },
  { name: 'lat', label: 'Latitude', helper: "Empty: your home's", selector: { number: { min: -90, max: 90, step: 'any', mode: 'box' } } },
  { name: 'lon', label: 'Longitude', helper: "Empty: your home's", selector: { number: { min: -180, max: 180, step: 'any', mode: 'box' } } },
  { name: 'mag', label: 'Zoom', default: 1, selector: { number: { min: 0.05, max: 500, step: 'any', mode: 'box' } } },
  { name: 'track', label: 'Track', default: 'iss', helper: 'For the tracking view; a NORAD number works too', selector: { text: {} } },
];

export const LAYER_FIELDS: Field[] = [
  toggle('clouds', 'Clouds', true),
  { name: 'imagery', label: 'Imagery', default: 'daily', selector: choice(['live', 'Live satellite pictures'], ['daily', "Yesterday's, zoomed in"], ['painted', 'Painted only']) },
  toggle('radar', 'Radar', true),
  toggle('severe', 'Severe weather warnings', true),
  toggle('lightning', 'Lightning', true),
  toggle('storms', 'Tropical storms', true),
  toggle('fires', 'Fires', true),
  toggle('quakes', 'Earthquakes', true),
  toggle('tsunami', 'Tsunami alerts', true),
  toggle('aurora', 'Aurora', true),
  toggle('events', 'GDACS events', true),
  toggle('snow', 'Snow and ice', true),
  toggle('smoke', 'Smoke', false),
  { name: 'winds', label: 'Winds', default: '0', selector: choice(['0', 'Off'], ['surface', 'Surface'], ['jet', 'Jet stream']) },
  toggle('launches', 'Launches', true),
  toggle('callouts', 'Hazard and launch labels', false),
  {
    name: 'sats', label: 'Satellites', default: 'tracked',
    selector: choice(['tracked', 'Only the tracked one'], ['all', 'All'], ['featured', 'Named only'], ['0', 'None']),
  },
  toggle('borders', 'Borders', false),
  toggle('markers', 'City names', true),
  toggle('lights', 'Night lights', true),
];

export const DISPLAY_FIELDS: Field[] = [
  { name: 'label', label: 'Status readout', default: '0', selector: choice(['0', 'Off'], ['short', 'Short'], ['1', 'Full']) },
  { name: 'clock', label: 'Clock', default: 'local', selector: choice(['local', 'Local'], ['utc', 'UTC'], ['both', 'Both']) },
  { name: 'sharp', label: 'Sharpness', default: 'full', helper: 'Lower is easier on a wall tablet', selector: choice(['full', 'Full'], ['balanced', 'Balanced'], ['saver', 'Saver']) },
  toggle('interactive', 'Drag and click the globe', true),
  { ...toggle('embed', 'Just the globe', true), helper: "Off: livex's full page, panels and controls and all" },
  { name: 'aspect_ratio', label: 'Aspect ratio', default: '1', helper: 'Like 16:9; a sections view sizes the card itself', selector: { text: {} } },
];

export const FIELDS: Field[] = [...VIEW_FIELDS, ...LAYER_FIELDS, ...DISPLAY_FIELDS];
const BY_NAME = new Map(FIELDS.map((f) => [f.name, f]));

/** A YAML value as the field shows it: `0`/`1` and `'0'`/`'1'` as switches, numbers in a select as strings. */
function shown(f: Field, v: unknown): unknown {
  if ('boolean' in f.selector) {
    if (v === 0 || v === '0' || v === 'false' || v === 'off') return false;
    if (v === 1 || v === '1' || v === 'true' || v === 'on') return true;
    return typeof v === 'boolean' ? v : undefined;
  }
  if ('select' in f.selector && (typeof v === 'number' || typeof v === 'boolean')) return v === true ? '1' : v === false ? '0' : String(v);
  return v;
}

/** The form's data: each field's value from the config, or its default. */
export function formData(config: LivexCardConfig): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = shown(f, config[f.name]);
    if (v !== undefined && v !== '') data[f.name] = v;
    else if (f.default !== undefined) data[f.name] = f.default;
  }
  return data;
}

/**
 * The config after the form changed from `before` to `after`. Only the fields that changed are
 * written, so the rest of the YAML keeps the way it was written; a field back at its default,
 * or emptied, leaves the YAML.
 */
export function applyForm(config: LivexCardConfig, before: Record<string, unknown>, after: Record<string, unknown>): LivexCardConfig {
  const next: LivexCardConfig = { ...config };
  for (const [name, v] of Object.entries(after)) {
    const f = BY_NAME.get(name);
    if (!f || before[name] === v) continue;
    if (v === undefined || v === '' || v === null || v === f.default) delete next[name];
    else next[name] = v;
  }
  for (const name of Object.keys(before)) {
    if (BY_NAME.has(name) && !(name in after)) delete next[name];
  }
  return next;
}
