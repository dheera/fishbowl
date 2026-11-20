/* Fishbowl: bounded simulation, cached artwork, no network activity after load. */
(function () {
  'use strict';
  var canvas = document.getElementById('water');
  var ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx || !window.FishArt) {
    document.getElementById('welcome').innerHTML = '<p>The aquarium could not start. Enable JavaScript and use an up-to-date Android System WebView.</p>';
    return;
  }
  var TAU = Math.PI * 2;
  var defaults = { population: 14, activity: 100, light: 'day', brightness: 100, quality: 'auto', volume: 35 };
  var settings = Object.assign({}, defaults);
  try {
    var saved = JSON.parse(localStorage.getItem('fishbowl.settings.v1') || '{}');
    ['population', 'activity', 'brightness', 'volume'].forEach(function (key) {
      var limits = { population: [6, 24], activity: [50, 150], brightness: [35, 100], volume: [0, 100] }[key];
      if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) settings[key] = Math.round(Math.max(limits[0], Math.min(limits[1], saved[key])));
    });
    if (['day', 'dusk', 'night'].indexOf(saved.light) !== -1) settings.light = saved.light;
    if (['auto', 'eco', 'high'].indexOf(saved.quality) !== -1) settings.quality = saved.quality;
  } catch (_) { /* Private browsing and file URLs can deny storage. */ }

  var width = innerWidth, height = innerHeight, scale = 1, renderScale = 1;
  var fish = [], pointers = new Map(), ripples = [], bubbles = [], motes = [], food = [];
  var elapsed = 0, generation = 0, catches = 0, nextFrame = 0, lastUpdate = 0, raf = 0, depthSortIn = 0;
  var targetFPS = 30, sampleTime = 0, sampleFrames = 0, slowSamples = 0, actualFPS = 30;
  var panel = document.getElementById('controls');
  var trigger = document.getElementById('settings-trigger');
  var panelOpen = false, holdTimer = 0, toastTimer = 0, wakeLock = null, wakePending = false;
  var lastCatchSound = -1, lastPointerRipple = -1;
  var welcome = document.getElementById('welcome');
  var sound = window.AquariumAudio || { unlock: function () {}, play: function () {}, setVolume: function () {}, suspend: function () {} };
  sound.setVolume(settings.volume / 100);
  function random(a, b) { return a + Math.random() * (b - a); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function perspective(z) { return 1 / (.45 + z * 1.1); }
  function displayHeading(f) {
    // Fish turn through the water in depth, instead of rotating flat on the glass.
    var pitch = clamp(Math.atan2(f.vy, Math.abs(f.vx)), -.42, .42) * Math.abs(Math.cos(f.heading));
    return f.vx < 0 ? Math.PI - pitch : pitch;
  }
  function save() { try { localStorage.setItem('fishbowl.settings.v1', JSON.stringify(settings)); } catch (_) {} }
  function toast(message) {
    var el = document.getElementById('toast');
    el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('visible'); }, 3500);
  }
  function dismissWelcome() { welcome.classList.add('dismissed'); }
  setTimeout(dismissWelcome, 11500);

  function resize() {
    var oldW = width, oldH = height;
    width = Math.max(1, innerWidth); height = Math.max(1, innerHeight);
    var maxPixels = settings.quality === 'high' ? 2300000 : 1350000;
    var ratio = settings.quality === 'high' ? Math.min(devicePixelRatio || 1, 1.5) : 1;
    if (settings.quality === 'eco') ratio = .75;
    scale = Math.min(ratio * renderScale, Math.sqrt(maxPixels / (width * height)));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    fish.forEach(function (f) {
      f.x *= width / oldW; f.y *= height / oldH;
      var nextFit = clamp(Math.min(width / 1100, height / 700), .8, 1.15);
      f.baseLength *= nextFit / f.sizeFit; f.baseSpeed *= nextFit / f.sizeFit;
      f.sizeFit = nextFit; f.length = f.baseLength * f.depth;
    });
    pointers.forEach(function (p) { release(p); }); pointers.clear();
    targetFPS = settings.quality === 'high' ? 60 : settings.quality === 'eco' ? 24 : (renderScale < .75 ? 24 : 30);
  }
  function speciesFor(index) {
    // Small schools mixed with solitary fish; every initial tank includes all eight species.
    var mix = [0, 0, 0, 6, 6, 4, 4, 7, 7, 1, 2, 3, 5, 3, 0, 6, 4, 5, 7, 2, 3, 0, 1, 6];
    if (index < 0) return mix[Math.floor(Math.random() * mix.length)];
    if (settings.population <= 10) return [0, 6, 1, 2, 3, 5, 4, 7, 0, 6][index];
    return mix[index % mix.length];
  }
  function createFish(index, initial) {
    var speciesIndex = speciesFor(index), spec = FishArt.species[speciesIndex];
    var z = Math.random(), depth = perspective(z), sizeFit = clamp(Math.min(width / 1100, height / 700), .8, 1.15);
    var baseLength = spec.size * random(.88, 1.17) * sizeFit, length = baseLength * depth;
    var fromLeft = Math.random() < .5;
    var f = {
      id: ++generation, speciesIndex: speciesIndex, sprite: FishArt.create(speciesIndex, Math.floor(Math.random() * 0x7fffffff)),
      x: initial ? random(length * .4, width - length * .4) : (fromLeft ? -length : width + length),
      y: random(height * .08, height * .87), length: length, baseLength: baseLength, sizeFit: sizeFit, depth: depth,
      z: z, targetZ: Math.random(), zVelocity: 0, depthChangeIn: random(8, 22),
      heading: fromLeft ? 0 : Math.PI, cruiseHeading: (fromLeft ? 0 : Math.PI) + random(-.45, .45),
      phase: random(0, TAU), age: 0, lifetime: random(95, 240), born: elapsed,
      baseSpeed: random(19, 31) * spec.speed * sizeFit,
      wanderIn: random(1, 6), fright: 0, immune: 0, grabbedBy: null, heldFor: 0,
      escaping: false, escapeDir: fromLeft ? 1 : -1, escapeAge: 0, tailSpeed: 1, turn: 0,
      vx: fromLeft ? 25 : -25, vy: 0
    };
    return f;
  }
  function setPopulation(fresh) {
    if (fresh) { pointers.forEach(function (p) { p.fish = null; }); fish.length = 0; }
    while (fish.length < settings.population) fish.push(createFish(fish.length, true));
    while (fish.length > settings.population) {
      var removed = fish.pop(); pointers.forEach(function (p) { if (p.fish === removed) p.fish = null; });
    }
    fish.sort(function (a, b) { return a.depth - b.depth; });
  }
  function addRipple(x, y, caught) {
    if (ripples.length >= 20) ripples.shift();
    ripples.push({ x: x, y: y, age: 0, life: caught ? 1.1 : .9, caught: caught });
  }
  function burst(x, y, count) {
    for (var i = 0; i < count; i++) {
      if (bubbles.length >= 64) {
        var expired = bubbles.findIndex(function (b) { return !b.ambient; });
        if (expired !== -1) bubbles.splice(expired, 1); else break;
      }
      bubbles.push({ x: x + random(-15, 15), y: y + random(-8, 8), radius: random(1.5, 4), vy: random(25, 65), phase: random(0, TAU), life: random(.8, 2), ambient: false });
    }
  }
  function catchAt(p) {
    if (p.fish) return;
    for (var i = fish.length - 1; i >= 0; i--) {
      var f = fish[i];
      if (f.grabbedBy !== null || f.immune > 0 || f.escaping || f.age < .6) continue;
      var dx = p.x - f.x, dy = p.y - f.y;
      var a = displayHeading(f), along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a);
      var fatness = f.speciesIndex === 2 ? .37 : .22;
      if (along * along / Math.pow(f.length * .5 + 12, 2) + across * across / Math.pow(f.length * fatness + 12, 2) > 1) continue;
      p.fish = f; f.grabbedBy = p.id; f.heldFor = 0; f.fright = 1; catches++;
      addRipple(f.x, f.y, true); burst(f.x, f.y, 7);
      if (elapsed - lastCatchSound > .07) { sound.play('catch', p.x / width); lastCatchSound = elapsed; }
      break;
    }
  }
  function release(p) {
    var f = p.fish;
    if (!f) return;
    f.grabbedBy = null; f.fright = 1; f.immune = 3; f.escaping = true; f.escapeAge = 0;
    f.escapeDir = f.x < width / 2 ? -1 : 1;
    f.heading = f.escapeDir > 0 ? random(-.25, .25) : Math.PI + random(-.25, .25);
    burst(f.x, f.y, 4); sound.play('release', f.x / width); p.fish = null;
  }
  function pointerDown(id, x, y) {
    if (pointers.size >= 10) return;
    sound.unlock(); requestWakeLock(); dismissWelcome();
    var p = { id: id, x: x, y: y, fish: null, updated: elapsed };
    pointers.set(id, p); addRipple(x, y, false); catchAt(p);
    if (!p.fish) sound.play('touch', x / width);
    fish.forEach(function (f) { if (Math.hypot(f.x - x, f.y - y) < 170) f.fright = Math.max(f.fright, .7); });
  }
  function pointerMove(id, x, y) {
    var p = pointers.get(id); if (!p) return;
    p.x = x; p.y = y; p.updated = elapsed; catchAt(p);
    if (elapsed - lastPointerRipple > .14) { addRipple(x, y, false); lastPointerRipple = elapsed; }
  }
  function pointerUp(id) { var p = pointers.get(id); if (p) release(p); pointers.delete(id); }
  if ('PointerEvent' in window) {
    canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); if (e.pointerType === 'mouse' && e.button !== 0) return; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} pointerDown(e.pointerId, e.clientX, e.clientY); });
    canvas.addEventListener('pointermove', function (e) { if (pointers.has(e.pointerId)) { e.preventDefault(); pointerMove(e.pointerId, e.clientX, e.clientY); } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { canvas.addEventListener(type, function (e) { pointerUp(e.pointerId); }); });
  } else {
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); Array.from(e.changedTouches).forEach(function (t) { pointerDown(t.identifier, t.clientX, t.clientY); }); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); Array.from(e.changedTouches).forEach(function (t) { pointerMove(t.identifier, t.clientX, t.clientY); }); }, { passive: false });
    ['touchend', 'touchcancel'].forEach(function (type) { canvas.addEventListener(type, function (e) { e.preventDefault(); Array.from(e.changedTouches).forEach(function (t) { pointerUp(t.identifier); }); }, { passive: false }); });
  }
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { pointers.forEach(release); pointers.clear(); cancelHold(); });

  function update(dt) {
    elapsed += dt;
    pointers.forEach(function (p, id) { if (elapsed - p.updated > 20) pointerUp(id); });
    var pace = settings.activity / 100;
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i]; f.age += dt; f.immune = Math.max(0, f.immune - dt); f.fright = Math.max(0, f.fright - dt * .33);
      f.depthChangeIn -= dt;
      if (f.depthChangeIn <= 0) { f.targetZ = Math.random(); f.depthChangeIn = random(8, 22); }
      if (f.grabbedBy === null) {
        f.zVelocity += ((f.targetZ - f.z) * .12 - f.zVelocity * .7) * dt;
        f.z = clamp(f.z + f.zVelocity * dt, 0, 1);
        f.depth = perspective(f.z); f.length = f.baseLength * f.depth;
      }
      if (f.grabbedBy !== null) {
        var p = pointers.get(f.grabbedBy);
        if (p) {
          f.heldFor += dt; f.x += (p.x - f.x) * Math.min(1, dt * 13); f.y += (p.y - f.y) * Math.min(1, dt * 13);
          f.phase = (f.phase + dt * 28) % TAU; f.turn = Math.sin(f.heldFor * 30) * .1;
          if (f.heldFor > .65) release(p);
          continue;
        }
        f.grabbedBy = null;
      }
      if (f.age > f.lifetime && !f.escaping) { f.escaping = true; f.escapeDir = f.x < width / 2 ? -1 : 1; f.escapeAge = 0; }
      f.wanderIn -= dt;
      if (f.wanderIn <= 0) { f.cruiseHeading = f.heading + random(-.85, .85); f.wanderIn = random(3, 7); }
      // Cruise in a direction, rather than perpetually seeking points near the center.
      var steerX = Math.cos(f.cruiseHeading), steerY = Math.sin(f.cruiseHeading);
      if (FishArt.species[f.speciesIndex].school && !f.escaping && f.fright < .2) {
        var neighbors = 0, alignX = 0, alignY = 0, centerX = 0, centerY = 0, separateX = 0, separateY = 0;
        for (var j = 0; j < fish.length; j++) {
          var n = fish[j];
          var distance = Math.hypot(n.x - f.x, n.y - f.y);
          if (n !== f && n.speciesIndex === f.speciesIndex && Math.abs(n.z - f.z) < .4 && distance < 190) {
            alignX += Math.cos(n.heading); alignY += Math.sin(n.heading);
            centerX += (n.x - f.x) / 190; centerY += (n.y - f.y) / 190;
            var personalSpace = (f.length + n.length) * .6;
            if (distance < personalSpace && distance > .01) {
              var pressure = 1 - distance / personalSpace;
              separateX += (f.x - n.x) / distance * pressure; separateY += (f.y - n.y) / distance * pressure;
            }
            neighbors++;
          }
        }
        if (neighbors) {
          steerX += alignX / neighbors * .4 + centerX / neighbors * .12 + separateX * 1.3;
          steerY += alignY / neighbors * .4 + centerY / neighbors * .12 + separateY * 1.3;
        }
      }
      if (food.length && !f.escaping && f.fright < .3) {
        var closest = null, closestD = Infinity;
        for (var k = 0; k < food.length; k++) { var pelletD = Math.hypot(food[k].x - f.x, food[k].y - f.y); if (pelletD < closestD) { closestD = pelletD; closest = food[k]; } }
        if (closest) { steerX = (closest.x - f.x) / Math.max(1, closestD); steerY = (closest.y - f.y) / Math.max(1, closestD); if (closestD < f.length * .35) closest.life = 0; }
      }
      pointers.forEach(function (p) {
        var dx = f.x - p.x, dy = f.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 160 && !f.escaping) {
          var repel = 1 - dist / 160;
          f.fright = Math.max(f.fright, repel * .9);
          steerX += dx / Math.max(1, dist) * repel * 6; steerY += dy / Math.max(1, dist) * repel * 4;
        }
      });
      if (f.escaping) { steerX = f.escapeDir; steerY = Math.sin(f.phase) * .025; f.escapeAge += dt; }
      else {
        var marginX = Math.min(width * .2, f.length * .45 + 35), marginY = Math.min(height * .2, f.length * .25 + 35);
        var lookX = f.x + Math.cos(f.heading) * 35, lookY = f.y + Math.sin(f.heading) * 20;
        if (lookX < marginX) steerX += (1 - lookX / marginX) * 3;
        if (lookX > width - marginX) steerX -= (1 - (width - lookX) / marginX) * 3;
        if (lookY < marginY) steerY += (1 - lookY / marginY) * 3;
        if (lookY > height - marginY) steerY -= (1 - (height - lookY) / marginY) * 3;
      }
      var desired = Math.atan2(steerY * .75, steerX);
      var delta = angleDiff(desired, f.heading), maxTurn = dt * (f.escaping ? 4 : .75 + f.fright * 3);
      f.heading += clamp(delta, -maxTurn, maxTurn); f.heading = Math.atan2(Math.sin(f.heading), Math.cos(f.heading));
      f.turn += (clamp(delta, -1, 1) - f.turn) * Math.min(1, dt * 4);
      var speed = f.baseSpeed * Math.sqrt(f.depth) * pace * (1 + f.fright * 3.5) * (f.escaping ? 2.1 : 1) * (1 + .14 * Math.sin(f.phase * .5));
      f.vx = Math.cos(f.heading) * speed; f.vy = Math.sin(f.heading) * speed * .55;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.phase = (f.phase + dt * (4.4 + speed * .075)) % TAU;
      if (f.escaping && (f.x < -f.length * 1.8 || f.x > width + f.length * 1.8 || f.escapeAge > 20)) fish[i] = createFish(-1, false);
    }
    depthSortIn -= dt;
    if (depthSortIn <= 0) { fish.sort(function (a, b) { return a.depth - b.depth; }); depthSortIn = .25; }
    for (var r = ripples.length - 1; r >= 0; r--) { ripples[r].age += dt; if (ripples[r].age > ripples[r].life) ripples.splice(r, 1); }
    for (var b = bubbles.length - 1; b >= 0; b--) {
      var bubble = bubbles[b]; bubble.y -= bubble.vy * dt; bubble.x += Math.sin(elapsed * 1.4 + bubble.phase) * dt * 4;
      if (!bubble.ambient) bubble.life -= dt;
      if (bubble.y < -8 || bubble.life <= 0) { if (bubble.ambient) { bubble.y = height + 8; bubble.x = width * .08 + random(-12, 12); } else bubbles.splice(b, 1); }
    }
    for (var m = 0; m < motes.length; m++) { var mote = motes[m]; mote.x = (mote.x + dt * mote.speed + width) % width; mote.y = (mote.y - dt * 1.8 + height) % height; }
    for (var q = food.length - 1; q >= 0; q--) { food[q].y += dt * 12; food[q].x += Math.sin(elapsed + q) * dt * 3; food[q].life -= dt; if (food[q].life <= 0 || food[q].y > height * .86) food.splice(q, 1); }
  }
  function render() {
    ctx.clearRect(0, 0, width, height);
    // Broad, barely visible moving light; the detailed aquascape stays on a static layer.
    if (settings.quality !== 'eco') {
      ctx.fillStyle = 'rgba(188,242,218,.018)';
      for (var l = 0; l < 3; l++) { var beamX = width * (.14 + l * .22) + Math.sin(elapsed * .09 + l) * 22; ctx.beginPath(); ctx.moveTo(beamX, 0); ctx.lineTo(beamX + 30, 0); ctx.lineTo(beamX + width * .24, height); ctx.lineTo(beamX + width * .08, height); ctx.closePath(); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(216,244,218,.25)';
    for (var m = 0; m < motes.length; m++) { var mote = motes[m]; ctx.globalAlpha = mote.alpha; ctx.fillRect(mote.x, mote.y, mote.size, mote.size); }
    ctx.globalAlpha = 1;
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i]; var alpha = (.78 + .22 * (1 - f.z)) * Math.min(1, f.age / 1.2);
      var heading = displayHeading(f);
      if (f.grabbedBy !== null) heading += Math.sin(f.heldFor * 30) * .1;
      var yaw = .04 + .96 * Math.abs(Math.cos(f.heading));
      FishArt.draw(ctx, f.sprite, f.x, f.y + Math.sin(f.phase * .5) * 1.1, f.length, heading, f.phase, f.turn, alpha, yaw);
    }
    ctx.fillStyle = '#bc9864';
    for (var p = 0; p < food.length; p++) { ctx.globalAlpha = Math.min(1, food[p].life); ctx.beginPath(); ctx.arc(food[p].x, food[p].y, 1.9, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.lineWidth = .8;
    for (var b = 0; b < bubbles.length; b++) {
      var bubble = bubbles[b]; ctx.strokeStyle = 'rgba(195,239,233,' + (bubble.ambient ? .24 : Math.min(.5, bubble.life * .45)) + ')';
      ctx.beginPath(); ctx.arc(bubble.x, bubble.y, bubble.radius, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(231,255,242,.4)'; ctx.fillRect(bubble.x - bubble.radius * .35, bubble.y - bubble.radius * .5, .9, .9);
    }
    for (var r = 0; r < ripples.length; r++) {
      var ripple = ripples[r], progress = ripple.age / ripple.life;
      ctx.strokeStyle = 'rgba(221,255,242,' + (.32 * (1 - progress)) + ')'; ctx.lineWidth = 1.3 * (1 - progress) + .3;
      ctx.beginPath(); ctx.ellipse(ripple.x, ripple.y, 10 + progress * 63, 7 + progress * 43, -.12, 0, TAU); ctx.stroke();
      if (progress > .15) { ctx.strokeStyle = 'rgba(221,255,242,' + (.12 * (1 - progress)) + ')'; ctx.beginPath(); ctx.ellipse(ripple.x, ripple.y, 4 + progress * 42, 3 + progress * 28, -.12, 0, TAU); ctx.stroke(); }
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var interval = 1000 / targetFPS;
    if (!nextFrame) { nextFrame = now + interval; lastUpdate = now; return; }
    if (now < nextFrame - .5) return;
    nextFrame += interval;
    if (nextFrame <= now) nextFrame = now + interval;
    var realGap = now - lastUpdate; lastUpdate = now;
    var dt = Math.min(realGap / 1000, .08);
    update(dt); render();
    sampleFrames++; sampleTime += realGap;
    if (sampleTime > 4000) {
      actualFPS = Math.round(sampleFrames * 1000 / sampleTime);
      if (settings.quality === 'auto') {
        slowSamples = actualFPS < targetFPS * .75 ? slowSamples + 1 : 0;
        if (slowSamples >= 2 && renderScale > .65) { renderScale = Math.max(.65, renderScale - .15); resize(); slowSamples = 0; }
      }
      if (panelOpen) updateStatus(); sampleFrames = 0; sampleTime = 0;
    }
  }
  function updateStatus() { document.getElementById('render-status').textContent = fish.length + ' fish · ' + actualFPS + ' fps · ' + (settings.quality === 'eco' ? 'eco' : settings.quality === 'auto' ? 'adaptive' : 'smooth'); }
  function applyLight() {
    var opacity = settings.light === 'night' ? .52 : settings.light === 'dusk' ? .23 : 0;
    document.getElementById('shade').style.background = settings.light === 'dusk' ? '#061735' : '#010e1c';
    document.getElementById('shade').style.opacity = 1 - (1 - opacity) * settings.brightness / 100;
  }
  function updateUI() {
    Object.keys(defaults).forEach(function (key) { var el = document.getElementById(key); if (el) el.value = settings[key]; });
    document.getElementById('population-value').textContent = settings.population;
    document.getElementById('activity-value').textContent = settings.activity < 80 ? 'Unhurried' : settings.activity > 120 ? 'Playful' : 'Natural';
    document.getElementById('brightness-value').textContent = settings.brightness + '%';
    var volumeOutput = document.getElementById('volume-value'); if (volumeOutput) volumeOutput.textContent = settings.volume ? settings.volume + '%' : 'Muted';
  }
  Object.keys(defaults).forEach(function (key) {
    var el = document.getElementById(key); if (!el) return;
    el.addEventListener('input', function () {
      settings[key] = typeof defaults[key] === 'number' ? Number(el.value) : el.value;
      if (key === 'population') setPopulation(false);
      if (key === 'quality') { renderScale = 1; slowSamples = 0; resize(); }
      if (key === 'light' || key === 'brightness') applyLight();
      if (key === 'volume') { sound.unlock(); sound.setVolume(settings.volume / 100); sound.play('touch', .5); }
      updateUI(); updateStatus(); save();
    });
  });
  function openPanel() {
    cancelHold(); panelOpen = true; dismissWelcome();
    pointers.forEach(release); pointers.clear();
    panel.hidden = false; document.getElementById('panel-scrim').hidden = false; trigger.hidden = true;
    updateUI(); updateStatus(); document.getElementById('close-controls').focus();
  }
  function closePanel() { panelOpen = false; panel.hidden = true; document.getElementById('panel-scrim').hidden = true; trigger.hidden = false; trigger.focus({ preventScroll: true }); }
  function cancelHold() { clearTimeout(holdTimer); holdTimer = 0; trigger.classList.remove('holding'); }
  trigger.addEventListener('pointerdown', function (e) { e.preventDefault(); if (e.button !== 0) return; sound.unlock(); cancelHold(); trigger.classList.add('holding'); try { trigger.setPointerCapture(e.pointerId); } catch (_) {} holdTimer = setTimeout(openPanel, 1200); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { trigger.addEventListener(type, cancelHold); });
  trigger.addEventListener('click', function (e) { if (e.detail === 0) openPanel(); });
  document.getElementById('close-controls').addEventListener('click', closePanel);
  document.getElementById('panel-scrim').addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelOpen) closePanel();
    if (e.key.toLowerCase() === 's' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); panelOpen ? closePanel() : openPanel(); }
    if (e.key === 'Tab' && panelOpen) {
      var focusable = panel.querySelectorAll('button,input,select'), first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function fullscreen() {
    sound.unlock(); requestWakeLock();
    var method = isFullscreen() ? (document.exitFullscreen || document.webkitExitFullscreen) : (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!method) { toast('Use Fully Kiosk’s Fullscreen Mode on this device.'); return; }
    try { var result = method.call(isFullscreen() ? document : document.documentElement); if (result && result.catch) result.catch(function () { toast('Full screen is managed by your browser or Fully Kiosk.'); }); } catch (_) { toast('Use Fully Kiosk’s Fullscreen Mode on this device.'); }
  }
  document.getElementById('fullscreen').addEventListener('click', fullscreen);
  document.getElementById('welcome-fullscreen').addEventListener('click', function () { fullscreen(); dismissWelcome(); });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) { document.addEventListener(type, function () { document.querySelector('#fullscreen span').textContent = isFullscreen() ? 'Exit full screen' : 'Enter full screen'; resize(); }); });
  async function requestWakeLock() {
    if (!navigator.wakeLock || !window.isSecureContext || document.hidden || wakeLock || wakePending) return;
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      document.getElementById('awake-status').textContent = 'Screen wake lock is active while this page stays visible.';
      wakeLock.addEventListener('release', function () { wakeLock = null; document.getElementById('awake-status').textContent = 'For all-day play, use Fully Kiosk’s Keep Screen On setting.'; });
    } catch (_) { /* Fully Kiosk manages power on ordinary HTTP LAN URLs. */ }
    finally { wakePending = false; }
  }
  document.getElementById('feed').addEventListener('click', function () {
    sound.unlock(); sound.play('food', .5);
    for (var i = 0; i < 15; i++) { if (food.length >= 40) food.shift(); food.push({ x: random(width * .3, width * .7), y: random(20, height * .16), life: random(16, 24) }); }
    closePanel(); toast('A little snack for the shoal');
  });
  document.getElementById('refresh-fish').addEventListener('click', function () { setPopulation(true); closePanel(); toast('Meet your new neighbours'); });
  document.addEventListener('visibilitychange', function () {
    cancelAnimationFrame(raf); raf = 0; nextFrame = 0; sampleFrames = 0; sampleTime = 0;
    if (document.hidden) { pointers.forEach(release); pointers.clear(); sound.suspend(); cancelHold(); }
    else { requestWakeLock(); raf = requestAnimationFrame(frame); }
  });
  window.addEventListener('pageshow', function () { if (!document.hidden && !raf) { nextFrame = 0; raf = requestAnimationFrame(frame); } });
  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 100); });
  canvas.addEventListener('contextrestored', function () { resize(); render(); });
  for (var i = 0; i < 18; i++) bubbles.push({ x: width * .08 + random(-12, 12), y: random(0, height), radius: random(.9, 2.5), vy: random(15, 30), phase: random(0, TAU), ambient: true, life: 1 });
  for (var j = 0; j < 36; j++) motes.push({ x: random(0, width), y: random(0, height), speed: random(1, 5), size: random(.6, 1.7), alpha: random(.15, .8) });
  resize(); setPopulation(true); updateUI(); applyLight(); render();
  raf = requestAnimationFrame(frame);
  // Opt-in diagnostics for automated soak tests; no per-frame logging or growing history.
  if (new URLSearchParams(location.search).has('debug')) {
    window.fishbowlDebug = {
      snapshot: function () { return { fish: fish.map(function (f) { return { id: f.id, species: f.speciesIndex, x: f.x, y: f.y, length: f.length, depth: f.z, escaping: f.escaping, grabbed: f.grabbedBy !== null }; }), generations: generation, catches: catches, bubbles: bubbles.length, ripples: ripples.length, food: food.length, pointers: pointers.size, fps: actualFPS, scale: scale, settings: Object.assign({}, settings), elapsed: elapsed }; },
      advance: function (seconds) { for (var t = 0; t < seconds; t += .05) update(.05); render(); },
      touch: pointerDown, move: pointerMove, release: pointerUp
    };
  }
}());
