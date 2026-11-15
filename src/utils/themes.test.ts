import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_THEMES, getThemeById } from './themes.ts';

test('APP_THEMES provides 6 distinct sensory-friendly dark and light themes', () => {
  assert.equal(APP_THEMES.length, 6);
  const ids = new Set(APP_THEMES.map((t) => t.id));
  assert.equal(ids.size, 6);

  const modes = new Set(APP_THEMES.map((t) => t.mode));
  assert.ok(modes.has('dark'));
  assert.ok(modes.has('light'));

  for (const theme of APP_THEMES) {
    assert.equal(theme.previewSwatches.length, 3);
    assert.equal(theme.canvasBg.length, 3);
    assert.ok(theme.name.length > 0);
  }
});

test('getThemeById returns matching theme or falls back to midnight_sanctuary', () => {
  const washi = getThemeById('warm_parchment');
  assert.equal(washi.id, 'warm_parchment');
  assert.equal(washi.mode, 'light');

  const fallback = getThemeById('non_existent_theme');
  assert.equal(fallback.id, 'midnight_sanctuary');
});
