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
  // Find exact match or fall back to nearest lower key
  if (WMO[code]) return WMO[code];
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b);
  const nearest = keys.filter(k => k <= code).pop();
  return WMO[nearest] || ['🌡️', 'Unknown'];
}

// ── Weather ───────────────────────────────────────────────────────────────────
const WEATHER_CACHE_KEY = 'ntp-weather-cache';
const WEATHER_TTL = 30 * 60 * 1000; // 30 min

async function loadWeather() {
  // Try cache first
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    if (cached && Date.now() - cached.ts < WEATHER_TTL) {
      renderWeather(cached);
      return;
    }
  } catch (_) {}

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async ({ coords: { latitude: lat, longitude: lon } }) => {
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
            `&current=temperature_2m,weathercode&timezone=auto`
          ),
          fetch(
            `https://nominatim.openstreetmap.org/reverse` +
            `?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`,
            { headers: { 'User-Agent': 'CleanNewTab/1.0 personal-extension' } }
          )
        ]);

        const w = await wRes.json();
        const g = await gRes.json();

        const data = {
          ts:   Date.now(),
          temp: Math.round(w.current.temperature_2m),
          code: w.current.weathercode,
          city: g.address?.city || g.address?.town || g.address?.village ||
                g.address?.county || g.address?.state || '',
        };

        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
        renderWeather(data);
      } catch (e) {
        console.warn('[NTP] Weather fetch failed:', e);
      }
    },
    (e) => console.warn('[NTP] Geolocation denied:', e)
  );
}

function renderWeather({ temp, code, city }) {
  const [icon, desc] = wmoInfo(code);
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-temp').textContent = `${temp}°C`;
  document.getElementById('weather-desc').textContent = desc;
  document.getElementById('weather-city').textContent = city;
  document.getElementById('weather').style.display = 'flex';
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────
function loadShortcuts() {
  chrome.topSites.get((sites) => {
    const container = document.getElementById('shortcuts');

    sites.slice(0, 8).forEach(site => {
      let hostname;
      try { hostname = new URL(site.url).hostname; }
      catch { hostname = site.url; }

      const a = document.createElement('a');
      a.href = site.url;
      a.className = 'shortcut';
      a.title = site.title;

      // Icon circle
      const iconDiv = document.createElement('div');
      iconDiv.className = 'shortcut-icon';

      const img = document.createElement('img');
      img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
      img.alt = '';
      img.onerror = () => {
        img.remove();
        iconDiv.textContent = (site.title[0] || '?').toUpperCase();
      };
      iconDiv.appendChild(img);

      // Label
      const label = document.createElement('div');
      label.className = 'shortcut-label';
      label.textContent = site.title;

      a.appendChild(iconDiv);
      a.appendChild(label);
      container.appendChild(a);
    });
  });
}

// ── Background ────────────────────────────────────────────────────────────────
const BG_URL_KEY  = 'ntp-bg-url';
const BG_DATA_KEY = 'ntp-bg-data'; // base64 for uploaded files

function setBgStyle(value) {
  if (!value) {
    document.getElementById('bg').style.backgroundImage = '';
    return;
  }
  document.getElementById('bg').style.backgroundImage = `url(${JSON.stringify(value)})`;
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

  // Restore saved URL in input
  urlIn.value = localStorage.getItem(BG_URL_KEY) || '';

  // Toggle panel
  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    msg.textContent = '';
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });

  // Apply URL
  document.getElementById('bg-apply-url').addEventListener('click', () => {
    const url = urlIn.value.trim();
    if (!url) { msg.textContent = 'Enter a URL first.'; return; }
    localStorage.setItem(BG_URL_KEY, url);
    localStorage.removeItem(BG_DATA_KEY);
    setBgStyle(url);
    panel.classList.add('hidden');
  });

  // File upload → base64 stored in localStorage
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

  // Clear
  document.getElementById('bg-clear').addEventListener('click', () => {
    localStorage.removeItem(BG_URL_KEY);
    localStorage.removeItem(BG_DATA_KEY);
    urlIn.value = '';
    setBgStyle('');
    panel.classList.add('hidden');
  });
}

// ── Search ────────────────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const form  = document.getElementById('search-form');

  // Auto-focus
  input.focus();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // If it looks like a URL, navigate directly
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

    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBackground();
loadShortcuts();
loadWeather();
initSettings();
initSearch();
