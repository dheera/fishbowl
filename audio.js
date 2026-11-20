(function () {
  'use strict';

  // Everything is synthesized locally. No AudioContext exists until a gesture.
  var context = null;
  var master = null;
  var volume = 0.3;
  var resuming = false;
  var resumeGeneration = 0;
  var pending = null;
  var voices = new Set();
  var lastSound = -Infinity;
  var lastKind = { touch: -Infinity, catch: -Infinity, release: -Infinity, food: -Infinity };
  var MAX_VOICES = 10;
  var intervals = { touch: 85, catch: 110, release: 90, food: 180 };

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function disconnect(node) {
    if (!node) return;
    try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
  }

  function clearVoice(voice) {
    if (!voices.has(voice)) return;
    voices.delete(voice);
    if (voice.oscillator) voice.oscillator.onended = null;
    disconnect(voice.oscillator);
    disconnect(voice.envelope);
    disconnect(voice.panner);
  }

  function stopVoices() {
    voices.forEach(function (voice) {
      try { voice.oscillator.stop(); } catch (_) { /* Already stopped. */ }
      clearVoice(voice);
    });
  }

  function unlock() {
    try {
      if (!context || context.state === 'closed') {
        stopVoices();
        disconnect(master);
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
      }
      if (context.state === 'running' || resuming) return;
      resuming = true;
      var generation = ++resumeGeneration;
      var result = context.resume();
      if (result && typeof result.then === 'function') {
        result.then(function () {
          if (generation !== resumeGeneration) return;
          resuming = false;
          var request = pending;
          pending = null;
          if (request && now() - request.time < 500) play(request.kind, request.x);
        }).catch(function () {
          if (generation !== resumeGeneration) return;
          resuming = false;
          pending = null;
        });
      } else {
        resuming = false;
      }
    } catch (_) {
      resuming = false;
      pending = null;
    }
  }

  // A short sine chirp with a rounded envelope sounds like a small water bubble.
  function bubble(start, pitch, duration, loudness, pan) {
    if (voices.size >= MAX_VOICES) return;
    var voice = { oscillator: null, envelope: null, panner: null };
    try {
      voice.oscillator = context.createOscillator();
      voice.envelope = context.createGain();
      var oscillator = voice.oscillator;
      var envelope = voice.envelope;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(pitch * 0.72, start);
      oscillator.frequency.exponentialRampToValueAtTime(pitch, start + 0.014);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, pitch * 0.33), start + duration);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(loudness, start + 0.009);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      envelope.gain.linearRampToValueAtTime(0, start + duration + 0.015);
      oscillator.connect(envelope);
      if (typeof context.createStereoPanner === 'function') {
        voice.panner = context.createStereoPanner();
        voice.panner.pan.value = pan;
        envelope.connect(voice.panner);
        voice.panner.connect(master);
      } else {
        envelope.connect(master);
      }
      voices.add(voice);
      oscillator.onended = function () { clearVoice(voice); };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.025);
    } catch (_) {
      // Include partially built voices in cleanup even if start() failed.
      voices.add(voice);
      if (voice.oscillator) {
        try { voice.oscillator.stop(); } catch (ignored) { /* Not started. */ }
      }
      clearVoice(voice);
    }
  }

  function play(kind, xNormalized) {
    if (!Object.prototype.hasOwnProperty.call(intervals, kind) || !context || volume <= 0) return;
    var timestamp = now();
    if (context.state !== 'running') {
      // Keep at most one fresh interaction during gesture-triggered resume.
      if (resuming) pending = { kind: kind, x: xNormalized, time: timestamp };
      return;
    }
    if (timestamp - lastSound < 40 || timestamp - lastKind[kind] < intervals[kind]) return;
    if (voices.size >= MAX_VOICES - 2) return;
    lastSound = timestamp;
    lastKind[kind] = timestamp;
    var x = Number(xNormalized);
    if (!Number.isFinite(x)) x = 0.5;
    var pan = (Math.max(0, Math.min(1, x)) * 2 - 1) * 0.65;
    var start = context.currentTime + 0.004;
    var variation = 0.9 + Math.random() * 0.2;
    if (kind === 'catch') {
      bubble(start, 770 * variation, 0.15, 0.32, pan);
      bubble(start + 0.058, 1080 * variation, 0.13, 0.18, pan);
    } else if (kind === 'release') {
      bubble(start, 460 * variation, 0.16, 0.2, pan);
      bubble(start + 0.07, 640 * variation, 0.12, 0.1, pan);
    } else if (kind === 'food') {
      bubble(start, 1050 * variation, 0.11, 0.19, pan);
      bubble(start + 0.063, 820 * variation, 0.12, 0.14, pan);
      bubble(start + 0.13, 630 * variation, 0.14, 0.1, pan);
    } else {
      bubble(start, 590 * variation, 0.13, 0.24, pan);
    }
  }

  function setVolume(value) {
    var next = Number(value);
    if (!Number.isFinite(next)) return;
    volume = Math.max(0, Math.min(1, next));
    if (volume === 0) {
      pending = null;
      stopVoices();
    }
    if (!master || !context || context.state === 'closed') return;
    try {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(volume, context.currentTime, 0.025);
    } catch (_) { /* Audio remains optional if an implementation fails. */ }
  }

  function suspend() {
    pending = null;
    resuming = false;
    resumeGeneration += 1;
    stopVoices();
    if (!context || context.state === 'closed') return;
    try {
      var result = context.suspend();
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (_) { /* Already unavailable. */ }
  }

  window.AquariumAudio = {
    unlock: unlock,
    play: play,
    setVolume: setVolume,
    suspend: suspend
  };
}());
