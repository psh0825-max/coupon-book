import { getCategoryIcon } from './skins.js';

/* ===== Date Utils ===== */
export function formatDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

export function formatRelative(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return formatDate(ts);
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(`${dateValue}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function getCardStatus(shop) {
  const remaining = shop.totalCoupons - (shop.usedCoupons || 0);
  const days = daysUntil(shop.expiresAt);
  if ((shop.usedCoupons || 0) >= shop.totalCoupons) return { label: '완성', className: 'success' };
  if (days !== null && days < 0) return { label: '만료됨', className: 'danger' };
  if (days !== null && days <= 7) return { label: days === 0 ? '오늘 만료' : `D-${days}`, className: 'danger' };
  if (remaining <= 2) return { label: `${remaining}개 남음`, className: 'warning' };
  if (days !== null && days <= 30) return { label: `D-${days}`, className: 'warning' };
  return { label: `${remaining}개 남음`, className: 'neutral' };
}

function getExpiryLabel(dateValue) {
  const days = daysUntil(dateValue);
  if (days === null) return '';
  if (days < 0) return '만료됨';
  if (days === 0) return '오늘 만료';
  return `D-${days}`;
}

/* ===== Toast ===== */
export function showToast(msg, type='success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  const color = type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : 'var(--accent)';
  el.innerHTML = `<svg viewBox="0 0 24 24" stroke="${color}" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span></span>`;
  el.querySelector('span').textContent = msg;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 2200);
}

/* ===== Popup ===== */
export function showPopup({ title, body, actions = [] }) {
  let overlay = document.getElementById('overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="popup-sheet">
      <div class="popup-header">
        <h3>${title}</h3>
        <button class="btn btn-ghost" onclick="closePopup()">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="popup-body">${body}</div>
      <div class="popup-footer">${actions.map(a =>
        `<button class="btn ${a.className || 'btn-secondary'}" id="popup-btn-${a.id}">${a.label}</button>`
      ).join('')}</div>
    </div>
  `;
  requestAnimationFrame(() => overlay.classList.add('active'));
  actions.forEach(a => {
    const btn = document.getElementById(`popup-btn-${a.id}`);
    if (btn) btn.onclick = () => { a.onClick?.(); if (a.close !== false) closePopup(); };
  });
  overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}

export function showConfirm({ title, message, confirmLabel = '확인', danger = false }) {
  return new Promise((resolve) => {
    showPopup({
      title,
      body: `<p class="confirm-message">${escapeHtml(message)}</p>`,
      actions: [
        { id: 'cancel', label: '취소', className: 'btn-secondary', onClick: () => resolve(false), close: true },
        { id: 'confirm', label: confirmLabel, className: danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true), close: true }
      ]
    });
  });
}

export function closePopup() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => { if (!overlay.classList.contains('active')) overlay.innerHTML = ''; }, 400);
  }
}

// expose to global for inline onclick in showPopup
if (typeof window !== 'undefined') window.closePopup = closePopup;

/* ===== Full-screen Reward Modal ===== */
export function showRewardModal({ shopName, total }) {
  let modal = document.getElementById('reward-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reward-modal';
    modal.className = 'reward-modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="reward-card">
      <div class="reward-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg></div>
      <div class="reward-eyebrow">REWARD UNLOCKED</div>
      <h2>완성! 🎉</h2>
      <p><strong>${escapeHtml(shopName)}</strong> 쿠폰 ${total}개를<br>모두 모았어요</p>
      <button class="btn btn-primary btn-block" id="reward-close">보상 받기</button>
    </div>
  `;
  requestAnimationFrame(() => modal.classList.add('active'));
  const close = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 320);
  };
  modal.querySelector('#reward-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

/* ===== Ad Banner (free-tier ad slot) =====
   Neutral placeholder. To serve real ads later, replace the inner content
   of the element matching `slotId` with the ad network markup. */
export function adBannerHTML({ title = '광고 영역', desc = '무료 버전을 지원하는 광고가 표시됩니다', slotId = '' } = {}) {
  return `
    <div class="ad-banner"${slotId ? ` id="${slotId}"` : ''} role="complementary" aria-label="광고">
      <span class="ad-badge">AD</span>
      <div class="ad-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></div>
      <div class="ad-body"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(desc)}</p></div>
      <svg class="ad-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
}

