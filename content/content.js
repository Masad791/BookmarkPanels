(function () {
  'use strict';
  if (document.getElementById('bp-overlay-host')) return;

  try {
    window.addEventListener('unhandledrejection', (event) => {
      if (event && event.reason && String(event.reason.message || event.reason).includes('Extension context invalidated')) {
        event.preventDefault();
      }
    });
  } catch (e) { /* ignore */ }

  const PRESET_COLORS = [
    '#a8d8ea', // Light blue (watercolor)
    '#b8d4e3', // Mist blue
    '#f4b9c2', // Baby pink
    '#545b6d', // Dark gray (watercolor slate)
    '#c4b7cb', // Soft lavender
    '#b5ead7', // Mint green
    '#e2d5f1', // Light lilac
    '#ffdac1', // Soft peach
    '#c7ceea', // Periwinkle
    '#d4e6f1', // Powder blue
    '#f0e6ef', // Rose quartz
    '#3e4451', // Charcoal dark gray
  ];

  let categories = [];
  let cardPositions = {};
  let theme = 'dark';
  let sidebarOpen = false;
  let cardsVisible = true;
  let bpBrightness = 100;
  let bpBlur = 24;
  let overlayEnabled = true;
  let zCounter = 10000;
  let activeMenuEl = null;
  let modalEditCat = null;
  let modalEditBm = null;
  let modalBmCatId = null;
  let selectedColor = PRESET_COLORS[0];
  let selectMode = false;
  let selectedBmIds = new Set();

  function isGoogleHomePage() {
    try {
      const loc = window.location;
      const isGoogleDomain = /(^|\.)google\.(com?|[a-z]{2})(\.[a-z]{2})?$/i.test(loc.hostname);
      if (!isGoogleDomain) return false;
      return loc.pathname === '/' || loc.pathname === '/webhp' || loc.pathname === '' || loc.pathname === '/blank.html';
    } catch {
      return false;
    }
  }

  let showCardsOnThisPage = isGoogleHomePage();

  const host = document.createElement('div');
  host.id = 'bp-overlay-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483640;pointer-events:none;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .bp-root {
      /* ── Dark glassmorphism tokens (rich, opaque, high-contrast) ── */
      --glass-bg: rgba(18, 21, 28, 0.85);
      --glass-bg-strong: rgba(18, 21, 28, 0.95);
      --glass-border: rgba(255, 255, 255, 0.16);
      --glass-blur: 24px;
      --panel-brightness: 1;
      --card-glass: rgba(255, 255, 255, 0.05);
      --card-glass-hover: rgba(255, 255, 255, 0.09);
      --text-1: #ffffff;
      --text-2: #c5cbd8;
      --text-3: #8e96a7;
      --border: rgba(255, 255, 255, 0.10);
      --hover: rgba(255, 255, 255, 0.08);
      --danger: #f28b82;
      --shadow: 0 16px 48px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.35);
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .bp-root[data-theme="light"] {
      /* ── Light glassmorphism tokens (clean, elevated, deep contrast) ── */
      --glass-bg: rgba(255, 255, 255, 0.85);
      --glass-bg-strong: rgba(255, 255, 255, 0.96);
      --glass-border: rgba(0, 0, 0, 0.16);
      --card-glass: rgba(0, 0, 0, 0.03);
      --card-glass-hover: rgba(0, 0, 0, 0.06);
      --text-1: #0f1419;
      --text-2: #333d47;
      --text-3: #536471;
      --border: rgba(0, 0, 0, 0.12);
      --hover: rgba(0, 0, 0, 0.06);
      --danger: #cf222e;
      --shadow: 0 14px 40px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.10);
    }
    .bp-root[data-theme="light"] .bp-search-input,
    .bp-root[data-theme="light"] .bp-modal-input {
      background: #f6f8fa;
      border: 1px solid rgba(0, 0, 0, 0.20);
      color: #0f1419;
    }
    .bp-root[data-theme="light"] .bp-search-input:focus,
    .bp-root[data-theme="light"] .bp-modal-input:focus {
      background: #ffffff;
      border-color: #0969da;
      box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
    }
    .bp-root[data-theme="light"] .bp-card-bm span,
    .bp-root[data-theme="light"] .bp-bm-name,
    .bp-root[data-theme="light"] .bp-card-cname {
      color: #0f1419;
      font-weight: 500;
    }
    .bp-root[data-theme="light"] .bp-modal-box,
    .bp-root[data-theme="light"] .bp-dropdown {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.15);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08);
    }

    /* High-contrast hand pointer for light mode so cursor is never lost on white surfaces */
    .bp-root[data-theme="light"] button,
    .bp-root[data-theme="light"] [data-action],
    .bp-root[data-theme="light"] [data-trigger],
    .bp-root[data-theme="light"] [data-sb],
    .bp-root[data-theme="light"] [data-bulk],
    .bp-root[data-theme="light"] .bp-card-bm,
    .bp-root[data-theme="light"] .bp-bm-row,
    .bp-root[data-theme="light"] .bp-cat-header,
    .bp-root[data-theme="light"] .bp-color-swatch,
    .bp-root[data-theme="light"] .bp-edge-tab {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'%3E%3Cpolygon points='1,1 7,21 11,13 19,11' fill='%23111827' stroke='%23ffffff' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E") 1 1, pointer;
    }

    /* ════════════════════════════════════════
       SIDEBAR
       ════════════════════════════════════════ */
    .bp-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.18);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .bp-root.sidebar-open .bp-backdrop {
      opacity: 1;
      pointer-events: auto;
    }

    .bp-sidebar {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 380px;
      max-width: 88vw;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      filter: brightness(var(--panel-brightness));
      border-left: 1px solid var(--glass-border);
      box-shadow: -4px 0 40px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.15, 1);
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      font-family: var(--font);
      font-size: 13px;
      color: var(--text-1);
      z-index: 10015;
    }
    .bp-root.sidebar-open .bp-sidebar {
      transform: translateX(0);
    }

    /* ── Sidebar Header ── */
    .bp-sb-header {
      display: flex;
      align-items: center;
      padding: 14px 18px;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      background: var(--glass-bg-strong);
      backdrop-filter: blur(30px);
      flex-shrink: 0;
      position: relative;
    }
    .bp-sb-title {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.2px;
      color: var(--text-1);
    }
    .bp-sb-actions { display: flex; gap: 2px; }

    .bp-icon-btn {
      width: 30px; height: 30px;
      border: none;
      background: transparent;
      color: var(--text-2);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
      font-family: var(--font);
    }
    .bp-icon-btn svg {
      display: block;
      pointer-events: none;
      transition: transform 0.15s;
    }
    .bp-icon-btn:hover { background: var(--hover); color: var(--text-1); }
    .bp-icon-btn.active {
      color: #a8d8ea;
      background: rgba(168, 216, 234, 0.15);
    }

    /* Glass Aesthetics Popover */
    .bp-brightness-popover {
      position: absolute;
      top: 56px;
      right: 14px;
      z-index: 10025;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 14px 16px;
      width: 240px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
      animation: bpFadeIn 0.15s ease;
    }
    .bp-brightness-popover.hidden { display: none !important; }
    .bp-popover-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-2);
      margin-bottom: 12px;
    }
    .bp-slider-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .bp-slider-row:last-child { margin-bottom: 0; }
    .bp-slider-label {
      font-size: 11px;
      color: var(--text-1);
      width: 86px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .bp-slider-label svg {
      color: var(--text-2);
      flex-shrink: 0;
    }
    .bp-slider {
      flex: 1;
      height: 4px;
      accent-color: #a8d8ea;
      cursor: pointer;
    }
    .bp-slider-val {
      font-size: 10px;
      color: var(--text-2);
      width: 34px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* Master Overlay Disabled State */
    .bp-root.overlay-disabled .bp-edge-tab,
    .bp-root.overlay-disabled .bp-card {
      display: none !important;
    }
    .bp-disabled-banner {
      background: rgba(244, 185, 194, 0.15);
      border-bottom: 1px solid rgba(244, 185, 194, 0.3);
      padding: 8px 16px;
      font-size: 11px;
      color: #f4b9c2;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bp-disabled-banner.hidden { display: none !important; }
    .bp-disabled-banner button {
      background: #a8d8ea;
      color: #121212;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }

    /* ── Search & Bulk Toolbar ── */
    .bp-sb-search {
      padding: 12px 18px 8px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .bp-search-input {
      flex: 1;
      width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--card-glass);
      color: var(--text-1);
      font-size: 12px;
      font-family: var(--font);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      backdrop-filter: blur(8px);
    }
    .bp-search-input::placeholder { color: var(--text-3); }
    .bp-search-input:focus {
      border-color: rgba(168, 216, 234, 0.4);
      box-shadow: 0 0 0 3px rgba(168, 216, 234, 0.1);
    }
    .bp-bulk-toggle-btn {
      padding: 6px 11px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-glass);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
      transition: all 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .bp-bulk-toggle-btn:hover,
    .bp-bulk-toggle-btn.active {
      background: rgba(168, 216, 234, 0.2);
      color: #a8d8ea;
      border-color: rgba(168, 216, 234, 0.4);
    }

    .bp-bm-checkbox {
      width: 15px;
      height: 15px;
      border-radius: 4px;
      accent-color: #a8d8ea;
      cursor: pointer;
      margin-right: 2px;
      flex-shrink: 0;
    }
    .bp-bm-row.selected {
      background: rgba(168, 216, 234, 0.15);
      border-left: 2px solid #a8d8ea;
    }

    /* ── Bulk Action Bar ── */
    .bp-bulk-bar {
      padding: 10px 14px;
      background: var(--glass-bg-strong);
      border-top: 1px solid var(--glass-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    }
    .bp-bulk-bar.hidden { display: none !important; }
    .bp-bulk-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      color: var(--text-1);
      font-weight: 500;
      white-space: nowrap;
    }
    .bp-bulk-link {
      background: none;
      border: none;
      color: #a8d8ea;
      font-size: 11px;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }
    .bp-bulk-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bp-bulk-select {
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-glass);
      color: var(--text-1);
      font-size: 11px;
      font-family: var(--font);
      cursor: pointer;
      max-width: 120px;
      outline: none;
    }
    .bp-bulk-select option {
      background: #202124;
      color: #e8eaed;
    }
    .bp-root[data-theme="light"] .bp-bulk-select option {
      background: #ffffff;
      color: #1f2328;
    }
    .bp-bulk-action-btn {
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-glass);
      color: var(--text-1);
      font-size: 11px;
      font-family: var(--font);
      cursor: pointer;
      transition: all 0.15s;
      font-weight: 500;
    }
    .bp-bulk-action-btn:hover { background: var(--hover); }
    .bp-bulk-action-btn.danger { color: var(--danger); border-color: rgba(242, 139, 130, 0.3); }
    .bp-bulk-action-btn.danger:hover { background: rgba(242, 139, 130, 0.15); }

    /* ── Scrollable List ── */
    .bp-sb-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px 16px;
    }
    .bp-sb-list::-webkit-scrollbar { width: 5px; }
    .bp-sb-list::-webkit-scrollbar-track { background: transparent; }
    .bp-sb-list::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 3px; }

    /* ── Category Section ── */
    .bp-cat-section {
      margin-bottom: 8px;
      border-radius: 10px;
      background: var(--card-glass);
      border: 1px solid var(--border);
      overflow: hidden;
      transition: background 0.15s;
    }
    .bp-cat-section.drop-target {
      border-color: rgba(168, 216, 234, 0.5);
      background: var(--card-glass-hover);
    }
    .bp-cat-section.section-dragging { opacity: 0.5; }

    .bp-cat-header {
      display: flex;
      align-items: center;
      padding: 9px 12px;
      gap: 8px;
      cursor: grab;
      user-select: none;
      transition: background 0.1s;
    }
    .bp-cat-header:hover { background: var(--hover); }
    .bp-cat-header:active { cursor: grabbing; }

    .bp-cat-color-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      opacity: 0.85;
    }
    .bp-cat-name {
      flex: 1;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bp-cat-count {
      font-size: 10px;
      color: var(--text-3);
      padding: 1px 7px;
      border-radius: 8px;
      background: var(--card-glass);
      flex-shrink: 0;
    }
    .bp-cat-chevron {
      font-size: 9px;
      color: var(--text-3);
      transition: transform 0.2s;
      flex-shrink: 0;
      width: 16px;
      text-align: center;
    }
    .bp-cat-section.collapsed .bp-cat-chevron { transform: rotate(-90deg); }

    .bp-dot-btn {
      width: 22px; height: 22px;
      border: none;
      background: transparent;
      color: var(--text-3);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s, color 0.1s;
      flex-shrink: 0;
      font-family: var(--font);
      opacity: 0;
    }
    .bp-cat-header:hover .bp-dot-btn,
    .bp-bm-row:hover .bp-dot-btn { opacity: 1; }
    .bp-dot-btn:hover { background: var(--hover); color: var(--text-1); }

    /* ── Category Body ── */
    .bp-cat-body {
      padding: 2px 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      transition: max-height 0.25s ease, padding 0.2s ease, opacity 0.2s ease;
      overflow: hidden;
    }
    .bp-cat-section.collapsed .bp-cat-body {
      max-height: 0 !important;
      padding: 0 8px;
      opacity: 0;
    }

    /* ── Bookmark Row ── */
    .bp-bm-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
      text-decoration: none;
      color: var(--text-1);
    }
    .bp-bm-row:hover { background: var(--card-glass-hover); }
    .bp-bm-row.drag-above { border-top: 2px solid #a8d8ea; padding-top: 4px; }
    .bp-bm-row.drag-below { border-bottom: 2px solid #a8d8ea; padding-bottom: 4px; }
    .bp-bm-row.bm-dragging { opacity: 0.3; }

    .bp-bm-fav {
      width: 14px; height: 14px;
      flex-shrink: 0;
      border-radius: 3px;
      object-fit: contain;
    }
    .bp-bm-info {
      flex: 1;
      min-width: 0;
    }
    .bp-bm-name {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .bp-bm-host {
      font-size: 10px;
      color: var(--text-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    /* ── Add Buttons ── */
    .bp-add-bm-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      border: 1px dashed var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--text-3);
      cursor: pointer;
      font-size: 11px;
      margin-top: 4px;
      transition: border-color 0.15s, color 0.15s;
      font-family: var(--font);
    }
    .bp-add-bm-btn:hover { border-color: var(--text-2); color: var(--text-2); }

    .bp-add-cat-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 10px;
      border: 1px dashed var(--border);
      border-radius: 10px;
      background: transparent;
      color: var(--text-3);
      cursor: pointer;
      font-size: 12px;
      font-family: var(--font);
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      margin-top: 4px;
    }
    .bp-add-cat-btn:hover {
      border-color: rgba(168, 216, 234, 0.3);
      color: var(--text-2);
      background: var(--card-glass);
    }

    /* ── Sidebar Footer ── */
    .bp-sb-footer {
      padding: 8px 18px;
      text-align: center;
      font-size: 10px;
      color: var(--text-3);
      border-top: 1px solid var(--border);
      background: var(--glass-bg-strong);
      flex-shrink: 0;
    }
    .bp-sb-footer kbd {
      background: var(--card-glass);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 10px;
      font-family: var(--font);
    }

    /* ════════════════════════════════════════
       FLOATING CARDS (sticky note mode)
       ════════════════════════════════════════ */
    .bp-card {
      position: fixed;
      width: 230px;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      filter: brightness(var(--panel-brightness));
      border: 1px solid var(--glass-border);
      border-radius: 10px;
      box-shadow: var(--shadow);
      pointer-events: auto;
      font-family: var(--font);
      font-size: 13px;
      color: var(--text-1);
      display: flex;
      flex-direction: column;
      overflow: visible;
      transition: box-shadow 0.15s;
    }
    .bp-card:hover { box-shadow: 0 8px 36px rgba(0,0,0,0.35); }
    .bp-card.bp-card-dragging { opacity: 0.75; cursor: grabbing; }
    .bp-card.bp-card-drop { border-color: rgba(168,216,234,0.5); }

    .bp-card-accent {
      height: 3px;
      border-radius: 10px 10px 0 0;
      flex-shrink: 0;
      opacity: 0.7;
    }
    .bp-card-head {
      display: flex;
      align-items: center;
      padding: 7px 10px;
      gap: 6px;
      cursor: grab;
      user-select: none;
      border-bottom: 1px solid var(--border);
    }
    .bp-card-head:active { cursor: grabbing; }
    .bp-card-cdot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      opacity: 0.85;
    }
    .bp-card-cname {
      flex: 1;
      font-weight: 600;
      font-size: 11.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.1px;
    }
    .bp-card-ccount {
      font-size: 9px;
      color: var(--text-3);
      padding: 1px 5px;
      border-radius: 6px;
      background: var(--card-glass);
      flex-shrink: 0;
    }
    .bp-card-chevron {
      background: none;
      border: none;
      color: var(--text-3);
      cursor: pointer;
      font-size: 8px;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: color 0.1s, background 0.1s;
      flex-shrink: 0;
    }
    .bp-card-chevron:hover { background: var(--hover); color: var(--text-1); }
    .bp-card-head .bp-dot-btn {
      opacity: 0.6;
      width: 20px;
      height: 20px;
      font-size: 13px;
    }
    .bp-card-head:hover .bp-dot-btn { opacity: 1; }
    .bp-card-close-btn {
      background: none;
      border: none;
      color: var(--text-3);
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      opacity: 0.6;
      transition: color 0.15s, background 0.15s, opacity 0.15s;
      flex-shrink: 0;
      padding: 0;
      margin-left: 2px;
    }
    .bp-card-head:hover .bp-card-close-btn { opacity: 0.9; }
    .bp-card-close-btn:hover { background: rgba(242, 139, 130, 0.2); color: var(--danger); opacity: 1; }

    .bp-cat-hidden-badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(242, 139, 130, 0.15);
      color: var(--danger);
      font-weight: 500;
      margin-left: auto;
      margin-right: 4px;
    }
    .bp-card-body {
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 260px;
      overflow-y: auto;
      transition: max-height 0.2s ease, padding 0.2s ease, opacity 0.2s ease;
    }
    .bp-card-body::-webkit-scrollbar { width: 3px; }
    .bp-card-body::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }
    .bp-card.collapsed .bp-card-body {
      max-height: 0; padding: 0 6px; opacity: 0; overflow: hidden;
    }
    .bp-card-bm {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
      text-decoration: none;
      color: var(--text-1);
      font-size: 11.5px;
      position: relative;
    }
    .bp-card-bm:hover { background: var(--card-glass-hover); }
    .bp-card-bm.drag-above { border-top: 2px solid #a8d8ea; padding-top: 3px; }
    .bp-card-bm.drag-below { border-bottom: 2px solid #a8d8ea; padding-bottom: 3px; }
    .bp-card-bm.bm-dragging { opacity: 0.3; }
    .bp-card-bm img { width: 13px; height: 13px; border-radius: 2px; object-fit: contain; flex-shrink: 0; }
    .bp-card-bm span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-card-bm .bp-dot-btn { opacity: 0; width: 18px; height: 18px; font-size: 11px; flex-shrink: 0; }
    .bp-card-bm:hover .bp-dot-btn { opacity: 1; }

    /* ════════════════════════════════════════
       EDGE TAB (toggle trigger)
       ════════════════════════════════════════ */
    .bp-edge-tab {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 56px;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      filter: brightness(var(--panel-brightness));
      border: 1px solid var(--glass-border);
      border-right: none;
      border-radius: 8px 0 0 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      color: var(--text-3);
      font-size: 10px;
      z-index: 10012;
      transition: width 0.15s, background 0.15s, color 0.15s;
      writing-mode: vertical-rl;
      letter-spacing: 1px;
      font-family: var(--font);
    }
    .bp-edge-tab:hover {
      width: 26px;
      color: var(--text-1);
      background: var(--glass-bg-strong);
    }

    /* ════════════════════════════════════════
       DROPDOWN MENU
       ════════════════════════════════════════ */
    .bp-dropdown {
      position: fixed;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      padding: 4px 0;
      min-width: 155px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.3);
      z-index: 10025;
      pointer-events: auto;
      font-family: var(--font);
    }
    .bp-dd-item {
      padding: 7px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--text-1);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.1s;
      white-space: nowrap;
    }
    .bp-dd-item:hover { background: var(--hover); }
    .bp-dd-item.danger { color: var(--danger); }
    .bp-dd-item.danger:hover { background: rgba(232, 139, 139, 0.08); }
    .bp-dd-sep { height: 1px; background: var(--border); margin: 3px 0; }
    .bp-dd-icon { width: 16px; text-align: center; font-size: 10px; color: var(--text-3); flex-shrink: 0; }
    .bp-dd-item.danger .bp-dd-icon { color: var(--danger); }

    /* ════════════════════════════════════════
       MODAL
       ════════════════════════════════════════ */
    .bp-modal-wrap {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.5);
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      font-family: var(--font);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .bp-modal-wrap.hidden { display: none !important; }
    .bp-modal-box {
      position: relative;
      z-index: 2147483647;
      pointer-events: auto !important;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      padding: 22px 24px;
      width: 320px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .bp-modal-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-1);
      margin-bottom: 16px;
    }
    .bp-modal-label {
      font-size: 10px;
      color: var(--text-3);
      margin-bottom: 4px;
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bp-modal-input {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-glass);
      color: var(--text-1);
      font-size: 13px;
      font-family: var(--font);
      outline: none;
      margin-bottom: 10px;
      transition: border-color 0.2s;
    }
    .bp-modal-input:focus { border-color: rgba(168, 216, 234, 0.5); }
    .bp-modal-input::placeholder { color: var(--text-3); }
    .bp-modal-actions {
      display: flex; justify-content: flex-end; gap: 6px; margin-top: 16px;
    }
    .bp-modal-btn {
      padding: 7px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: var(--font);
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--card-glass);
      color: var(--text-1);
      transition: background 0.15s;
    }
    .bp-modal-btn:hover { background: var(--card-glass-hover); }
    .bp-modal-btn.primary {
      background: rgba(168, 216, 234, 0.2);
      border-color: rgba(168, 216, 234, 0.3);
      color: var(--text-1);
    }
    .bp-modal-btn.primary:hover { background: rgba(168, 216, 234, 0.3); }

    /* ── Color Swatches ── */
    .bp-color-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      padding: 6px 0 2px;
    }
    .bp-color-swatch {
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      cursor: pointer;
      transition: transform 0.12s, border-color 0.12s;
      opacity: 0.8;
    }
    .bp-color-swatch:hover { transform: scale(1.18); opacity: 1; }
    .bp-color-swatch.selected { border-color: var(--text-1); opacity: 1; }

    /* ── Toast ── */
    .bp-toast {
      position: fixed;
      bottom: 24px; left: 50%;
      transform: translateX(-50%);
      background: var(--glass-bg-strong);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 12px;
      color: var(--text-1);
      box-shadow: var(--shadow);
      pointer-events: auto;
      z-index: 10045;
      font-family: var(--font);
      animation: bpSlideUp 0.25s ease;
    }
    @keyframes bpSlideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ── Hidden ── */
    .bp-hidden { display: none !important; }
  `;
  shadow.appendChild(styleEl);

  const root = document.createElement('div');
  root.className = 'bp-root';
  shadow.appendChild(root);

  root.insertAdjacentHTML('beforeend', `<div class="bp-edge-tab" data-action="toggle-sidebar" title="Sidebar (Ctrl+B / Alt+B)">\u2630</div>`);

  root.insertAdjacentHTML('beforeend', `<div class="bp-backdrop" data-action="close-sidebar" title="Close"></div>`);

  root.insertAdjacentHTML('beforeend', `
    <div class="bp-sidebar">
      <div class="bp-disabled-banner hidden" data-role="disabled-banner">
        <span>Overlay is paused on web pages</span>
        <button type="button" data-action="enable-overlay" title="Turn On">Turn On</button>
      </div>
      <div class="bp-sb-header">
        <span class="bp-sb-title">Bookmarks</span>
        <div class="bp-sb-actions">
          <button class="bp-icon-btn" data-sb="cards" title="Toggle Cards">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"></rect>
              <path d="M3 9h18"></path>
              <path d="M9 21V9"></path>
            </svg>
          </button>
          <button class="bp-icon-btn" data-sb="import" title="Import Bookmarks">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              <polyline points="12 7 12 13 15 10"></polyline>
              <polyline points="12 13 9 10"></polyline>
            </svg>
          </button>
          <button class="bp-icon-btn" data-sb="brightness" title="Aesthetics">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
          </button>
          <button class="bp-icon-btn" data-sb="theme" title="Toggle Theme">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button class="bp-icon-btn" data-sb="power" title="Toggle Overlay">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </button>
          <button class="bp-icon-btn" data-sb="close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Glass Aesthetics Popover -->
      <div class="bp-brightness-popover hidden" data-role="brightness-popover">
        <div class="bp-popover-title">Glass Aesthetics</div>
        <div class="bp-slider-row">
          <span class="bp-slider-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            Brightness
          </span>
          <input type="range" class="bp-slider" min="50" max="140" value="100" data-slider="brightness" title="Brightness">
          <span class="bp-slider-val" data-val="brightness">100%</span>
        </div>
        <div class="bp-slider-row">
          <span class="bp-slider-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
            Frost Blur
          </span>
          <input type="range" class="bp-slider" min="8" max="36" value="24" data-slider="blur" title="Blur">
          <span class="bp-slider-val" data-val="blur">24px</span>
        </div>
      </div>

      <div class="bp-sb-search">
        <input class="bp-search-input" type="text" placeholder="Filter bookmarks..." data-role="search" title="Filter">
        <button type="button" class="bp-bulk-toggle-btn" data-action="toggle-bulk" title="Select Multiple">Select</button>
      </div>
      <div class="bp-sb-list" data-role="sb-list"></div>

      <!-- Bulk Action Bar -->
      <div class="bp-bulk-bar hidden" data-role="bulk-bar">
        <div class="bp-bulk-info">
          <span class="bp-bulk-count" data-role="bulk-count">0 selected</span>
          <button type="button" class="bp-bulk-link" data-bulk="select-all">All</button>
        </div>
        <div class="bp-bulk-controls">
          <select class="bp-bulk-select" data-role="bulk-move-select" title="Move to Category">
            <option value="" disabled selected>Move to...</option>
          </select>
          <button type="button" class="bp-bulk-action-btn danger" data-bulk="delete" title="Delete Selected">&#10005;</button>
          <button type="button" class="bp-bulk-action-btn" data-bulk="done" title="Done">Done</button>
        </div>
      </div>

      <div class="bp-sb-footer">Press <kbd>Ctrl+B</kbd> or <kbd>Alt+B</kbd> to toggle</div>
    </div>
  `);

  const cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10010;';
  root.appendChild(cardsContainer);

  root.insertAdjacentHTML('beforeend', `
    <div class="bp-modal-wrap hidden" data-modal="category">
      <div class="bp-modal-box">
        <div class="bp-modal-title" data-role="cat-modal-title">New Category</div>
        <label class="bp-modal-label">Name</label>
        <input class="bp-modal-input" data-input="cat-name" type="text" placeholder="e.g. Development">
        <label class="bp-modal-label">Color</label>
        <div class="bp-color-grid" data-role="color-grid"></div>
        <div class="bp-modal-actions">
          <button class="bp-modal-btn" data-action="modal-cancel">Cancel</button>
          <button class="bp-modal-btn primary" data-action="modal-save-cat">Save</button>
        </div>
      </div>
    </div>
    <div class="bp-modal-wrap hidden" data-modal="bookmark">
      <div class="bp-modal-box">
        <div class="bp-modal-title" data-role="bm-modal-title">Add Bookmark</div>
        <label class="bp-modal-label">Title</label>
        <input class="bp-modal-input" data-input="bm-title" type="text" placeholder="My Website">
        <label class="bp-modal-label">URL</label>
        <input class="bp-modal-input" data-input="bm-url" type="text" placeholder="https://example.com">
        <div class="bp-modal-actions">
          <button class="bp-modal-btn" data-action="modal-cancel">Cancel</button>
          <button class="bp-modal-btn primary" data-action="modal-save-bm">Save</button>
        </div>
      </div>
    </div>
  `);

  const qs = (s) => root.querySelector(s);
  const qsa = (s) => root.querySelectorAll(s);
  const sidebar = qs('.bp-sidebar');
  const sbList = qs('[data-role="sb-list"]');
  const searchInput = qs('[data-role="search"]');
  const catModal = qs('[data-modal="category"]');
  const bmModal = qs('[data-modal="bookmark"]');
  const colorGrid = qs('[data-role="color-grid"]');

  PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'bp-color-swatch' + (c === selectedColor ? ' selected' : '');
    sw.style.background = c;
    sw.dataset.color = c;
    sw.title = 'Select this watercolor shade';
    sw.addEventListener('click', () => {
      colorGrid.querySelectorAll('.bp-color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = c;
    });
    colorGrid.appendChild(sw);
  });

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome && chrome.runtime && !!chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function safeStorageGet(keys, fallback = {}) {
    if (!isContextValid()) return Promise.resolve(fallback);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (res) => {
          if (chrome.runtime.lastError || !res) resolve(fallback);
          else resolve(res);
        });
      } catch {
        resolve(fallback);
      }
    });
  }

  function safeStorageSet(data) {
    if (!isContextValid()) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {}
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function getFallbackIcon() {
    try {
      if (isContextValid()) return chrome.runtime.getURL('icons/icon32.png');
    } catch {}
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%23a8d8ea"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>';
  }

  function attachFaviconFallback(img, url) {
    if (!img) return;
    img.addEventListener('error', function () {
      const host = shortHost(url);
      if (host && !img.dataset.fallbackTried) {
        img.dataset.fallbackTried = 'true';
        img.src = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
      } else {
        img.src = getFallbackIcon();
      }
    }, { once: true });
  }

  function faviconUrl(url) {
    try {
      const u = new URL(url);
      const domain = u.hostname.replace(/^www\./, '');
      if (!domain) return getFallbackIcon();
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    } catch {
      return getFallbackIcon();
    }
  }

  async function loadData() {
    try {
      const d = await safeStorageGet(['categories', 'cardPositions', 'theme', 'bpCards', 'bpBrightness', 'bpBlur', 'overlayEnabled', 'hasInstalled']);
      if (!d.categories || d.categories.length === 0) {
        categories = [
          { id: 'cat-main', name: 'Main Bookmarks', color: '#a8d8ea', order: 0, collapsed: false, bookmarks: [] }
        ];
        await safeStorageSet({ categories, hasInstalled: true });
      } else {
        categories = d.categories || [];
      }

      cardPositions = d.cardPositions || {};

      theme = d.theme || 'dark';
      cardsVisible = d.bpCards !== false;
      root.setAttribute('data-theme', theme);
      updateThemeIcon();
      updateCardsBtnState();

      bpBrightness = d.bpBrightness !== undefined ? d.bpBrightness : 100;
      bpBlur = d.bpBlur !== undefined ? d.bpBlur : 24;
      overlayEnabled = d.overlayEnabled !== false;

      applyAesthetics(bpBrightness, bpBlur);
      updateOverlayState();
    } catch (e) {
      console.warn('BookmarkPanels: Storage read skipped', e);
    }
  }

  function updateCardsBtnState() {
    const btn = qs('[data-sb="cards"]');
    if (btn) {
      const active = isGoogleHomePage() ? cardsVisible : showCardsOnThisPage;
      btn.classList.toggle('active', active);
      btn.title = active ? 'Hide Floating Panels' : 'Show Floating Panels';
    }
  }

  function updateThemeIcon() {
    const themeBtn = qs('[data-sb="theme"]');
    if (!themeBtn) return;
    if (theme === 'dark') {
      themeBtn.title = 'Switch to Light Mode';
      themeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      themeBtn.title = 'Switch to Dark Mode';
      themeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  function applyAesthetics(bright, blur) {
    root.style.setProperty('--panel-brightness', (bright / 100).toString());
    root.style.setProperty('--glass-blur', blur + 'px');
    const bSlider = qs('[data-slider="brightness"]');
    const bVal = qs('[data-val="brightness"]');
    const blSlider = qs('[data-slider="blur"]');
    const blVal = qs('[data-val="blur"]');
    if (bSlider) bSlider.value = bright;
    if (bVal) bVal.textContent = bright + '%';
    if (blSlider) blSlider.value = blur;
    if (blVal) blVal.textContent = blur + 'px';
  }

  function updateOverlayState() {
    if (!overlayEnabled) {
      root.classList.add('overlay-disabled');
      const banner = qs('[data-role="disabled-banner"]');
      if (banner) banner.classList.remove('hidden');
    } else {
      root.classList.remove('overlay-disabled');
      const banner = qs('[data-role="disabled-banner"]');
      if (banner) banner.classList.add('hidden');
    }
  }

  function broadcastSync(type, data) {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage({
        action: 'broadcast-sync',
        payload: { type, [type]: data, timestamp: Date.now() }
      }).catch(() => {});
    } catch {}
  }

  async function saveCategories() {
    if (!isContextValid()) {
      showToast('Extension reloaded. Please refresh this page (F5).');
      return;
    }
    const clean = JSON.parse(JSON.stringify(categories));
    await safeStorageSet({ categories: clean, hasInstalled: true });
    broadcastSync('categories', clean);
  }

  async function savePositions() {
    const clean = JSON.parse(JSON.stringify(cardPositions));
    await safeStorageSet({ cardPositions: clean });
    broadcastSync('cardPositions', clean);
  }

  function shortHost(u) {
    try { return new URL(u).hostname.replace('www.', ''); } catch { return u; }
  }

  function esc(s) {
    const d = document.createElement('span');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function renderSidebar(filterTerm = '') {
    if (!sbList) return;
    try {
      sbList.innerHTML = '';

      const bulkToggleBtn = qs('[data-action="toggle-bulk"]');
      if (bulkToggleBtn) {
        bulkToggleBtn.textContent = selectMode ? 'Cancel' : 'Select';
        bulkToggleBtn.classList.toggle('active', selectMode);
      }

      const bulkBar = qs('[data-role="bulk-bar"]');
      const bulkCount = qs('[data-role="bulk-count"]');
      const bulkSelect = qs('[data-role="bulk-move-select"]');
      if (bulkBar) {
        if (selectMode) {
          bulkBar.classList.remove('hidden');
          if (bulkCount) bulkCount.textContent = `${selectedBmIds.size} selected`;
          if (bulkSelect) {
            bulkSelect.innerHTML = '<option value="" disabled selected>Move to...</option>';
            const catList = Array.isArray(categories) ? categories.filter(c => c && typeof c === 'object') : [];
            catList.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id;
              opt.textContent = c.name || 'Category';
              bulkSelect.appendChild(opt);
            });
          }
        } else {
          bulkBar.classList.add('hidden');
        }
      }

      const catList = Array.isArray(categories) ? categories.filter(c => c && typeof c === 'object') : [];
      const sorted = catList.sort((a, b) => ((a.order || 0) - (b.order || 0)));
      const term = typeof filterTerm === 'string' ? filterTerm.trim().toLowerCase() : '';

      for (const cat of sorted) {
        if (!cat) continue;
        const bmsList = Array.isArray(cat.bookmarks) ? cat.bookmarks : [];
        const bms = term
          ? bmsList.filter(b => b && (((b.title || '').toLowerCase().includes(term)) || ((b.url || '').toLowerCase().includes(term))))
          : bmsList;
        if (term && bms.length === 0) continue;

        const section = document.createElement('div');
        section.className = 'bp-cat-section' + (cat.collapsed && !term ? ' collapsed' : '');
        section.dataset.catId = cat.id;
        section.draggable = !selectMode;

        const header = document.createElement('div');
        header.className = 'bp-cat-header';
        header.title = 'Click to collapse/expand';
        const isHidden = Boolean(cardPositions[cat.id]?.hidden);
        header.innerHTML = `
          <div class="bp-cat-color-dot" style="background:${cat.color || '#a8d8ea'}"></div>
          <span class="bp-cat-name">${esc(cat.name || 'Category')}</span>
          <span class="bp-cat-count">${bmsList.length}</span>
          ${isHidden ? '<span class="bp-cat-hidden-badge" title="Floating panel hidden">&times; Hidden</span>' : ''}
          <span class="bp-cat-chevron">\u25BC</span>
          <button class="bp-dot-btn" data-trigger="cat-menu" title="Options">\u22EE</button>
        `;
        section.appendChild(header);

        header.addEventListener('click', async (e) => {
          try {
            if (e.target.closest('.bp-dot-btn')) return;
            cat.collapsed = !cat.collapsed;
            await saveCategories();
            renderSidebar(searchInput ? searchInput.value : '');
          } catch (err) { /* ignore */ }
        });

        header.querySelector('[data-trigger="cat-menu"]').addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = e.target.getBoundingClientRect();
          showDropdown(rect.left, rect.bottom + 4, [
            { icon: '\u270E', label: 'Rename', action: () => showCategoryModal(cat) },
            { icon: '\u25CF', label: 'Change Color', action: () => showCategoryModal(cat) },
            { icon: '+', label: 'Add Bookmark', action: () => showBookmarkModal(cat.id) },
            { icon: '\u2605', label: 'Save This Page', action: () => savePageTo(cat) },
            isHidden
              ? { icon: '\uD83D\uDC41', label: 'Show Floating Panel', action: () => toggleCardVisibility(cat.id, false) }
              : { icon: '\u2573', label: 'Hide Floating Panel', action: () => toggleCardVisibility(cat.id, true) },
            'sep',
            { icon: '\u2715', label: 'Delete', danger: true, action: () => deleteCategory(cat) }
          ]);
        });

        const catBody = document.createElement('div');
        catBody.className = 'bp-cat-body';

      bms.forEach(bm => {
        if (!bm) return;
        const row = document.createElement('div');
        const isSelected = selectedBmIds.has(bm.id);
        row.className = 'bp-bm-row' + (isSelected ? ' selected' : '');
        row.draggable = !selectMode;
        row.dataset.bmId = bm.id || '';
        row.dataset.catId = cat.id || '';

        const bmTitle = bm.title || bm.url || 'Bookmark';
        const bmUrl = bm.url || '#';

        if (selectMode) {
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'bp-bm-checkbox';
          cb.checked = isSelected;
          cb.title = 'Select bookmark';
          cb.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cb.checked) {
              selectedBmIds.add(bm.id);
              row.classList.add('selected');
            } else {
              selectedBmIds.delete(bm.id);
              row.classList.remove('selected');
            }
            if (bulkCount) bulkCount.textContent = `${selectedBmIds.size} selected`;
          });
          row.appendChild(cb);
        }

        const favImg = document.createElement('img');
        favImg.className = 'bp-bm-fav';
        favImg.src = faviconUrl(bmUrl);
        favImg.alt = '';
        favImg.loading = 'lazy';
        attachFaviconFallback(favImg, bmUrl);
        row.appendChild(favImg);

        const info = document.createElement('div');
        info.className = 'bp-bm-info';
        info.innerHTML = `
          <span class="bp-bm-name" title="${esc(bmTitle)}">${esc(bmTitle)}</span>
          <span class="bp-bm-host">${esc(shortHost(bmUrl))}</span>
        `;
        row.appendChild(info);

        if (!selectMode) {
          const menuBtn = document.createElement('button');
          menuBtn.className = 'bp-dot-btn';
          menuBtn.dataset.trigger = 'bm-menu';
          menuBtn.title = 'Options';
          menuBtn.textContent = '\u22EE';
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const r = e.target.getBoundingClientRect();
            showDropdown(r.left, r.bottom + 4, [
              { icon: '\u270E', label: 'Edit', action: () => showBookmarkModal(cat.id, bm) },
              { icon: '\u2197', label: 'Open in New Tab', action: () => window.open(bmUrl, '_blank') },
              'sep',
              { icon: '\u2715', label: 'Delete', danger: true, action: async () => {
                try {
                  cat.bookmarks = (cat.bookmarks || []).filter(b => b.id !== bm.id);
                  await saveCategories();
                  renderSidebar(searchInput ? searchInput.value : '');
                  renderCards();
                } catch (err) { /* ignore */ }
              }}
            ]);
          });
          row.appendChild(menuBtn);
        }

        row.addEventListener('click', (e) => {
          if (e.target.closest('.bp-dot-btn') || e.target.closest('.bp-bm-checkbox')) return;
          if (selectMode) {
            const cb = row.querySelector('.bp-bm-checkbox');
            if (selectedBmIds.has(bm.id)) {
              selectedBmIds.delete(bm.id);
              row.classList.remove('selected');
              if (cb) cb.checked = false;
            } else {
              selectedBmIds.add(bm.id);
              row.classList.add('selected');
              if (cb) cb.checked = true;
            }
            if (bulkCount) bulkCount.textContent = `${selectedBmIds.size} selected`;
            return;
          }
          if (bmUrl === '#') return;
          if (e.ctrlKey || e.metaKey) window.open(bmUrl, '_blank');
          else window.location.href = bmUrl;
        });

        if (!selectMode) {
          setupBmDrag(row, bm, cat);
        }
        catBody.appendChild(row);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'bp-add-bm-btn';
      addBtn.textContent = '+ Add bookmark';
      addBtn.title = 'Add bookmark';
      addBtn.addEventListener('click', () => showBookmarkModal(cat.id));
      catBody.appendChild(addBtn);

      section.appendChild(catBody);

      setupSectionDrag(section, cat);

      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('application/bp-bm')) {
          section.classList.add('drop-target');
        }
      });
      section.addEventListener('dragleave', (e) => {
        if (!section.contains(e.relatedTarget)) section.classList.remove('drop-target');
      });
      section.addEventListener('drop', async (e) => {
        try {
          section.classList.remove('drop-target');
          const bmData = e.dataTransfer ? e.dataTransfer.getData('application/bp-bm') : null;
          if (bmData) {
            e.preventDefault();
            const { bmId, fromCatId } = JSON.parse(bmData);
            if (fromCatId !== cat.id) {
              await moveBookmark(bmId, fromCatId, cat.id);
              renderSidebar(searchInput ? searchInput.value : '');
              renderCards();
            }
          }
        } catch (err) {
          console.warn('BookmarkPanels: Section drop error', err);
        }
      });

      sbList.appendChild(section);
    }

    const addCat = document.createElement('button');
    addCat.className = 'bp-add-cat-btn';
    addCat.textContent = '+ New Category';
    addCat.title = 'New Category';
    addCat.addEventListener('click', () => showCategoryModal());
    sbList.appendChild(addCat);
    } catch (err) {
      console.warn('BookmarkPanels: renderSidebar error', err);
    }
  }

  function setupBmDrag(row, bm, cat) {
    row.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      row.classList.add('bm-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/bp-bm', JSON.stringify({ bmId: bm.id, fromCatId: cat.id }));
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('bm-dragging');
      qsa('.drag-above,.drag-below').forEach(el => el.classList.remove('drag-above', 'drag-below'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      qsa('.drag-above,.drag-below').forEach(el => el.classList.remove('drag-above', 'drag-below'));
      const rect = row.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) row.classList.add('drag-above');
      else row.classList.add('drag-below');
    });
    row.addEventListener('dragleave', () => { row.classList.remove('drag-above', 'drag-below'); });
    row.addEventListener('drop', async (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        row.classList.remove('drag-above', 'drag-below');
        const above = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        const raw = e.dataTransfer ? e.dataTransfer.getData('application/bp-bm') : null;
        if (!raw) return;
        const { bmId, fromCatId } = JSON.parse(raw);
        const bmsList = Array.isArray(cat.bookmarks) ? cat.bookmarks : [];
        let targetIdx = bmsList.findIndex(b => b.id === bm.id);
        if (!above) targetIdx++;
        if (fromCatId === cat.id) {
          const fromIdx = bmsList.findIndex(b => b.id === bmId);
          if (fromIdx !== -1 && fromIdx < targetIdx) targetIdx--;
        }
        await moveBookmark(bmId, fromCatId, cat.id, Math.max(0, targetIdx));
        renderSidebar(searchInput ? searchInput.value : '');
        renderCards();
      } catch (err) {
        console.warn('BookmarkPanels: Bookmark drop error', err);
      }
    });
  }

  function setupSectionDrag(section, cat) {
    section.addEventListener('dragstart', (e) => {
      if (e.target !== section) return;
      section.classList.add('section-dragging');
      e.dataTransfer.setData('application/bp-cat', cat.id);
    });
    section.addEventListener('dragend', () => { section.classList.remove('section-dragging'); });

    section.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/bp-cat')) {
        e.preventDefault();
        const allSections = Array.from(sbList.querySelectorAll('.bp-cat-section'));
        const dragged = allSections.find(s => s.classList.contains('section-dragging'));
        if (dragged && dragged !== section) {
          const dIdx = allSections.indexOf(dragged);
          const tIdx = allSections.indexOf(section);
          if (dIdx < tIdx) section.after(dragged);
          else section.before(dragged);
        }
      }
    });
    section.addEventListener('drop', async (e) => {
      if (e.dataTransfer.types.includes('application/bp-cat')) {
        e.preventDefault();
        const allSections = Array.from(sbList.querySelectorAll('.bp-cat-section'));
        allSections.forEach((s, i) => {
          const c = categories.find(c => c.id === s.dataset.catId);
          if (c) c.order = i;
        });
        categories.sort((a, b) => (a.order || 0) - (b.order || 0));
        await saveCategories();
        renderCards();
      }
    });
  }

  function renderCards() {
    if (!cardsContainer) return;
    try {
      cardsContainer.innerHTML = '';

      if (!cardsVisible || !overlayEnabled || !showCardsOnThisPage) return;

      const catList = Array.isArray(categories) ? categories.filter(c => c && typeof c === 'object') : [];
      const sorted = catList.sort((a, b) => ((a.order || 0) - (b.order || 0)));
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      sorted.forEach((cat, idx) => {
        if (!cat) return;

        if (cardPositions[cat.id]?.hidden) return;

        let pos = cardPositions[cat.id];
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          pos = { x: 24 + col * 260, y: 70 + row * 220 };
          cardPositions[cat.id] = pos;
        }

        const card = document.createElement('div');
        card.className = 'bp-card' + (cat.collapsed ? ' collapsed' : '');
        card.dataset.catId = cat.id;
        const clampedX = clamp(pos.x, 16, Math.max(16, vw - 250));
        const clampedY = clamp(pos.y, 16, Math.max(16, vh - 60));
        card.style.left = clampedX + 'px';
        card.style.top = clampedY + 'px';
        card.style.zIndex = zCounter++;
        card.style.pointerEvents = 'auto';

        const accent = document.createElement('div');
        accent.className = 'bp-card-accent';
        accent.style.background = cat.color || '#a8d8ea';
        card.appendChild(accent);

        const bmsList = Array.isArray(cat.bookmarks) ? cat.bookmarks : [];

        const head = document.createElement('div');
        head.className = 'bp-card-head';
        head.title = 'Drag to move';
        head.innerHTML = `
          <div class="bp-card-cdot" style="background:${cat.color || '#a8d8ea'}"></div>
          <span class="bp-card-cname">${esc(cat.name || 'Category')}</span>
          <span class="bp-card-ccount">${bmsList.length}</span>
          <button class="bp-card-chevron" data-action="toggle-card" title="${cat.collapsed ? 'Expand' : 'Collapse'}">${cat.collapsed ? '\u25B6' : '\u25BC'}</button>
          <button class="bp-dot-btn" data-trigger="card-cat-menu" title="Options">\u22EE</button>
          <button class="bp-card-close-btn" data-action="close-card" title="Hide this panel">&times;</button>
        `;
        card.appendChild(head);

        head.querySelector('[data-action="toggle-card"]').addEventListener('click', async (e) => {
          try {
            e.stopPropagation();
            cat.collapsed = !cat.collapsed;
            await saveCategories();
            renderCards();
          } catch (err) { /* ignore */ }
        });

        head.querySelector('[data-action="close-card"]').addEventListener('click', async (e) => {
          try {
            e.stopPropagation();
            toggleCardVisibility(cat.id, true);
          } catch (err) { /* ignore */ }
        });

        head.querySelector('[data-trigger="card-cat-menu"]').addEventListener('click', (e) => {
          e.stopPropagation();
          const r = e.target.getBoundingClientRect();
          showDropdown(r.left, r.bottom + 4, [
            { icon: '\u270E', label: 'Rename', action: () => showCategoryModal(cat) },
            { icon: '\u25CF', label: 'Change Color', action: () => showCategoryModal(cat) },
            { icon: '+', label: 'Add Bookmark', action: () => showBookmarkModal(cat.id) },
            { icon: '\u2605', label: 'Save This Page', action: () => savePageTo(cat) },
            'sep',
            { icon: '\u2715', label: 'Delete', danger: true, action: () => deleteCategory(cat) }
          ]);
        });

        const cardBody = document.createElement('div');
        cardBody.className = 'bp-card-body';
        bmsList.forEach(bm => {
          if (!bm) return;
          const item = document.createElement('div');
          item.className = 'bp-card-bm';
          item.draggable = true;
          item.dataset.bmId = bm.id || '';
          item.dataset.catId = cat.id || '';

          const bmTitle = bm.title || bm.url || 'Bookmark';
          const bmUrl = bm.url || '#';
          item.title = bmTitle;
          item.innerHTML = `
            <img class="bp-card-bm-fav" src="${faviconUrl(bmUrl)}" alt="" loading="lazy">
            <span title="${esc(bmTitle)}">${esc(bmTitle)}</span>
            <button class="bp-dot-btn" data-trigger="card-bm-menu" title="Options">\u22EE</button>
          `;
          attachFaviconFallback(item.querySelector('.bp-card-bm-fav'), bmUrl);

          item.addEventListener('click', (e) => {
            if (e.target.closest('.bp-dot-btn')) return;
            if (bmUrl === '#') return;
            if (e.ctrlKey || e.metaKey) window.open(bmUrl, '_blank');
            else window.location.href = bmUrl;
          });

          item.querySelector('[data-trigger="card-bm-menu"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const r = e.target.getBoundingClientRect();
            showDropdown(r.left, r.bottom + 4, [
              { icon: '\u270E', label: 'Edit', action: () => showBookmarkModal(cat.id, bm) },
              { icon: '\u2197', label: 'Open in New Tab', action: () => window.open(bmUrl, '_blank') },
              'sep',
              { icon: '\u2715', label: 'Delete', danger: true, action: async () => {
                try {
                  cat.bookmarks = (cat.bookmarks || []).filter(b => b.id !== bm.id);
                  await saveCategories();
                  renderCards();
                  if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
                } catch (err) { /* ignore */ }
              }}
            ]);
          });

          setupBmDrag(item, bm, cat);
          cardBody.appendChild(item);
        });

        const addBmBtn = document.createElement('button');
        addBmBtn.className = 'bp-add-bm-btn';
        addBmBtn.textContent = '+ Add bookmark';
        addBmBtn.title = 'Add bookmark';
        addBmBtn.addEventListener('click', () => showBookmarkModal(cat.id));
        cardBody.appendChild(addBmBtn);

        card.appendChild(cardBody);

        card.addEventListener('dragover', (e) => {
          if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('application/bp-bm')) {
            e.preventDefault();
            card.classList.add('bp-card-drop');
          }
        });
        card.addEventListener('dragleave', (e) => {
          if (!card.contains(e.relatedTarget)) card.classList.remove('bp-card-drop');
        });
        card.addEventListener('drop', async (e) => {
          try {
            card.classList.remove('bp-card-drop');
            const bmData = e.dataTransfer ? e.dataTransfer.getData('application/bp-bm') : null;
            if (bmData) {
              e.preventDefault();
              const { bmId, fromCatId } = JSON.parse(bmData);
              if (fromCatId !== cat.id) {
                await moveBookmark(bmId, fromCatId, cat.id);
                renderCards();
                if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
              }
            }
          } catch (err) {
            console.warn('BookmarkPanels: Card drop error', err);
          }
        });

        card.addEventListener('mousedown', () => { card.style.zIndex = zCounter++; });
        initCardDrag(card, head, cat.id);

        cardsContainer.appendChild(card);
      });
    } catch (err) {
      console.warn('BookmarkPanels: renderCards error', err);
    }
  }

  async function toggleCardVisibility(catId, hide) {
    try {
      cardPositions[catId] = cardPositions[catId] || {};
      cardPositions[catId].hidden = hide;
      if (!hide) showCardsOnThisPage = true;
      await savePositions();
      updateCardsBtnState();
      renderCards();
      renderSidebar(searchInput ? searchInput.value : '');
      const cat = categories.find(c => c.id === catId);
      showToast(hide ? `"${cat ? cat.name : 'Category'}" panel hidden` : `"${cat ? cat.name : 'Category'}" panel shown`);
    } catch (err) { /* ignore */ }
  }

  function initCardDrag(card, head, catId) {
    let sx = 0, sy = 0, ox = 0, oy = 0;

    function onMouseMove(e) {
      const maxX = Math.max(0, window.innerWidth - 100);
      const maxY = Math.max(0, window.innerHeight - 40);
      card.style.left = clamp(ox + e.clientX - sx, 0, maxX) + 'px';
      card.style.top = clamp(oy + e.clientY - sy, 0, maxY) + 'px';
    }

    async function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      card.classList.remove('bp-card-dragging');
      cardPositions[catId] = Object.assign({}, cardPositions[catId], {
        x: parseInt(card.style.left) || 0,
        y: parseInt(card.style.top) || 0
      });
      try {
        await savePositions();
      } catch (err) { /* ignore */ }
    }

    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      if (e.button !== 0) return;
      sx = e.clientX;
      sy = e.clientY;
      ox = parseInt(card.style.left) || 0;
      oy = parseInt(card.style.top) || 0;
      card.classList.add('bp-card-dragging');
      card.style.zIndex = zCounter++;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  function openSidebar() {
    sidebarOpen = true;
    root.classList.add('sidebar-open');
    renderSidebar();
  }

  function closeSidebar() {
    sidebarOpen = false;
    root.classList.remove('sidebar-open');
    hideDropdown();
  }

  function toggleSidebar() {
    if (sidebarOpen) closeSidebar(); else openSidebar();
  }

  function toggleCards() {
    if (!isGoogleHomePage()) {
      showCardsOnThisPage = !showCardsOnThisPage;
      updateCardsBtnState();
      renderCards();
      showToast(showCardsOnThisPage ? 'Floating panels enabled on this page' : 'Floating panels hidden on this page');
      return;
    }
    cardsVisible = !cardsVisible;
    if (cardsVisible) {

      Object.keys(cardPositions).forEach(k => {
        if (cardPositions[k]) delete cardPositions[k].hidden;
      });
      safeStorageSet({ cardPositions });
      broadcastSync('cardPositions', cardPositions);
    }
    safeStorageSet({ bpCards: cardsVisible });
    broadcastSync('bpCards', cardsVisible);
    updateCardsBtnState();
    renderCards();
    renderSidebar(searchInput ? searchInput.value : '');
    showToast(cardsVisible ? 'Floating panels enabled' : 'Floating panels hidden');
  }

  let activeMenuBackdrop = null;

  function showDropdown(x, y, items) {
    hideDropdown();

    activeMenuBackdrop = document.createElement('div');
    activeMenuBackdrop.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:auto;background:transparent;';
    activeMenuBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      hideDropdown();
    });
    activeMenuBackdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      hideDropdown();
    });
    root.appendChild(activeMenuBackdrop);

    const dd = document.createElement('div');
    dd.className = 'bp-dropdown';
    dd.style.zIndex = '2147483646';
    dd.style.left = clamp(x, 8, window.innerWidth - 170) + 'px';
    dd.style.top = clamp(y, 8, window.innerHeight - 220) + 'px';

    items.forEach(item => {
      if (item === 'sep') {
        dd.insertAdjacentHTML('beforeend', '<div class="bp-dd-sep"></div>');
        return;
      }
      const row = document.createElement('div');
      row.className = 'bp-dd-item' + (item.danger ? ' danger' : '');
      row.innerHTML = `<span class="bp-dd-icon">${item.icon}</span>${esc(item.label)}`;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        hideDropdown();
        item.action();
      });
      dd.appendChild(row);
    });

    activeMenuEl = dd;
    root.appendChild(dd);
  }

  function hideDropdown() {
    if (activeMenuEl) {
      activeMenuEl.remove();
      activeMenuEl = null;
    }
    if (activeMenuBackdrop) {
      activeMenuBackdrop.remove();
      activeMenuBackdrop = null;
    }
  }

  const catNameInput = qs('[data-input="cat-name"]');
  const bmTitleInput = qs('[data-input="bm-title"]');
  const bmUrlInput = qs('[data-input="bm-url"]');
  const catSaveBtn = catModal.querySelector('[data-action="modal-save-cat"]');
  const catCancelBtn = catModal.querySelector('[data-action="modal-cancel"]');
  const bmSaveBtn = bmModal.querySelector('[data-action="modal-save-bm"]');
  const bmCancelBtn = bmModal.querySelector('[data-action="modal-cancel"]');

  function showCategoryModal(editCat) {
    hideDropdown();
    modalEditCat = editCat || null;
    qs('[data-role="cat-modal-title"]').textContent = editCat ? 'Edit Category' : 'New Category';
    catNameInput.value = editCat ? editCat.name : '';
    selectedColor = editCat ? editCat.color : PRESET_COLORS[0];
    colorGrid.querySelectorAll('.bp-color-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.color === selectedColor);
    });
    catModal.classList.remove('hidden');
    setTimeout(() => catNameInput.focus(), 60);
  }

  function closeCategoryModal() {
    catModal.classList.add('hidden');
    modalEditCat = null;
  }

  async function saveCategoryModal() {
    const name = catNameInput.value.trim();
    if (!name) {
      catNameInput.focus();
      return;
    }
    if (modalEditCat) {
      const cat = categories.find(c => c.id === modalEditCat.id);
      if (cat) {
        cat.name = name;
        cat.color = selectedColor;
      }
    } else {
      categories.push({
        id: 'cat-' + Date.now(),
        name,
        color: selectedColor,
        order: categories.length,
        collapsed: false,
        bookmarks: []
      });
    }
    await saveCategories();
    closeCategoryModal();
    renderSidebar(searchInput ? searchInput.value : '');
    renderCards();
    showToast(modalEditCat ? 'Category updated' : 'Category created');
  }

  function showBookmarkModal(catId, editBm) {
    hideDropdown();
    modalEditBm = editBm || null;
    modalBmCatId = catId;
    qs('[data-role="bm-modal-title"]').textContent = editBm ? 'Edit Bookmark' : 'Add Bookmark';
    bmTitleInput.value = editBm ? editBm.title : '';
    bmUrlInput.value = editBm ? editBm.url : '';
    bmModal.classList.remove('hidden');
    setTimeout(() => (editBm ? bmTitleInput : bmUrlInput).focus(), 60);
  }

  function closeBookmarkModal() {
    bmModal.classList.add('hidden');
    modalEditBm = null;
    modalBmCatId = null;
  }

  async function saveBookmarkModal() {
    const title = bmTitleInput.value.trim();
    let url = bmUrlInput.value.trim();
    if (!url) {
      bmUrlInput.focus();
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    let cat = categories.find(c => c.id === modalBmCatId);
    if (!cat && modalEditBm) {
      cat = categories.find(c => (c.bookmarks || []).some(b => b.id === modalEditBm.id));
    }
    if (!cat) return;

    if (modalEditBm) {
      const bm = (cat.bookmarks || []).find(b => b.id === modalEditBm.id);
      if (bm) {
        bm.title = title || url;
        bm.url = url;
      }
    } else {
      cat.bookmarks = cat.bookmarks || [];
      cat.bookmarks.push({
        id: 'bm-' + Date.now(),
        title: title || url,
        url,
        order: cat.bookmarks.length
      });
    }
    await saveCategories();
    closeBookmarkModal();
    renderSidebar(searchInput ? searchInput.value : '');
    renderCards();
    showToast(modalEditBm ? 'Bookmark updated' : 'Bookmark added');
  }

  catSaveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    saveCategoryModal();
  });
  catCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCategoryModal();
  });
  catModal.addEventListener('click', (e) => {
    if (e.target === catModal) closeCategoryModal();
  });
  catNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCategoryModal();
    }
    if (e.key === 'Escape') closeCategoryModal();
  });

  bmSaveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    saveBookmarkModal();
  });
  bmCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeBookmarkModal();
  });
  bmModal.addEventListener('click', (e) => {
    if (e.target === bmModal) closeBookmarkModal();
  });
  bmTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmarkModal();
    }
    if (e.key === 'Escape') closeBookmarkModal();
  });
  bmUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmarkModal();
    }
    if (e.key === 'Escape') closeBookmarkModal();
  });

  root.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'toggle-sidebar') { toggleSidebar(); return; }
    if (action === 'close-sidebar') { closeSidebar(); return; }
    if (action === 'toggle-bulk') {
      selectMode = !selectMode;
      if (!selectMode) selectedBmIds.clear();
      renderSidebar(searchInput ? searchInput.value : '');
      return;
    }
    if (action === 'enable-overlay') {
      overlayEnabled = true;
      updateOverlayState();
      await safeStorageSet({ overlayEnabled: true });
      broadcastSync('overlayEnabled', true);
      showToast('Overlay enabled on web pages');
      return;
    }
  });

  sidebar.querySelector('.bp-sb-actions').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-sb]')?.dataset.sb;
    if (!act) return;
    switch (act) {
      case 'close': closeSidebar(); break;
      case 'theme':
        theme = theme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', theme);
        updateThemeIcon();
        await safeStorageSet({ theme });
        broadcastSync('theme', theme);
        showToast(theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
        break;
      case 'cards': toggleCards(); break;
      case 'import': importChromeBookmarks(); break;
      case 'brightness': {
        e.stopPropagation();
        const pop = qs('[data-role="brightness-popover"]');
        if (pop) pop.classList.toggle('hidden');
        break;
      }
      case 'power': {
        overlayEnabled = !overlayEnabled;
        updateOverlayState();
        await safeStorageSet({ overlayEnabled });
        broadcastSync('overlayEnabled', overlayEnabled);
        showToast(overlayEnabled ? 'Overlay enabled on web pages' : 'Overlay disabled on web pages');
        break;
      }
    }
  });

  const bulkBar = qs('[data-role="bulk-bar"]');
  if (bulkBar) {
    bulkBar.addEventListener('click', async (e) => {
      const bulkAct = e.target.closest('[data-bulk]')?.dataset.bulk;
      if (!bulkAct) return;
      if (bulkAct === 'select-all') {
        const visibleBmIds = [];
        qsa('.bp-bm-row').forEach(r => { if (r.dataset.bmId) visibleBmIds.push(r.dataset.bmId); });
        const allSelected = visibleBmIds.length > 0 && visibleBmIds.every(id => selectedBmIds.has(id));
        if (allSelected) {
          visibleBmIds.forEach(id => selectedBmIds.delete(id));
        } else {
          visibleBmIds.forEach(id => selectedBmIds.add(id));
        }
        renderSidebar(searchInput ? searchInput.value : '');
        return;
      }
      if (bulkAct === 'delete') {
        if (selectedBmIds.size === 0) {
          showToast('No bookmarks selected');
          return;
        }
        if (!confirm(`Delete ${selectedBmIds.size} selected bookmark(s)?`)) return;
        let count = 0;
        for (const cat of categories) {
          const before = (cat.bookmarks || []).length;
          cat.bookmarks = (cat.bookmarks || []).filter(b => !selectedBmIds.has(b.id));
          count += (before - cat.bookmarks.length);
        }
        selectedBmIds.clear();
        selectMode = false;
        await saveCategories();
        renderSidebar(searchInput ? searchInput.value : '');
        renderCards();
        showToast(`Deleted ${count} bookmark(s)`);
        return;
      }
      if (bulkAct === 'done') {
        selectMode = false;
        selectedBmIds.clear();
        renderSidebar(searchInput ? searchInput.value : '');
        return;
      }
    });

    const bulkSelect = qs('[data-role="bulk-move-select"]');
    if (bulkSelect) {
      bulkSelect.addEventListener('change', async (e) => {
        const targetCatId = e.target.value;
        if (!targetCatId || selectedBmIds.size === 0) {
          if (selectedBmIds.size === 0) showToast('No bookmarks selected');
          bulkSelect.value = '';
          return;
        }
        const targetCat = categories.find(c => c.id === targetCatId);
        if (!targetCat) return;

        targetCat.bookmarks = targetCat.bookmarks || [];
        let count = 0;
        for (const cat of categories) {
          if (cat.id === targetCatId) continue;
          const remaining = [];
          for (const bm of (cat.bookmarks || [])) {
            if (selectedBmIds.has(bm.id)) {
              targetCat.bookmarks.push(bm);
              count++;
            } else {
              remaining.push(bm);
            }
          }
          cat.bookmarks = remaining;
        }

        selectedBmIds.clear();
        selectMode = false;
        await saveCategories();
        renderSidebar(searchInput ? searchInput.value : '');
        renderCards();
        showToast(`Moved ${count} bookmark(s) to "${targetCat.name}"`);
      });
    }
  }

  const bSlider = qs('[data-slider="brightness"]');
  const bVal = qs('[data-val="brightness"]');
  const blSlider = qs('[data-slider="blur"]');
  const blVal = qs('[data-val="blur"]');

  if (bSlider) {
    bSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (bVal) bVal.textContent = val + '%';
      bpBrightness = val;
      root.style.setProperty('--panel-brightness', (val / 100).toString());
      safeStorageSet({ bpBrightness: val });
      broadcastSync('aesthetics', { bpBrightness: val, bpBlur });
    });
  }

  if (blSlider) {
    blSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (blVal) blVal.textContent = val + 'px';
      bpBlur = val;
      root.style.setProperty('--glass-blur', val + 'px');
      safeStorageSet({ bpBlur: val });
      broadcastSync('aesthetics', { bpBrightness, bpBlur: val });
    });
  }

  const bPop = qs('[data-role="brightness-popover"]');
  if (bPop) {
    bPop.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  root.addEventListener('click', (e) => {
    const pop = qs('[data-role="brightness-popover"]');
    const btn = qs('[data-sb="brightness"]');
    if (pop && !pop.classList.contains('hidden')) {
      if (!pop.contains(e.target) && !btn?.contains(e.target)) {
        pop.classList.add('hidden');
      }
    }
  });

  document.addEventListener('click', (e) => {
    const pop = qs('[data-role="brightness-popover"]');
    if (pop && !pop.classList.contains('hidden')) {
      if (e.target !== host) {
        pop.classList.add('hidden');
      }
    }
  });

  searchInput.addEventListener('input', (e) => renderSidebar(e.target.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      const t = searchInput.value.trim().toLowerCase();
      const match = categories.some(c => (c.bookmarks || []).some(b => 
        (b.title || '').toLowerCase().includes(t) || (b.url || '').toLowerCase().includes(t)
      ));
      if (!match) window.open(`https://www.google.com/search?q=${encodeURIComponent(searchInput.value.trim())}`, '_blank');
    }
  });

  async function moveBookmark(bmId, fromCatId, toCatId, insertIdx) {
    const from = categories.find(c => c.id === fromCatId);
    const to = categories.find(c => c.id === toCatId);
    if (!from || !to) return;
    const idx = from.bookmarks.findIndex(b => b.id === bmId);
    if (idx === -1) return;
    const [bm] = from.bookmarks.splice(idx, 1);
    if (insertIdx !== undefined && insertIdx >= 0) to.bookmarks.splice(insertIdx, 0, bm);
    else to.bookmarks.push(bm);
    await saveCategories();
  }

  async function deleteCategory(cat) {
    if (!confirm('Delete "' + (cat.name || 'Category') + '" and all its bookmarks?')) return;
    categories = categories.filter(c => c.id !== cat.id);
    delete cardPositions[cat.id];
    await saveCategories();
    await savePositions();
    renderSidebar(searchInput ? searchInput.value : '');
    renderCards();
    showToast('Category deleted');
  }

  async function savePageTo(cat) {
    cat.bookmarks = cat.bookmarks || [];
    const exists = cat.bookmarks.some(b => b.url === window.location.href);
    if (exists) { showToast('Already saved'); return; }
    cat.bookmarks.push({
      id: 'bm-' + Date.now(),
      title: document.title || window.location.href,
      url: window.location.href,
      order: cat.bookmarks.length
    });
    await saveCategories();
    renderSidebar(searchInput ? searchInput.value : '');
    renderCards();
    showToast('Saved to "' + (cat.name || 'Category') + '"');
  }

  async function importChromeBookmarks() {
    if (!confirm('Import Chrome bookmarks? Categories will be created from your bookmark folders.')) return;
    showToast('Importing bookmarks...');
    if (!isContextValid()) {
      showToast('Extension reloaded. Please refresh this page (F5).');
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: 'import-bookmarks' }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('BookmarkPanels: Import notice', chrome.runtime.lastError.message);
          return;
        }
        if (res && res.success) {
          categories = res.categories || categories;
          renderSidebar(searchInput ? searchInput.value : '');
          renderCards();
          showToast(`Imported ${res.count} bookmarks!`);
        } else {
          loadData().then(() => {
            renderSidebar(searchInput ? searchInput.value : '');
            renderCards();
            showToast('Bookmarks imported');
          }).catch(() => {});
        }
      });
    } catch (err) {
      console.warn('BookmarkPanels: Import error', err);
      showToast('Import failed. Please refresh this page (F5).');
    }
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'bp-toast';
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 250);
    }, 2000);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!catModal.classList.contains('hidden')) { catModal.classList.add('hidden'); return; }
      if (!bmModal.classList.contains('hidden')) { bmModal.classList.add('hidden'); return; }
      if (sidebarOpen) { closeSidebar(); return; }
      hideDropdown();
    }
    const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    if (!isInput) {
      if ((e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') || 
          (e.altKey && e.key.toLowerCase() === 'b') || 
          (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleSidebar();
      }
    }
  });

  if (isContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!isContextValid()) return;
        if (msg.action === 'toggle-panel') toggleSidebar();
        if (msg.action === 'refresh-panel') {
          loadData().then(() => {
            if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
            renderCards();
          }).catch(() => {});
        }
        if (msg.action === 'sync-update' && msg.payload) {
          const { type } = msg.payload;
          if (type === 'categories' && msg.payload.categories) {
            categories = msg.payload.categories;
            if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
            renderCards();
          } else if (type === 'cardPositions' && msg.payload.cardPositions) {
            cardPositions = msg.payload.cardPositions;
            renderCards();
            if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
          } else if (type === 'theme' && msg.payload.theme) {
            theme = msg.payload.theme;
            root.setAttribute('data-theme', theme);
            updateThemeIcon();
            if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
            renderCards();
          } else if (type === 'aesthetics' && msg.payload.aesthetics) {
            const { bpBrightness: b, bpBlur: bl } = msg.payload.aesthetics;
            if (b !== undefined) bpBrightness = b;
            if (bl !== undefined) bpBlur = bl;
            applyAesthetics(bpBrightness, bpBlur);
          } else if (type === 'bpCards' && msg.payload.bpCards !== undefined) {
            cardsVisible = msg.payload.bpCards !== false;
            updateCardsBtnState();
            renderCards();
            if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
          } else if (type === 'overlayEnabled' && msg.payload.overlayEnabled !== undefined) {
            overlayEnabled = msg.payload.overlayEnabled !== false;
            updateOverlayState();
          }
        }
      });
    } catch (e) { /* ignore */ }

    try {
      chrome.storage.onChanged.addListener((changes) => {
        if (!isContextValid()) return;
        if (changes.categories) {
          categories = changes.categories.newValue || [];
          if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
          renderCards();
        }
        if (changes.cardPositions) {
          cardPositions = changes.cardPositions.newValue || {};
          renderCards();
          if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
        }
        if (changes.theme) {
          theme = changes.theme.newValue || 'dark';
          root.setAttribute('data-theme', theme);
          updateThemeIcon();
          if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
          renderCards();
        }
        if (changes.bpCards !== undefined) {
          cardsVisible = changes.bpCards.newValue !== false;
          updateCardsBtnState();
          renderCards();
          if (sidebarOpen) renderSidebar(searchInput ? searchInput.value : '');
        }
        if (changes.overlayEnabled !== undefined) {
          overlayEnabled = changes.overlayEnabled.newValue !== false;
          updateOverlayState();
        }
        if (changes.bpBrightness !== undefined) {
          bpBrightness = changes.bpBrightness.newValue !== undefined ? changes.bpBrightness.newValue : 100;
          applyAesthetics(bpBrightness, bpBlur);
        }
        if (changes.bpBlur !== undefined) {
          bpBlur = changes.bpBlur.newValue !== undefined ? changes.bpBlur.newValue : 24;
          applyAesthetics(bpBrightness, bpBlur);
        }
      });
    } catch (e) { /* ignore */ }
  }

  loadData().then(() => {
    renderCards();
  }).catch(() => {});

})();
