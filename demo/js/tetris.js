/* ============================================================================
 * NEON STACK · 俄罗斯方块引擎（10×20 / 7 种方块 / SRS 近似旋转 + 踢墙）
 * ----------------------------------------------------------------------------
 * 纯逻辑 + Canvas 渲染，不依赖 SDK。供 js/app.js 消费。
 * 计分：单行 100 / 双行 300 / 三行 500 / 四行 800 × 等级；软降 +1/格，硬降 +2/格。
 * 等级：每 10 行升 1 级，起始 800ms，最快 120ms。
 * ==========================================================================*/
(function (global) {
  'use strict';

  var COLS = 10;
  var ROWS = 20;

  var PIECES = {
    I: { color: '#3FD4FF', spawnX: 3, mat: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { color: '#FFC83D', spawnX: 4, mat: [[1, 1], [1, 1]] },
    T: { color: '#B067FF', spawnX: 3, mat: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { color: '#5BE36A', spawnX: 3, mat: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { color: '#FF5A6A', spawnX: 3, mat: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { color: '#4D7CFF', spawnX: 3, mat: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { color: '#FF9A3D', spawnX: 3, mat: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] }
  };
  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  /* SRS 近似踢墙：先原地，再左右，再向上抬一格（街机手感，宽容度略高于标准） */
  var KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
  var I_KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [-1, -1], [1, -1], [0, -1]];

  var LINE_SCORES = { 1: 100, 2: 300, 3: 500, 4: 800 };
  var START_INTERVAL = 800;
  var FASTEST_INTERVAL = 120;
  var LEVEL_STEP_MS = 75;
  var LOCK_DELAY = 460;
  var CLEAR_MS = 190;
  var SLOW_FACTOR = 1.6;

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      b.push(row);
    }
    return b;
  }
  function cloneMatrix(m) {
    var out = [];
    for (var i = 0; i < m.length; i++) out.push(m[i].slice());
    return out;
  }
  function rotateCW(m) {
    var n = m.length, out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) out[r].push(m[n - 1 - c][r] ? 1 : 0);
    }
    return out;
  }
  function rotateCCW(m) {
    var n = m.length, out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) out[r].push(m[c][n - 1 - r] ? 1 : 0);
    }
    return out;
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ============================== Engine ============================== */
  function Engine(opts) {
    opts = opts || {};
    this.onScore = opts.onScore || null;
    this.onLines = opts.onLines || null;
    this.onLevelUp = opts.onLevelUp || null;
    this.onGameOver = opts.onGameOver || null;
    this.onLock = opts.onLock || null;
    this.onSpawn = opts.onSpawn || null;
    this.board = emptyBoard();
    this.current = null;
    this.bag = [];
    this.nextType = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.revivesUsed = 0;
    this.maxRevives = opts.maxRevives || 2;
    this.state = 'idle'; // idle | running | paused | clearing | over
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.clearTimer = 0;
    this.clearingRows = [];
    this.slowUntil = 0;
    this.lastLock = null;
    this.lastClear = null;
    this.startedAt = 0;
  }

  Engine.prototype.getInterval = function () {
    var base = Math.max(FASTEST_INTERVAL, START_INTERVAL - (this.level - 1) * LEVEL_STEP_MS);
    if (this.slowUntil && Date.now() < this.slowUntil) base *= SLOW_FACTOR;
    return base;
  };

  Engine.prototype.reset = function () {
    this.board = emptyBoard();
    this.current = null;
    this.bag = [];
    this.nextType = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.revivesUsed = 0;
    this.state = 'idle';
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.clearTimer = 0;
    this.clearingRows = [];
    this.slowUntil = 0;
    this.lastLock = null;
    this.lastClear = null;
    this.startedAt = 0;
  };

  Engine.prototype.refillBag = function () {
    this.bag = shuffle(TYPES.slice());
  };

  Engine.prototype.takeFromBag = function () {
    if (!this.bag.length) this.refillBag();
    return this.bag.shift();
  };

  Engine.prototype.start = function () {
    this.reset();
    this.state = 'running';
    this.startedAt = Date.now();
    this.nextType = this.takeFromBag();
    this.spawn();
  };

  Engine.prototype.spawn = function (type) {
    var t = type || this.nextType || this.takeFromBag();
    if (!type) this.nextType = this.takeFromBag();
    this.current = {
      type: t,
      m: cloneMatrix(PIECES[t].mat),
      x: PIECES[t].spawnX,
      y: 0
    };
    this.dropAcc = 0;
    this.lockAcc = 0;
    if (this.collides(this.current.m, this.current.x, this.current.y)) {
      this.current = null;
      this.gameOver();
      return false;
    }
    if (this.onSpawn) this.onSpawn(this.current, this.nextType);
    return true;
  };

  Engine.prototype.collides = function (m, px, py) {
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && this.board[y][x]) return true;
      }
    }
    return false;
  };

  Engine.prototype.canMove = function (dx, dy) {
    if (!this.current) return false;
    return !this.collides(this.current.m, this.current.x + dx, this.current.y + dy);
  };

  Engine.prototype.getCells = function (piece) {
    var p = piece || this.current, out = [];
    if (!p) return out;
    for (var r = 0; r < p.m.length; r++) {
      for (var c = 0; c < p.m[r].length; c++) {
        if (p.m[r][c]) out.push({ x: p.x + c, y: p.y + r });
      }
    }
    return out;
  };

  Engine.prototype.move = function (dx) {
    if (this.state !== 'running' || !this.current) return false;
    if (!this.collides(this.current.m, this.current.x + dx, this.current.y)) {
      this.current.x += dx;
      if (!this.canMove(0, 1)) this.lockAcc = Math.min(this.lockAcc, LOCK_DELAY * 0.5);
      return true;
    }
    return false;
  };

  Engine.prototype.rotate = function (dir) {
    if (this.state !== 'running' || !this.current) return false;
    if (this.current.type === 'O') return false;
    var m = dir < 0 ? rotateCCW(this.current.m) : rotateCW(this.current.m);
    var kicks = this.current.type === 'I' ? I_KICKS : KICKS;
    for (var i = 0; i < kicks.length; i++) {
      var nx = this.current.x + kicks[i][0];
      var ny = this.current.y + kicks[i][1];
      if (!this.collides(m, nx, ny)) {
        this.current.m = m;
        this.current.x = nx;
        this.current.y = ny;
        this.lockAcc = 0;
        return true;
      }
    }
    return false;
  };

  Engine.prototype.softDrop = function () {
    if (this.state !== 'running' || !this.current) return false;
    if (this.canMove(0, 1)) {
      this.current.y += 1;
      this.score += 1;
      this.dropAcc = 0;
      this.lockAcc = 0;
      if (this.onScore) this.onScore(this.score, 1);
      return true;
    }
    this.lockAcc = LOCK_DELAY;
    this.lock();
    return false;
  };

  Engine.prototype.hardDrop = function () {
    if (this.state !== 'running' || !this.current) return false;
    var cells = 0;
    while (this.canMove(0, 1)) { this.current.y += 1; cells++; }
    this.score += cells * 2;
    if (this.onScore) this.onScore(this.score, cells * 2);
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.lock();
    return true;
  };

  Engine.prototype.update = function (dt) {
    if (this.state === 'clearing') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishClear();
      return;
    }
    if (this.state !== 'running' || !this.current) return;

    var interval = this.getInterval();
    this.dropAcc += dt;
    var guard = 0;
    while (this.dropAcc >= interval && this.state === 'running' && guard++ < 8) {
      this.dropAcc -= interval;
      if (this.canMove(0, 1)) {
        this.current.y += 1;
        this.lockAcc = 0;
      }
    }
    if (this.state !== 'running' || !this.current) return;

    if (!this.canMove(0, 1)) {
      this.lockAcc += dt;
      if (this.lockAcc >= LOCK_DELAY) this.lock();
    } else {
      this.lockAcc = 0;
    }
  };

  Engine.prototype.lock = function () {
    if (!this.current) return;
    var p = this.current;
    var cells = this.getCells(p);
    var topLocked = false;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.y < 0) { topLocked = true; continue; }
      this.board[cell.y][cell.x] = p.type;
    }
    var cr = 0, cc = 0;
    for (var k = 0; k < cells.length; k++) { cr += cells[k].y; cc += cells[k].x; }
    this.lastLock = { r: Math.round(cr / cells.length), c: Math.round(cc / cells.length), type: p.type };
    if (this.onLock) this.onLock(p, this.lastLock);
    this.current = null;

    var full = [];
    for (var r = 0; r < ROWS; r++) {
      var complete = true;
      for (var c2 = 0; c2 < COLS; c2++) {
        if (!this.board[r][c2]) { complete = false; break; }
      }
      if (complete) full.push(r);
    }

    if (full.length) {
      this.state = 'clearing';
      this.clearingRows = full;
      this.clearTimer = CLEAR_MS;
      this.lastClear = { rows: full, colors: full.map(function (row) { return this.board[row].slice(); }, this) };
      if (this.onLines) this.onLines(full, this.lastClear.colors);
      return;
    }
    if (topLocked) { this.gameOver(); return; }
    this.spawn();
  };

  Engine.prototype.finishClear = function () {
    var n = this.clearingRows.length;
    if (!n) { this.state = 'running'; this.spawn(); return; }
    var kept = [];
    for (var r = 0; r < ROWS; r++) {
      if (this.clearingRows.indexOf(r) < 0) kept.push(this.board[r]);
    }
    while (kept.length < ROWS) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      kept.unshift(row);
    }
    this.board = kept;
    var gained = (LINE_SCORES[n] || 0) * this.level;
    this.score += gained;
    this.lines += n;
    this.lastClear = { rows: this.clearingRows.slice(), gained: gained, count: n };
    this.clearingRows = [];
    var newLevel = 1 + Math.floor(this.lines / 10);
    var leveled = newLevel > this.level;
    if (leveled) this.level = newLevel;
    this.state = 'running';
    if (this.onScore) this.onScore(this.score, gained);
    if (leveled && this.onLevelUp) this.onLevelUp(this.level);
    this.spawn();
  };

  Engine.prototype.gameOver = function () {
    if (this.state === 'over') return;
    this.state = 'over';
    this.current = null;
    if (this.onGameOver) this.onGameOver({
      score: this.score, lines: this.lines, level: this.level, revivesUsed: this.revivesUsed
    });
  };

  Engine.prototype.pause = function () {
    if (this.state === 'running') {
      this.state = 'paused';
      return true;
    }
    return false;
  };

  Engine.prototype.resume = function () {
    if (this.state === 'paused') {
      this.state = 'running';
      this.dropAcc = 0;
      this.lockAcc = 0;
      return true;
    }
    return false;
  };

  Engine.prototype.revive = function (clearRows) {
    var n = clearRows || 4;
    if (this.revivesUsed >= this.maxRevives) return false;
    /* 清空底部 n 行，上方堆叠整体下落 n 行（等价于获得 n 行喘息空间） */
    var top = this.board.slice(0, ROWS - n);
    var fresh = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      fresh.push(row);
    }
    this.board = fresh.concat(top);
    this.revivesUsed += 1;
    this.state = 'running';
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.clearTimer = 0;
    this.clearingRows = [];
    this.current = null;
    this.spawn();
    return true;
  };

  Engine.prototype.clearArea = function (centerR, centerC, size) {
    var n = size || 3;
    var half = Math.floor(n / 2);
    var cleared = 0;
    for (var r = centerR - half; r <= centerR + half; r++) {
      for (var c = centerC - half; c <= centerC + half; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.board[r][c]) {
          this.board[r][c] = null;
          cleared++;
        }
      }
    }
    return cleared;
  };

  Engine.prototype.ghostY = function () {
    if (!this.current) return 0;
    var y = this.current.y;
    while (!this.collides(this.current.m, this.current.x, y + 1)) y++;
    return y;
  };

  Engine.prototype.debugPileUp = function (fromRow) {
    /* 仅用于演示/QA 截图：按列高铺出一个粗糙、自然的堆叠（不参与真实判定逻辑） */
    var colors = TYPES;
    var start = fromRow == null ? 5 : Math.max(0, Math.min(ROWS - 1, Number(fromRow) || 0));
    var seed = (start * 7 + 3) % 97;
    for (var c = 0; c < COLS; c++) {
      var h = 5 + ((c * 7 + seed) % 10);
      var top = ROWS - h;
      if (top < start) top = start;
      for (var r = top; r < ROWS; r++) {
        var hole = ((r * 13 + c * 29 + seed) % 19) === 0;
        if (r === start && c > 6) hole = true;
        this.board[r][c] = hole ? null : colors[(r * 5 + c * 3 + seed) % colors.length];
      }
    }
  };

  Engine.prototype.debugSetupClear = function (lineCount, col) {
    lineCount = Math.max(1, Math.min(4, lineCount || 4));
    col = col == null ? 4 : col;
    this.board = emptyBoard();
    for (var r = ROWS - lineCount; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (c !== col) this.board[r][c] = TYPES[(r + c) % TYPES.length];
      }
    }
    var m = cloneMatrix(PIECES.I.mat);
    m = rotateCW(m);
    this.current = { type: 'I', m: m, x: col - 2, y: 0 };
    this.state = 'running';
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.clearingRows = [];
    return { col: col, lineCount: lineCount };
  };

  /* ============================== Renderer ============================== */
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
  function mix(hex, target, amount) {
    var a = hexToRgb(hex);
    var tr = target === 'white' ? 255 : 0;
    var r = Math.round(a.r + (tr - a.r) * amount);
    var g = Math.round(a.g + (tr - a.g) * amount);
    var b = Math.round(a.b + (tr - a.b) * amount);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function rgba(hex, alpha) {
    var a = hexToRgb(hex);
    return 'rgba(' + a.r + ',' + a.g + ',' + a.b + ',' + alpha + ')';
  }
  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function Renderer(boardCanvas, nextCanvas) {
    this.bc = boardCanvas;
    this.nc = nextCanvas;
    this.ctx = boardCanvas.getContext('2d');
    this.nctx = nextCanvas ? nextCanvas.getContext('2d') : null;
    this.w = 0;
    this.h = 0;
    this.cell = 0;
    this.dpr = 1;
    this.particles = [];
    this.floats = [];
    this.flash = null;
    this._last = 0;
  }

  Renderer.prototype.resize = function (w, h) {
    var dpr = Math.min(3, global.devicePixelRatio || 1);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.cell = w / COLS;
    this.bc.width = Math.round(w * dpr);
    this.bc.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.resizeNext();
  };

  Renderer.prototype.resizeNext = function () {
    if (!this.nc) return;
    var rect = this.nc.getBoundingClientRect();
    var dpr = this.dpr || 1;
    var w = Math.max(40, rect.width || 76);
    var h = Math.max(36, rect.height || 52);
    this.nw = w;
    this.nh = h;
    this.nc.width = Math.round(w * dpr);
    this.nc.height = Math.round(h * dpr);
    this.nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* 皮肤：palette 覆盖 7 种方块颜色；style = candy（硬糖）/ gem（宝石切面） */
  Renderer.prototype.colorOf = function (type) {
    return (this.palette && this.palette[type]) || PIECES[type].color;
  };
  Renderer.prototype.setSkin = function (skin) {
    this.palette = skin && skin.palette ? skin.palette : null;
    this.style = (skin && skin.style) || 'candy';
  };

  /* 硬糖方块：底部倒角 + 主体渐变 + 左上高光 */
  Renderer.prototype.drawCell = function (ctx, px, py, size, color, opts) {
    opts = opts || {};
    var pad = Math.max(1, size * 0.05);
    var x = px + pad, y = py + pad, s = size - pad * 2;
    var r = size * 0.22;
    var bevel = Math.max(1.5, size * 0.11);
    ctx.save();
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = mix(color, 'black', 0.32);
    ctx.fill();
    roundRect(ctx, x, y, s, s - bevel, r);
    var g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, mix(color, 'white', 0.28));
    g.addColorStop(0.55, color);
    g.addColorStop(1, mix(color, 'black', 0.08));
    ctx.fillStyle = g;
    ctx.fill();
    if (this.style === 'gem') {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.16);
      ctx.lineTo(x + s * 0.82, y + (s - bevel) * 0.5);
      ctx.lineTo(x + s * 0.5, y + (s - bevel) * 0.84);
      ctx.lineTo(x + s * 0.18, y + (s - bevel) * 0.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x + s * 0.34, y + s * 0.26, s * 0.2, s * 0.1, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (opts.active ? 0.7 : 0.55) + ')';
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawGhost = function (ctx, engine) {
    var cur = engine.current;
    if (!cur) return;
    var gy = engine.ghostY();
    var size = this.cell;
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (var r = 0; r < cur.m.length; r++) {
      for (var c = 0; c < cur.m[r].length; c++) {
        if (!cur.m[r][c]) continue;
        var y = gy + r;
        if (y < 0) continue;
        var x = cur.x + c;
        var px = x * size, py = y * size;
        roundRect(ctx, px + size * 0.12, py + size * 0.12, size * 0.76, size * 0.76, size * 0.14);
        ctx.fillStyle = rgba(this.colorOf(cur.type), 0.08);
        ctx.fill();
        ctx.strokeStyle = rgba(this.colorOf(cur.type), 0.5);
        ctx.lineWidth = 1;
        ctx.setLineDash([size * 0.16, size * 0.14]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  };

  Renderer.prototype.draw = function (engine, now) {
    now = now || (global.performance ? performance.now() : Date.now());
    var dt = this._last ? Math.min(48, now - this._last) : 16;
    this._last = now;
    var ctx = this.ctx;
    var w = this.w, h = this.h, size = this.cell;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1F1A63');
    bg.addColorStop(1, '#17134F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* 空槽：每格一个浅色圆角凹槽 */
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        roundRect(ctx, c * size + size * 0.08, r * size + size * 0.08, size * 0.84, size * 0.84, size * 0.2);
        ctx.fill();
      }
    }

    /* 已固定方块 */
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        var t = engine.board[rr][cc];
        if (!t) continue;
        if (engine.state === 'clearing' && engine.clearingRows.indexOf(rr) >= 0) continue;
        this.drawCell(ctx, cc * size, rr * size, size, this.colorOf(t), { active: false });
      }
    }

    if (engine.current && engine.state !== 'over') {
      this.drawGhost(ctx, engine);
      var cur = engine.current;
      for (var i = 0; i < cur.m.length; i++) {
        for (var j = 0; j < cur.m[i].length; j++) {
          if (!cur.m[i][j]) continue;
          var yy = cur.y + i;
          if (yy < 0) continue;
          this.drawCell(ctx, (cur.x + j) * size, yy * size, size, this.colorOf(cur.type), { active: true });
        }
      }
    }

    /* 消行闪白 */
    if (this.flash) {
      var p = (now - this.flash.t0) / this.flash.dur;
      if (p >= 1) {
        this.flash = null;
      } else {
        ctx.save();
        for (var fi = 0; fi < this.flash.rows.length; fi++) {
          var ry = this.flash.rows[fi] * size;
          var grad = ctx.createLinearGradient(0, ry, w, ry + size);
          var a = (1 - p) * 0.9;
          grad.addColorStop(0, 'rgba(255,255,255,' + (a * 0.15) + ')');
          grad.addColorStop(0.5, 'rgba(255,255,255,' + a + ')');
          grad.addColorStop(1, 'rgba(255,255,255,' + (a * 0.15) + ')');
          ctx.fillStyle = grad;
          ctx.fillRect(0, ry, w, size);
        }
        ctx.restore();
      }
    }

    /* 粒子 */
    if (this.particles.length) {
      ctx.save();
      for (var pi = this.particles.length - 1; pi >= 0; pi--) {
        var pt = this.particles[pi];
        pt.life -= dt;
        if (pt.life <= 0) { this.particles.splice(pi, 1); continue; }
        pt.vy += 0.0018 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        var alpha = Math.max(0, pt.life / pt.maxLife);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 8;
        var ps = pt.size * (0.4 + alpha * 0.6);
        ctx.fillRect(pt.x - ps / 2, pt.y - ps / 2, ps, ps);
      }
      ctx.restore();
    }

    /* 飘分 */
    if (this.floats.length) {
      ctx.save();
      ctx.textAlign = 'center';
      for (var qi = this.floats.length - 1; qi >= 0; qi--) {
        var ft = this.floats[qi];
        ft.life -= dt;
        if (ft.life <= 0) { this.floats.splice(qi, 1); continue; }
        var fa = Math.max(0, ft.life / ft.maxLife);
        ft.y -= 0.03 * dt;
        ctx.globalAlpha = fa;
        ctx.fillStyle = ft.color;
        ctx.font = '900 ' + Math.round(size * 0.9) + 'px "PingFang SC", "Noto Sans SC", system-ui, sans-serif';
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 14;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 0.5 * fa;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.restore();
    }

    this.drawNext(engine.nextType);
  };

  Renderer.prototype.drawNext = function (type) {
    if (!this.nctx || !type) return;
    var ctx = this.nctx;
    var w = this.nw || 76, h = this.nh || 52;
    ctx.clearRect(0, 0, w, h);
    var mat = PIECES[type].mat;
    var minR = 99, maxR = -1, minC = 99, maxC = -1;
    for (var r = 0; r < mat.length; r++) {
      for (var c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    var pw = maxC - minC + 1, ph = maxR - minR + 1;
    var size = Math.min(w / (pw + 0.5), h / (ph + 0.4), 18);
    var ox = (w - pw * size) / 2 - minC * size;
    var oy = (h - ph * size) / 2 - minR * size;
    for (var rr2 = 0; rr2 < mat.length; rr2++) {
      for (var cc2 = 0; cc2 < mat[rr2].length; cc2++) {
        if (!mat[rr2][cc2]) continue;
        this.drawCell(ctx, ox + cc2 * size, oy + rr2 * size, size, this.colorOf(type), { active: true });
      }
    }
  };

  Renderer.prototype.spawnLineParticles = function (rows, colors) {
    var size = this.cell;
    if (!size) return;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowColors = (colors && colors[i]) || [];
      for (var c = 0; c < COLS; c++) {
        var type = rowColors[c];
        var color = type && PIECES[type] ? this.colorOf(type) : '#FFD24A';
        for (var k = 0; k < 3; k++) {
          this.particles.push({
            x: (c + Math.random()) * size,
            y: (row + Math.random()) * size,
            vx: (Math.random() - 0.5) * 0.22,
            vy: -Math.random() * 0.22 - 0.03,
            life: 420 + Math.random() * 320,
            maxLife: 740,
            size: size * (0.14 + Math.random() * 0.2),
            color: Math.random() > 0.45 ? color : '#FFFFFF'
          });
        }
      }
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  };

  Renderer.prototype.flashRows = function (rows) {
    this.flash = { rows: rows.slice(), t0: (global.performance ? performance.now() : Date.now()), dur: 200 };
  };

  Renderer.prototype.spawnFloat = function (text, x, y, color) {
    if (this.floats.length > 6) this.floats.shift();
    this.floats.push({
      text: text, x: x, y: y, color: color || '#FFD24A',
      life: 900, maxLife: 900
    });
  };

  Renderer.prototype.clearFx = function () {
    this.particles.length = 0;
    this.floats.length = 0;
    this.flash = null;
  };

  /* ============================== 导出 ============================== */
  global.NeonStack = {
    Engine: Engine,
    Renderer: Renderer,
    PIECES: PIECES,
    TYPES: TYPES,
    COLS: COLS,
    ROWS: ROWS,
    LINE_SCORES: LINE_SCORES
  };
})(typeof window !== 'undefined' ? window : globalThis);
