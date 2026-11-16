/* Hero card: lock / garage door status toggles. node test/toggle.test.cjs (needs jsdom on NODE_PATH). Synthetic data only. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname, '..', 'glasshouse-hero-card.js'), 'utf8'));

const t0 = new Date(Date.now() - 3600e3).toISOString();
const S = (state, name) => ({ state, attributes: { friendly_name: name }, last_changed: t0, last_updated: t0 });
const states = {
  'lock.front': S('locked', 'Front lock'), 'lock.side': S('unlocked', 'Side lock'),
  'cover.garage': S('closed', 'Garage'), 'binary_sensor.door': S('off', 'Door'),
};
const calls = [];
const mk = () => ({ states, callService: (d, s, data) => { calls.push(`${d}.${s} ${data.entity_id}`); return Promise.resolve(); },
  formatEntityState: (st) => st.state.charAt(0).toUpperCase() + st.state.slice(1), locale: { language: 'en' }, config: {}, user: { name: 'Test' } });
const el = w.document.createElement('glasshouse-hero-card');
el.setConfig({ security: { locks: ['lock.front', 'lock.side'], openings: ['binary_sensor.door', 'cover.garage'] } });
w.document.body.append(el);
el.hass = mk();
const root = el.shadowRoot;
const $$ = (q) => [...root.querySelectorAll(q)];
const tap = (b) => b.dispatchEvent(new w.MouseEvent('click', { bubbles: true, composed: true }));
const press = (b) => tap(b);

el._expanded.locks = true; el._expanded.openings = true; el._render();
const tg = () => $$('.sub .v.tg');
eq(tg().map((b) => b.textContent.trim()), ['Locked', 'Unlocked', 'Closed'], 'locks and the garage door get toggles, the contact sensor does not');
eq($$('.sub').length, 4, 'all four still listed');

press(tg()[1]);
eq(calls, ['lock.lock lock.side'], 'locking is one tap');
eq(tg()[1].textContent.trim(), 'Locking…', 'feedback while waiting');
ok(tg()[1].disabled, 'no double taps while waiting');
states['lock.side'] = S('locked', 'Side lock'); el.hass = mk(); el._render();
eq(tg()[1].textContent.trim(), 'Locked', 'device answered');

press(tg()[0]);
eq(calls.length, 1, 'unlock waits for a second tap');
eq(tg()[0].textContent.trim(), 'Tap to unlock', 'confirm prompt');
press(tg()[0]);
eq(calls[1], 'lock.unlock lock.front', 'second tap unlocks');

press(tg()[2]);
eq(tg()[2].textContent.trim(), 'Tap to open', 'garage asks first');
press(tg()[2]);
eq(calls[2], 'cover.open_cover cover.garage', 'garage opens');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
