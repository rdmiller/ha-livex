import { describe, expect, it } from 'vitest';
import { aspectRatio, livexParams, livexUrl, paramValue } from '../src/url';

const HOME = {
  config: { latitude: 44.97781, longitude: -93.26501, unit_system: { length: 'mi' } },
  locale: { time_format: '12' },
};

describe('livexUrl', () => {
  it('faces the home, rounded to a tenth of a degree, in its units and clock', () => {
    expect(livexUrl({ type: 'custom:livex-card' }, HOME)).toBe(
      'https://livex.earth/?lat=45&lon=-93.3&units=imperial&hours=12&clock=local&embed=1',
    );
  });

  it('passes every other key through as a parameter, in YAML order', () => {
    const url = new URL(livexUrl({ type: 'custom:livex-card', mag: 2.6, radar: false, winds: 'jet', satshow: ['iss', 'gps'] }));
    expect([...url.searchParams]).toEqual([['mag', '2.6'], ['radar', '0'], ['winds', 'jet'], ['satshow', 'iss,gps'], ['clock', 'local'], ['embed', '1']]);
  });

  it("keeps the card's own keys and Home Assistant's out of the link", () => {
    const url = livexUrl({
      type: 'custom:livex-card', title: 'Globe', aspect_ratio: '16:9', height: '400px', interactive: false,
      grid_options: { rows: 4 }, visibility: [{ condition: 'screen' }], view_layout: { position: 'main' },
    });
    expect(url).toBe('https://livex.earth/?clock=local&embed=1');
  });

  it("uses the YAML's own lat, lon, units, hours and clock over Home Assistant's", () => {
    const params = livexParams({ type: 'x', lat: 60, lon: -100, units: 'metric', hours: '24', clock: 'utc', embed: false }, HOME);
    expect(params).toEqual([['lat', '60'], ['lon', '-100'], ['units', 'metric'], ['hours', '24'], ['clock', 'utc'], ['embed', '0']]);
  });

  it("leaves the home out with home: false, or a lat or lon of the YAML's own", () => {
    expect(livexParams({ type: 'x', home: false }, HOME).map(([k]) => k)).not.toContain('lat');
    expect(livexParams({ type: 'x', lat: 10 }, HOME).filter(([k]) => k === 'lon')).toEqual([]);
  });

  it('faces the home only in views where lat and lon are a place', () => {
    expect(livexParams({ type: 'x', view: 'sky' }, HOME)[0]).toEqual(['lat', '45']);
    for (const view of ['sunrel', 'orbit', 'track', 'moon']) {
      expect(livexParams({ type: 'x', view }, HOME).map(([k]) => k)).not.toContain('lat');
    }
  });

  it('takes a self-hosted base and rejects anything but http(s)', () => {
    expect(livexUrl({ type: 'x', base_url: 'http://nas.local:8080/xearth/', clock: 'utc', embed: 1 })).toBe('http://nas.local:8080/xearth/?clock=utc&embed=1');
    expect(() => livexUrl({ type: 'x', base_url: 'javascript:alert(1)' })).toThrow(/http or https/);
    expect(() => livexUrl({ type: 'x', base_url: 'not a url' })).toThrow(/isn't a URL/);
  });
});

describe('paramValue', () => {
  it('writes switches as 1/0 and drops what a URL cannot hold', () => {
    expect(paramValue(true)).toBe('1');
    expect(paramValue(0)).toBe('0');
    expect(paramValue(null)).toBeUndefined();
    expect(paramValue(Number.NaN)).toBeUndefined();
    expect(paramValue({ a: 1 })).toBeUndefined();
  });
});

describe('aspectRatio', () => {
  it("reads 16:9, 16/9, a number, and the Webpage card's percent", () => {
    expect(aspectRatio('16:9')).toBe('16 / 9');
    expect(aspectRatio('4/3')).toBe('4 / 3');
    expect(aspectRatio(1.5)).toBe('1.5');
    expect(aspectRatio('50%')).toBe('100 / 50');
    expect(aspectRatio(undefined)).toBe('1');
    expect(aspectRatio('wide')).toBe('1');
  });
});
