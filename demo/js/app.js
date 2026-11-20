/* =============
 * NEON STACK · 商业版主逻辑（v6）
 * -------------
 * 游戏：经典 / 限时 / 每日挑战、体力、金币、钻石、道具、皮肤、签到、任务、排行。
 * 短剧：剧场（列表 / 分类 / 搜索 / 详情 / 播放 / 收藏 / 点赞）全部走 LAAFFIC 内容 API（LCDK.*）；
 *       游戏里的"看一集"奖励（翻倍 / 复活 / 体力 / 金币）用同一个播放器，奖励由游戏自己发。
 * ===========*/
(function () {
  'use strict';

  var CFG = window.LAFFIC_DEMO, G = CFG.game;
  var NS = window.NeonStack, LCDK = window.LAAFFIC.ContentSDK, SFX = window.SFX, I18N = window.I18N;
  var T = I18N.t;
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ============== 工具 ============== */
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(id) { return '<svg><use href="#i-' + id + '"/></svg>'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function shortNum(n) {
    n = Number(n) || 0;
    if (I18N.lang === 'zh') return n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万' : String(n);
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n);
  }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function sdkError(err) {
    toast(T('toast.reqFail', { c: err && err.errorCode != null ? err.errorCode : '-' }));
  }

  /* ============== 存档（游戏自己的数据，本地保存） ============== */
  var S;
  function defaults() {
    var st = G.start;
    return {
      coins: st.coins, gems: st.gems, energy: st.energy, energyAt: Date.now(),
      items: { bomb: st.bombs, slow: st.slows },
      level: st.level, xp: st.xp,
      best: { classic: 0, blitz: 0, daily: 0 }, games: 0, lines: 0,
      skin: 'candy', skins: ['candy'],
      checkin: { streak: 0, last: '' },
      daily: { date: '', done: false },
      tasks: { date: '', p: {}, claimed: {} },
      watch: { date: '', count: 0 },
      history: {},
      mode: 'classic',
      settings: { sound: true, music: true, haptic: true },
      dev: false
    };
  }
  function load() {
    try { S = JSON.parse(localStorage.getItem(G.storeKey)) || defaults(); } catch (e) { S = defaults(); }
    var d = defaults();
    for (var k in d) if (S[k] == null) S[k] = d[k];
    rollDay();
  }
  function save() { try { localStorage.setItem(G.storeKey, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function rollDay() {
    var t = today();
    if (S.tasks.date !== t) S.tasks = { date: t, p: {}, claimed: {} };
    if (S.watch.date !== t) S.watch = { date: t, count: 0 };
    if (S.daily.date !== t) S.daily = { date: t, done: false };
  }

  /* ======= 体力 ============== */
  function tickEnergy() {
    if (S.energy >= G.energyMax) { S.energyAt = Date.now(); return; }
    var gained = Math.floor((Date.now() - S.energyAt) / G.energyRegenMs);
    if (gained > 0) {
      S.energy = Math.min(G.energyMax, S.energy + gained);
      S.energyAt += gained * G.energyRegenMs;
      if (S.energy >= G.energyMax) S.energyAt = Date.now();
      save(); renderTop();
    }
  }
  function energyLeftMs() { return G.energyRegenMs - (Date.now() - S.energyAt); }

  /* ============== 资源变动 ============== */
  function addCoins(n, fromEl) {
    S.coins += n; save();
    if (n > 0) { flyCoins(fromEl, n); SFX.play('coin'); }
    renderTop(true);
  }
  function spend(currency, n) {
    if (S[currency] < n) { toast(T(currency === 'gems' ? 'toast.noGems' : 'toast.noCoins')); SFX.play('error'); return false; }
    S[currency] -= n; save(); renderTop();
    return true;
  }
  function addXp(n) {
    S.xp += n;
    while (S.xp >= G.xpPerLevel) { S.xp -= G.xpPerLevel; S.level += 1; }
    save();
  }
  function taskProgress(id, n) {
    rollDay();
    S.tasks.p[id] = (S.tasks.p[id] || 0) + n;
    save(); renderDots();
  }
  function setTask(id, v) { rollDay(); S.tasks.p[id] = Math.max(S.tasks.p[id] || 0, v); save(); renderDots(); }

  /* ============== 顶栏 / 红点 ============== */
  function renderTop(bump) {
    $('tb-coins').textContent = fmt(S.coins);
    $('tb-gems').textContent = fmt(S.gems);
    $('tb-energy').textContent = S.energy + '/' + G.energyMax;
    $('tb-lv').textContent = S.level;
    if (bump) {
      var pill = $('tb-coins').parentNode;
      pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    }
  }
  function renderDots() {
    var claimable = TASKS.some(function (t) { return !S.tasks.claimed[t.id] && (S.tasks.p[t.id] || 0) >= t.goal; });
    $('dot-tasks').hidden = !claimable;
    $('tab-dot-tasks').hidden = !claimable;
    $('dot-checkin').hidden = S.checkin.last === today();
  }

  /* ============== 金币飞入 / 彩带 ============== */
  function flyCoins(fromEl, n) {
    var fx = $('fx'), app = $('app').getBoundingClientRect();
    var to = $('tb-coins').getBoundingClientRect();
    var from = fromEl && fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : { left: app.left + app.width / 2, top: app.top + app.height / 2, width: 0, height: 0 };
    var count = Math.min(10, 3 + Math.floor(n / 80));
    for (var i = 0; i < count; i++) {
      (function (i) {
        var c = document.createElement('div');
        c.className = 'fly';
 c.innerHTML = ico('coin');
 var x = from.left - app.left + from.width / 2 + (Math.random() - 0.5) * 60;
        var y = from.top - app.top + from.height / 2 + (Math.random() - 0.5) * 30;
        c.style.left = x + 'px'; c.style.top = y + 'px';
        fx.appendChild(c);
        setTimeout(function () {
          c.style.transform = 'translate(' + (to.left - app.left - x) + 'px,' + (to.top - app.top - y) + 'px) scale(.6)';
   c.style.opacity = '0.2';
 }, 30 + i * 45);
        setTimeout(function () { c.remove(); }, 900 + i * 45);
      })(i);
    }
  }
  function confetti() {
    var fx = $('fx'), colors = ['#FFC83D', '#FF5E9C', '#30E3A5', '#3FD4FF', '#B067FF'];
    for (var i = 0; i < 46; i++) {
      var c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
      c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      c.style.animationDelay = Math.random() * 0.4 + 's';
      fx.appendChild(c);
      setTimeout(function (el) { return function () { el.remove(); }; }(c), 2400);
    }
  }

  /* ============== Logo（方块拼字） ============== */
  var LOGO_COLORS = ['#3FD4FF', '#FFC83D', '#FF5E9C', '#30E3A5', '#B067FF', '#FF9A3D', '#4D7CFF', '#5BE36A', '#FF5A6A'];
  function buildLogo(el, animate) {
    var rows = [['N', 'E', 'O', 'N'], ['S', 'T', 'A', 'C', 'K']];
    var k = 0;
    el.innerHTML = rows.map(function (row, ri) {
      return '<div class="logo__row' + (ri ? ' logo__row--b' : '') + '">' + row.map(function (ch) {
        var col = LOGO_COLORS[k % LOGO_COLORS.length];
        var delay = animate ? ' style="background:' + col + ';animation-delay:' + (k * 0.07) + 's"' : ' style="background:' + col + '"';
        k++;
        return '<span class="logo__blk"' + delay + '>' + ch + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  /* ============== 屏幕切换 ============== */
  var screen = 'splash';
  var TAB_SCREENS = ['home', 'tasks', 'theater', 'shop', 'me'];
  function go(name) {
    if (name === screen) return;
    if (screen === 'game' && name !== 'game') leaveGame();
    screen = name;
    $('app').setAttribute('data-screen', name);
    ['splash', 'home', 'game', 'theater', 'tasks', 'shop', 'me'].forEach(function (s) { $('scr-' + s).hidden = s !== name; });
    var tabbed = TAB_SCREENS.indexOf(name) >= 0;
    $('tabbar').hidden = !tabbed;
    $('topbar').hidden = !(tabbed && name !== 'theater');
    qsa('#tabbar button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-go') === name); });
    if (name === 'home') renderHome();
    if (name === 'tasks') renderTasks();
    if (name === 'shop') renderShop();
    if (name === 'me') renderMe();
    if (name === 'theater') openTheater();
  }

  /* ============== 启动 ============== */
  function splash() {
    buildLogo($('splash-logo'), true);
    var tips = T('splash.tips');
    var p = 0, fill = $('splash-fill'), tip = $('splash-tip');
    tip.textContent = tips[0];
    var steps = [
      function () { var cfg = Object.assign({}, CFG.sdk, { language: I18N.lang }); if (cfg.mode === 'live') cfg.baseUrl = cfg.liveBaseUrl; return LCDK.init(cfg); },
      function () { tip.textContent = tips[1]; return preloadContent(); },
      function () { tip.textContent = tips[2]; return new Promise(function (r) { setTimeout(r, 350); }); }
    ];
    var chain = Promise.resolve();
    steps.forEach(function (fn, i) {
      chain = chain.then(fn).then(function () { p = (i + 1) / steps.length; fill.style.width = (p * 100) + '%'; });
    });
    chain.catch(function () { toast(T('toast.loadFail')); }).then(function () {
      setTimeout(function () { window.__DEMO_READY__ = true; go('home'); }, 300);
    });
  }

  /* ============== 首页 ======= */
  var MODES = [
    { id: 'classic', lv: 0 },
    { id: 'blitz', lv: G.blitzUnlockLv },
    { id: 'daily', lv: G.dailyUnlockLv }
  ];
  function modeArt(id) {
    /* 每种模式一个小插画：用方块拼的 SVG */
    var b = function (x, y, c) { return '<rect x="' + x + '" y="' + y + '" width="14" height="14" rx="4" fill="' + c + '"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="6" height="3" rx="1.5" fill="rgba(255,255,255,.55)"/>'; };
    if (id === 'classic') return '<svg class="mode__art" viewBox="0 0 64 56">' + b(8, 38, '#4D7CFF') + b(24, 38, '#4D7CFF') + b(40, 38, '#FFC83D') + b(24, 22, '#B067FF') + b(40, 22, '#FFC83D') + b(24, 6, '#3FD4FF') + '</svg>';
    if (id === 'blitz') return '<svg class="mode__art" viewBox="0 0 64 56"><circle cx="32" cy="30" r="20" fill="#3FD4FF"/><circle cx="32" cy="30" r="15" fill="#fff"/><path d="M32 19v12l8 5" stroke="#25226B" stroke-width="4" stroke-linecap="round" fill="none"/><rect x="27" y="4" width="10" height="6" rx="2" fill="#1C8AB8"/><path d="M52 12 58 6M12 12 6 6" stroke="#FFC83D" stroke-width="4" stroke-linecap="round"/></svg>';
    return '<svg class="mode__art" viewBox="0 0 64 56"><rect x="10" y="10" width="44" height="40" rx="8" fill="#FF5E9C"/><rect x="10" y="10" width="44" height="12" rx="6" fill="#C93573"/><rect x="18" y="4" width="5" height="12" rx="2.5" fill="#fff"/><rect x="41" y="4" width="5" height="12" rx="2.5" fill="#fff"/><path d="m24 35 6 6 11-12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  /* 首页中间的棋盘小样：用当前皮肤画一局"快消行"的画面，并让一块方块缓慢下落 */
  var stage = { r: null, t0: 0, raf: null };
  var STAGE_BOARD = [
    '..........', '..........', '..........', '..........', '..........', '..........',
    '..........', '..........', '..........', '..........', '......T...', '.....TTT..',
    'J....OO..L', 'JJJ..OOS.L', 'ZZLLLSSSOL', '.ZZLIIIIOI'
  ];
  function drawStage() {
    var cv = $('home-stage'); if (!cv || screen !== 'home') return;
    var box = cv.parentNode.getBoundingClientRect();
    var cell = Math.max(10, Math.floor(Math.min((box.height - 24) / 16, (box.width - 24) / 10)));
    var w = cell * 10, h = cell * 16, dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    if (!stage.r) stage.r = new NS.Renderer(cv, null);
    stage.r.setSkin(skinById(S.skin));
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1F1A63'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var r = 0; r < 16; r++) for (var c = 0; c < 10; c++) {
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(c * cell + cell * 0.08, r * cell + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.2) : ctx.rect(c * cell, r * cell, cell, cell); ctx.fill();
    }
    STAGE_BOARD.forEach(function (row, r) {
      for (var c = 0; c < 10; c++) if (row[c] !== '.') stage.r.drawCell(ctx, c * cell, r * cell, cell, stage.r.colorOf(row[c]), {});
    });
    /* 下落中的 I 块 */
    /* 竖 I 块从顶部落进第 9 列的空槽（停在第 12 行上方，不穿过已有方块） */
    var t = ((performance.now() - stage.t0) / 520) % 12;
    var y = Math.min(8, Math.floor(t)) - 3;
    for (var k = 0; k < 4; k++) if (y + k >= 0) stage.r.drawCell(ctx, 8 * cell, (y + k) * cell, cell, stage.r.colorOf('I'), { active: true });
    stage.raf = requestAnimationFrame(drawStage);
  }
  function renderHome() {
    renderTop(); renderDots();
    buildLogo($('home-logo'), false);
    cancelAnimationFrame(stage.raf); stage.t0 = performance.now(); stage.raf = requestAnimationFrame(drawStage);
    $('home-best').textContent = fmt(S.best[S.mode] || 0);
    $('modes').innerHTML = MODES.map(function (m) {
      var locked = S.level < m.lv;
      var sub = m.id === 'daily' ? (S.daily.done ? T('mode.dailyDone') : T('mode.dailySub', { n: G.dailyGoal })) : T('mode.' + m.id + 'Sub');
      if (locked) sub = T('mode.lockLv', { n: m.lv });
      return '<button type="button" class="mode' + (S.mode === m.id ? ' is-on' : '') + (locked ? ' is-locked' : '') + '" data-mode="' + m.id + '"' + (locked ? ' aria-disabled="true"' : '') + '>' +
        (m.id === 'daily' && !S.daily.done && !locked ? '<span class="mode__badge">+' + ico('gem').replace('<svg>', '<svg style="font-size:11px;vertical-align:-1px">') + '20</span>' : '') +
        (locked ? '<span class="mode__lock">' + ico('lock') + '</span>' : '') +
        modeArt(m.id) + '<b>' + esc(T('mode.' + m.id)) + '</b><span>' + esc(sub) + '</span></button>';
    }).join('');
  }

  /* ============== 游戏 ============== */
  var engine, renderer, lastFrame = 0;
  var Game = { mode: 'classic', running: false, startedAt: 0, endsAt: 0, combo: 0, revived: false, pausedAt: 0, countdown: false };

  function startRun() {
    tickEnergy();
    if (S.energy <= 0) { energyModal(); return; }
    S.energy -= 1;
    if (S.energy < G.energyMax && S.energy === G.energyMax - 1) S.energyAt = Date.now();
    save(); renderTop();
    Game.mode = S.mode;
    Game.revived = false;
    Game.combo = 0;
    go('game');
    layoutBoard();
    renderer.setSkin(skinById(S.skin));
    renderer.clearFx();
    engine.reset();
    renderHud();
    renderPowers();
    $('hud-meter').hidden = Game.mode === 'classic';
    countdown(function () {
      engine.start();
      Game.running = true;
      Game.startedAt = Date.now();
      Game.endsAt = Game.mode === 'blitz' ? Date.now() + G.blitzMs : 0;
      SFX.startMusic();
    });
  }
  function countdown(done) {
    var el = $('countdown'), n = 3;
    Game.countdown = true;
    el.hidden = false;
    var step = function () {
      if (screen !== 'game') { el.hidden = true; Game.countdown = false; return; }
      if (n === 0) { el.hidden = true; Game.countdown = false; SFX.play('count', true); done(); return; }
      el.innerHTML = '<b>' + n + '</b>'; SFX.play('count', false);
      n--; setTimeout(step, 650);
    };
    step();
  }
  function leaveGame() {
    Game.running = false;
    engine.reset();
    SFX.stopMusic();
  }
  function renderHud() {
    $('hud-score').textContent = fmt(engine.score);
    $('hud-sub').textContent = T('game.level', { l: engine.level, n: engine.lines });
    if (Game.mode === 'blitz') {
      var left = Game.endsAt ? Game.endsAt - Date.now() : G.blitzMs;
      $('hud-meter-fill').style.width = (Math.max(0, left) / G.blitzMs * 100) + '%';
      $('hud-meter-label').textContent = T('game.time', { s: Math.max(0, Math.ceil(left / 1000)) });
      $('hud-meter').classList.toggle('is-warn', left < 15000);
    } else if (Game.mode === 'daily') {
      $('hud-meter-fill').style.width = Math.min(100, engine.lines / G.dailyGoal * 100) + '%';
      $('hud-meter-label').textContent = T('game.goal', { n: Math.max(0, G.dailyGoal - engine.lines) });
      $('hud-meter').classList.remove('is-warn');
    }
  }
  function renderPowers() {
    [['bomb', 'pw-bomb'], ['slow', 'pw-slow']].forEach(function (p) {
      var n = S.items[p[0]], badge = $(p[1] + '-n');
      badge.textContent = n > 0 ? n : '+';
      badge.classList.toggle('is-buy', n <= 0);
    });
    $('pw-slow').classList.toggle('is-active', !!(engine.slowUntil && Date.now() < engine.slowUntil));
  }

  function createEngine() {
    engine = new NS.Engine({
      maxRevives: 99,
      onScore: function () { renderHud(); },
      onLines: function (rows, colors) {
        renderer.flashRows(rows);
        renderer.spawnLineParticles(rows, colors);
 Game.combo += 1;
        var n = rows.length;
 SFX.play('clear', n);
        taskProgress('lines30', n);
        if (n >= 2 || Game.combo >= 2) showCombo(n, Game.combo);
 if (n >= 4) { $('board-frame-el').classList.remove('shake'); void $('board-frame-el').offsetWidth; $('board-frame-el').classList.add('shake'); }
      },
      onLock: function () { SFX.play('lock'); },
      onSpawn: function () {
 /* 本次落下没有消行 → 连击中断 */
        if (engine.lastClear && engine.lastClear._seen) Game.combo = 0;
        if (engine.lastClear) engine.lastClear._seen = true;
      },
      onLevelUp: function () { SFX.play('level'); showCombo(0, 0, T('game.level', { l: engine.level, n: engine.lines })); },
      onGameOver: function (info) { onOver(info); }
    });
  }
  function showCombo(lines, chain, text) {
    var el = $('combo');
    var main = text || (lines >= 4 ? T('combo.4') : lines === 3 ? T('combo.3') : lines === 2 ? T('combo.2') : '');
    var sub = chain >= 2 ? T('combo.chain', { n: chain }) : '';
    if (!main && sub) { main = sub; sub = ''; }
    el.innerHTML = esc(main) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  function setupRenderer() {
    renderer = new NS.Renderer($('board'), $('next'));
    $('board').parentNode.id = 'board-frame-el';
    window.addEventListener('resize', layoutBoard);
    if (window.ResizeObserver) new ResizeObserver(layoutBoard).observe($('board-area'));
  }
  function layoutBoard() {
    var area = $('board-area');
    if (!area || screen !== 'game') return;
    var r = area.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var w = Math.floor(Math.max(160, Math.min(r.width - 24, (r.height - 24) / 2)));
    $('board').style.width = w + 'px';
    $('board').style.height = (w * 2) + 'px';
    renderer.resize(w, w * 2);
    renderer.resizeNext();
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = lastFrame ? Math.min(60, ts - lastFrame) : 16;
    lastFrame = ts;
    if (screen !== 'game') return;
    if (Game.running && (engine.state === 'running' || engine.state === 'clearing')) {
      engine.update(dt);
      if (Game.mode === 'blitz') {
        renderHud();
        if (Date.now() >= Game.endsAt && engine.state !== 'over') { engine.gameOver(); }
      }
      if (Game.mode === 'daily' && engine.lines >= G.dailyGoal && engine.state !== 'over') { Game.dailyWin = true; engine.gameOver(); }
      if (Math.floor(ts / 500) !== Math.floor((ts - dt) / 500)) renderPowers();
    }
    renderer.draw(engine, ts);
  }

  /* ---- 手势：横滑移动（按格）、轻点旋转、快速下滑硬降、慢速下拖软降 ---- */
  function bindGestures() {
    var el = $('board-area'), start = null, lastX = 0, lastY = 0, moved = false, softTimer = null;
    var cellPx = function () { return Math.max(18, renderer.cell || 24); };
    el.addEventListener('pointerdown', function (e) {
      if (!playable()) return;
      SFX.unlock();
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
      lastX = e.clientX; lastY = e.clientY; moved = false;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    el.addEventListener('pointermove', function (e) {
      if (!start || !playable()) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY, step = cellPx() * 0.9;
      while (Math.abs(dx) >= step) {
        var dir = dx > 0 ? 1 : -1;
        if (engine.move(dir)) SFX.play('move');
        dx -= dir * step; lastX += dir * step; moved = true;
      }
      if (dy >= step) {
        engine.softDrop(); lastY = e.clientY; moved = true;
      }
    });
    var end = function (e) {
      if (!start) return;
      var dt = Date.now() - start.t, dy = e.clientY - start.y, dx = e.clientX - start.x;
      if (playable()) {
        if (dy > 60 && dt < 260 && Math.abs(dy) > Math.abs(dx) * 1.4) { engine.hardDrop(); SFX.play('drop'); }
        else if (!moved && Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) { if (engine.rotate(1)) SFX.play('rotate'); }
      }
      start = null; clearInterval(softTimer);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', function () { start = null; });
    document.addEventListener('keydown', function (e) {
      if (screen !== 'game') return;
      if (e.key === 'Escape' || e.key === 'p') { pauseGame(); return; }
      if (!playable()) return;
      var k = e.key;
      if (k === 'ArrowLeft') { engine.move(-1); SFX.play('move'); }
      else if (k === 'ArrowRight') { engine.move(1); SFX.play('move'); }
      else if (k === 'ArrowDown') engine.softDrop();
      else if (k === 'ArrowUp' || k === 'x') { engine.rotate(1); SFX.play('rotate'); }
      else if (k === 'z') { engine.rotate(-1); SFX.play('rotate'); }
      else if (k === ' ') { e.preventDefault(); engine.hardDrop(); SFX.play('drop'); }
      else return;
      e.preventDefault();
    });
  }
  function playable() { return screen === 'game' && Game.running && engine.state === 'running' && !modalOpen() && !Game.countdown; }

  /* ---- 道具 ---- */
  function usePower(kind) {
    if (!playable()) return;
    if (S.items[kind] <= 0) { buyPowerModal(kind); return; }
    S.items[kind] -= 1; save();
    if (kind === 'bomb') {
      var c = engine.lastLock || { r: 18, c: 4 };
      engine.clearArea(c.r, c.c, 3);
      var rows = []; for (var r = c.r - 1; r <= c.r + 1; r++) if (r >= 0 && r < NS.ROWS) rows.push(r);
      renderer.flashRows(rows);
      renderer.spawnLineParticles(rows, []);
      SFX.play('bomb');
      $('board-frame-el').classList.remove('shake'); void $('board-frame-el').offsetWidth; $('board-frame-el').classList.add('shake');
      taskProgress('bomb', 1);
    } else {
      engine.slowUntil = Date.now() + 30000;
      SFX.play('buy');
    }
    renderPowers();
  }
  function buyPowerModal(kind) {
    var price = kind === 'bomb' ? G.bombPrice : G.slowPrice;
    pauseEngine();
    openModal({
      ribbon: T('item.' + kind),
      body: '<div class="item__art" style="font-size:64px">' + ico(kind === 'bomb' ? 'bomb' : 'clock') + '</div><p>' + esc(T('item.' + kind + 'Desc')) + '</p>',
      acts: [
        { cls: 'btn--gold', html: '<span class="price">' + ico('coin') + fmt(price) + '</span> ×1', on: function () {
   if (!spend('coins', price)) return false;
          S.items[kind] += 1; save(); SFX.play('buy'); renderPowers(); toast(T('toast.bought'));
        } }
      ],
      onClose: resumeEngine
    });
  }
  function pauseEngine() { if (engine.state === 'running') { engine.pause(); Game.pausedAt = Date.now(); } }
  function resumeEngine() {
    if (screen === 'game' && engine.state === 'paused' && !modalOpen()) {
      if (Game.endsAt && Game.pausedAt) Game.endsAt += Date.now() - Game.pausedAt;
      Game.pausedAt = 0;
      engine.resume();
    }
  }
  function pauseGame() {
    if (screen !== 'game' || engine.state === 'over' || modalOpen()) return;
    pauseEngine();
    SFX.duck(true);
    openModal({
      ribbon: T('pause.title'),
      body: '<div class="set-list">' + toggleRow('sound') + toggleRow('music') + toggleRow('haptic') + '</div>',
      acts: [
        { cls: 'btn--gold', text: T('pause.resume') },
        { cls: 'btn--purple', text: T('pause.restart'), on: function () { closeModal(true); leaveGame(); startRunNoCost(); return false; } },
        { cls: 'link', text: T('pause.quit'), on: function () { closeModal(true); go('home'); return false; } }
      ],
      onClose: function () { SFX.duck(false); resumeEngine(); }
    });
  }
  function startRunNoCost() { S.energy += 1; startRun(); }

  /* ============== 结束 / 复活 / 结算 ============== */
  function onOver(info) {
    Game.running = false;
    SFX.stopMusic();
    var timeUp = Game.mode === 'blitz' && Date.now() >= Game.endsAt;
    var won = Game.mode === 'daily' && Game.dailyWin;
    Game.dailyWin = false;
    if (!timeUp && !won && !Game.revived) { reviveModal(info); return; }
    settle(info, won);
  }
  function reviveModal(info) {
    SFX.play('over');
    var left = 8, timer = null;
    var ring = function (v) {
      var c = 2 * Math.PI * 52;
      return '<div class="revive-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(15,12,60,.5)" stroke-width="10"/>' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="#FFC83D" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - v / 8)) + '" style="transition:stroke-dashoffset 1s linear"/></svg><b id="rv-n">' + v + '</b></div>';
    };
    openModal({
      ribbon: T('revive.title'),
      body: ring(left) + '<p>' + esc(T('revive.body')) + '</p>',
      acts: [
 { cls: 'btn--pink', html: '<span class="play-ico">' + ico('play') + '</span>' + esc(T('revive.watch')), on: function () {
   clearInterval(timer);
   watchReward('revive', function (ok) { if (ok) doRevive(); else settle(info); });
        } },
        { cls: 'btn--gold', html: '<span class="price">' + ico('gem') + G.reviveGems + '</span>' + esc(T('revive.gems', { n: '' }).replace(/\s+$/, '')), on: function () {
   if (!spend('gems', G.reviveGems)) return false;
          clearInterval(timer); doRevive();
        } },
        { cls: 'link', text: T('revive.skip'), on: function () { clearInterval(timer); settle(info); } }
      ],
      noClose: true
    });
    timer = setInterval(function () {
      left -= 1;
      var el = $('panel').querySelector('.revive-ring circle:last-child');
      if (el) { var c = 2 * Math.PI * 52; el.setAttribute('stroke-dashoffset', c * (1 - left / 8)); }
      if ($('rv-n')) $('rv-n').textContent = Math.max(0, left);
      if (left <= 0) { clearInterval(timer); closeModal(true); settle(info); }
    }, 1000);
  }
  function doRevive() {
    Game.revived = true;
    engine.revive(4);
    Game.running = true;
    if (Game.endsAt) Game.endsAt = Math.max(Game.endsAt, Date.now() + 15000);
    SFX.play('level'); SFX.startMusic();
    renderHud();
  }
  function settle(info, won) {
    var score = engine.score, mode = Game.mode;
    var prev = S.best[mode] || 0, isNew = score > prev;
    if (isNew) S.best[mode] = score;
    S.games += 1; S.lines += engine.lines;
    var coins = Math.max(10, Math.round(score * G.coinPerScore));
    var stars = G.starScores.filter(function (v) { return score >= v; }).length;
    var gems = 0;
    if (won && !S.daily.done) { S.daily.done = true; gems = 20; S.gems += gems; }
    addXp(G.xpPerGame + stars * 20);
    taskProgress('play3', 1);
    setTask('score5k', score);
    save();
    var dur = Date.now() - Game.startedAt;
    var title = won ? T('result.win') : T('result.title');
    openModal({
      ribbon: title, ribbonGold: won || isNew,
      body:
        '<div class="stars">' + [0, 1, 2].map(function (i) { return '<svg class="' + (i < stars ? 'on' : '') + '"><use href="#i-star"/></svg>'; }).join('') + '</div>' +
        '<div class="res-score" id="res-score">0</div>' +
        '<span class="res-best' + (isNew ? ' is-new' : '') + '">' + esc(isNew ? T('result.newBest') : T('result.best', { v: fmt(prev) })) + '</span>' +
        '<div class="res-grid"><div><span>' + esc(T('result.lines')) + '</span><b>' + engine.lines + '</b></div><div><span>' + esc(T('result.level')) + '</span><b>' + engine.level + '</b></div><div><span>' + esc(T('result.time')) + '</span><b>' + mmss(dur) + '</b></div></div>' +
 '<div class="reward" id="res-reward">' + ico('coin') + '<span id="res-coins">' + fmt(coins) + '</span>' + (gems ? '&nbsp;&nbsp;' + ico('gem') + '<span>' + gems + '</span>' : '') + '</div>',
      acts: [
        { cls: 'btn--pink', id: 'res-double', html: '<span class="play-ico">' + ico('play') + '</span>' + esc(T('result.double')) + ' <span class="badge-x2">×2</span>', on: function () {
   watchReward('double', function (ok) {
     var c = ok ? coins * 2 : coins;
            if (ok) toast(T('reward.doubled'));
            afterSettle(c);
          });
        } },
        { cls: 'btn--gold', text: T('result.collect'), on: function () { afterSettle(coins); } }
      ],
      noClose: true
    });
    /* 分数滚动 */
    var t0 = performance.now(), el = $('res-score');
    var roll = function (now) {
      var p = Math.min(1, (now - t0) / 900);
      if (el) el.textContent = fmt(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(roll);
    };
    requestAnimationFrame(roll);
    if (isNew || won) { SFX.play('win'); confetti(); }
  }
  function afterSettle(coins) {
    closeModal(true);
    go('home');
    setTimeout(function () { addCoins(coins, $('play-btn')); toast(T('reward.got', { n: fmt(coins) })); }, 250);
  }

  /* ============== 体力 ======= */
  function energyModal() {
    openModal({
      ribbon: T('energy.title'),
      body: '<div class="item__art" style="font-size:70px">' + ico('bolt') + '</div><p>' + esc(T('energy.body')) + '</p><p><b>' + esc(T('energy.next', { t: mmss(energyLeftMs()) })) + '</b></p>',
      acts: [
        { cls: 'btn--pink', html: '<span class="play-ico">' + ico('play') + '</span>' + esc(T('energy.watch')), on: function () {
   watchReward('energy', function (ok) { if (ok) { S.energy = Math.min(G.energyMax, S.energy + 1); save(); renderTop(true); } });
        } },
        { cls: 'btn--gold', html: '<span class="price">' + ico('gem') + G.refillGems + '</span>', on: function () {
          if (!spend('gems', G.refillGems)) return false;
   S.energy = G.energyMax; S.energyAt = Date.now(); save(); renderTop(true); SFX.play('buy');
        } }
      ]
    });
  }

  /* ============== 弹窗 ============== */
  var modalState = null;
  function modalOpen() { return !!modalState; }
  function openModal(o) {
    if (modalState) closeModal(true);
    modalState = o;
    var acts = (o.acts || []).map(function (a, i) {
      if (a.cls === 'link') return '<button type="button" class="link-btn" data-act="' + i + '">' + esc(a.text) + '</button>';
      return '<button type="button" class="btn btn--block ' + a.cls + '" data-act="' + i + '"' + (a.id ? ' id="' + a.id + '"' : '') + '>' + (a.html || esc(a.text)) + '</button>';
    }).join('');
    $('panel').innerHTML =
      (o.ribbon ? '<div class="panel__ribbon' + (o.ribbonGold ? ' panel__ribbon--gold' : '') + '">' + esc(o.ribbon) + '</div>' : '') +
      (o.noClose ? '' : '<button type="button" class="panel__x" data-x aria-label="' + esc(T('common.close')) + '">' + ico('close') + '</button>') +
      (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') +
      (o.body || '') +
      (acts ? '<div class="panel__acts">' + acts + '</div>' : '');
    $('panel').style.paddingTop = o.ribbon ? '34px' : '';
    $('modal').hidden = false;
    if (o.onOpen) o.onOpen($('panel'));
  }
  function closeModal(silent) {
    var o = modalState;
    modalState = null;
    $('modal').hidden = true;
    $('panel').innerHTML = '';
    if (o && o.onClose && !silent) o.onClose();
  }
  function bindModal() {
    $('panel').addEventListener('click', function (e) {
      var o = modalState; if (!o) return;
      if (e.target.closest('[data-x]')) { SFX.play('tap'); closeModal(); return; }
      var b = e.target.closest('[data-act]');
      if (b) {
 SFX.play('tap');
        var a = o.acts[Number(b.getAttribute('data-act'))];
        var keep = a.on ? a.on(b) : undefined;
        if (keep !== false && modalState === o) closeModal(!!a.on);
 return;
      }
      if (o.onClick) o.onClick(e);
    });
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal') && modalState && !modalState.noClose) closeModal(); });
  }

  /* ============== 剧场（LAAFFIC 内容 API） ==============
   * 首屏：轮播（最新上架前 5）→ 继续观看 → 分类 chips → 本周热播 Top10 → 3 个分类货架 → 全部（分页加载）
   * 每块都是一次内容 API 调用：getCategoryList / getDefaultDramasList(sort, categoryCode, pageIndex) / searchDramas
   */
  var TH = { cat: '', sort: 'default', kw: '', seq: 0, cats: null, lang: null, hot: null, page: 1, more: false, loading: false, slides: [], slideI: 0, slideT: null };
  var RAIL_CATS = ['ceo', 'werewolf', 'revenge', 'costume', 'suspense', 'romance', 'war'];
  function lc() { return [I18N.lang]; }
  function catName(code) {
    var c = (TH.cats || []).filter(function (x) { return x.categoryCode === code; })[0];
    return c ? (c.categoryNameLanguage || c.categoryName) : code;
  }
  function preloadContent() {
    TH.lang = I18N.lang;
    return Promise.all([
      LCDK.requestCategoryList().then(function (l) { TH.cats = l; }),
      LCDK.requestDefaultDramasList(1, 1, { languageCodes: lc(), sort: 'hot' }).then(function (r) { TH.hot = (r.list || [])[0] || null; })
    ]);
  }
  function openTheater() {
    $('th-search').setAttribute('placeholder', T('theater.search'));
    var reload = TH.lang !== I18N.lang || !TH.cats;
    var p = reload ? preloadContent() : Promise.resolve();
    p.then(function () {
      renderCats(); renderHero(); renderContinue(); renderRails(); loadGrid(true);
      LCDK.getPlaceholder(I18N.lang).then(function (k) { if (k && k.length) $('th-search').setAttribute('placeholder', k[Math.floor(Math.random() * k.length)]); }).catch(function () {});
    }).catch(sdkError);
  }
  function browsing() { return !TH.kw && !TH.cat; }
  function renderCats() {
    $('th-cats').innerHTML = '<button type="button" data-cat=""' + (TH.cat ? '' : ' class="is-on"') + '>' + esc(T('theater.all')) + '</button>' +
      (TH.cats || []).map(function (c) {
        return '<button type="button" data-cat="' + esc(c.categoryCode) + '"' + (TH.cat === c.categoryCode ? ' class="is-on"' : '') + '>' + esc(c.categoryNameLanguage || c.categoryName) + '</button>';
      }).join('');
  }
  function renderHero() {
    var el = $('th-hero');
    clearInterval(TH.slideT);
    if (!browsing()) { el.hidden = true; return; }
    el.hidden = false;
    LCDK.requestDefaultDramasList(1, 5, { languageCodes: lc(), sort: 'new' }).then(function (r) {
      var list = r.list || [];
      TH.slides = list; TH.slideI = 0;
      $('th-hero-track').innerHTML = list.map(function (d) {
        var tag = d.tags && d.tags[0] ? (d.tags[0].tagNameLanguage || d.tags[0].tagName) : '';
 return '<div class="th-slide" data-vid="' + esc(d.vid) + '" style="background-image:url(\'' + esc(d.thumbnailLargeUrl || d.coverImage) + '\')">' +
          '<span class="th-hero__tag">' + esc(T('theater.newTag')) + '</span><div class="th-hero__txt"><div><b>' + esc(d.title) + '</b><span>' +
   esc([catName((d.categories[0] || {}).categoryCode), tag, T('theater.eps', { n: d.total })].filter(Boolean).join('  ')) + '</span></div>' +
          '<span class="btn btn--gold btn--sm">' + ico('play') + esc(T('detail.start')) + '</span></div></div>';
      }).join('');
      $('th-hero-dots').innerHTML = list.map(function (_, i) { return '<i' + (i ? '' : ' class="is-on"') + '></i>'; }).join('');
      $('th-hero-track').style.transform = 'translateX(0)';
      TH.slideT = setInterval(function () { slideTo(TH.slideI + 1); }, 4200);
    }).catch(sdkError);
  }
  function slideTo(i) {
    var n = TH.slides.length; if (!n) return;
    TH.slideI = (i + n) % n;
    $('th-hero-track').style.transform = 'translateX(' + (-TH.slideI * 100) + '%)';
    qsa('#th-hero-dots i').forEach(function (d, k) { d.classList.toggle('is-on', k === TH.slideI); });
  }
  function lastWatched() {
    return Object.keys(S.history).map(function (v) { return Object.assign({ vid: v }, S.history[v]); }).sort(function (a, b) { return b.at - a.at; });
  }
  function renderContinue() {
    var h = lastWatched()[0], el = $('th-continue');
    if (!h || !browsing()) { el.hidden = true; return; }
    LCDK.requestDramaByVid(h.vid).then(function (d) {
      el.hidden = false;
      el.setAttribute('data-vid', d.vid); el.setAttribute('data-ep', h.ep);
      el.innerHTML = '<span class="th-continue__img" style="background-image:url(\'' + esc(d.thumbnailSmallUrl || d.coverImage) + '\')"></span>' +
        '<span class="th-continue__main"><small>' + esc(T('theater.continue')) + '</small><b>' + esc(d.title) + '</b><span>' + esc(T('theater.epOf', { e: h.ep, n: d.total })) + '</span>' +
 '<span class="th-continue__bar" style="display:block"><i style="width:' + Math.round(h.ep / d.total * 100) + '%"></i></span></span>' +
        '<span class="btn btn--gold btn--square" style="width:44px;min-height:44px;font-size:18px">' + ico('play') + '</span>';
    }).catch(function () { el.hidden = true; });
  }
  function posterHtml(d, rank) {
    var tag = d.tags && d.tags[0] ? (d.tags[0].tagNameLanguage || d.tags[0].tagName) : '';
    var fresh = d.publishTime && (Date.now() - new Date(d.publishTime).getTime()) < 10 * 864e5;
    return '<button type="button" class="poster" data-vid="' + esc(d.vid) + '"><span class="poster__img" style="background-image:url(\'' + esc(d.thumbnailMediumUrl || d.coverImage) + '\')">' +
      (fresh && !rank ? '<span class="poster__flag">' + esc(T('common.new')) + '</span>' : '') +
      (rank ? '<span class="rank-n' + (rank <= 3 ? ' is-top' : '') + '">' + rank + '</span>' : '') +
      '<span class="poster__eps">' + esc(d.sType === 0 ? T('theater.ongoingEps', { n: d.total }) : T('theater.eps', { n: d.total })) + '</span></span><b>' + esc(d.title) + '</b><span>' + esc(rank ? T('theater.saves', { n: shortNum(d.totalCollectCount) }) : tag) + '</span></button>';
  }
  function renderRails() {
    var box = $('th-rails');
    if (!browsing()) { box.innerHTML = ''; return; }
    var seq = TH.seq;
    /* 每天轮换展示的 3 个分类货架 */
    var day = new Date().getDate(), cats = [];
    for (var i = 0; i < 3; i++) cats.push(RAIL_CATS[(day + i * 2) % RAIL_CATS.length]);
    var calls = [LCDK.requestDefaultDramasList(1, 10, { languageCodes: lc(), sort: 'hot' })].concat(cats.map(function (c) {
      return LCDK.requestDefaultDramasList(1, 10, { languageCodes: lc(), categoryCode: c, sort: 'hot' });
    }));
    Promise.all(calls).then(function (rs) {
      if (seq !== TH.seq || !browsing()) return;
      var html = '<section class="rail rail--rank"><div class="rail__head"><b>' + esc(T('theater.hot')) + '</b></div><div class="rail__row">' +
 (rs[0].list || []).map(function (d, i) { return posterHtml(d, i + 1); }).join('') + '</div></section>';
      cats.forEach(function (c, i) {
        var l = rs[i + 1].list || []; if (!l.length) return;
        html += '<section class="rail"><div class="rail__head"><b>' + esc(catName(c)) + '</b><button type="button" data-cat="' + esc(c) + '">' + esc(T('theater.seeAll', { n: rs[i + 1].total })) + '</button></div><div class="rail__row">' + l.map(function (d) { return posterHtml(d); }).join('') + '</div></section>';
      });
      box.innerHTML = html;
    }).catch(sdkError);
  }
  function loadGrid(reset) {
    if (reset) { TH.page = 1; TH.seq++; $('th-grid').innerHTML = ''; }
    var seq = TH.seq, opts = { languageCodes: lc(), categoryCode: TH.cat, sort: TH.sort };
    TH.loading = true;
    var p = TH.kw ? LCDK.searchDramas(TH.kw, TH.page, 12, opts) : LCDK.requestDefaultDramasList(TH.page, 12, opts);
    $('th-all-title').textContent = TH.cat ? catName(TH.cat) : T('theater.allShows');
    $('th-all-title').parentNode.hidden = !!TH.kw;
    p.then(function (r) {
      if (seq !== TH.seq) return;
      TH.loading = false;
      var list = r.list || [];
      TH.more = !!r.hasNextPage;
      $('th-results').hidden = !TH.kw;
      $('th-results').textContent = TH.kw ? T('theater.results', { k: TH.kw, n: r.total || list.length }) : '';
      $('th-empty').hidden = !(TH.page === 1 && !list.length);
      $('th-grid').insertAdjacentHTML('beforeend', list.map(function (d) { return posterHtml(d); }).join(''));
      $('th-more').hidden = false;
      $('th-more').textContent = TH.more ? T('theater.loading') : (list.length || TH.page > 1 ? T('theater.end', { n: r.total }) : '');
    }).catch(function (e) { TH.loading = false; sdkError(e); });
  }
  function maybeLoadMore() {
    var b = $('th-body');
    if (TH.more && !TH.loading && b.scrollTop + b.clientHeight > b.scrollHeight - 300) { TH.page += 1; loadGrid(false); }
  }
  function refreshTheater() { renderCats(); renderHero(); renderContinue(); renderRails(); loadGrid(true); }

  /* ---- 详情 ---- */
  var DT = null;
  function openDetail(vid) {
    LCDK.requestDramaByVid(vid).then(function (d) {
      DT = d;
      $('detail').hidden = false; $('detail').scrollTop = 0;
      renderDetail();
    }).catch(sdkError);
  }
  function renderDetail() {
    var d = DT; if (!d) return;
    var h = S.history[d.vid], ep = h ? h.ep : 1;
    $('dt-hero').style.backgroundImage = 'url("' + (d.thumbnailLargeUrl || d.coverImage) + '")';
    $('dt-title').textContent = d.title;
    var cat = d.categories && d.categories[0] ? (d.categories[0].categoryNameLanguage || d.categories[0].categoryName) : '';
    $('dt-meta').textContent = [cat, d.sType === 1 ? T('theater.done') : T('theater.ongoing'), T('theater.saves', { n: shortNum(d.totalCollectCount) }), d.publishTime ? T('detail.released', { d: d.publishTime }) : ''].filter(Boolean).join('  ·  ');
    $('dt-tags').innerHTML = (d.tags || []).map(function (t) { return '<span>' + esc(t.tagNameLanguage || t.tagName) + '</span>'; }).join('');
    $('dt-desc').textContent = d.desc || '';
    $('dt-play').innerHTML = ico('play') + esc(h ? T('detail.play', { e: ep }) : T('detail.start'));
    $('dt-play').setAttribute('data-ep', ep);
    $('dt-fav').classList.toggle('is-on', !!d.isCollected);
    $('dt-eps-title').textContent = T('detail.eps', { n: d.total });
    $('dt-eps').innerHTML = epsHtml(d, h ? h.ep : 0, h ? h.seen : []);
  }
  function epsHtml(d, cur, seen) {
    return (d.episodes || []).map(function (e) {
      return '<button type="button" class="ep' + (e.index === cur ? ' is-cur' : '') + ((seen || []).indexOf(e.index) >= 0 ? ' is-seen' : '') + '" data-ep="' + e.index + '">' + e.index + '</button>';
    }).join('');
  }
  function toggleFav(d, done) {
    var want = !d.isCollected;
    LCDK.userAction({ action: 'collect', vid: d.vid, status: want }).then(function () {
      return LCDK.requestDramaByVid(d.vid);
    }).then(function (f) {
      d.isCollected = f.isCollected; d.totalCollectCount = f.totalCollectCount;
      toast(T(want ? 'toast.saved' : 'toast.unsaved')); SFX.play('tap');
      if (done) done();
    }).catch(sdkError);
  }

  /* ============== 播放器 ==============
   * browse：剧场里正常追剧（看完一集游戏发 watchCoins 金币，每日上限）
   * reward：游戏里的奖励观看（翻倍 / 复活 / 体力 / 金币）——看完回调 cb(true)
   */
  var PL = { mode: 'browse', d: null, ep: 1, fileId: null, done: false, raf: null, reached: {}, cb: null, kind: null, nextT: null };
  function watchReward(kind, cb) {
    var d = TH.hot;
    var go2 = function (drama) {
      var h = S.history[drama.vid];
      var ep = h ? (h.done ? Math.min(drama.total, h.ep + 1) : h.ep) : 1;
      openPlayer('reward', drama, ep, cb, kind);
    };
    pauseEngine();
    if (d && d.episodes && d.episodes.length > 1) { go2(d); return; }
    LCDK.requestDefaultDramasList(1, 1, { languageCodes: lc(), sort: 'hot' }).then(function (r) {
      var first = (r.list || [])[0]; if (!first) throw new Error('empty');
      return LCDK.requestDramaByVid(first.vid);
    }).then(function (full) { TH.hot = full; go2(full); }).catch(function (e) { sdkError(e); cb(false); });
  }
  function openPlayer(mode, d, ep, cb, kind) {
    PL.mode = mode; PL.d = d; PL.cb = cb || null; PL.kind = kind || null;
    $('player').hidden = false;
    $('player').classList.toggle('is-reward', mode === 'reward');
    $('pl-side').hidden = mode === 'reward';
    $('pl-desc').hidden = mode === 'reward';
    SFX.duck(true);
    loadEp(ep);
  }
  function loadEp(ep) {
    clearTimeout(PL.nextT);
    var d = PL.d, v = $('video');
    PL.ep = ep; PL.done = false; PL.fileId = null; PL.reached = {};
    $('ep-sheet').hidden = true;
    $('pl-drama').textContent = d.title;
    $('pl-ep').textContent = T('player.ep', { e: ep, n: d.total });
    $('pl-desc').textContent = d.desc || '';
    $('pl-fill').style.width = '0%';
    $('pl-time').textContent = '00:00';
    var rw = $('pl-reward');
    if (PL.mode === 'reward') {
      rw.hidden = false; rw.innerHTML = ico('gift') + esc(T('player.rewardTip'));
      $('pl-hint').textContent = '';
    } else {
      var left = G.watchDailyLimit - S.watch.count;
      rw.hidden = left <= 0;
      rw.innerHTML = ico('coin') + '+' + G.watchCoins;
      $('pl-hint').textContent = '';
      renderSide();
    }
    v.muted = !S.settings.sound;
    LCDK.refreshPlayUrl(d.vid, [ep]).then(function (list) {
      if ($('player').hidden) return;
      var e = list && list[0]; if (!e) throw new Error('no url');
      PL.fileId = e.fileId;
      v.src = e.playInfoUrl; v.load();
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      LCDK.logPlayInfo(e.fileId, 'PLAY_START', 0);
      LCDK.userAction({ action: 'played', vid: d.vid, episode: ep }).catch(function () {});
      remember(d.vid, ep, false);
      loop();
    }).catch(function (e) { closePlayer(false); sdkError(e); });
  }
  function renderSide() {
    var d = PL.d, e = (d.episodes || []).filter(function (x) { return x.index === PL.ep; })[0] || {};
    $('pl-like').classList.toggle('is-on', !!e.isLiked);
    $('pl-like-n').textContent = shortNum(e.totalLikeCount || 0);
    $('pl-fav').classList.toggle('is-on', !!d.isCollected);
    $('pl-fav-l').textContent = d.isCollected ? T('detail.saved') : T('detail.save');
  }
  function remember(vid, ep, done) {
    var h = S.history[vid] || { seen: [] };
    h.ep = ep; h.at = Date.now(); h.done = done;
    if (done && h.seen.indexOf(ep) < 0) h.seen.push(ep);
    S.history[vid] = h; save();
  }
  function loop() {
    cancelAnimationFrame(PL.raf);
    var step = function () {
      if ($('player').hidden) return;
      var v = $('video'), dur = v.duration && isFinite(v.duration) ? v.duration : 0, t = v.currentTime || 0;
      if (dur && !PL.done) {
        var pct = t / dur * 100;
        $('pl-fill').style.width = pct.toFixed(2) + '%';
        $('pl-time').textContent = mmss(t * 1000) + ' / ' + mmss(dur * 1000);
 [25, 50, 75].forEach(function (m) { if (!PL.reached[m] && pct >= m) { PL.reached[m] = true; LCDK.logPlayInfo(PL.fileId, m, Math.round(t * 1000)); } });
 if (pct >= 97 || v.ended) finishEp();
      }
      PL.raf = requestAnimationFrame(step);
    };
    PL.raf = requestAnimationFrame(step);
  }
  function finishEp() {
    if (PL.done) return;
    PL.done = true;
    var v = $('video');
    try { v.pause(); } catch (e) { /* ignore */ }
    $('pl-fill').style.width = '100%';
    LCDK.logPlayInfo(PL.fileId, 'PLAY_END', Math.round((v.currentTime || 0) * 1000));
    remember(PL.d.vid, PL.ep, true);
    taskProgress('watch2', 1);
    if (PL.mode === 'reward') {
      $('pl-reward').innerHTML = ico('check') + esc(T('player.rewardGot'));
      SFX.play('win');
      var cb = PL.cb; PL.cb = null;
      setTimeout(function () { closePlayer(true); if (cb) cb(true); }, 700);
      return;
    }
    rollDay();
    if (S.watch.count < G.watchDailyLimit) {
      S.watch.count += 1; save();
      addCoins(G.watchCoins, $('pl-reward'));
      if (S.watch.count >= G.watchDailyLimit) $('pl-reward').hidden = true;
    }
    if (PL.ep < PL.d.total) PL.nextT = setTimeout(function () { if (!$('player').hidden) loadEp(PL.ep + 1); }, 1200);
    else toast(T('player.last'));
  }
  function requestClosePlayer() {
    if (PL.mode !== 'reward' || PL.done) { closePlayer(false); return; }
    var v = $('video'); try { v.pause(); } catch (e) { /* ignore */ }
    openModal({
      ribbon: T('player.quitTitle'),
      body: '<p>' + esc(T('player.quitBody')) + '</p>',
      acts: [
        { cls: 'btn--gold', text: T('player.keep'), on: function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); } },
 { cls: 'link', text: T('player.quit'), on: function () { var cb = PL.cb; PL.cb = null; closePlayer(false); toast(T('toast.notDone')); if (cb) cb(false); } }
      ],
      noClose: true
    });
  }
  function closePlayer(finished) {
    clearTimeout(PL.nextT); cancelAnimationFrame(PL.raf);
    var v = $('video');
    try { v.pause(); } catch (e) { /* ignore */ }
    if (PL.fileId && !PL.done) LCDK.logPlayInfo(PL.fileId, 'PLAY_END', Math.round((v.currentTime || 0) * 1000));
    v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ }
    $('player').hidden = true;
    SFX.duck(false);
    if (PL.mode === 'browse') {
      if (!$('detail').hidden && DT) LCDK.requestDramaByVid(DT.vid).then(function (d) { DT = d; renderDetail(); }).catch(function () {});
      if (screen === 'theater') renderContinue();
      if (screen === 'me') renderMe();
    }
  }

  /* ============== 任务 / 签到 ============== */
  var TASKS = [
    { id: 'play3', goal: 3, coins: 150, ico: 'play' },
    { id: 'lines30', goal: 30, coins: 200, ico: 'list' },
    { id: 'score5k', goal: 5000, coins: 250, ico: 'trophy' },
    { id: 'watch2', goal: 2, coins: 200, gems: 10, ico: 'film', film: true },
    { id: 'bomb', goal: 1, coins: 80, ico: 'bomb' }
  ];
  function renderTasks() {
    rollDay(); renderTop();
    var streak = S.checkin.streak, checked = S.checkin.last === today();
    var idx = checked ? (streak - 1) % 7 : streak % 7;
    $('streak').innerHTML = '<div class="streak__head"><b>' + esc(T('tasks.streak')) + '</b><span>' + esc(T('tasks.streakDays', { n: streak })) + '</span></div><div class="streak__days">' +
      G.checkin.map(function (r, i) {
        var done = i < idx || (checked && i === idx), isToday = !checked && i === idx;
        var gem = typeof r === 'object';
        return '<div class="day' + (done ? ' is-done' : '') + (isToday ? ' is-today' : '') + '">' + esc(T('tasks.day', { n: i + 1 })) + ico(gem ? 'gem' : 'coin') + '<b>' + (gem ? r.gems : r) + '</b></div>';
      }).join('') + '</div>' +
      (checked ? '' : '<button type="button" class="btn btn--gold btn--block" id="checkin-btn" style="margin-top:12px">' + esc(T('tasks.checkin')) + '</button>');
    $('task-list').innerHTML = TASKS.map(function (t) {
      var p = Math.min(t.goal, S.tasks.p[t.id] || 0), claimed = !!S.tasks.claimed[t.id], ready = p >= t.goal && !claimed;
      var btn = claimed ? '<button type="button" class="btn btn--ghost btn--sm" disabled>' + ico('check') + '</button>'
        : ready ? '<button type="button" class="btn btn--gold btn--sm" data-claim="' + t.id + '">' + esc(T('common.claim')) + '</button>'
        : '<button type="button" class="btn btn--purple btn--sm" data-gotask="' + t.id + '">' + esc(T('common.go')) + '</button>';
      return '<div class="task' + (claimed ? ' is-claimed' : '') + '"><span class="task__ico' + (t.film ? ' task__ico--film' : '') + '">' + ico(t.ico) + '</span>' +
        '<div class="task__main"><b>' + esc(T('task.' + t.id)) + '</b><div class="task__bar"><i style="width:' + (p / t.goal * 100) + '%"></i><span>' + fmt(p) + ' / ' + fmt(t.goal) + '</span></div>' +
 '<span class="task__rw">' + ico('coin') + t.coins + (t.gems ? '&nbsp;' + ico('gem') + t.gems : '') + '</span></div>' + btn + '</div>';
    }).join('');
  }
  function claimTask(id, el) {
    var t = TASKS.filter(function (x) { return x.id === id; })[0];
    if (!t || S.tasks.claimed[id]) return;
    S.tasks.claimed[id] = true;
    if (t.gems) S.gems += t.gems;
    save(); addCoins(t.coins, el); renderTasks(); renderDots();
  }
  function checkin(el) {
    if (S.checkin.last === today()) return;
    var y = new Date(Date.now() - 864e5);
    var ystr = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    S.checkin.streak = S.checkin.last === ystr ? S.checkin.streak + 1 : 1;
    S.checkin.last = today();
    var r = G.checkin[(S.checkin.streak - 1) % 7];
    save();
    if (typeof r === 'object') { S.gems += r.gems; save(); renderTop(true); SFX.play('win'); } else addCoins(r, el);
    toast(T('toast.checked'));
    renderDots();
    if (screen === 'tasks') renderTasks();
  }

  /* ============== 商店 ============== */
  var shopTab = 'items';
  function skinById(id) { return G.skins.filter(function (s) { return s.id === id; })[0] || G.skins[0]; }
  function renderShop() {
    renderTop();
    qsa('#shop-tabs button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-tab') === shopTab); });
    var g = $('shop-grid'), html = '';
    if (shopTab === 'items') {
      html += '<div class="item item--wide"><span class="item__tag">' + esc(T('item.limited')) + '</span><span class="item__art">' + ico('gift') + '</span><div><b>' + esc(T('item.pack')) + '</b><p>' + esc(T('item.packDesc')) + '</p></div><button type="button" class="btn btn--mint btn--sm" data-iap="pack">' + esc(T('iap.p1')) + '</button></div>';
      [['bomb', G.bombPrice], ['slow', G.slowPrice]].forEach(function (it) {
        html += '<div class="item"><span class="item__tag item__tag--mint">×' + S.items[it[0]] + '</span><span class="item__art">' + ico(it[0] === 'bomb' ? 'bomb' : 'clock') + '</span><b>' + esc(T('item.' + it[0])) + '</b><p>' + esc(T('item.' + it[0] + 'Desc')) + '</p>' +
          '<button type="button" class="btn btn--gold btn--sm" data-buy="' + it[0] + '"><span class="price">' + ico('coin') + fmt(it[1]) + '</span></button></div>';
      });
    } else if (shopTab === 'skins') {
      G.skins.forEach(function (sk) {
 var owned = S.skins.indexOf(sk.id) >= 0, inUse = S.skin === sk.id;
 var btn = inUse ? '<button type="button" class="btn btn--ghost btn--sm" disabled>' + esc(T('skin.inUse')) + '</button>'
   : owned ? '<button type="button" class="btn btn--purple btn--sm" data-equip="' + sk.id + '">' + esc(T('skin.equip')) + '</button>'
   : '<button type="button" class="btn btn--gold btn--sm" data-skin="' + sk.id + '"><span class="price">' + ico(sk.currency === 'gems' ? 'gem' : 'coin') + fmt(sk.price) + '</span></button>';
        html += '<div class="item"><span class="item__art"><canvas data-skin-prev="' + sk.id + '" width="192" height="128"></canvas></span><b>' + esc(T('skin.' + sk.id)) + '</b>' + btn + '</div>';
      });
    } else {
      var left = G.watchDailyLimit - S.watch.count;
      html += '<div class="item item--wide"><span class="item__art" style="color:#FF5E9C">' + ico('film') + '</span><div><b>' + esc(T('coins.free')) + ' · +' + G.watchCoins + '</b><p>' + esc(T('coins.leftToday', { n: left })) + '</p></div>' +
        '<button type="button" class="btn btn--pink btn--sm" data-freecoins' + (left <= 0 ? ' disabled' : '') + '>' + esc(T('common.free')) + '</button></div>';
      [[500, 'p1', 0], [3000, 'p2', 'x'], [8000, 'p3', '+30%']].forEach(function (c, i) {
 html += '<div class="item' + (i === 0 ? '' : '') + '">' + (c[2] ? '<span class="item__tag">' + (c[2] === 'x' ? '🔥' : c[2]) + '</span>' : '') + '<span class="item__art">' + ico('coin') + '</span><b>' + fmt(c[0]) + '</b><p>' + esc(T('iap.note')) + '</p><button type="button" class="btn btn--mint btn--sm" data-iap="' + c[1] + '">' + esc(T('iap.' + c[1])) + '</button></div>';
      });
    }
    g.innerHTML = html;
    qsa('canvas[data-skin-prev]', g).forEach(drawSkinPreview);
  }
  function drawSkinPreview(cv) {
    var sk = skinById(cv.getAttribute('data-skin-prev'));
    var r = new NS.Renderer(cv, null);
    r.setSkin(sk);
    var ctx = cv.getContext('2d'), s = 30;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var cells = [[0, 2, 'J'], [1, 2, 'J'], [2, 2, 'O'], [3, 2, 'O'], [4, 2, 'S'], [5, 2, 'I'], [1, 1, 'T'], [2, 1, 'O'], [3, 1, 'O'], [4, 1, 'S'], [5, 1, 'I'], [2, 0, 'L'], [4, 0, 'Z'], [5, 0, 'I']];
    cells.forEach(function (c) { r.drawCell(ctx, 6 + c[0] * s, 20 + c[1] * s, s, r.colorOf(c[2]), {}); });
  }

  /* ======= 我 ============== */
  function renderMe() {
    renderTop();
    $('me-lv').textContent = T('me.lv', { n: S.level, x: G.xpPerLevel - S.xp });
    $('me-xp').style.width = (S.xp / G.xpPerLevel * 100) + '%';
    var best = Math.max(S.best.classic || 0, S.best.blitz || 0, S.best.daily || 0);
    $('me-stats').innerHTML = '<div><b>' + fmt(S.games) + '</b><span>' + esc(T('me.games')) + '</span></div><div><b>' + fmt(best) + '</b><span>' + esc(T('me.best')) + '</span></div><div><b>' + fmt(S.lines) + '</b><span>' + esc(T('me.lines')) + '</span></div>';
    var hist = lastWatched().slice(0, 10);
    var empty = '<p class="empty">' + esc(T('me.empty')) + '</p>';
    if (!hist.length) $('me-history').innerHTML = empty;
    else LCDK.requestDefaultDramasList(1, 20, { languageCodes: lc(), vids: hist.map(function (h) { return h.vid; }) }).then(function (r) {
      var by = {}; (r.list || []).forEach(function (d) { by[d.vid] = d; });
      $('me-history').innerHTML = hist.map(function (h) {
 var d = by[h.vid]; if (!d) return '';
        return '<button type="button" class="poster" data-vid="' + esc(d.vid) + '" data-ep="' + h.ep + '"><span class="poster__img" style="background-image:url(\'' + esc(d.thumbnailSmallUrl || d.coverImage) + '\')"><span class="poster__eps">' + h.ep + '/' + d.total + '</span></span><b>' + esc(d.title) + '</b><span class="mini-bar"><i style="width:' + Math.round(h.ep / d.total * 100) + '%"></i></span></button>';
      }).join('');
    }).catch(sdkError);
    LCDK.getFavList(1, 20).then(function (r) {
      var l = r.list || [];
      $('me-favs').innerHTML = l.length ? l.map(function (d) { return posterHtml(d); }).join('') : empty;
    }).catch(sdkError);
  }

  /* ============== 设置 / 排行 / 开发者 ======= */
  function toggleRow(k) {
    return '<div class="set-row"><span>' + esc(T('set.' + k)) + '</span><button type="button" class="switch' + (S.settings[k] ? ' is-on' : '') + '" data-toggle="' + k + '" role="switch" aria-checked="' + !!S.settings[k] + '" aria-label="' + esc(T('set.' + k)) + '"></button></div>';
  }
  var verTaps = 0, verTimer = null;
  function settingsModal() {
    openModal({
      ribbon: T('set.title'),
      body: '<div class="set-list">' + toggleRow('sound') + toggleRow('music') + toggleRow('haptic') +
        '<div class="set-row"><span>' + esc(T('set.lang')) + '</span><div class="seg"><button type="button" data-lang="zh"' + (I18N.lang === 'zh' ? ' class="is-on"' : '') + '>中文</button><button type="button" data-lang="en"' + (I18N.lang === 'en' ? ' class="is-on"' : '') + '>English</button></div></div>' +
        '<button type="button" class="set-row" data-legal>' + '<span>' + esc(T('set.privacy')) + '</span>' + ico('back').replace('<svg>', '<svg style="transform:rotate(180deg)">') + '</button>' +
        '<button type="button" class="set-row" data-legal><span>' + esc(T('set.terms')) + '</span>' + ico('back').replace('<svg>', '<svg style="transform:rotate(180deg)">') + '</button>' +
        (S.dev ? '<button type="button" class="set-row" data-dev><span>' + esc(T('dev.title')) + '</span>' + ico('back').replace('<svg>', '<svg style="transform:rotate(180deg)">') + '</button>' : '') +
        '<button type="button" class="set-row" data-reset style="color:#FF8A96"><span>' + esc(T('set.reset')) + '</span></button>' +
        '</div><button type="button" class="version" data-ver>' + esc(T('set.version', { v: CFG.version })) + '</button>',
      onClick: function (e) {
        var tg = e.target.closest('[data-toggle]');
 if (tg) { var k = tg.getAttribute('data-toggle'); S.settings[k] = !S.settings[k]; SFX.set(k, S.settings[k]); save(); tg.classList.toggle('is-on', S.settings[k]); tg.setAttribute('aria-checked', S.settings[k]); SFX.play('tap'); return; }
 var lb = e.target.closest('[data-lang]');
        if (lb) { I18N.setLang(lb.getAttribute('data-lang')); settingsModal(); return; }
        if (e.target.closest('[data-legal]')) { toast(T('toast.privacy')); return; }
        if (e.target.closest('[data-dev]')) { devModal(); return; }
        if (e.target.closest('[data-reset]')) { if (window.confirm(T('set.resetConfirm'))) { localStorage.removeItem(G.storeKey); if (window.LAAFFICMockGateway) window.LAAFFICMockGateway.reset(); location.reload(); } return; }
 if (e.target.closest('[data-ver]')) {
   verTaps += 1; clearTimeout(verTimer); verTimer = setTimeout(function () { verTaps = 0; }, 1500);
   if (verTaps >= 5 && !S.dev) { S.dev = true; save(); toast(T('dev.unlocked')); settingsModal(); }
        }
      }
    });
  }
  function devModal() {
    var logs = LCDK.getApiLogs().slice().reverse().slice(0, 80);
    openModal({
      ribbon: T('dev.title'),
      body: '<p style="text-align:left">' + esc(T('dev.body')) + '</p><div class="dev-log">' + (logs.length ? logs.map(function (r) {
 return '<div><span>' + esc(r.time) + '</span><span class="' + (r.status === 'success' ? 'ok' : 'err') + '">POST ' + esc(r.path) + '</span><span>' + esc(r.code == null ? '-' : r.code) + ' · ' + esc(r.durationMs) + 'ms</span></div>';
      }).join('') : '<p>' + esc(T('dev.empty')) + '</p>') + '</div>'
    });
  }
  function rankModal() {
    var me = Math.max(S.best.classic || 0, S.best.blitz || 0);
    var rows = [['Mia', 48210], ['阿杰', 41560], ['Leo', 38900], ['Hana', 30120], ['小鱼', 26750], ['Kai', 21400], ['Nora', 18230], ['Tom', 15600]];
    rows.push([T('rank.me'), me, true]);
    rows.sort(function (a, b) { return b[1] - a[1]; });
    openModal({
      ribbon: T('rank.title'), ribbonGold: true,
      body: '<div class="rank">' + rows.map(function (r, i) { return '<div' + (r[2] ? ' class="is-me"' : '') + '><i>' + (i + 1) + '</i><span>' + esc(r[0]) + '</span><b>' + fmt(r[1]) + '</b></div>'; }).join('') + '</div>'
    });
  }

  /* ============== 事件 ======= */
  function on(el, ev, fn) { el.addEventListener(ev, fn); }
  function delegate(root, sel, fn) { on(root, 'click', function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(t, e); }); }
  function bind() {
    document.addEventListener('pointerdown', function () { SFX.unlock(); if (S.settings.music && screen === 'game' && Game.running) SFX.startMusic(); }, { once: true });
    delegate(document, '[data-go]', function (b) { SFX.play('tap'); go(b.getAttribute('data-go')); });
    on($('tb-settings'), 'click', function () { SFX.play('tap'); settingsModal(); });
    on($('tb-avatar'), 'click', function () { SFX.play('tap'); go('me'); });
    delegate($('modes'), '[data-mode]', function (b) {
      var m = MODES.filter(function (x) { return x.id === b.getAttribute('data-mode'); })[0];
      if (S.level < m.lv) { SFX.play('error'); toast(T('mode.lockLv', { n: m.lv })); return; }
      S.mode = m.id; save(); SFX.play('tap'); renderHome();
    });
    on($('play-btn'), 'click', function () { SFX.play('tap'); startRun(); });
    on($('checkin-open'), 'click', function () { SFX.play('tap'); go('tasks'); });
    on($('rank-open'), 'click', function () { SFX.play('tap'); rankModal(); });
    on($('pause-btn'), 'click', function () { SFX.play('tap'); pauseGame(); });
    on($('pw-bomb'), 'click', function () { usePower('bomb'); });
    on($('pw-slow'), 'click', function () { usePower('slow'); });
    on($('pw-rot'), 'click', function () { if (playable() && engine.rotate(1)) SFX.play('rotate'); });

    /* 剧场 */
    delegate($('th-body'), '[data-cat]', function (b) { TH.cat = b.getAttribute('data-cat'); SFX.play('tap'); $('th-body').scrollTop = 0; refreshTheater(); });
    delegate($('th-sort'), '[data-sort]', function (b) { TH.sort = b.getAttribute('data-sort'); qsa('#th-sort button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); SFX.play('tap'); loadGrid(true); });
    delegate($('th-body'), '.poster', function (p) { SFX.play('tap'); openDetail(p.getAttribute('data-vid')); });
    delegate($('th-hero'), '.th-slide', function (sl) { SFX.play('tap'); openDetail(sl.getAttribute('data-vid')); });
    on($('th-body'), 'scroll', maybeLoadMore);
    (function () {
      var x0 = null;
      on($('th-hero'), 'touchstart', function (e) { x0 = e.touches[0].clientX; clearInterval(TH.slideT); }, { passive: true });
      on($('th-hero'), 'touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) slideTo(TH.slideI + (dx < 0 ? 1 : -1)); x0 = null; TH.slideT = setInterval(function () { slideTo(TH.slideI + 1); }, 4200); });
    })();
    on($('th-continue'), 'click', function () {
      var v = this.getAttribute('data-vid'), ep = Number(this.getAttribute('data-ep')) || 1;
      LCDK.requestDramaByVid(v).then(function (d) { openPlayer('browse', d, ep); }).catch(sdkError);
    });
    var sTimer = null;
    on($('th-search'), 'input', function () { var v = this.value.trim(); clearTimeout(sTimer); sTimer = setTimeout(function () { TH.kw = v; refreshTheater(); }, 300); });
    on($('th-search'), 'keydown', function (e) { if (e.key === 'Enter') { clearTimeout(sTimer); TH.kw = this.value.trim(); refreshTheater(); this.blur(); } });

    /* 详情 */
    on($('dt-back'), 'click', function () { $('detail').hidden = true; DT = null; if (screen === 'theater') renderContinue(); });
    on($('dt-play'), 'click', function () { if (DT) openPlayer('browse', DT, Number(this.getAttribute('data-ep')) || 1); });
    on($('dt-fav'), 'click', function () { if (DT) toggleFav(DT, renderDetail); });
    delegate($('dt-eps'), '.ep', function (b) { if (DT) openPlayer('browse', DT, Number(b.getAttribute('data-ep'))); });

    /* 播放器 */
    on($('pl-close'), 'click', requestClosePlayer);
    on($('pl-like'), 'click', function () {
      var d = PL.d, e = (d.episodes || []).filter(function (x) { return x.index === PL.ep; })[0]; if (!e) return;
      var want = !e.isLiked;
      LCDK.userAction({ action: 'like', vid: d.vid, episode: PL.ep, status: want }).then(function () {
        e.isLiked = want; e.totalLikeCount = Math.max(0, (e.totalLikeCount || 0) + (want ? 1 : -1)); renderSide(); SFX.play('tap');
      }).catch(sdkError);
    });
    on($('pl-fav'), 'click', function () { toggleFav(PL.d, renderSide); });
    on($('pl-list'), 'click', function () { var h = S.history[PL.d.vid]; $('ep-sheet-eps').innerHTML = epsHtml(PL.d, PL.ep, h ? h.seen : []); $('ep-sheet').hidden = false; });
    on($('ep-sheet-x'), 'click', function () { $('ep-sheet').hidden = true; });
    delegate($('ep-sheet-eps'), '.ep', function (b) { loadEp(Number(b.getAttribute('data-ep'))); });
    on($('video'), 'ended', function () { if (!$('player').hidden) finishEp(); });

    /* 任务 */
    on($('scr-tasks'), 'click', function (e) {
      var c = e.target.closest('[data-claim]'); if (c) { SFX.play('tap'); claimTask(c.getAttribute('data-claim'), c); return; }
      if (e.target.closest('#checkin-btn')) { SFX.play('tap'); checkin(e.target.closest('#checkin-btn')); return; }
      var g = e.target.closest('[data-gotask]');
      if (g) { SFX.play('tap'); go(g.getAttribute('data-gotask') === 'watch2' ? 'theater' : 'home'); }
    });

    /* 商店 */
    delegate($('shop-tabs'), '[data-tab]', function (b) { shopTab = b.getAttribute('data-tab'); SFX.play('tap'); renderShop(); });
    on($('shop-grid'), 'click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      SFX.play('tap');
      if (b.hasAttribute('data-buy')) {
        var k = b.getAttribute('data-buy'), price = k === 'bomb' ? G.bombPrice : G.slowPrice;
 if (spend('coins', price)) { S.items[k] += 1; save(); SFX.play('buy'); toast(T('toast.bought')); renderShop(); }
      } else if (b.hasAttribute('data-skin')) {
        var sk = skinById(b.getAttribute('data-skin'));
        if (spend(sk.currency === 'gems' ? 'gems' : 'coins', sk.price)) { S.skins.push(sk.id); S.skin = sk.id; save(); SFX.play('buy'); toast(T('toast.equipped', { n: T('skin.' + sk.id) })); renderShop(); }
      } else if (b.hasAttribute('data-equip')) {
        S.skin = b.getAttribute('data-equip'); save(); toast(T('toast.equipped', { n: T('skin.' + S.skin) })); renderShop();
      } else if (b.hasAttribute('data-freecoins')) {
        watchReward('coins', function (ok) { if (ok) { rollDay(); S.watch.count += 1; save(); addCoins(G.watchCoins, null); } if (screen === 'shop') renderShop(); });
      } else if (b.hasAttribute('data-iap')) {
 toast(T('iap.note'));
      }
    });

    /* 我 */
    delegate($('me-history'), '.poster', function (p) {
      var ep = Number(p.getAttribute('data-ep')) || 1;
      LCDK.requestDramaByVid(p.getAttribute('data-vid')).then(function (d) { openPlayer('browse', d, ep); }).catch(sdkError);
    });
    delegate($('me-favs'), '.poster', function (p) { openDetail(p.getAttribute('data-vid')); });

    I18N.onChange(function (l) {
      LCDK.setLanguage(l);
      TH.lang = null; TH.cat = '';
      if (screen === 'home') renderHome();
      if (screen === 'tasks') renderTasks();
      if (screen === 'shop') renderShop();
      if (screen === 'me') renderMe();
      if (screen === 'theater') openTheater();
      if (screen === 'game') renderHud();
      preloadContent().catch(function () {});
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && screen === 'game' && Game.running && engine.state === 'running') pauseGame(); });
    setInterval(function () { tickEnergy(); }, 5000);
  }

  /* ============== 测试入口（QA 脚本使用） ============== */
  function installTestApi() {
    window.__DEMO__ = {
      state: function () { return { screen: screen, engine: engine && engine.state, score: engine && engine.score, save: JSON.parse(JSON.stringify(S)), modal: !!modalState, player: !$('player').hidden, mode: PL.mode }; },
      go: go, start: startRun, settings: settingsModal, dev: devModal,
      over: function () { engine.gameOver(); },
      endVideo: function () { var v = $('video'); try { v.currentTime = Math.max(0, (v.duration || 30) - 0.2); } catch (e) { /* ignore */ } },
      openDetail: openDetail, apiLogs: function () { return LCDK.getApiLogs(); },
      setLang: function (l) { I18N.setLang(l); },
      pile: function () { engine.debugPileUp(); }
    };
  }

  /* ============== 启动 ============== */
  function boot() {
    load();
    I18N.apply();
    ['sound', 'music', 'haptic'].forEach(function (k) { SFX.set(k, S.settings[k]); });
    SFX.stopMusic();
    createEngine();
    setupRenderer();
    bind();
    bindGestures();
    bindModal();
    installTestApi();
    tickEnergy();
    requestAnimationFrame(frame);
    splash();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();




})();
