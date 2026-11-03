// livex-card: a Home Assistant dashboard card showing livex.earth, the live globe, in an iframe.
// The card's YAML is the view's URL parameters (url.ts), and its visual editor covers the common
// ones (editorModel.ts) with Home Assistant's own form element.

import { FIELDS, DISPLAY_FIELDS, LAYER_FIELDS, VIEW_FIELDS, applyForm, formData, type Field } from './editorModel';
import { aspectRatio, baseUrl, livexUrl, type HassLike, type LivexCardConfig } from './url';

declare const __VERSION__: string;

interface Hass extends HassLike {
  [key: string]: unknown;
}

const STYLE = `
  :host { display: block; height: 100%; }
  ha-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .globe { position: relative; width: 100%; background: #000; flex: 1 1 auto; }
  iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
  .still iframe { pointer-events: none; }
`;

class LivexCard extends HTMLElement {
  private config?: LivexCardConfig;
  private _hass?: Hass;
  private _layout?: string;
  private card?: HTMLElement;
  private globe?: HTMLDivElement;
  private iframe?: HTMLIFrameElement;

  static getConfigElement(): HTMLElement {
    return document.createElement('livex-card-editor');
  }

  static getStubConfig(): Partial<LivexCardConfig> {
    return {};
  }

  setConfig(config: LivexCardConfig): void {
    if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
    baseUrl(config); // throws on a bad base_url, which the dashboard shows as the card's error
    this.config = config;
    this.render();
  }

  set hass(hass: Hass) {
    this._hass = hass;
    this.update();
  }

  /** "grid" in a sections view, where the dashboard sizes the card and the globe fills it. */
  set layout(layout: string | undefined) {
    this._layout = layout;
    this.update();
  }

  get layout(): string | undefined {
    return this._layout;
  }

  getCardSize(): number {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, rows: 6, min_columns: 4, min_rows: 2 };
  }

  private render(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = STYLE;
      this.card = document.createElement('ha-card');
      this.globe = document.createElement('div');
      this.globe.className = 'globe';
      this.iframe = document.createElement('iframe');
      this.iframe.title = 'livex.earth';
      this.iframe.loading = 'lazy';
      this.iframe.allow = 'fullscreen; clipboard-write';
      this.iframe.allowFullscreen = true;
      this.iframe.referrerPolicy = 'no-referrer';
      this.globe.append(this.iframe);
      this.card.append(this.globe);
      root.append(style, this.card);
    }
    this.update();
  }

  private update(): void {
    const config = this.config;
    if (!config || !this.card || !this.globe || !this.iframe) return;
    if (config.title) this.card.setAttribute('header', config.title);
    else this.card.removeAttribute('header');

    const fill = this._layout === 'grid' && !config.height;
    this.globe.style.aspectRatio = fill || config.height ? '' : aspectRatio(config.aspect_ratio);
    this.globe.style.height = config.height ?? (fill ? '100%' : '');
    this.globe.classList.toggle('still', config.interactive === false);

    // The hass object changes on every state change in the house; the page reloads only when the link does.
    const src = livexUrl(config, this._hass);
    if (this.iframe.getAttribute('src') !== src) this.iframe.setAttribute('src', src);
  }
}

interface HaFormSchema {
  name: string;
  type?: 'grid' | 'expandable';
  title?: string;
  flatten?: boolean;
  schema?: HaFormSchema[];
  selector?: Field['selector'];
}

const field = (f: Field): HaFormSchema => ({ name: f.name, selector: f.selector });
const [title, view, lat, lon, ...restView] = VIEW_FIELDS.map(field);

const SCHEMA: HaFormSchema[] = [
  title!,
  view!,
  { name: '', type: 'grid', schema: [lat!, lon!] },
  ...restView,
  { name: '', type: 'expandable', title: 'Layers', flatten: true, schema: LAYER_FIELDS.map(field) },
  { name: '', type: 'expandable', title: 'Display', flatten: true, schema: DISPLAY_FIELDS.map(field) },
];
const LABELS = new Map(FIELDS.map((f) => [f.name, f]));

/** The visual editor: Home Assistant's ha-form over the fields in editorModel.ts. */
class LivexCardEditor extends HTMLElement {
  private config?: LivexCardConfig;
  private data: Record<string, unknown> = {};
  private form?: HTMLElement & Record<string, unknown>;
  private _hass?: Hass;

  setConfig(config: LivexCardConfig): void {
    this.config = config;
    this.data = formData(config);
    this.render();
  }

  set hass(hass: Hass) {
    this._hass = hass;
    if (this.form) this.form.hass = hass;
  }

  private render(): void {
    if (!this.form) {
      const form = document.createElement('ha-form') as HTMLElement & Record<string, unknown>;
      form.schema = SCHEMA;
      form.computeLabel = (s: HaFormSchema) => LABELS.get(s.name)?.label ?? s.title ?? s.name;
      form.computeHelper = (s: HaFormSchema) => LABELS.get(s.name)?.helper;
      form.addEventListener('value-changed', (e) => this.changed((e as CustomEvent<{ value: Record<string, unknown> }>).detail.value));
      this.form = form;
      this.append(form);
    }
    this.form.hass = this._hass;
    this.form.data = this.data;
  }

  private changed(value: Record<string, unknown>): void {
    if (!this.config) return;
    const config = applyForm(this.config, this.data, value);
    this.config = config;
    this.data = formData(config);
    if (this.form) this.form.data = this.data;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
}

if (!customElements.get('livex-card')) customElements.define('livex-card', LivexCard);
if (!customElements.get('livex-card-editor')) customElements.define('livex-card-editor', LivexCardEditor);

const w = window as unknown as { customCards?: object[] };
w.customCards ??= [];
w.customCards.push({
  type: 'livex-card',
  name: 'livex.earth',
  description: 'The live globe from livex.earth: clouds, radar, storms, fires, lightning and satellites, facing your home.',
  preview: false,
  documentationURL: 'https://github.com/rdmiller/ha-livex',
});

console.info(`%c livex-card %c ${__VERSION__} `, 'color:#fff;background:#36909f;padding:2px 4px', 'color:#36909f;background:#000;padding:2px 4px');
