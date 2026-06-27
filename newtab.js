'use strict';

// ── WMO weather code map ──────────────────────────────────────────────────────
const WMO = {
  0:  ['☀️', 'Clear'],
  1:  ['🌤️', 'Mostly clear'],
  2:  ['⛅', 'Partly cloudy'],
  3:  ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'],
  48: ['🌫️', 'Freezing fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'],
  61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  71: ['❄️', 'Light snow'],
  73: ['❄️', 'Snow'],
  75: ['❄️', 'Heavy snow'],
  77: ['🌨️', 'Snow grains'],
  80: ['🌧️', 'Rain showers'],
  81: ['🌧️', 'Rain showers'],
  82: ['⛈️', 'Heavy showers'],
  85: ['🌨️', 'Snow showers'],
  86: ['🌨️', 'Snow showers'],
  95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Thunderstorm'],
  99: ['⛈️', 'Thunderstorm'],
};

function wmoInfo(code) {
  if (WMO[code]) return WMO[code];
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b);
  const nearest = keys.filter(k => k <= code).pop();
  return WMO[nearest] || ['🌡️', 'Unknown'];
}

// ── Weather ───────────────────────────────────────────────────────────────────
const WEATHER_CACHE_KEY = 'ntp-weather-cache';
const WEATHER_LOC_KEY   = 'ntp-weather-loc'; // {lat, lon, label}
const WEATHER_TTL = 30 * 60 * 1000; // 30 min

function getManualLoc() {
  try { return JSON.parse(localStorage.getItem(WEATHER_LOC_KEY)); }
  catch { return null; }
}

async function loadWeather(force) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
      if (cached && Date.now() - cached.ts < WEATHER_TTL) {
        renderWeather(cached);
        return;
      }
    } catch (_) {}
  }

  const loc = getManualLoc();
  if (loc) {
    fetchWeatherFor(loc.lat, loc.lon, loc.label);
    return;
  }

  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    ({ coords: { latitude, longitude } }) => fetchWeatherFor(latitude, longitude, null),
    (e) => console.warn('[NTP] Geolocation denied:', e)
  );
}

async function fetchWeatherFor(lat, lon, label) {
  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,weathercode&timezone=auto`
    );
    const w = await wRes.json();

    let city = label;
    if (!city) {
      try {
        const gRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`,
          { headers: { 'User-Agent': 'CleanNewTab/1.1 personal-extension' } }
        );
        const g = await gRes.json();
        city = g.address?.city || g.address?.town || g.address?.village ||
               g.address?.county || g.address?.state || '';
      } catch (_) { city = ''; }
    }

    const data = {
      ts:   Date.now(),
      temp: Math.round(w.current.temperature_2m),
      code: w.current.weathercode,
      city,
    };

    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
    renderWeather(data);
  } catch (e) {
    console.warn('[NTP] Weather fetch failed:', e);
  }
}

function renderWeather({ temp, code, city }) {
  const [icon, desc] = wmoInfo(code);
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-temp').textContent = `${temp}°C`;
  document.getElementById('weather-desc').textContent = desc;
  document.getElementById('weather-city').textContent = city;
  document.getElementById('weather').style.display = 'flex';
}

async function geocodeCity(name) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
  );
  const j = await res.json();
  if (!j.results || !j.results.length) return null;
  const r = j.results[0];
  return { lat: r.latitude, lon: r.longitude, label: r.name };
}

// ── Shortcuts ───────────────────────────────────────────────────────────────
const SHORTCUTS_KEY = 'ntp-shortcuts';
const HIDDEN_KEY    = 'ntp-hidden';
const TOPSITES_CACHE_KEY = 'ntp-topsites-cache';

function getCustom() {
  try { return JSON.parse(localStorage.getItem(SHORTCUTS_KEY)) || []; }
  catch { return []; }
}

function saveCustom(arr) {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(arr));
}

function getHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY)) || []; }
  catch { return []; }
}

function saveHidden(arr) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr));
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

let cachedTopSites = [];

