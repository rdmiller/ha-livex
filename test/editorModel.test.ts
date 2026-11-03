import { describe, expect, it } from 'vitest';
import { applyForm, formData } from '../src/editorModel';

describe('formData', () => {
  it("shows livex's defaults where the YAML is silent", () => {
    const data = formData({ type: 'custom:livex-card' });
    expect(data).toMatchObject({
      view: 'fixed', mag: 1, clouds: true, borders: false, winds: '0', clock: 'local', interactive: true,
      embed: true, label: '0', callouts: false, sats: 'tracked',
    });
    expect(data).not.toHaveProperty('lat');
  });

  it('reads 0/1 switches and numbered choices as the form shows them', () => {
    expect(formData({ type: 'x', clouds: 0, borders: '1', label: 0 })).toMatchObject({ clouds: false, borders: true, label: '0' });
  });
});

describe('applyForm', () => {
  it('writes only what changed, leaving the rest of the YAML as written', () => {
    const config = { type: 'custom:livex-card', clouds: 0, satshow: 'iss' };
    const before = formData(config);
    const next = applyForm(config, before, { ...before, borders: true });
    expect(next).toEqual({ type: 'custom:livex-card', clouds: 0, satshow: 'iss', borders: true });
  });

  it('writes "only the tracked one" as no sats key at all', () => {
    const config = { type: 'x', sats: 'all' };
    const before = formData(config);
    expect(applyForm(config, before, { ...before, sats: 'tracked' })).toEqual({ type: 'x' });
  });

  it('drops a field set back to its default, or emptied', () => {
    const config = { type: 'x', radar: false, lat: 45, mag: 3 };
    const before = formData(config);
    const after: Record<string, unknown> = { ...before, radar: true, mag: 1 };
    delete after.lat;
    expect(applyForm(config, before, after)).toEqual({ type: 'x' });
  });
});
