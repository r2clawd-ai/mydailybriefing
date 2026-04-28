/**
 * referral-widget.js — "Share your briefing" referral widget
 * for mydailybriefing.app
 *
 * Usage: included as a <script src="/referral-widget.js"> tag, or inlined.
 * Depends on:
 *   - window.API  (set in briefing.html: the backend base URL)
 *   - localStorage key "briefing_token"
 *   - showToast()  (defined in briefing.html; falls back to a local no-op)
 *
 * Injects a widget card into #referral-widget-mount if that element exists,
 * otherwise appends after the first <main> or <body>.
 */

(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────

  const API_BASE = (typeof window !== 'undefined' && window.API)
    ? window.API
    : (window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://mydailybriefing-api-production.up.railway.app');

  const STORAGE_KEY = 'briefing_token';

  // ── Toast helper ───────────────────────────────────────────────────────────

  function toast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
      return;
    }
    // Fallback: small floating notification
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#222', color: '#f0f0f0', padding: '10px 20px',
      borderRadius: '8px', fontSize: '14px', zIndex: '9999',
      boxShadow: '0 4px 16px rgba(0,0,0,.5)', pointerEvents: 'none',
      transition: 'opacity .3s ease',
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderWidget(stats) {
    const { referral_count, days_earned, referral_link, reward_days_per_referral } = stats;

    const html = `
<div id="referral-widget" style="
  background: #141414;
  border: 1px solid #222;
  border-radius: 14px;
  padding: 20px 18px;
  margin: 20px 0;
  max-width: 520px;
">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <span style="font-size:22px">🔗</span>
    <span style="font-weight:600;font-size:16px;color:#f0f0f0">Share your briefing</span>
  </div>

  <p style="font-size:13px;color:#a8a8a8;margin-bottom:16px;line-height:1.5">
    Invite friends to My Daily Briefing — you both benefit.
    You earn <strong style="color:#f0c040">${reward_days_per_referral} free Pro days</strong> for every friend who joins.
  </p>

  <!-- Stats row -->
  <div style="display:flex;gap:12px;margin-bottom:16px">
    <div style="flex:1;background:#1a1a1a;border-radius:10px;padding:12px;text-align:center">
      <div id="referral-count-val" style="font-size:24px;font-weight:700;color:#f0c040">${referral_count}</div>
      <div style="font-size:11px;color:#a8a8a8;margin-top:2px">friends joined</div>
    </div>
    <div style="flex:1;background:#1a1a1a;border-radius:10px;padding:12px;text-align:center">
      <div id="referral-days-val" style="font-size:24px;font-weight:700;color:#4db86a">${days_earned}</div>
      <div style="font-size:11px;color:#a8a8a8;margin-top:2px">free days earned</div>
    </div>
  </div>

  <!-- Link row -->
  <div style="display:flex;gap:8px;align-items:center">
    <input
      id="referral-link-input"
      type="text"
      readonly
      value="${referral_link}"
      style="
        flex:1;min-width:0;background:#202020;border:1px solid #2c2c2c;
        border-radius:8px;padding:9px 12px;color:#f0f0f0;font-size:13px;
        cursor:pointer;outline:none;
      "
      onclick="this.select()"
    />
    <button
      id="referral-copy-btn"
      onclick="window.__copyReferralLink()"
      style="
        background:#f0c040;color:#0d0d0d;border:none;border-radius:8px;
        padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;
        white-space:nowrap;flex-shrink:0;
      "
    >Copy link</button>
  </div>

  <!-- Share row -->
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
    <button onclick="window.__shareReferral('twitter')" style="
      background:#1a1a1a;border:1px solid #2c2c2c;border-radius:8px;
      padding:7px 14px;color:#a8a8a8;font-size:12px;cursor:pointer;
    ">Share on X</button>
    <button onclick="window.__shareReferral('whatsapp')" style="
      background:#1a1a1a;border:1px solid #2c2c2c;border-radius:8px;
      padding:7px 14px;color:#a8a8a8;font-size:12px;cursor:pointer;
    ">WhatsApp</button>
    <button onclick="window.__shareReferral('native')" style="
      background:#1a1a1a;border:1px solid #2c2c2c;border-radius:8px;
      padding:7px 14px;color:#a8a8a8;font-size:12px;cursor:pointer;
    ">More options</button>
  </div>
</div>`;

    return html;
  }

  // ── Clipboard / share actions ──────────────────────────────────────────────

  let _currentLink = '';

  window.__copyReferralLink = async function () {
    if (!_currentLink) return;
    try {
      await navigator.clipboard.writeText(_currentLink);
      toast('Link copied to clipboard!');
      const btn = document.getElementById('referral-copy-btn');
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy link'; }, 2000); }
    } catch {
      // Fallback: select the input
      const inp = document.getElementById('referral-link-input');
      if (inp) { inp.select(); document.execCommand('copy'); toast('Link copied!'); }
    }
  };

  window.__shareReferral = function (platform) {
    if (!_currentLink) return;
    const text = 'I use My Daily Briefing for my morning news — try it free:';
    const encodedLink = encodeURIComponent(_currentLink);
    const encodedText = encodeURIComponent(text);

    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`, '_blank', 'width=550,height=420');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodedText}%20${encodedLink}`, '_blank');
    } else if (platform === 'native' && navigator.share) {
      navigator.share({ title: 'My Daily Briefing', text, url: _currentLink }).catch(() => {});
    } else {
      // Fallback: copy
      window.__copyReferralLink();
    }
  };

  // ── Mount ──────────────────────────────────────────────────────────────────

  async function mountWidget() {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return; // not logged in — nothing to show

    let stats;
    try {
      const res = await fetch(`${API_BASE}/api/users/${token}/referral-stats`);
      if (!res.ok) return;
      stats = await res.json();
    } catch {
      return; // silently skip if backend unreachable
    }

    _currentLink = stats.referral_link || '';

    const widgetHtml = renderWidget(stats);

    // Prefer a dedicated mount point
    let mount = document.getElementById('referral-widget-mount');

    if (!mount) {
      // Fall back: insert after .pro-banner, .subscription-banner, or the first <section>
      const fallbackAnchors = [
        document.querySelector('.pro-banner'),
        document.querySelector('.upgrade-banner'),
        document.querySelector('[data-section="subscription"]'),
        document.querySelector('main section'),
        document.querySelector('main'),
        document.body,
      ];
      const anchor = fallbackAnchors.find(Boolean);
      if (!anchor) return;

      mount = document.createElement('div');
      mount.id = 'referral-widget-mount';
      // Insert as the next sibling of the anchor (or append inside it if it is body/main)
      if (anchor === document.body || anchor.tagName === 'MAIN') {
        anchor.insertBefore(mount, anchor.firstChild);
      } else {
        anchor.insertAdjacentElement('afterend', mount);
      }
    }

    mount.innerHTML = widgetHtml;
  }

  // ── Auto-apply referral code from URL (?ref=XXXXXX) ───────────────────────

  async function autoApplyRefCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    if (!code) return;

    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      // Store for after sign-up
      sessionStorage.setItem('pending_ref_code', code);
      return;
    }

    // Check if already referred
    try {
      const res = await fetch(`${API_BASE}/api/referral/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) toast('Referral applied — your friend earned free Pro days!');
      }
    } catch {
      // Silently ignore network errors
    }
  }

  // ── Apply any pending referral stored before sign-up ──────────────────────

  async function applyPendingRefCode(token) {
    const code = sessionStorage.getItem('pending_ref_code');
    if (!code || !token) return;
    sessionStorage.removeItem('pending_ref_code');

    try {
      await fetch(`${API_BASE}/api/referral/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code }),
      });
    } catch { /* ignore */ }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    autoApplyRefCode();

    // Mount widget after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountWidget);
    } else {
      mountWidget();
    }
  }

  init();

  // Expose helper so server.js signup flow can call after token is stored
  window.referralWidget = {
    mount: mountWidget,
    applyPendingRefCode,
  };
})();
