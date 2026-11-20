/* Run: node tests/simulation.test.cjs (or add --quick to skip the six-hour soak)
 * Real simulation code with mocked DOM, sprites, and RAF: verifies behavior and
 * bounded state, not actual device frame rate, GPU memory, or audible output.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const soakHours = process.argv.includes('--quick') ? 0 : 6;

function aquarium(settings = {}) {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const context = new Proxy({
    globalAlpha: 1,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }, { get(object, key) { return key in object ? object[key] : noop; } });
  const elements = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, style: {}, value: '', hidden: false,
      classList: { add: noop, remove: noop },
      events: new Map(),
      addEventListener(type, callback) { this.events.set(type, callback); },
      focus() { document.activeElement = this; },
      getContext: () => context,
      setPointerCapture: noop,
      querySelectorAll: () => [],
      dispatch(type, event = {}) { this.events.get(type)?.(event); },
    });
    return elements.get(id);
  }
  const document = {
    hidden: false, activeElement: null, documentElement: {},
    getElementById: element, createElement: () => element(Symbol()),
    querySelector: element,
    addEventListener(type, callback) { documentEvents.set(type, callback); },
  };
  const callbacks = new Map();
  const timers = new Map();
  let nextRAF = 0;
  let nextTimer = 0;
  let randomSeed = 123456;
  const seededMath = Object.create(Math);
  seededMath.random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };
  const window = {
    innerWidth: 1340, innerHeight: 800, devicePixelRatio: 1,
    document, location: { search: '?debug' }, navigator: {},
    PointerEvent: function () {}, isSecureContext: false,
    localStorage: { getItem: () => JSON.stringify(settings), setItem: noop },
    console, Math: seededMath, Map, Set, URLSearchParams, Number, Array, Object, Promise,
    performance: { now: () => 0 },
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { callbacks.set(++nextRAF, callback); return nextRAF; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
    addEventListener(type, callback) { windowEvents.set(type, callback); },
  };
  window.window = window;
  vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(root, 'fish-art.js'), 'utf8'), window);
  // Retain actual species metadata; raster artwork is covered by browser QA.
  window.FishArt.create = (species, seed) => ({ species, seed });
  window.FishArt.draw = noop;
  vm.runInContext(fs.readFileSync(path.join(root, 'aquarium.js'), 'utf8'), window);
  return {
    window, debug: window.fishbowlDebug, elements, documentEvents, windowEvents,
    document, timers, callbacks,
    frame(time) {
      const current = [...callbacks]; callbacks.clear();
      for (const [, callback] of current) callback(time);
    },
    flushTimers() {
      const current = [...timers]; timers.clear();
      for (const [, callback] of current) callback();
    },
    change(name, value) {
      elements.get(name).value = value;
      elements.get(name).dispatch('input');
    },
  };
}

for (const [quality, expected] of [['eco', 24], ['auto', 30], ['high', 60]]) {
  for (const refreshHz of [60, 90, 120]) {
    const app = aquarium({ quality });
    for (let frame = 1; frame <= refreshHz * 12; frame++) app.frame(frame * 1000 / refreshHz);
    const state = app.debug.snapshot();
    assert(Math.abs(state.fps - expected) <= 1, `${quality}/${refreshHz}Hz: ${state.fps} fps`);
    assert(Math.abs(state.elapsed - 12) < .12, 'simulation should follow elapsed real time');
    assert.equal(app.callbacks.size, 1, 'only one animation loop');
    console.log(`${quality}, ${refreshHz} Hz: ${state.fps} fps`);
  }
}

// Diagnostic distribution, deliberately not a brittle visual-layout assertion.
const roaming = aquarium();
const horizontalBins = [0, 0, 0, 0, 0];
const verticalBins = [0, 0, 0, 0];
for (let sample = 0; sample < 150; sample++) {
  roaming.debug.advance(2);
  for (const fish of roaming.debug.snapshot().fish) {
    if (fish.x < 0 || fish.x >= 1340 || fish.y < 0 || fish.y >= 800) continue;
    horizontalBins[Math.floor(fish.x / 1340 * 5)]++;
    verticalBins[Math.floor(fish.y / 800 * 4)]++;
  }
}
console.log('Five-minute occupancy (left to right / top to bottom):', horizontalBins, verticalBins);

const app = aquarium({ population: 24 });
app.debug.advance(1);
let state = app.debug.snapshot();
assert.equal(state.fish.length, 24);

for (let pointer = 0; pointer < 20; pointer++) app.debug.touch(100 + pointer, 5, 5);
assert.equal(app.debug.snapshot().pointers, 10, 'simultaneous touches stay bounded');
app.debug.advance(21);
assert.equal(app.debug.snapshot().pointers, 0, 'stale contacts expire');
assert.equal(new Set(state.fish.map(fish => fish.species)).size, 8);
const initialDepths = new Map(state.fish.map(fish => [fish.id, fish.depth]));
app.debug.advance(10);
assert(app.debug.snapshot().fish.some(fish => Math.abs(fish.depth - initialDepths.get(fish.id)) > .05), 'fish change depth');

for (let touch = 0; touch < 100; touch++) {
  const fish = app.debug.snapshot().fish.find(fish => !fish.escaping);
  if (fish) {
    app.debug.touch(touch % 10, fish.x, fish.y);
    app.debug.move(touch % 10, fish.x + 5, fish.y + 3);
    app.debug.release(touch % 10);
  }
  app.debug.advance(.1);
  assert(app.debug.snapshot().bubbles <= 64);
  assert(app.debug.snapshot().ripples <= 20);
}
assert(app.debug.snapshot().catches > 0);
app.debug.advance(30);
state = app.debug.snapshot();
assert.equal(state.pointers, 0);
assert.equal(state.ripples, 0);
assert.equal(state.bubbles, 18, 'ambient bubble stream survives interaction bursts');
assert.equal(state.fish.length, 24);

for (let feed = 0; feed < 100; feed++) app.elements.get('feed').dispatch('click');
assert.equal(app.debug.snapshot().food, 40);
app.debug.advance(30);
assert.equal(app.debug.snapshot().food, 0);
for (const population of [6, 24, 10, 14]) {
  app.change('population', population);
  assert.equal(app.debug.snapshot().fish.length, population);
}
app.change('population', 24);

// Six simulated hours at the maximum population, using the real 50 ms update.
let priorGeneration = app.debug.snapshot().generations;
for (let hour = 1; hour <= soakHours; hour++) {
  app.debug.advance(3600);
  state = app.debug.snapshot();
  assert.equal(state.fish.length, 24);
  assert(state.generations > priorGeneration, 'fish continuously replenish');
  priorGeneration = state.generations;
  for (const fish of state.fish) {
    assert(Number.isFinite(fish.x) && Number.isFinite(fish.y));
    assert(Number.isFinite(fish.length) && fish.length > 0);
    assert(Number.isFinite(fish.depth) && fish.depth >= 0 && fish.depth <= 1);
    assert(fish.x > -fish.length * 3 && fish.x < 1340 + fish.length * 3);
  }
  assert.equal(state.bubbles, 18);
  assert.equal(state.ripples, 0);
  assert.equal(state.food, 0);
  assert.equal(state.pointers, 0);
  console.log(`Simulated hour ${hour}: ${state.fish.length} fish, ${state.generations} generations; state bounded.`);
}

const preResize = new Map(app.debug.snapshot().fish.map(fish => [fish.id, fish]));
app.window.innerWidth = 800; app.window.innerHeight = 1340;
app.windowEvents.get('resize')(); app.flushTimers();
assert.equal(app.elements.get('water').width, 800);
for (const fish of app.debug.snapshot().fish) {
  const prior = preResize.get(fish.id);
  assert(Math.abs(fish.length / prior.length - .7) < 1e-9, 'fish resize with viewport orientation');
  assert(Math.abs(fish.x - prior.x * 800 / 1340) < 1e-7);
  assert(Math.abs(fish.y - prior.y * 1340 / 800) < 1e-7);
}
app.debug.advance(60);
for (const fish of app.debug.snapshot().fish) assert(Number.isFinite(fish.x) && Number.isFinite(fish.y));
app.frame(1000);
app.document.hidden = true; app.documentEvents.get('visibilitychange')();
assert.equal(app.callbacks.size, 0);
app.document.hidden = false; app.documentEvents.get('visibilitychange')();
assert.equal(app.callbacks.size, 1);
const beforeResume = app.debug.snapshot().elapsed;
app.frame(600000); app.frame(600034);
assert(app.debug.snapshot().elapsed - beforeResume < .1, 'background time should not teleport fish');
assert.equal(app.callbacks.size, 1);
console.log(`PASS: scheduler, touch/replenishment, effect caps, depth, ${soakHours}-hour soak, settings, resize, visibility.`);
