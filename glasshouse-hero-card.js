/*
 * Glasshouse Hero Card
 * The "state of the house" panel for the Glasshouse suite of Home Assistant cards.
 * Vanilla custom element, shadow DOM, no dependencies, no build step.
 * MIT License (c) Peter Gray
 */
(() => {
  'use strict';

  const CARD_VERSION = '1.3.3';
  const TAG = 'glasshouse-hero-card';
  const HOLD_MS = 500;
  const CLOCK_MS = 30 * 1000;
  const HISTORY_REFRESH_MS = 5 * 60 * 1000;
  const NARROW_MAX = 500;
  const WIDE_MIN = 900;

  if (!window.__GLASSHOUSE_HERO_BANNER__) {
    window.__GLASSHOUSE_HERO_BANNER__ = true;
    console.info(
      `%c GLASSHOUSE-HERO %c v${CARD_VERSION} `,
      'color:#0b0f17;background:#a3a8ff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
      'color:#a3a8ff;background:#1a2030;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0'
    );
  }

  /* ----------------------------------------------------------------- helpers */

  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const domainOf = (id) => String(id).split('.')[0];
  const isUnavailable = (st) => !st || st.state === 'unavailable' || st.state === 'unknown';
  const nameOf = (hass, id, override) => {
    if (override) return override;
    const st = hass && hass.states[id];
    return (st && st.attributes && st.attributes.friendly_name) || id;
  };
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  const humanize = (s) => cap(String(s || '').replace(/_/g, ' '));

  const WEATHER = {
    'clear-night': ['mdi:weather-night', 'Clear', '--gh-cover'],
    cloudy: ['mdi:weather-cloudy', 'Cloudy', '--gh-neutral'],
    exceptional: ['mdi:alert-circle-outline', 'Exceptional', '--gh-warn'],
    fog: ['mdi:weather-fog', 'Fog', '--gh-neutral'],
    hail: ['mdi:weather-hail', 'Hail', '--gh-cool'],
    lightning: ['mdi:weather-lightning', 'Lightning', '--gh-energy'],
    'lightning-rainy': ['mdi:weather-lightning-rainy', 'Thunderstorms', '--gh-energy'],
    partlycloudy: ['mdi:weather-partly-cloudy', 'Partly cloudy', '--gh-light'],
    pouring: ['mdi:weather-pouring', 'Pouring', '--gh-water'],
    rainy: ['mdi:weather-rainy', 'Rainy', '--gh-water'],
    snowy: ['mdi:weather-snowy', 'Snowy', '--gh-text'],
    'snowy-rainy': ['mdi:weather-snowy-rainy', 'Sleet', '--gh-cool'],
    sunny: ['mdi:weather-sunny', 'Sunny', '--gh-light'],
    windy: ['mdi:weather-windy', 'Windy', '--gh-fan'],
    'windy-variant': ['mdi:weather-windy-variant', 'Windy', '--gh-fan'],
  };
  const weatherInfo = (cond) => WEATHER[cond] || ['mdi:weather-cloudy', humanize(cond), '--gh-neutral'];

  const ALARM = {
    disarmed: ['mdi:shield-off-outline', 'Disarmed', 'neutral'],
    armed_home: ['mdi:shield-home', 'Armed home', 'ok'],
    armed_away: ['mdi:shield-lock', 'Armed away', 'ok'],
    armed_night: ['mdi:shield-moon', 'Armed night', 'ok'],
    armed_vacation: ['mdi:shield-airplane', 'Armed vacation', 'ok'],
    armed_custom_bypass: ['mdi:shield-star', 'Armed custom', 'ok'],
    arming: ['mdi:shield-sync', 'Arming', 'warn'],
    pending: ['mdi:shield-sync', 'Pending', 'warn'],
    disarming: ['mdi:shield-sync', 'Disarming', 'warn'],
    triggered: ['mdi:bell-ring', 'Triggered', 'alert'],
  };

  const SEVERITY = {
    alert: { rank: 0, icon: 'mdi:alert-octagon', color: '--gh-alert' },
    warn: { rank: 1, icon: 'mdi:alert', color: '--gh-warn' },
    info: { rank: 2, icon: 'mdi:information-outline', color: '--gh-info' },
  };

  const TONE = { ok: '--gh-ok', warn: '--gh-warn', alert: '--gh-alert', info: '--gh-info', neutral: '--gh-neutral' };

  const STAT_ACCENT = {
    power: '--gh-energy',
    energy: '--gh-energy',
    current: '--gh-energy',
    voltage: '--gh-energy',
    temperature: '--gh-heat',
    humidity: '--gh-water',
    moisture: '--gh-water',
    water: '--gh-water',
    gas: '--gh-heat',
    carbon_dioxide: '--gh-fan',
    pm25: '--gh-fan',
    aqi: '--gh-fan',
    battery: '--gh-switch',
    illuminance: '--gh-light',
  };

  const isOpen = (st) => {
    if (isUnavailable(st)) return false;
    const s = st.state;
    return s === 'on' || s === 'open' || s === 'opening' || s === 'closing' || s === 'unlocked';
  };
  const lockTone = (st) => {
    if (isUnavailable(st)) return 'neutral';
    if (st.state === 'locked') return 'ok';
    if (st.state === 'jammed' || st.state === 'open') return 'alert';
    if (st.state === 'locking' || st.state === 'unlocking' || st.state === 'opening') return 'warn';
    return 'warn'; // unlocked
  };

  /* ------------------------------------------------------------------ styles */

  const STYLE = `
:host {
  --gh-font: var(--glasshouse-font, -apple-system, "SF Pro Text", Inter, Roboto, system-ui, sans-serif);
  --gh-surface: var(--glasshouse-surface, rgba(255,255,255,0.045));
  --gh-surface-2: var(--glasshouse-surface-2, rgba(255,255,255,0.075));
  --gh-border: var(--glasshouse-border, rgba(255,255,255,0.09));
  --gh-blur: var(--glasshouse-blur, 18px);
  --gh-radius: var(--glasshouse-radius, 22px);
  --gh-radius-sm: var(--glasshouse-radius-sm, 14px);
  --gh-pad: var(--glasshouse-pad, 16px);
  --gh-gap: var(--glasshouse-gap, 10px);
  --gh-text: var(--glasshouse-text, #e9eef6);
  --gh-text-2: var(--glasshouse-text-2, #93a0b5);
  --gh-text-3: var(--glasshouse-text-3, #5d697d);
  --gh-ok: var(--glasshouse-ok, #3fb950);
  --gh-warn: var(--glasshouse-warn, #e3b341);
  --gh-alert: var(--glasshouse-alert, #ff5c5c);
  --gh-info: var(--glasshouse-info, #58a6ff);
  --gh-light: var(--glasshouse-light, #ffb547);
  --gh-fan: var(--glasshouse-fan, #4dd6e8);
  --gh-cover: var(--glasshouse-cover, #a3a8ff);
  --gh-switch: var(--glasshouse-switch, #7ee08a);
  --gh-heat: var(--glasshouse-heat, #ff7a59);
  --gh-cool: var(--glasshouse-cool, #58a6ff);
  --gh-media: var(--glasshouse-media, #c48cff);
  --gh-lock: var(--glasshouse-lock, #3fb950);
  --gh-security: var(--glasshouse-security, #ff5c5c);
  --gh-energy: var(--glasshouse-energy, #f6d365);
  --gh-water: var(--glasshouse-water, #4aa8ff);
  --gh-neutral: var(--glasshouse-neutral, #93a0b5);
  --gh-accent: var(--glasshouse-accent, var(--gh-cover));
  display: block;
}
*, *::before, *::after { box-sizing: border-box; }
ha-card {
  display: block;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: var(--gh-surface);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-radius);
  backdrop-filter: blur(var(--gh-blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--gh-blur)) saturate(140%);
  padding: calc(var(--gh-pad) + 6px);
  color: var(--gh-text);
  font-family: var(--gh-font);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  box-shadow: none;
  -webkit-font-smoothing: antialiased;
}
[data-size="narrow"] ha-card, ha-card[data-size="narrow"] { padding: var(--gh-pad); }

/* ---------- aurora */
.aurora {
  position: absolute;
  inset: -45%;
  z-index: 0;
  pointer-events: none;
  --aur-1: var(--gh-cover);
  --aur-2: var(--gh-fan);
  --aur-3: var(--gh-media);
  background:
    radial-gradient(32% 30% at 22% 28%, color-mix(in srgb, var(--aur-1) 20%, transparent), transparent 72%),
    radial-gradient(30% 26% at 78% 22%, color-mix(in srgb, var(--aur-2) 11%, transparent), transparent 72%),
    radial-gradient(38% 34% at 58% 78%, color-mix(in srgb, var(--aur-3) 12%, transparent), transparent 72%);
  filter: blur(36px);
  opacity: .9;
  animation: gh-aurora 32s ease-in-out infinite alternate;
  will-change: transform;
}
ha-card[data-alert="alert"] .aurora { --aur-3: var(--gh-alert); }
ha-card[data-alert="warn"] .aurora { --aur-3: var(--gh-warn); }
@keyframes gh-aurora {
  0%   { transform: translate3d(-5%, -3%, 0) rotate(0deg) scale(1); }
  50%  { transform: translate3d(4%, 3%, 0) rotate(9deg) scale(1.08); }
  100% { transform: translate3d(6%, -4%, 0) rotate(-7deg) scale(1.03); }
}

.wrap { position: relative; z-index: 1; display: grid; gap: 18px; min-width: 0; }

/* ---------- top layout */
.top {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: stretch;
}
.size-medium .top { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
.size-medium .right { grid-column: 1 / -1; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); display: grid; }
.size-medium .right .people { border-bottom: 0; padding-bottom: 0; border-right: 1px solid var(--gh-border); padding-right: 14px; }
.size-narrow .top { grid-template-columns: minmax(0, 1fr); gap: 14px; }
.size-narrow .wrap { gap: 14px; }

.panel {
  background: color-mix(in srgb, var(--gh-surface) 80%, transparent);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-radius-sm);
  padding: 14px;
  min-width: 0;
}

.label {
  font-size: 12px; font-weight: 650; text-transform: uppercase; letter-spacing: .08em;
  color: var(--gh-text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.title { font-size: 18px; font-weight: 650; }
.metric { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; line-height: 1.1; }
.unit { font-size: 13px; font-weight: 600; color: var(--gh-text-2); margin-left: 3px; letter-spacing: 0; }
.hero { font-size: 44px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.08; }
.muted { color: var(--gh-text-2); }
.dim { color: var(--gh-text-3); }
.ellip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

button {
  font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0;
  cursor: pointer; text-align: inherit; -webkit-tap-highlight-color: transparent;
}
button:focus { outline: none; }
button:focus-visible { outline: 2px solid var(--gh-accent); outline-offset: 2px; }
ha-icon, ha-state-icon { --mdc-icon-size: 22px; display: inline-flex; flex: none; }

/* ---------- greeting column */
.left { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 4px 2px 0; }
.greet { margin: 2px 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.timeline { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; min-width: 0; }
.clock { font-size: 19px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--gh-text); }
.summary { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--gh-text-2); min-width: 0; }
.summary span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.summary i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px -1px var(--c); display: inline-block; }

.modes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 8px; }
.modes.grid { display: grid; grid-template-columns: repeat(var(--mc, 3), minmax(0, 1fr)); }
.modes.grid .chip { justify-content: center; min-width: 0; }
.chip {
  --c: var(--gh-accent);
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 44px; max-width: 100%;
  padding: 0 16px 0 12px;
  border-radius: 999px;
  background: var(--gh-surface-2);
  border: 1px solid var(--gh-border);
  color: var(--gh-text);
  font-size: 15px; font-weight: 600;
  transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}
.chip ha-icon, .chip ha-state-icon { --mdc-icon-size: 22px; color: var(--gh-text-2); transition: color 160ms ease; }
.chip .ellip { max-width: 160px; }
.chip.on {
  background: color-mix(in srgb, var(--c) 16%, transparent);
  border-color: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 0 18px -6px var(--c);
}
.chip.on ha-icon, .chip.on ha-state-icon { color: var(--c); }
.chip.flash { animation: gh-flash 1.1s ease-out; }
@keyframes gh-flash {
  0% { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 70%, transparent), 0 0 22px -4px var(--c); }
  100% { box-shadow: inset 0 0 0 1px transparent, 0 0 0 0 transparent; }
}
.unavail { opacity: .45; }
.badge-ua { --mdc-icon-size: 14px; color: var(--gh-warn); }

/* ---------- weather */
.weather-panel { display: flex; }
.weather { display: flex; flex-direction: column; gap: 12px; text-align: left; width: 100%; flex: 1; border-radius: 10px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.wx-main { display: flex; align-items: center; gap: 14px; min-width: 0; }
.wx-icon {
  width: 60px; height: 60px; border-radius: 18px; flex: none;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--c) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent), 0 0 24px -10px var(--c);
  color: var(--c);
}
.wx-icon ha-icon { --mdc-icon-size: 34px; }
.wx-temp { display: flex; align-items: flex-start; }
.wx-temp .deg { font-size: 18px; font-weight: 600; color: var(--gh-text-2); margin-top: 4px; margin-left: 2px; }
.wx-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wx-meta { display: grid; grid-template-columns: repeat(2, auto); gap: 8px 18px; margin-left: auto; align-content: center; color: var(--gh-text); font-size: 16px; }
.size-narrow .wx-meta { gap: 6px 12px; font-size: 14px; }
.wx-meta span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.wx-meta ha-icon { --mdc-icon-size: 15px; color: var(--gh-text-3); }
.hr { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 2px; padding: 6px 0; border-top: 1px solid var(--gh-border); border-bottom: 1px solid var(--gh-border); }
.hr > div { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
.hr .ht { font-size: 13px; font-weight: 600; color: var(--gh-text-2); white-space: nowrap; }
.hr ha-icon { --mdc-icon-size: 22px; color: var(--c); }
.hr .hv { font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; }
.hr .hp { font-size: 13px; font-weight: 600; color: var(--gh-water, #4dabf7); font-variant-numeric: tabular-nums; }
.hr .hp.none { color: var(--gh-text-3); }
.fc { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: auto; }
.size-narrow .fc { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
.fc > div {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 8px 2px; border-radius: 12px; background: var(--gh-surface);
  min-width: 0;
}
.fc > div:first-child { background: var(--gh-surface-2); }
.fc ha-icon { --mdc-icon-size: 24px; color: var(--c); }
.fc .hi { font-weight: 650; font-variant-numeric: tabular-nums; }
.fc .lo { color: var(--gh-text-3); font-variant-numeric: tabular-nums; margin-left: 3px; }
.fc .label { font-size: 12px; }
.fc > div > span:last-child { font-size: 16px; }

/* ---------- people + security */
.right { display: flex; flex-direction: column; justify-content: space-between; gap: 0; min-width: 0; padding: 12px 14px; }
.people { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; padding-bottom: 12px; border-bottom: 1px solid var(--gh-border); align-items: flex-start; }
.person {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  width: 88px; min-height: 44px; padding: 4px 2px; border-radius: 14px;
  transition: background 160ms ease;
}
.person:hover { background: var(--gh-surface); }
.avatar {
  --c: var(--gh-neutral);
  position: relative; width: 54px; height: 54px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--gh-surface-2);
  box-shadow: 0 0 0 2px var(--gh-surface), 0 0 0 4px color-mix(in srgb, var(--c) 70%, transparent);
  font-size: 16px; font-weight: 650; color: var(--gh-text-2);
  transition: box-shadow 160ms ease;
}
.avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.person.away .avatar img { filter: saturate(.35) brightness(.8); }
.person.home .avatar { box-shadow: 0 0 0 2px var(--gh-surface), 0 0 0 4px var(--c), 0 0 18px -4px var(--c); }
.avatar .dot {
  position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--c); border: 3px solid #141922;
}
.person .pname { font-size: 15px; font-weight: 600; max-width: 100%; text-align: center; margin-top: 2px; }
.person .pstate { font-size: 13px; color: var(--gh-text-2); max-width: 100%; text-align: center; margin-top: -4px; }
.person.home .pstate { color: var(--c); }

.sec { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; }
.size-medium .sec { padding-top: 0; padding-left: 14px; }
.row { display: flex; align-items: center; min-width: 0; border-radius: 12px; transition: background 160ms ease; }
.row:hover { background: var(--gh-surface); }
.row-main {
  flex: 1; min-width: 0; min-height: 44px;
  display: grid; grid-template-columns: 32px minmax(0, auto) minmax(0, 1fr); align-items: center; gap: 10px;
  padding: 4px 6px; border-radius: 12px;
}
.row-icon {
  width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  color: var(--c);
}
.row-icon ha-icon { --mdc-icon-size: 18px; }
.row-icon.tone-neutral { background: var(--gh-surface-2); color: var(--gh-text-2); }
.row-name { color: var(--gh-text); font-size: 16px; font-weight: 500; white-space: nowrap; }
.row-val { text-align: right; font-size: 16px; font-weight: 650; color: var(--c, var(--gh-text)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.row-spacer { width: 36px; flex: none; }
.row-more {
  width: 36px; min-height: 44px; display: grid; place-items: center; border-radius: 12px; color: var(--gh-text-3);
}
.row-more ha-icon { --mdc-icon-size: 18px; transition: transform 160ms ease; }
.row-more[aria-expanded="true"] ha-icon { transform: rotate(180deg); }
.row.pulse .row-icon { animation: gh-pulse 2.4s ease-in-out infinite; }
.sublist { display: flex; flex-direction: column; margin: 0 0 4px 48px; padding-left: 10px; border-left: 1px solid var(--gh-border); }
.sub { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 36px; padding: 0 8px; border-radius: 10px; }
.sub:hover { background: var(--gh-surface); }
.sub .v { font-weight: 600; color: var(--c); white-space: nowrap; }

/* ---------- bottom */
.bottom { display: grid; gap: 18px; grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); align-items: start; }
.bottom.no-alerts, .bottom.no-stats { grid-template-columns: minmax(0, 1fr); }
.size-medium .bottom, .size-narrow .bottom { grid-template-columns: minmax(0, 1fr); }
.size-narrow .bottom { gap: 14px; }
.stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: var(--gh-gap); }
.size-narrow .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.stat {
  --c: var(--gh-info);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: 6px;
  min-height: 104px; padding: 12px 14px 44px;
  border-radius: var(--gh-radius-sm);
  background: color-mix(in srgb, var(--gh-surface) 80%, transparent);
  border: 1px solid var(--gh-border);
  text-align: left;
  transition: background 160ms ease;
}
.stat:hover { background: var(--gh-surface-2); }
.stat .shead { display: flex; align-items: center; gap: 7px; position: relative; z-index: 1; min-width: 0; }
.stat .shead ha-icon, .stat .shead ha-state-icon { --mdc-icon-size: 16px; color: var(--c); }
.stat .metric { position: relative; z-index: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stats.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 22px; margin-top: 6px; }
/* in the greeting panel: centre the meters in the space between the time line and the mode chips */
.left .stats.compact { margin: auto 0; }
.left .stats.compact + .modes { margin-top: 0; }
.meter {
  --c: var(--gh-info);
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 4px 8px;
  padding: 2px 0; background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: pointer; min-width: 0;
}
.meter ha-icon, .meter ha-state-icon { --mdc-icon-size: 18px; color: var(--c); }
.meter .ml { font-size: 13px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: var(--gh-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meter .mv { font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--gh-text); }
.meter .mv small { font-size: 12px; font-weight: 600; color: var(--gh-text-3); margin-left: 1px; }
.meter .bar { grid-column: 1 / -1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.09); overflow: hidden; }
.meter .bar i { display: block; height: 100%; width: var(--p, 0%); border-radius: inherit; background: var(--c);
  box-shadow: 0 0 8px -2px var(--c); transition: width 400ms ease; }
.meter.unavail { opacity: .45; }
.spark { position: absolute; left: 0; right: 0; bottom: 0; height: 38px; width: 100%; z-index: 0; pointer-events: none; }
.spark path.line { fill: none; stroke: var(--c); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; opacity: .85; }
.spark path.area { stroke: none; }

.alerts { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.alerts .panel-head .count {
  min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; display: inline-grid; place-items: center;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent);
}
.pills { display: flex; flex-wrap: wrap; gap: 8px; }
.pill {
  --c: var(--gh-alert);
  display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
  min-height: 44px; padding: 0 14px 0 12px; border-radius: 999px;
  background: color-mix(in srgb, var(--c) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 0 18px -6px var(--c);
  font-weight: 600;
}
.pill ha-icon { --mdc-icon-size: 20px; color: var(--c); }
.pill .ellip { max-width: 220px; }
.pill.sev-alert { animation: gh-pulse 2.4s ease-in-out infinite; }
.okchip {
  --c: var(--gh-ok);
  display: inline-flex; align-items: center; gap: 10px; align-self: flex-start;
  min-height: 44px; padding: 0 16px 0 12px; border-radius: 999px;
  background: color-mix(in srgb, var(--c) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 35%, transparent);
  font-weight: 600; color: var(--gh-text);
}
.okchip ha-icon { --mdc-icon-size: 20px; color: var(--c); }
.okchip .dim { font-weight: 500; }

@keyframes gh-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 0 0 0 color-mix(in srgb, var(--c) 0%, transparent); }
  50% { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 80%, transparent), 0 0 0 5px color-mix(in srgb, var(--c) 18%, transparent); }
}

.size-narrow .hero { font-size: 34px; }
.size-narrow .right { padding: 12px; }
.size-narrow .person { width: 68px; }

@media (prefers-reduced-motion: reduce) {
  .aurora, .pill.sev-alert, .row.pulse .row-icon, .chip.flash { animation: none !important; }
  *, *::before, *::after { transition: none !important; }
}
`;

  /* -------------------------------------------------------------------- card */

  class GlasshouseHeroCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = null;
      this._hass = null;
      this._watched = [];
      this._prev = new Map();
      this._size = 'wide';
      this._expanded = { locks: false, openings: false };
      this._history = {};
      this._flash = null;
      this._holdTimer = null;
      this._held = false;
      this._wxForecast = null;
      this._wxUnsub = null;
      this._wxSubscribedFor = null;
      this._built = false;
    }

    /* ---- config */
    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('glasshouse-hero-card: invalid configuration');
      const c = JSON.parse(JSON.stringify(config));
      const need = (cond, msg) => {
        if (!cond) throw new Error(`glasshouse-hero-card: ${msg}`);
      };
      const isId = (v) => typeof v === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(v);

      if (c.weather != null) need(isId(c.weather) && domainOf(c.weather) === 'weather', '`weather` must be a weather.* entity id');

      c.people = (c.people || []).map((p, i) => {
        const o = typeof p === 'string' ? { entity: p } : p;
        need(o && isId(o.entity), `people[${i}] needs an entity id (person.* or device_tracker.*)`);
        return o;
      });

      need(Array.isArray(c.modes || []), '`modes` must be a list');
      c.modes = (c.modes || []).map((m, i) => {
        const o = typeof m === 'string' ? { entity: m } : m;
        need(o && isId(o.entity), `modes[${i}] needs an \`entity\``);
        return o;
      });

      const sec = c.security || {};
      need(typeof sec === 'object', '`security` must be a mapping with alarm / locks / openings');
      if (sec.alarm != null) need(isId(sec.alarm), '`security.alarm` must be an entity id');
      const list = (v, key) => {
        if (v == null) return [];
        const arr = Array.isArray(v) ? v : [v];
        arr.forEach((x) => need(isId(x), `\`security.${key}\` must be a list of entity ids`));
        return arr;
      };
      c.security = { alarm: sec.alarm || null, locks: list(sec.locks, 'locks'), openings: list(sec.openings, 'openings') };

      need(Array.isArray(c.alerts || []), '`alerts` must be a list');
      c.alerts = (c.alerts || []).map((a, i) => {
        const o = typeof a === 'string' ? { entity: a } : a;
        need(o && isId(o.entity), `alerts[${i}] needs an \`entity\``);
        if (o.severity != null) need(SEVERITY[o.severity], `alerts[${i}].severity must be alert, warn or info`);
        if (o.above != null) need(!isNaN(Number(o.above)), `alerts[${i}].above must be a number`);
        if (o.below != null) need(!isNaN(Number(o.below)), `alerts[${i}].below must be a number`);
        return o;
      });

      need(Array.isArray(c.stats || []), '`stats` must be a list');
      c.stats = (c.stats || []).map((s, i) => {
        const o = typeof s === 'string' ? { entity: s } : s;
        need(o && isId(o.entity), `stats[${i}] needs an \`entity\``);
        return o;
      });
      need(c.stats.length <= 6, '`stats` supports at most 6 entries (2–4 look best)');

      this._config = c;
      this._watched = [
        c.weather,
        ...c.people.map((p) => p.entity),
        ...c.modes.map((m) => m.entity),
        c.security.alarm,
        ...c.security.locks,
        ...c.security.openings,
        ...c.alerts.map((a) => a.entity),
        ...c.stats.map((s) => s.entity),
      ].filter(Boolean);
      this._prev = new Map();
      this._history = {};
      this._historyFetched = 0;
      this._built = false;
      if (this._hass) this._render();
    }

    /* ---- hass */
    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._config) return;
      let changed = first || !this._built;
      for (const id of this._watched) {
        const st = hass.states[id];
        if (this._prev.get(id) !== st) {
          changed = true;
          this._prev.set(id, st);
          this._appendHistory(id, st);
        }
      }
      this._ensureForecast();
      this._maybeFetchHistory();
      if (changed) this._render();
    }
    get hass() {
      return this._hass;
    }

    getCardSize() {
      const c = this._config || {};
      return 5 + (c.stats && c.stats.length ? 2 : 0) + (c.alerts && c.alerts.length ? 1 : 0);
    }

    getGridOptions() {
      return { columns: 'full', rows: 'auto' };
    }

    static getStubConfig(hass) {
      const ids = Object.keys((hass && hass.states) || {});
      const first = (d) => ids.find((i) => domainOf(i) === d);
      const all = (d, n) => ids.filter((i) => domainOf(i) === d).slice(0, n);
      const cfg = {};
      const w = first('weather');
      if (w) cfg.weather = w;
      const ppl = all('person', 4);
      if (ppl.length) cfg.people = ppl;
      const modes = all('input_boolean', 3);
      if (modes.length) cfg.modes = modes.map((e) => ({ entity: e }));
      const sec = {};
      const alarm = first('alarm_control_panel');
      if (alarm) sec.alarm = alarm;
      const locks = all('lock', 3);
      if (locks.length) sec.locks = locks;
      if (Object.keys(sec).length) cfg.security = sec;
      const stats = ids
        .filter((i) => domainOf(i) === 'sensor' && hass.states[i].attributes.unit_of_measurement && !isNaN(Number(hass.states[i].state)))
        .slice(0, 3);
      if (stats.length) cfg.stats = stats.map((e) => ({ entity: e }));
      return cfg;
    }

    /* ---- lifecycle */
    connectedCallback() {
      this._tick = setInterval(() => this._updateClock(), CLOCK_MS);
      if (!this._ro && 'ResizeObserver' in window) {
        this._ro = new ResizeObserver((entries) => {
          const w = entries[0] && entries[0].contentRect.width;
          if (w) this._applySize(w);
        });
      }
      if (this._ro) this._ro.observe(this);
      if (this._config && this._hass) {
        this._ensureForecast();
        this._render();
      }
    }

    disconnectedCallback() {
      clearInterval(this._tick);
      this._tick = null;
      if (this._ro) this._ro.disconnect();
      clearTimeout(this._holdTimer);
      this._unsubForecast();
    }

    _applySize(w) {
      const size = w <= NARROW_MAX ? 'narrow' : w < WIDE_MIN ? 'medium' : 'wide';
      if (size !== this._size) {
        this._size = size;
        const wrap = this.shadowRoot.querySelector('.wrap');
        if (wrap) wrap.className = `wrap size-${size}`;
        const card = this.shadowRoot.querySelector('ha-card');
        if (card) card.setAttribute('data-size', size);
      }
    }

    /* ---- time */
    _tz() {
      const h = this._hass;
      if (h && h.locale && h.locale.time_zone === 'server' && h.config && h.config.time_zone) return h.config.time_zone;
      return undefined;
    }
    _lang() {
      const h = this._hass;
      return (h && ((h.locale && h.locale.language) || h.language)) || navigator.language || 'en';
    }
    _hour12() {
      const f = this._hass && this._hass.locale && this._hass.locale.time_format;
      if (f === '12') return true;
      if (f === '24') return false;
      return undefined;
    }
    _timeParts() {
      const now = new Date();
      const lang = this._lang();
      const tz = this._tz();
      let time;
      let date;
      let hour;
      try {
        time = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', hour12: this._hour12(), timeZone: tz }).format(now);
        date = new Intl.DateTimeFormat(lang, { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(now);
        hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(now));
      } catch (e) {
        time = now.toLocaleTimeString();
        date = now.toDateString();
        hour = now.getHours();
      }
      return { time, date, hour };
    }
    _greeting(hour) {
      if (this._config.title) return this._config.title;
      if (hour >= 5 && hour < 12) return 'Good morning';
      if (hour >= 12 && hour < 17) return 'Good afternoon';
      if (hour >= 17 && hour < 22) return 'Good evening';
      return 'Late night';
    }
    _updateClock() {
      if (!this._config || !this.shadowRoot) return;
      const t = this._timeParts();
      const set = (sel, v) => {
        const el = this.shadowRoot.querySelector(sel);
        if (el && el.textContent !== v) el.textContent = v;
      };
      set('.clock', t.time);
      set('.date', t.date);
      set('.greet', this._greeting(t.hour));
    }

    /* ---- weather forecast (modern HA has no forecast attribute) */
    _ensureForecast() {
      const c = this._config;
      const h = this._hass;
      if (!c || !h || !c.weather || !this.isConnected) return;
      const st = h.states[c.weather];
      if (!st || Array.isArray(st.attributes.forecast)) return;
      if (this._wxSubscribedFor === c.weather || !h.connection || !h.connection.subscribeMessage) return;
      const feats = Number(st.attributes.supported_features || 0);
      const type = feats & 1 ? 'daily' : feats & 4 ? 'twice_daily' : null;
      if (!type) return;
      this._wxSubscribedFor = c.weather;
      try {
        const p = h.connection.subscribeMessage(
          (msg) => {
            this._wxForecast = (msg && msg.forecast) || null;
            this._render();
          },
          { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: c.weather }
        );
        Promise.resolve(p)
          .then((unsub) => {
            if (this._wxSubscribedFor === c.weather) this._wxUnsub = unsub;
            else if (typeof unsub === 'function') unsub();
          })
          .catch(() => {
            this._wxSubscribedFor = null;
          });
      } catch (e) {
        this._wxSubscribedFor = null;
      }
      // hourly strip (fills the weather panel with the next few hours)
      if (c.hourly !== false && feats & 2 && !this._wxHourUnsub && !this._wxHourPending) {
        this._wxHourPending = true;
        try {
          Promise.resolve(h.connection.subscribeMessage(
            (msg) => { this._wxHourly = (msg && msg.forecast) || null; this._render(); },
            { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: c.weather }
          )).then((unsub) => { this._wxHourUnsub = unsub; this._wxHourPending = false; })
            .catch(() => { this._wxHourPending = false; });
        } catch (e) { this._wxHourPending = false; }
      }
    }
    _unsubForecast() {
      if (typeof this._wxHourUnsub === 'function') { try { this._wxHourUnsub(); } catch (e) { /* ignore */ } }
      this._wxHourUnsub = null;
      this._wxHourly = null;
      if (typeof this._wxUnsub === 'function') {
        try {
          this._wxUnsub();
        } catch (e) {
          /* ignore */
        }
      }
      this._wxUnsub = null;
      this._wxSubscribedFor = null;
    }

    /* ---- history for sparklines */
    _graphStats() {
      return (this._config.stats || []).filter((s) => s.graph !== false);
    }
    _maybeFetchHistory() {
      const h = this._hass;
      if (!h || !h.callWS || this._historyBusy) return;
      const stats = this._graphStats();
      if (!stats.length) return;
      if (Date.now() - (this._historyFetched || 0) < HISTORY_REFRESH_MS) return;
      this._historyBusy = true;
      this._historyFetched = Date.now();
      const maxH = Math.max(...stats.map((s) => Number(s.hours_to_show) || 24));
      const start = new Date(Date.now() - maxH * 3600 * 1000).toISOString();
      h.callWS({
        type: 'history/history_during_period',
        start_time: start,
        entity_ids: stats.map((s) => s.entity),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })
        .then((res) => {
          for (const s of stats) {
            const rows = (res && res[s.entity]) || [];
            const pts = [];
            for (const r of rows) {
              const v = Number(r.s);
              const t = (r.lu || r.lc || 0) * 1000;
              if (!isNaN(v) && r.s !== '' && t) pts.push([t, v]);
            }
            this._history[s.entity] = pts;
          }
          this._render();
        })
        .catch(() => {})
        .finally(() => {
          this._historyBusy = false;
        });
    }
    _appendHistory(id, st) {
      const pts = this._history[id];
      if (!pts || !st) return;
      const v = Number(st.state);
      if (isNaN(v) || st.state === '') return;
      pts.push([Date.now(), v]);
      if (pts.length > 2000) pts.splice(0, pts.length - 2000);
    }
    _sparkline(id, hours) {
      const pts0 = this._history[id];
      if (!pts0 || pts0.length < 2) return '';
      const end = Date.now();
      const start = end - hours * 3600 * 1000;
      let pts = pts0.filter((p) => p[0] >= start);
      const before = pts0.filter((p) => p[0] < start).pop();
      if (before) pts.unshift([start, before[1]]);
      if (pts.length < 2) return '';
      pts.push([end, pts[pts.length - 1][1]]);
      // bucket to ~60 points (mean per bucket) for a smooth, cheap path
      const N = 60;
      const buckets = new Array(N).fill(null).map(() => [0, 0]);
      let last = pts[0][1];
      for (const [t, v] of pts) {
        const b = Math.min(N - 1, Math.max(0, Math.floor(((t - start) / (end - start)) * N)));
        buckets[b][0] += v;
        buckets[b][1] += 1;
      }
      const vals = buckets.map((b) => {
        if (b[1]) last = b[0] / b[1];
        return last;
      });
      let min = Math.min(...vals);
      let max = Math.max(...vals);
      if (max - min < 1e-9) {
        max += 1;
        min -= 1;
      }
      const W = 100;
      const H = 40;
      const xy = vals.map((v, i) => [(i / (N - 1)) * W, H - 3 - ((v - min) / (max - min)) * (H - 8)]);
      let d = `M${xy[0][0].toFixed(2)},${xy[0][1].toFixed(2)}`;
      for (let i = 1; i < xy.length; i++) {
        const [x0, y0] = xy[i - 1];
        const [x1, y1] = xy[i];
        const cx = (x0 + x1) / 2;
        d += ` C${cx.toFixed(2)},${y0.toFixed(2)} ${cx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
      }
      const gid = `g${Math.random().toString(36).slice(2, 8)}`;
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--c)" stop-opacity=".22"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/>
        </linearGradient></defs>
        <path class="area" d="${d} L${W},${H} L0,${H} Z" fill="url(#${gid})"/>
        <path class="line" d="${d}" vector-effect="non-scaling-stroke"/>
      </svg>`;
    }

    /* ---- formatting */
    _fmtNumber(n, decimals) {
      try {
        return n.toLocaleString(this._lang(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      } catch (e) {
        return n.toFixed(decimals);
      }
    }
    _fmtState(st) {
      const h = this._hass;
      if (h && typeof h.formatEntityState === 'function') {
        try {
          return h.formatEntityState(st);
        } catch (e) {
          /* fall through */
        }
      }
      return humanize(st.state);
    }
    _statValue(cfg, st) {
      if (isUnavailable(st)) return { value: '—', unit: '' };
      const n = Number(st.state);
      if (st.state === '' || isNaN(n)) return { value: this._fmtState(st), unit: '' };
      const reg = this._hass.entities && this._hass.entities[cfg.entity];
      let p = cfg.decimals != null ? Number(cfg.decimals) : reg && reg.display_precision != null ? reg.display_precision : null;
      if (p == null) p = Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : 1;
      return { value: this._fmtNumber(n, p), unit: st.attributes.unit_of_measurement || '' };
    }
    _temp(v) {
      const n = Number(v);
      return isNaN(n) ? '–' : `${Math.round(n)}`;
    }

    /* ---- alerts */
    _alertActive(a, st) {
      if (isUnavailable(st)) return false;
      const s = st.state;
      if (a.state != null) return [].concat(a.state).map(String).includes(s);
      if (a.state_not != null) return ![].concat(a.state_not).map(String).includes(s);
      if (a.above != null || a.below != null) {
        const n = Number(s);
        if (s === '' || isNaN(n)) return false;
        return (a.above == null || n > Number(a.above)) && (a.below == null || n < Number(a.below));
      }
      return s === 'on' || s === 'problem' || s === 'open' || s === 'unlocked' || s === 'triggered';
    }
    _activeAlerts() {
      const h = this._hass;
      return this._config.alerts
        .map((a, i) => ({ a, i, st: h.states[a.entity] }))
        .filter((x) => this._alertActive(x.a, x.st))
        .sort((x, y) => SEVERITY[x.a.severity || 'alert'].rank - SEVERITY[y.a.severity || 'alert'].rank || x.i - y.i);
    }

    /* ---- render pieces */
    _iconHtml(icon, entity, cls = '') {
      if (icon) return `<ha-icon class="${cls}" icon="${esc(icon)}"></ha-icon>`;
      return `<ha-state-icon class="${cls}" data-entity="${esc(entity)}"></ha-state-icon>`;
    }

    _renderLeft(t, alerts) {
      const c = this._config;
      const h = this._hass;
      const summary = [];
      if (c.people.length) {
        const sts = c.people.map((p) => h.states[p.entity]).filter(Boolean);
        const home = sts.filter((s) => s.state === 'home').length;
        const txt =
          home === sts.length && home > 0
            ? sts.length === 1 ? 'Home' : 'Everyone home'
            : home === 0 ? 'Nobody home' : `${home} of ${sts.length} home`;
        summary.push([home > 0 ? '--gh-ok' : '--gh-neutral', txt]);
      }
      const secTone = this._securityTone();
      if (secTone) summary.push([TONE[secTone[0]], secTone[1]]);
      if (c.alerts.length) {
        if (alerts.length) {
          const sev = alerts[0].a.severity || 'alert';
          summary.push([SEVERITY[sev].color, `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`]);
        }
      }
      const modes = c.modes
        .map((m, i) => {
          const st = h.states[m.entity];
          const ua = !st || st.state === 'unavailable';
          const d = domainOf(m.entity);
          const on = !ua && (st.state === 'on' || (d === 'script' && st.state === 'on'));
          const name = nameOf(h, m.entity, m.name);
          const flash = this._flash === i ? ' flash' : '';
          const color = m.color ? ` style="--c:${esc(m.color)}"` : '';
          return `<button class="chip${on ? ' on' : ''}${ua ? ' unavail' : ''}${flash}"${color}
              data-key="mode-${i}" data-act="mode" data-i="${i}"
              aria-label="${esc(name)}${ua ? ' (unavailable)' : ''}" aria-pressed="${on}">
              ${this._iconHtml(m.icon, m.entity)}
              <span class="ellip">${esc(name)}</span>
              ${ua ? '<ha-icon class="badge-ua" icon="mdi:alert-circle-outline"></ha-icon>' : ''}
            </button>`;
        })
        .join('');
      return `<div class="left">
        <div class="label date">${esc(t.date)}</div>
        <div class="hero greet">${esc(this._greeting(t.hour))}</div>
        <div class="timeline">
          <span class="clock">${esc(t.time)}</span>
          ${summary.length ? `<span class="summary">${summary.map(([col, txt]) => `<span><i style="--c:var(${col})"></i>${esc(txt)}</span>`).join('')}</span>` : ''}
        </div>
        ${c.stats_style === 'compact' && c.stats.length ? this._renderMeters() : ''}
        ${modes ? `<div class="modes${Number(c.mode_columns) > 0 ? ' grid' : ''}" role="group" aria-label="Modes"${Number(c.mode_columns) > 0 ? ` style="--mc:${Math.min(6, Math.round(Number(c.mode_columns)))}"` : ''}>${modes}</div>` : ''}
      </div>`;
    }

    _renderHourly(lang, tz) {
      const now = Date.now();
      const hrs = (this._wxHourly || []).filter((f) => f && f.datetime && new Date(f.datetime).getTime() > now - 30 * 60e3).slice(0, 6);
      if (hrs.length < 3) return '';
      const fmt = (d) => {
        try { return new Intl.DateTimeFormat(lang, { hour: 'numeric', timeZone: tz }).format(d).replace(/\s?([AP])M$/i, (m, x) => x.toLowerCase()); } catch (e) { return ''; }
      };
      return `<div class="hr">${hrs.map((f, i) => {
        const [fi, , fcol] = weatherInfo(f.condition);
        const pp = f.precipitation_probability != null ? Math.round(f.precipitation_probability) : null;
        return `<div style="--c:var(${fcol})"><span class="ht">${i === 0 ? 'Now' : esc(fmt(new Date(f.datetime)))}</span><ha-icon icon="${fi}"></ha-icon>
          <span class="hv">${this._temp(f.temperature)}°</span><span class="hp${pp ? '' : ' none'}">${pp ? `${pp}%` : '·'}</span></div>`;
      }).join('')}</div>`;
    }

    _renderWeather() {
      const c = this._config;
      if (!c.weather) return '';
      const h = this._hass;
      const st = h.states[c.weather];
      if (isUnavailable(st)) {
        return `<div class="panel weather-panel unavail"><button class="weather" data-key="wx" data-act="more" data-entity="${esc(c.weather)}" aria-label="Weather unavailable">
          <div class="panel-head"><span class="label">Weather</span></div>
          <div class="wx-main"><div class="wx-icon" style="--c:var(--gh-neutral)"><ha-icon icon="mdi:weather-cloudy-alert"></ha-icon></div>
          <div class="wx-text"><span class="title">Unavailable</span></div></div></button></div>`;
      }
      const a = st.attributes;
      const [icon, label, col] = weatherInfo(st.state);
      const cond = h.formatEntityState ? this._fmtState(st) : label;
      const unit = a.temperature_unit || '';
      const fc = Array.isArray(a.forecast) ? a.forecast : this._wxForecast || [];
      const today = fc[0];
      const hi = today && today.temperature != null ? this._temp(today.temperature) : null;
      const lo = today && today.templow != null ? this._temp(today.templow) : null;
      const meta = [];
      if (a.humidity != null) meta.push(['mdi:water-percent', `${Math.round(a.humidity)}%`]);
      if (a.wind_speed != null) meta.push(['mdi:weather-windy', `${Math.round(a.wind_speed)} ${a.wind_speed_unit || ''}`.trim()]);
      if (today && today.precipitation_probability != null) meta.push(['mdi:umbrella-outline', `${Math.round(today.precipitation_probability)}%`]);
      else if (a.apparent_temperature != null) meta.push(['mdi:thermometer', `Feels ${this._temp(a.apparent_temperature)}°`]);

      const lang = this._lang();
      const tz = this._tz();
      const dayKey = (d) => {
        try {
          return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(d);
        } catch (e) {
          return d.toDateString();
        }
      };
      const todayKey = dayKey(new Date());
      const days = fc
        .filter((f) => f && f.datetime)
        .slice(0, 5)
        .map((f) => {
          const d = new Date(f.datetime);
          let lbl;
          if (dayKey(d) === todayKey) lbl = 'Today';
          else {
            try {
              lbl = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: tz }).format(d);
            } catch (e) {
              lbl = '';
            }
          }
          const [fi, , fcol] = weatherInfo(f.condition);
          return `<div style="--c:var(${fcol})"><span class="label">${esc(lbl)}</span><ha-icon icon="${fi}"></ha-icon>
            <span><span class="hi">${this._temp(f.temperature)}°</span>${f.templow != null ? `<span class="lo">${this._temp(f.templow)}°</span>` : ''}</span></div>`;
        })
        .join('');

      return `<div class="panel weather-panel">
        <button class="weather" data-key="wx" data-act="more" data-entity="${esc(c.weather)}"
          aria-label="Weather: ${esc(cond)}, ${esc(this._temp(a.temperature))} ${esc(unit)}">
          <div class="panel-head"><span class="label">Weather</span><span class="label dim">${esc(a.friendly_name || '')}</span></div>
          <div class="wx-main">
            <div class="wx-icon" style="--c:var(${col})"><ha-icon icon="${icon}"></ha-icon></div>
            <div class="wx-text">
              <div class="wx-temp"><span class="hero">${esc(this._temp(a.temperature))}</span><span class="deg">${esc(unit || '°')}</span></div>
              <span class="title ellip">${esc(cond)}</span>
            </div>
            <div class="wx-meta">
              ${hi != null ? `<span><span class="muted">H</span>&nbsp;<b>${hi}°</b></span>` : ''}
              ${meta.map(([i, v]) => `<span><ha-icon icon="${i}"></ha-icon>${esc(v)}</span>`).join('')}
            </div>
          </div>
          ${this._renderHourly(lang, tz, unit)}
          ${days ? `<div class="fc">${days}</div>` : ''}
        </button>
      </div>`;
    }

    _personState(st) {
      if (isUnavailable(st)) return ['Unknown', '--gh-neutral', 'unk'];
      if (st.state === 'home') return ['Home', '--gh-ok', 'home'];
      if (st.state === 'not_home') return ['Away', '--gh-neutral', 'away'];
      return [humanize(st.state), '--gh-info', 'zone'];
    }

    _renderPeople() {
      const c = this._config;
      if (!c.people.length) return '';
      const h = this._hass;
      return `<div class="people" role="group" aria-label="People">${c.people
        .map((p, i) => {
          const st = h.states[p.entity];
          const name = nameOf(h, p.entity, p.name);
          const short = String(name).split(' ')[0];
          const [stTxt, col, cls] = this._personState(st);
          const pic = st && st.attributes && st.attributes.entity_picture;
          const initials = String(name)
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return `<button class="person ${cls}${isUnavailable(st) ? ' unavail' : ''}" data-key="p-${i}" data-act="more" data-entity="${esc(p.entity)}"
              aria-label="${esc(name)}: ${esc(stTxt)}">
              <span class="avatar" style="--c:var(${col})">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : esc(initials)}<span class="dot"></span></span>
              <span class="pname ellip">${esc(short)}</span>
              <span class="pstate ellip">${esc(stTxt)}</span>
            </button>`;
        })
        .join('')}</div>`;
    }

    _alarmInfo() {
      const id = this._config.security.alarm;
      if (!id) return null;
      const st = this._hass.states[id];
      if (isUnavailable(st)) return { id, icon: 'mdi:shield-alert-outline', text: 'Unavailable', tone: 'neutral', ua: true };
      const m = ALARM[st.state] || ['mdi:shield-outline', humanize(st.state), 'neutral'];
      return { id, icon: m[0], text: this._hass.formatEntityState ? this._fmtState(st) : m[1], tone: m[2], state: st.state };
    }

    _locksInfo() {
      const ids = this._config.security.locks;
      if (!ids.length) return null;
      const h = this._hass;
      const sts = ids.map((id) => ({ id, st: h.states[id], name: nameOf(h, id) }));
      const avail = sts.filter((x) => !isUnavailable(x.st));
      const bad = avail.filter((x) => x.st.state !== 'locked');
      const ua = sts.length - avail.length;
      let text;
      let tone;
      if (!avail.length) {
        text = 'Unavailable';
        tone = 'neutral';
      } else if (!bad.length) {
        text = ids.length === 1 ? 'Locked' : 'All locked';
        tone = 'ok';
      } else {
        const names = bad.map((x) => this._shortName(x.name, ['lock', 'door lock']));
        const jam = bad.some((x) => x.st.state === 'jammed');
        tone = jam ? 'alert' : 'warn';
        text = bad.length === 1 ? `${names[0]} ${jam ? 'jammed' : 'unlocked'}` : `${bad.length} unlocked: ${names.join(', ')}`;
      }
      if (ua && avail.length) text += ` · ${ua} offline`;
      const target = (bad[0] || sts[0]).id;
      return { key: 'locks', icon: bad.length ? 'mdi:lock-open-variant' : 'mdi:lock', name: 'Locks', text, tone, target, list: sts };
    }

    _openingsInfo() {
      const ids = this._config.security.openings;
      if (!ids.length) return null;
      const h = this._hass;
      const sts = ids.map((id) => ({ id, st: h.states[id], name: nameOf(h, id) }));
      const avail = sts.filter((x) => !isUnavailable(x.st));
      const open = avail.filter((x) => isOpen(x.st));
      const ua = sts.length - avail.length;
      const alarm = this._alarmInfo();
      const armed = alarm && alarm.state && alarm.state.startsWith('armed');
      let text;
      let tone;
      if (!avail.length) {
        text = 'Unavailable';
        tone = 'neutral';
      } else if (!open.length) {
        text = 'All closed';
        tone = 'ok';
      } else {
        const names = open.map((x) => this._shortName(x.name, ['contact sensor', 'contact', 'sensor']));
        text = `${open.length} open: ${names.join(', ')}`;
        tone = armed ? 'alert' : 'warn';
      }
      if (ua && avail.length) text += ` · ${ua} offline`;
      const target = (open[0] || sts[0]).id;
      const icon = open.length ? 'mdi:door-open' : 'mdi:door-closed';
      return { key: 'openings', icon, name: 'Openings', text, tone, target, list: sts, pulse: open.length && armed };
    }

    /* Trim noise like "Front Door Lock" -> "Front door" for compact status text. */
    _shortName(name, suffixes) {
      let n = String(name).trim();
      for (const s of suffixes) {
        const re = new RegExp(`\\s+${s}$`, 'i');
        if (re.test(n) && n.replace(re, '').length >= 3) n = n.replace(re, '');
      }
      return n.charAt(0).toUpperCase() + n.slice(1);
    }

    _securityTone() {
      const parts = [this._alarmInfo(), this._locksInfo(), this._openingsInfo()].filter(Boolean);
      if (!parts.length) return null;
      if (parts.some((p) => p.tone === 'alert')) return ['alert', 'Needs attention'];
      if (parts.some((p) => p.tone === 'warn')) {
        const l = this._locksInfo();
        const o = this._openingsInfo();
        if (l && l.tone === 'warn') return ['warn', 'Unlocked'];
        if (o && o.tone === 'warn') return ['warn', 'Something open'];
        return ['warn', 'Check security'];
      }
      if (parts.every((p) => p.tone === 'neutral')) return null;
      return ['ok', 'Secure'];
    }

    _renderSecurity() {
      const rows = [];
      const al = this._alarmInfo();
      if (al) {
        rows.push(`<div class="row${al.tone === 'alert' ? ' pulse' : ''}${al.ua ? ' unavail' : ''}" style="--c:var(${TONE[al.tone]})">
          <button class="row-main" data-key="alarm" data-act="more" data-entity="${esc(al.id)}" aria-label="Alarm: ${esc(al.text)}">
            <span class="row-icon tone-${al.tone}"><ha-icon icon="${al.icon}"></ha-icon></span>
            <span class="row-name">Alarm</span>
            <span class="row-val">${esc(al.text)}</span>
          </button>${this._config.security.locks.length || this._config.security.openings.length ? '<span class="row-spacer"></span>' : ''}</div>`);
      }
      for (const info of [this._locksInfo(), this._openingsInfo()]) {
        if (!info) continue;
        const exp = this._expanded[info.key];
        const sub = exp
          ? `<div class="sublist" id="list-${info.key}">${info.list
              .map((x, j) => {
                const tone = info.key === 'locks' ? lockTone(x.st) : isUnavailable(x.st) ? 'neutral' : isOpen(x.st) ? 'warn' : 'ok';
                const v = isUnavailable(x.st) ? 'Unavailable' : this._fmtState(x.st);
                return `<button class="sub" data-key="${info.key}-s${j}" data-act="more" data-entity="${esc(x.id)}" style="--c:var(${TONE[tone]})" aria-label="${esc(x.name)}: ${esc(v)}">
                  <span class="ellip">${esc(x.name)}</span><span class="v">${esc(v)}</span></button>`;
              })
              .join('')}</div>`
          : '';
        rows.push(`<div class="row${info.pulse || info.tone === 'alert' ? ' pulse' : ''}${info.tone === 'neutral' && info.text === 'Unavailable' ? ' unavail' : ''}" style="--c:var(${TONE[info.tone]})">
          <button class="row-main" data-key="${info.key}" data-act="${info.key}" aria-label="${esc(info.name)}: ${esc(info.text)}">
            <span class="row-icon tone-${info.tone}"><ha-icon icon="${info.icon}"></ha-icon></span>
            <span class="row-name">${info.name}</span>
            <span class="row-val">${esc(info.text)}</span>
          </button>
          <button class="row-more" data-key="${info.key}-x" data-act="expand" data-group="${info.key}" aria-expanded="${exp}"
            aria-controls="list-${info.key}" aria-label="Show all ${info.name.toLowerCase()}"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
        </div>${sub}`);
      }
      if (!rows.length) return '';
      return `<div class="sec" role="group" aria-label="Security">${rows.join('')}</div>`;
    }

    _renderStats() {
      const c = this._config;
      if (!c.stats.length) return '';
      const h = this._hass;
      if (c.stats_style === 'compact') return ''; // drawn in the left panel as a 2×2 block
      return `<div class="stats" style="--n:${c.stats.length}">${c.stats
        .map((s, i) => {
          const st = h.states[s.entity];
          const ua = isUnavailable(st);
          const name = nameOf(h, s.entity, s.name);
          const dc = st && st.attributes && st.attributes.device_class;
          const color = s.color ? esc(s.color) : `var(${STAT_ACCENT[dc] || '--gh-info'})`;
          const { value, unit } = st ? this._statValue(s, st) : { value: '—', unit: '' };
          const spark = !ua && s.graph !== false ? this._sparkline(s.entity, Number(s.hours_to_show) || 24) : '';
          return `<button class="stat${ua ? ' unavail' : ''}" style="--c:${color}" data-key="s-${i}" data-act="more" data-entity="${esc(s.entity)}"
              aria-label="${esc(name)}: ${esc(value)} ${esc(unit)}">
              ${spark}
              <span class="shead">${this._iconHtml(s.icon, s.entity)}<span class="label">${esc(name)}</span></span>
              <span class="metric">${esc(value)}${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</span>
            </button>`;
        })
        .join('')}</div>`;
    }

    /** stats_style: compact — one slim row of labelled meters (bar = value / max, default max 100). */
    _renderMeters() {
      const CSS_NAMED = new Set(['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'white', 'black', 'gray', 'grey', 'teal', 'cyan', 'magenta', 'pink', 'gold', 'transparent', 'currentcolor']);
      const c = this._config;
      const h = this._hass;
      return `<div class="stats compact" style="--n:${c.stats.length}">${c.stats
        .map((s, i) => {
          const st = h.states[s.entity];
          const ua = isUnavailable(st);
          const name = nameOf(h, s.entity, s.name);
          const n = st ? Number(st.state) : NaN;
          const max = Number(s.max) > 0 ? Number(s.max) : 100;
          const pct = !ua && Number.isFinite(n) ? Math.max(0, Math.min(100, (n / max) * 100)) : 0;
          // accent names (ok, warn, alert, info…) map to theme tokens; anything else is used as a CSS colour
          const tok = (v) => (/^[a-z][a-z0-9-]*$/i.test(String(v)) && !CSS_NAMED.has(String(v).toLowerCase()) ? `var(--gh-${v})` : String(v));
          let color = s.color ? esc(tok(s.color)) : 'var(--gh-ok)';
          for (const t of [].concat(s.thresholds || [])) {
            if (t && t.above != null && t.color && n > Number(t.above)) color = esc(tok(t.color));
          }
          const { value, unit } = st ? this._statValue(s, st) : { value: '—', unit: '' };
          return `<button class="meter${ua ? ' unavail' : ''}" style="--c:${color};--p:${pct.toFixed(1)}%" data-key="s-${i}" data-act="more" data-entity="${esc(s.entity)}"
              aria-label="${esc(name)}: ${esc(value)} ${esc(unit)}">
              ${this._iconHtml(s.icon, s.entity)}<span class="ml">${esc(name)}</span>
              <span class="mv">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</span>
              <span class="bar"><i></i></span>
            </button>`;
        })
        .join('')}</div>`;
    }

    _renderAlerts(alerts) {
      const c = this._config;
      if (!c.alerts.length) return '';
      const h = this._hass;
      const top = alerts.length ? SEVERITY[alerts[0].a.severity || 'alert'].color : '--gh-ok';
      const body = alerts.length
        ? `<div class="pills">${alerts
            .map(({ a, i, st }) => {
              const sev = a.severity || 'alert';
              const name = nameOf(h, a.entity, a.name);
              return `<button class="pill sev-${sev}" style="--c:var(${SEVERITY[sev].color})" data-key="a-${i}" data-act="more" data-entity="${esc(a.entity)}"
                aria-label="${esc(sev)}: ${esc(name)}">
                <ha-icon icon="${esc(a.icon || SEVERITY[sev].icon)}"></ha-icon><span class="ellip">${esc(name)}</span></button>`;
            })
            .join('')}</div>`
        : `<div class="okchip" role="status"><ha-icon icon="mdi:check-circle"></ha-icon>All good<span class="dim">${c.alerts.length} check${c.alerts.length === 1 ? '' : 's'} clear</span></div>`;
      return `<div class="panel alerts" aria-live="polite">
        <div class="panel-head"><span class="label">Alerts</span><span class="count" style="--c:var(${top})">${alerts.length}</span></div>
        ${body}
      </div>`;
    }

    /* ---- main render */
    _render() {
      if (!this._config || !this._hass) return;
      const root = this.shadowRoot;
      if (!this._built) {
        root.innerHTML = `<style>${STYLE}</style><ha-card><div class="aurora"></div><div class="wrap size-${this._size}"></div></ha-card>`;
        const card = root.querySelector('ha-card');
        card.setAttribute('data-size', this._size);
        this._bindEvents(card);
        this._built = true;
        const w = this.getBoundingClientRect().width;
        if (w) this._applySize(w);
      }
      const card = root.querySelector('ha-card');
      const wrap = root.querySelector('.wrap');
      const focusKey = root.activeElement && root.activeElement.dataset ? root.activeElement.dataset.key : null;

      const t = this._timeParts();
      const alerts = this._activeAlerts();
      const sev = alerts.length ? alerts[0].a.severity || 'alert' : '';
      card.setAttribute('data-alert', sev === 'info' ? '' : sev);

      const weather = this._renderWeather();
      const people = this._renderPeople();
      const security = this._renderSecurity();
      const right = people || security ? `<div class="panel right">${people}${security}</div>` : '';
      const stats = this._renderStats();
      const alertsHtml = this._renderAlerts(alerts);
      const bottomCls = `bottom${alertsHtml ? '' : ' no-alerts'}${stats ? '' : ' no-stats'}`;

      wrap.innerHTML = `
        <div class="top">${this._renderLeft(t, alerts)}${weather}${right}</div>
        ${stats || alertsHtml ? `<div class="${bottomCls}">${stats}${alertsHtml}</div>` : ''}`;

      // .top column count adapts to which blocks exist
      const top = wrap.querySelector('.top');
      const blocks = 1 + (weather ? 1 : 0) + (right ? 1 : 0);
      if (blocks < 3) top.style.gridTemplateColumns = this._size === 'narrow' ? '' : blocks === 2 ? 'minmax(0,1.2fr) minmax(0,1fr)' : 'minmax(0,1fr)';

      root.querySelectorAll('ha-state-icon[data-entity]').forEach((el) => {
        el.hass = this._hass;
        el.stateObj = this._hass.states[el.dataset.entity];
      });
      if (focusKey) {
        const el = root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
        if (el) el.focus({ preventScroll: true });
      }
    }

    /* ---- interaction */
    _bindEvents(card) {
      const target = (e) => e.composedPath().find((n) => n && n.dataset && n.dataset.act);
      card.addEventListener('pointerdown', (e) => {
        const el = target(e);
        if (!el || (e.button != null && e.button !== 0)) return;
        this._held = false;
        clearTimeout(this._holdTimer);
        this._holdTimer = setTimeout(() => {
          this._held = true;
          this._hold(el);
        }, HOLD_MS);
      });
      const cancel = () => clearTimeout(this._holdTimer);
      card.addEventListener('pointerup', cancel);
      card.addEventListener('pointercancel', cancel);
      card.addEventListener('pointerleave', cancel);
      card.addEventListener('contextmenu', (e) => {
        if (target(e)) e.preventDefault();
      });
      card.addEventListener('click', (e) => {
        const el = target(e);
        if (!el) return;
        if (this._held) {
          this._held = false;
          e.preventDefault();
          return;
        }
        this._tap(el);
      });
    }

    _moreInfo(entityId) {
      if (!entityId) return;
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
    _haptic() {
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'light', bubbles: true, composed: true }));
    }

    _tap(el) {
      const act = el.dataset.act;
      if (act === 'more') return this._moreInfo(el.dataset.entity);
      if (act === 'expand') {
        const g = el.dataset.group;
        this._expanded[g] = !this._expanded[g];
        return this._render();
      }
      if (act === 'locks') return this._moreInfo(this._locksInfo().target);
      if (act === 'openings') return this._moreInfo(this._openingsInfo().target);
      if (act === 'mode') return this._toggleMode(Number(el.dataset.i));
    }

    _hold(el) {
      const act = el.dataset.act;
      if (act === 'locks' || act === 'openings') {
        this._expanded[act] = !this._expanded[act];
        this._haptic();
        return this._render();
      }
      if (act === 'mode') return this._moreInfo(this._config.modes[Number(el.dataset.i)].entity);
      if (act === 'more') return this._moreInfo(el.dataset.entity);
    }

    _toggleMode(i) {
      const m = this._config.modes[i];
      if (!m) return;
      const st = this._hass.states[m.entity];
      if (!st || st.state === 'unavailable') return;
      const d = domainOf(m.entity);
      const data = { entity_id: m.entity };
      this._haptic();
      if (d === 'script') this._hass.callService('script', 'turn_on', data);
      else if (d === 'scene') this._hass.callService('scene', 'turn_on', data);
      else if (d === 'button') this._hass.callService('button', 'press', data);
      else if (d === 'input_button') this._hass.callService('input_button', 'press', data);
      else this._hass.callService('homeassistant', 'toggle', data);
      if (d === 'scene' || d === 'button' || d === 'input_button' || d === 'script') {
        this._flash = i;
        this._render();
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(() => {
          this._flash = null;
        }, 1200);
      }
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, GlasshouseHeroCard);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({
      type: TAG,
      name: 'Glasshouse Hero Card',
      description: 'State of the house at a glance: greeting, clock, modes, weather, people, security, alerts and key stats.',
      preview: true,
    });
  }
})();