function makeTile({ title, url, kind }) {
  const hostname = hostOf(url);

  const a = document.createElement('a');
  a.href = url;
  a.className = 'shortcut draggable';
  a.title = title;
  a.dataset.url = url;
  a.dataset.title = title;
  a.dataset.kind = kind; // 'custom' | 'top'
  a.draggable = true;

  const iconDiv = document.createElement('div');
  iconDiv.className = 'shortcut-icon';

  const img = document.createElement('img');
  img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  img.alt = '';
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    iconDiv.textContent = (title[0] || '?').toUpperCase();
  };
  iconDiv.appendChild(img);

  const label = document.createElement('div');
  label.className = 'shortcut-label';
  label.textContent = title;

  a.appendChild(iconDiv);
  a.appendChild(label);

  const rm = document.createElement('button');
  rm.className = 'shortcut-remove';
  rm.textContent = '×';
  rm.title = kind === 'custom' ? 'Remove' : 'Hide';
  rm.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (kind === 'custom') {
      saveCustom(getCustom().filter(s => s.url !== url));
    } else {
      const hidden = getHidden();
      if (!hidden.includes(hostname)) hidden.push(hostname);
      saveHidden(hidden);
    }
    loadShortcuts();
  });
  a.appendChild(rm);

  return a;
}

function renderShortcuts(sites) {
  const container = document.getElementById('shortcuts');
  container.innerHTML = '';

  const custom = getCustom();
  const customHosts = new Set(custom.map(s => hostOf(s.url)));
  const hidden = new Set(getHidden());
  const MAX = 10;

  custom.forEach(s => container.appendChild(
    makeTile({ ...s, kind: 'custom' })));

  const remaining = MAX - custom.length;
  (sites || [])
    .filter(s => !customHosts.has(hostOf(s.url)) && !hidden.has(hostOf(s.url)))
    .slice(0, Math.max(0, remaining))
    .forEach(site => container.appendChild(makeTile({
      title: site.title || hostOf(site.url),
      url: site.url,
      kind: 'top',
    })));

  // "Add shortcut" tile
  const add = document.createElement('button');
  add.className = 'shortcut add';
  add.title = 'Add shortcut';
  add.innerHTML =
    '<div class="shortcut-icon"><svg viewBox="0 0 24 24" width="22" height="22">' +
    '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div>' +
    '<div class="shortcut-label">Add shortcut</div>';
  add.addEventListener('click', openShortcutModal);
  container.appendChild(add);
}

function loadShortcuts() {
  // Render instantly from cached top sites (no flash of empty grid)…
  let cached = [];
  try { cached = JSON.parse(localStorage.getItem(TOPSITES_CACHE_KEY)) || []; } catch (_) {}
  cachedTopSites = cached;
  renderShortcuts(cached);

  // …then refresh from the live API and re-render if it changed.
  chrome.topSites.get((sites) => {
    cachedTopSites = sites;
    const serialized = JSON.stringify(sites);
    if (serialized !== JSON.stringify(cached)) {
      localStorage.setItem(TOPSITES_CACHE_KEY, serialized);
      renderShortcuts(sites);
    }
  });
}

// Animate sibling tiles sliding to their new spots (FLIP).
function flipMove(container, dragged, doMove) {
  const tiles = [...container.querySelectorAll('.shortcut')];
  const first = new Map(tiles.map(t => [t, t.getBoundingClientRect()]));
  doMove();
  for (const t of container.querySelectorAll('.shortcut')) {
    if (t === dragged) continue;
    const f = first.get(t);
    if (!f) continue;
    const l = t.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top - l.top;
    if (!dx && !dy) continue;
    t.style.transition = 'none';
    t.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      t.style.transition = 'transform 180ms ease';
      t.style.transform = '';
    });
  }
}

