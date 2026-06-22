// services/format.js — presentation formatting only (no business rules).

const pad = (n) => String(n).padStart(2, '0');

/** YYYY.MM.DD HH:mm */
export function formatDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 방금 / n분 전 / n시간 전 / n일 전 / date(>=7일) */
export function formatRelative(ts) {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  if (diff < MIN) return '방금';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  return formatDate(ts).split(' ')[0];
}

/** '120m' (<1000m) | '1.2km' (>=1000m) */
export function formatDistance(m) {
  const n = Number(m);
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return `${Math.round(n)}m`;
  return `${(n / 1000).toFixed(1)}km`;
}

/** integer KRW with thousands separators + '원', e.g. 850000 -> '850,000원' */
export function formatWon(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0원';
  return `${Math.round(v).toLocaleString('en-US')}원`;
}
