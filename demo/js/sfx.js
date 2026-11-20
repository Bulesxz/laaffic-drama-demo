/* =============
 * NEON STACK · 音效与触感（WebAudio 合成，无音频文件）
 * ===========*/
(function (global) {
  'use strict';
  var ctx = null, master = null, musicGain = null, musicTimer = null;
  var on = { sound: true, music: true, haptic: true };

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slide) {
    if (!on.sound || !ensure()) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function buzz(ms) { if (on.haptic && global.navigator && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  var S = {
    tap: function () { tone(660, 0.05, 'triangle', 0.18); buzz(8); },
    move: function () { tone(320, 0.03, 'square', 0.06); },
    rotate: function () { tone(520, 0.05, 'triangle', 0.12, 0, 700); },
    drop: function () { tone(180, 0.12, 'square', 0.22, 0, 80); buzz(15); },
    lock: function () { tone(240, 0.05, 'triangle', 0.1); },
    clear: function (n) {
      var base = [523, 659, 784, 1047];
      for (var i = 0; i < Math.min(4, n + 1); i++) tone(base[i], 0.14, 'square', 0.16, i * 0.06);
      buzz(n >= 4 ? [30, 40, 60] : 25);
    },
    level: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.12, 'triangle', 0.2, i * 0.07); }); },
    coin: function () { tone(988, 0.06, 'square', 0.14); tone(1319, 0.14, 'square', 0.14, 0.06); },
    buy: function () { tone(784, 0.08, 'triangle', 0.2); tone(1175, 0.16, 'triangle', 0.2, 0.08); buzz(20); },
    bomb: function () { tone(120, 0.4, 'sawtooth', 0.3, 0, 40); buzz([40, 30, 60]); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.2, i * 0.16); }); buzz(80); },
    win: function () { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.14, 'square', 0.15, i * 0.09); }); },
    count: function (last) { tone(last ? 880 : 440, last ? 0.3 : 0.12, 'square', 0.18); },
    error: function () { tone(200, 0.12, 'square', 0.15); tone(160, 0.18, 'square', 0.15, 0.1); buzz(30); }
  };

  /* 背景音乐：简单的 8 拍循环（低音 + 和弦琶音） */
  var SEQ = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  function startMusic() {
    if (!on.music || musicTimer || !ensure()) return;
    var step = 0;
    musicTimer = setInterval(function () {
      if (!on.music || ctx.state !== 'running') return;
      var chord = SEQ[Math.floor(step / 4) % SEQ.length];
      var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = chord[step % 3] * (step % 4 === 3 ? 2 : 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.3);
      step++;
    }, 300);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  global.SFX = {
    play: function (name, arg) { try { if (S[name]) S[name](arg); } catch (e) { /* ignore */ } },
    unlock: function () { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    set: function (k, v) {
      on[k] = !!v;
      if (k === 'music') { if (v) startMusic(); else stopMusic(); }
    },
    get: function (k) { return on[k]; },
    startMusic: startMusic,
    stopMusic: stopMusic,
    duck: function (v) { if (musicGain) musicGain.gain.value = v ? 0.03 : 0.12; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