// Drag-and-drop. Dragging any tile "pins" the whole current arrangement
// (so top sites get a stable, reorderable slot — like Chrome's own pinning).
function initShortcutDnD() {
  const container = document.getElementById('shortcuts');
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('.shortcut.draggable');
    if (!tile) return;
    dragged = tile;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tile.dataset.url || '');

    // Custom floating drag image (a styled clone of the tile).
    const ghost = tile.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${tile.offsetWidth}px`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, tile.offsetWidth / 2, 32);
    setTimeout(() => ghost.remove(), 0);

    // Leave a dashed placeholder gap in the original slot.
    setTimeout(() => tile.classList.add('dragging'), 0);
  });

  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Insert relative to the tile actually under the cursor — stable, no flicker.
    const target = e.target.closest?.('.shortcut.draggable');
    if (!target || target === dragged) return;

    const r = target.getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;

    if (after) {
      if (target.nextSibling !== dragged) {
        flipMove(container, dragged, () =>
          container.insertBefore(dragged, target.nextSibling));
      }
    } else {
      if (target.previousSibling !== dragged) {
        flipMove(container, dragged, () =>
          container.insertBefore(dragged, target));
      }
    }
  });

  container.addEventListener('drop', (e) => e.preventDefault());

  container.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    // Pin everything in its current displayed order.
    const pinned = [...container.querySelectorAll('.shortcut.draggable')]
      .map(el => ({ title: el.dataset.title, url: el.dataset.url }));
    saveCustom(pinned);
    loadShortcuts();
  });
}

// ── Add-shortcut modal ────────────────────────────────────────────────────────
function openShortcutModal() {
  const modal = document.getElementById('shortcut-modal');
  const name  = document.getElementById('sc-name');
  const url   = document.getElementById('sc-url');
  document.getElementById('sc-msg').textContent = '';
  document.getElementById('sc-suggestions').classList.add('hidden');
  name.value = '';
  url.value = '';
  modal.classList.remove('hidden');
  name.focus();
}

function renderModalSuggestions(q) {
  const box = document.getElementById('sc-suggestions');
  q = q.trim().toLowerCase();
  const matches = q
    ? cachedTopSites.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q)
      ).slice(0, 6)
    : [];

  if (!matches.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  box.innerHTML = '';
  matches.forEach(s => {
    const title = s.title || hostOf(s.url);
    const item = document.createElement('li');
    item.className = 'sc-suggestion';
    item.innerHTML =
      `<img src="https://www.google.com/s2/favicons?domain=${hostOf(s.url)}&sz=32" alt="">` +
      '<div><div class="sc-s-title"></div><div class="sc-s-url"></div></div>';
    item.querySelector('.sc-s-title').textContent = title;
    item.querySelector('.sc-s-url').textContent = s.url;
    item.addEventListener('click', () => {
      document.getElementById('sc-name').value = title;
      document.getElementById('sc-url').value = s.url;
      box.classList.add('hidden');
      box.innerHTML = '';
    });
    box.appendChild(item);
  });
  box.classList.remove('hidden');
}

function initShortcutModal() {
  const modal = document.getElementById('shortcut-modal');
  const msg   = document.getElementById('sc-msg');
  const name  = document.getElementById('sc-name');
  const url   = document.getElementById('sc-url');

  const close = () => modal.classList.add('hidden');

  const save = () => {
    const nameVal = name.value.trim();
    let urlVal    = url.value.trim();
    if (!urlVal) { msg.textContent = 'Enter a URL.'; return; }
    if (!/^https?:\/\//i.test(urlVal)) urlVal = 'https://' + urlVal;
    try { new URL(urlVal); } catch { msg.textContent = 'That URL looks invalid.'; return; }

    const custom = getCustom();
    custom.push({ title: nameVal || hostOf(urlVal), url: urlVal });
    saveCustom(custom);
    close();
    loadShortcuts();
  };

  document.getElementById('sc-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.getElementById('sc-save').addEventListener('click', save);

  // Live site suggestions from top sites
  name.addEventListener('input', () => renderModalSuggestions(name.value));

  url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); url.focus(); }
    if (e.key === 'Escape') close();
  });
}

// ── Background ────────────────────────────────────────────────────────────────
const BG_URL_KEY  = 'ntp-bg-url';
const BG_DATA_KEY = 'ntp-bg-data';

function setBgStyle(value) {
  document.documentElement.style.backgroundImage =
    value ? `url(${JSON.stringify(value)})` : '';
}

function loadBackground() {
  const data = localStorage.getItem(BG_DATA_KEY);
  if (data) { setBgStyle(data); return; }
  const url = localStorage.getItem(BG_URL_KEY);
  if (url) setBgStyle(url);
}

// ── Settings ──────────────────────────────────────────────────────────────────
function initSettings() {
  const btn   = document.getElementById('settings-btn');
  const panel = document.getElementById('settings-panel');
  const urlIn = document.getElementById('bg-url');
  const msg   = document.getElementById('settings-msg');

  urlIn.value = localStorage.getItem(BG_URL_KEY) || '';

  const loc = getManualLoc();
  document.getElementById('weather-city-input').value = loc?.label || '';

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    msg.textContent = '';
  });

  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  // Background — apply URL
  document.getElementById('bg-apply-url').addEventListener('click', () => {
    const url = urlIn.value.trim();
    if (!url) { msg.textContent = 'Enter a URL first.'; return; }
    localStorage.setItem(BG_URL_KEY, url);
    localStorage.removeItem(BG_DATA_KEY);
    setBgStyle(url);
    panel.classList.add('hidden');
  });

  // Background — file upload
  document.getElementById('bg-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      msg.textContent = 'File too large (> 8 MB). Use a URL instead.';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        localStorage.setItem(BG_DATA_KEY, ev.target.result);
        localStorage.removeItem(BG_URL_KEY);
        setBgStyle(ev.target.result);
        urlIn.value = '';
        panel.classList.add('hidden');
      } catch {
        msg.textContent = 'Image too large for storage. Use a URL instead.';
      }
    };
    reader.readAsDataURL(file);
  });

  // Background — clear
  document.getElementById('bg-clear').addEventListener('click', () => {
    localStorage.removeItem(BG_URL_KEY);
    localStorage.removeItem(BG_DATA_KEY);
    urlIn.value = '';
    setBgStyle('');
    panel.classList.add('hidden');
  });

  // Weather — set city
  const wMsg = document.getElementById('weather-msg');
  document.getElementById('weather-apply').addEventListener('click', async () => {
    const name = document.getElementById('weather-city-input').value.trim();
    if (!name) { wMsg.textContent = 'Type a city, or use "Use my location".'; return; }
    wMsg.style.color = 'rgba(255,255,255,0.6)';
    wMsg.textContent = 'Looking up…';
    const result = await geocodeCity(name);
    if (!result) {
      wMsg.style.color = '#f28b82';
      wMsg.textContent = 'City not found.';
      return;
    }
    localStorage.setItem(WEATHER_LOC_KEY, JSON.stringify(result));
    localStorage.removeItem(WEATHER_CACHE_KEY);
    loadWeather(true);
    panel.classList.add('hidden');
  });

  // Weather — use my location
  document.getElementById('weather-auto').addEventListener('click', () => {
    localStorage.removeItem(WEATHER_LOC_KEY);
    localStorage.removeItem(WEATHER_CACHE_KEY);
    document.getElementById('weather-city-input').value = '';
    loadWeather(true);
    panel.classList.add('hidden');
  });

  // Shortcuts — restore hidden top sites
  const scMsg = document.getElementById('shortcuts-msg');
  document.getElementById('restore-hidden').addEventListener('click', () => {
    const count = getHidden().length;
    saveHidden([]);
    loadShortcuts();
    scMsg.style.color = 'rgba(255,255,255,0.6)';
    scMsg.textContent = count
      ? `Restored ${count} hidden site${count === 1 ? '' : 's'}.`
      : 'No hidden sites.';
  });
}

// ── Plus menu: add open tabs as shortcuts ──────────────────────────────────────
function populateRecentTabs() {
  const list = document.getElementById('recent-tabs');
  list.innerHTML = '';

  if (!chrome.tabs || !chrome.tabs.query) {
    list.innerHTML = '<li class="menu-empty">Recent tabs unavailable.</li>';
    return;
  }

  chrome.tabs.query({}, (tabs) => {
    const existing = new Set(getCustom().map(s => s.url));
    const items = tabs
      .filter(t => t.url && /^https?:/i.test(t.url) && !existing.has(t.url))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .slice(0, 5);

    if (!items.length) {
      list.innerHTML = '<li class="menu-empty">No recent tabs to add.</li>';
      return;
    }

    items.forEach(t => {
      const title = t.title || hostOf(t.url);
      const li = document.createElement('li');
      li.className = 'recent-tab';
      li.title = title;
      li.innerHTML =
        `<img src="https://www.google.com/s2/favicons?domain=${hostOf(t.url)}&sz=32" alt="">` +
        '<span class="rt-title"></span>' +
        '<svg class="rt-add" viewBox="0 0 24 24" width="20" height="20">' +
        '<path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" opacity="0"/>' +
        '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/></svg>';
      li.querySelector('.rt-title').textContent = title;
      li.addEventListener('click', () => {
        const custom = getCustom();
        custom.push({ title, url: t.url });
        saveCustom(custom);
        document.getElementById('plus-menu').classList.add('hidden');
        loadShortcuts();
      });
      list.appendChild(li);
    });
  });
}

// ── Lens: search by image (in-page dialog) ─────────────────────────────────────
function openLensDialog() {
  const modal = document.getElementById('lens-modal');
  document.getElementById('lens-msg').textContent = '';
  document.getElementById('lens-url').value = '';
  document.getElementById('lens-file').value = '';
  modal.classList.remove('hidden');
}

function lensSearchByUrl(url) {
  window.location.href =
    `https://www.google.com/searchbyimage?sbisrc=tg&image_url=${encodeURIComponent(url)}`;
}