/* ===== Components ===== */
export function createCard(shop) {
  const remaining = shop.totalCoupons - shop.usedCoupons;
  const percent = shop.totalCoupons > 0 ? (shop.usedCoupons / shop.totalCoupons) * 100 : 0;
  const status = getCardStatus(shop);
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.skin = shop.skin || 'midnight';
  card.dataset.id = shop.id;
  card.classList.toggle('is-complete', remaining <= 0);
  card.innerHTML = `
    <div class="card-header">
      <div class="card-icon"><span class="category-icon">${getCategoryIcon(shop.category)}</span></div>
      <div class="card-info">
        <h3>${escapeHtml(shop.name)}</h3>
        <div class="category">${escapeHtml(shop.category)}${shop.expiresAt ? ` · ${getExpiryLabel(shop.expiresAt)}` : ''}</div>
      </div>
      <div class="badge badge-${status.className}">${status.label}</div>
    </div>
    <div class="card-body">
      <div class="card-progress-meta"><span>${Math.round(percent)}%</span><span>${remaining} / ${shop.totalCoupons}</span></div>
      <div class="progress-bar">
        <div class="progress-fill ${percent >= 100 ? 'success' : ''}" style="width:${percent}%"></div>
      </div>
      <div class="reward-hint ${remaining <= 0 ? 'done' : ''}">${remaining <= 0 ? '완성! 사장님께 보여주세요 ✨' : `${remaining}개 더 모으면 완성 🎉`}</div>
      <div class="stamp-board" id="stamps-${shop.id}"></div>
    </div>
    <div class="card-footer">
      <span>${shop.phone ? escapeHtml(shop.phone) : `${shop.usedCoupons} / ${shop.totalCoupons} 사용`}</span>
      <button class="card-quick-use" data-action="quick-use" ${remaining <= 0 ? 'disabled' : ''}>사용</button>
    </div>
  `;
  card.tabIndex = 0;
  const board = card.querySelector(`#stamps-${shop.id}`);
  if (board) board.appendChild(createStampBoard(shop.totalCoupons, shop.usedCoupons));
  return card;
}

export function createStampBoard(total, used) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < total; i++) {
    const stamp = document.createElement('div');
    const isReward = i === total - 1 && i >= used; // final prize, not yet reached
    stamp.className = `stamp ${i < used ? 'used' : ''} ${i === used ? 'current' : ''} ${isReward ? 'reward' : ''}`;
    stamp.innerHTML = isReward
      ? `<svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`
      : `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
    frag.appendChild(stamp);
  }
  return frag;
}

export function createTimelineItem(log, shopName) {
  const div = document.createElement('div');
  div.className = 'timeline-item success';
  div.innerHTML = `
    <div class="timeline-dot"></div>
    <div class="timeline-time">${formatDate(log.usedAt)} · ${formatRelative(log.usedAt)}</div>
    <div class="timeline-title">${escapeHtml(shopName)}</div>
    ${log.note ? `<div class="timeline-note">${escapeHtml(log.note)}</div>` : ''}
  `;
  return div;
}

export function createSummaryCard(value, label, color) {
  const div = document.createElement('div');
  div.className = 'summary-card';
  if (color) div.style.setProperty('--accent', color);
  div.innerHTML = `
    <div class="value" style="${color ? 'color:'+color : ''}">${value}</div>
    <div class="label">${label}</div>
  `;
  return div;
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createNearbyCard(shop, distance, onClick) {
  const div = document.createElement('div');
  div.className = 'nearby-card';
  div.innerHTML = `
    <div class="icon" style="background:var(--accent)">
      <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
    <div class="info">
      <h4>${escapeHtml(shop.name)}</h4>
      <p>${escapeHtml(shop.address || '')} · ${Math.round(distance)}m</p>
    </div>
    <div class="badge badge-accent">${shop.totalCoupons - shop.usedCoupons}개 남음</div>
  `;
  div.onclick = onClick;
  return div;
}
