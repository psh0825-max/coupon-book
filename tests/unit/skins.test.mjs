import test from 'node:test';
import assert from 'node:assert/strict';
import { getCategoryIcon, getDefaultSkin } from '../../static/js/data/skins.js';

test('getCategoryIcon: known category returns its emoji', () => {
  assert.equal(getCategoryIcon('카페'), '☕');
  assert.equal(getCategoryIcon('병원'), '🏥');
});

test('getCategoryIcon: unknown category returns default', () => {
  assert.equal(getCategoryIcon('우주정거장'), '🏪');
  assert.equal(getCategoryIcon(undefined), '🏪');
});

test('getDefaultSkin: known category returns its skin', () => {
  assert.equal(getDefaultSkin('카페'), 'espresso');
  assert.equal(getDefaultSkin('병원'), 'stone');
});

test('getDefaultSkin: unknown category returns midnight', () => {
  assert.equal(getDefaultSkin('우주정거장'), 'midnight');
  assert.equal(getDefaultSkin(undefined), 'midnight');
});