function lensSearchByFile(file) {
  // Submit the image to Google's reverse-image endpoint, which returns the
  // results page (Lens). A real form POST avoids cross-origin restrictions.
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://www.google.com/searchbyimage/upload';
  form.enctype = 'multipart/form-data';
  form.style.display = 'none';

  const fileField = document.createElement('input');
  fileField.type = 'file';
  fileField.name = 'encoded_image';
  const dt = new DataTransfer();
  dt.items.add(file);
  fileField.files = dt.files;

  form.appendChild(fileField);
  document.body.appendChild(form);
  form.submit();
}

function initLensDialog() {
  const modal     = document.getElementById('lens-modal');
  const drop      = document.getElementById('lens-drop');
  const fileInput = document.getElementById('lens-file');
  const urlInput  = document.getElementById('lens-url');
  const msg       = document.getElementById('lens-msg');

  const close = () => modal.classList.add('hidden');
  document.getElementById('lens-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) lensSearchByFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('dragover');
    }));
  ['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
    }));
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) lensSearchByFile(file);
    else msg.textContent = 'Please drop an image file.';
  });

  const doUrl = () => {
    const url = urlInput.value.trim();
    if (!url) { msg.textContent = 'Paste an image link first.'; return; }
    lensSearchByUrl(url);
  };
  document.getElementById('lens-search').addEventListener('click', doUrl);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doUrl(); });
}

