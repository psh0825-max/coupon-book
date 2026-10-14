import test from 'node:test';
import assert from 'node:assert/strict';
import { mapViewUrl, mapsDirectionsUrl } from '../../static/js/services/maps.js';

test('mapsDirectionsUrl: coordinates use Kakao link/to with encoded Korean name', () => {
  assert.equal(
    mapsDirectionsUrl({ name: '카페 봄', lat: 37.5665, lng: 126.978 }),
    'https://map.kakao.com/link/to/%EC%B9%B4%ED%8E%98%20%EB%B4%84,37.5665,126.978'
  );
});

test('mapsDirectionsUrl: commas in name are sanitized', () => {
  assert.equal(
    mapsDirectionsUrl({ name: '카페, 봄,날', lat: 37.5, lng: 127 }),
    'https://map.kakao.com/link/to/%EC%B9%B4%ED%8E%98%20%20%EB%B4%84%20%EB%82%A0,37.5,127'
  );
});

test('mapsDirectionsUrl: address-only uses Kakao search and empty destination returns blank', () => {
  assert.equal(mapsDirectionsUrl({ address: '서울시 중구 세종대로 1' }), 'https://map.kakao.com/link/search/%EC%84%9C%EC%9A%B8%EC%8B%9C%20%EC%A4%91%EA%B5%AC%20%EC%84%B8%EC%A2%85%EB%8C%80%EB%A1%9C%201');
  assert.equal(mapsDirectionsUrl({}), '');
});

test('mapViewUrl: coordinates use Kakao link/map', () => {
  assert.equal(
    mapViewUrl({ name: '카페 봄', lat: 37.5665, lng: 126.978 }),
    'https://map.kakao.com/link/map/%EC%B9%B4%ED%8E%98%20%EB%B4%84,37.5665,126.978'
  );
});