// ── Search ────────────────────────────────────────────────────────────────────
function searchUrl(q, aiMode) {
  if (aiMode) return `https://www.google.com/search?udm=50&q=${encodeURIComponent(q)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function navigateForQuery(q, aiMode) {
  q = q.trim();
  if (!q) return;
  if (!aiMode) {
    try {
      const u = new URL(q);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        window.location.href = q;
        return;
      }
    } catch (_) {}
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(q)) {
      window.location.href = `https://${q}`;
      return;
    }
  }
  window.location.href = searchUrl(q, aiMode);
}

function initSearch() {
  const input   = document.getElementById('search-input');
  const form    = document.getElementById('search-form');
  const wrap     = document.getElementById('search-wrap');
  const list    = document.getElementById('suggestions');

  let suggestions = [];
  let active = -1;
  let debounce;

  const DEFAULT_PLACEHOLDER = 'Search Google or type a URL';
  const AI_PLACEHOLDER = 'Ask anything';

  input.focus();

  const isAiMode = () => wrap.classList.contains('ai-active');

  const enterAiMode = () => {
    closeList();
    wrap.classList.add('ai-active');
    input.value = '';
    input.placeholder = AI_PLACEHOLDER;
    input.focus();
  };

  const exitAiMode = () => {
    wrap.classList.remove('ai-active');
    input.placeholder = DEFAULT_PLACEHOLDER;
    input.focus();
  };

  const closeList = () => {
    list.classList.add('hidden');
    wrap.classList.remove('open');
    suggestions = [];
    active = -1;
  };

  const renderList = () => {
    if (!suggestions.length) { closeList(); return; }
    list.innerHTML = '';
    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'suggestion' + (i === active ? ' active' : '');
      li.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20">' +
        '<path d="M20.49 19l-5.73-5.73C15.53 12.2 16 10.91 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.41 0 2.7-.47 3.77-1.24L19 20.49 20.49 19zM5 9.5C5 7.01 7.01 5 9.5 5S14 7.01 14 9.5 11.99 14 9.5 14 5 11.99 5 9.5z"/></svg>' +
        '<span></span>';
      li.querySelector('span').textContent = s;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        navigateForQuery(s, false);
      });
      li.addEventListener('mouseenter', () => { active = i; highlight(); });
      list.appendChild(li);
    });
    list.classList.remove('hidden');
    wrap.classList.add('open');
  };

  const highlight = () => {
    [...list.children].forEach((li, i) =>
      li.classList.toggle('active', i === active));
  };

  async function fetchSuggestions(q) {
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search` +
        `?client=firefox&q=${encodeURIComponent(q)}`
      );
      const data = JSON.parse(await res.text());
      return Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
    } catch (_) {
      return [];
    }
  }

  input.addEventListener('input', () => {
    if (isAiMode()) return; // no Google suggestions while writing an AI prompt
    const q = input.value.trim();
    clearTimeout(debounce);
    if (!q) { closeList(); return; }
    debounce = setTimeout(async () => {
      if (input.value.trim() !== q) return;
      suggestions = await fetchSuggestions(q);
      active = -1;
      renderList();
    }, 120);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isAiMode()) exitAiMode();
      else closeList();
      return;
    }
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(suggestions.length - 1, active + 1);
      highlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(-1, active - 1);
      highlight();
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (isAiMode()) {
      const q = input.value.trim();
      if (!q) return;
      // Brief in-bar loading handoff before redirecting to AI Mode.
      wrap.classList.add('ai-loading');
      input.readOnly = true;
      input.blur();
      setTimeout(() => navigateForQuery(q, true), 700);
      return;
    }
    const q = (active >= 0 ? suggestions[active] : input.value);
    navigateForQuery(q, false);
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closeList();
  });

  // Plus button → toggle the "add tabs / search by image" menu
  const plusMenu = document.getElementById('plus-menu');
  const plusBtn  = document.getElementById('plus-btn');
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = plusMenu.classList.contains('hidden');
    closeList();
    if (willOpen) {
      populateRecentTabs();
      plusMenu.classList.remove('hidden');
    } else {
      plusMenu.classList.add('hidden');
    }
  });
  document.addEventListener('click', (e) => {
    if (!plusMenu.contains(e.target) && !plusBtn.contains(e.target)) {
      plusMenu.classList.add('hidden');
    }
  });
  document.getElementById('menu-upload-image').addEventListener('click', () => {
    plusMenu.classList.add('hidden');
    openLensDialog();
  });

  // AI Mode — transform the bar into a prompt box (don't navigate yet)
  document.getElementById('ai-btn').addEventListener('click', enterAiMode);
  document.getElementById('ai-close').addEventListener('click', exitAiMode);

  // Lens (search by image) → open the in-page dialog
  document.getElementById('lens-btn').addEventListener('click', openLensDialog);

  // Voice search (Web Speech API)
  initVoice(input);
}

function initVoice(input) {
  const micBtn = document.getElementById('mic-btn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.style.display = 'none';
    return;
  }

  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let listening = false;

  micBtn.addEventListener('click', () => {
    if (listening) { rec.stop(); return; }
    try { rec.start(); } catch (_) {}
  });

  rec.addEventListener('start', () => {
    listening = true;
    micBtn.classList.add('listening');
  });

  rec.addEventListener('result', (e) => {
    const transcript = [...e.results].map(r => r[0].transcript).join('');
    input.value = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      navigateForQuery(transcript, false);
    }
  });

  rec.addEventListener('error', () => {
    listening = false;
    micBtn.classList.remove('listening');
  });

  rec.addEventListener('end', () => {
    listening = false;
    micBtn.classList.remove('listening');
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBackground();
loadShortcuts();
initShortcutDnD();
loadWeather(false);
initSettings();
initShortcutModal();
initLensDialog();
initSearch();
