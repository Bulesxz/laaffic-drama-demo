/* ============================================================================
 * LAAFFIC Content SDK · 参考版 JS SDK（UMD，无依赖）
 * ----------------------------------------------------------------------------
 * 全局：LAAFFIC.ContentSDK / LCDK · 仅内容能力（无金币 / 奖励 / 商店）
 *
 * 真实现（不是假 UI）：
 *   - WebCrypto AES-CBC/PKCS7 签名（无 WebCrypto 时纯 JS AES 兜底）
 *   - appId + uid + apiSignature + timestamp + nonce + token 鉴权，token 自动续期
 *   - 仅内容能力：getAccessToken / language / category / tag / dramas /
 *     search / detail / userAction / refreshPlayUrl / log/play
 *   - 事件订阅：sdk:log / sdk:error，埋点事件流与 API 调用日志
 *
 * 说明：Demo 中 baseUrl = 'mock://local' 时走本地 mock 网关（路径与线上一致）；
 *       改成 https 地址即走真实 fetch（线上 TLS + CORS 由接入方处理）。
 * ==========================================================================*/
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    var api = factory();
    root.LAAFFIC = root.LAAFFIC || {};
    root.LAAFFIC.ContentSDK = api;
    root.LCDK = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var VERSION = '1.0.0';
  var DEFAULT_BASE_URL = 'https://open.laaffic.io/sdk';
  var enc = new TextEncoder();

  var ErrorCode = {
    SUCCESS: 0,
    UNKNOWN: -1,
    PARSE: -3,
    NO_DATA: -4,
    CONFIG: -6,
    NETWORK: -7,
    SECRET_INVALID: -8,
    PARAM_EMPTY: -9,
    NOT_INIT: 1000,
    SIGN_ERROR: 1001,
    TOKEN_EXPIRED: 1002,
    TIMESTAMP_EXPIRED: 1003,
    CONTENT_OFFLINE: 3001,
    SERVER_ERROR: 9999
  };

  var PlayAction = {
    PLAY_END: 0,
    PLAY_START: 1,
    PLAY_PROGRESS_25: 25,
    PLAY_PROGRESS_50: 50,
    PLAY_PROGRESS_75: 75
  };

  /* ========================== AES-128-CBC（PKCS#7）=========================*/
  var SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];
  var RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function xtime(a) { return ((a << 1) ^ ((a >> 7) & 1) * 0x1b) & 0xff; }
  function gmul(a, b) {
    var r = 0;
    while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; }
    return r & 0xff;
  }
  function expandKey(key) {
    var w = new Uint8Array(176);
    w.set(key);
    for (var i = 16; i < 176; i += 4) {
      var t0 = w[i - 4], t1 = w[i - 3], t2 = w[i - 2], t3 = w[i - 1];
      if (i % 16 === 0) {
        var tmp = t0;
        t0 = SBOX[t1] ^ RCON[i / 16 - 1];
        t1 = SBOX[t2];
        t2 = SBOX[t3];
        t3 = SBOX[tmp];
      }
      w[i] = w[i - 16] ^ t0; w[i + 1] = w[i - 15] ^ t1;
      w[i + 2] = w[i - 14] ^ t2; w[i + 3] = w[i - 13] ^ t3;
    }
    return w;
  }
  function encryptBlock(input, w) {
    var s = new Uint8Array(input), i, r, t, c, j, a0, a1, a2, a3;
    for (i = 0; i < 16; i++) s[i] ^= w[i];
    for (r = 1; r < 10; r++) {
      for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
      t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
      t = s[2]; s[2] = s[10]; s[10] = t;
      t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = t;
      for (c = 0; c < 4; c++) {
        j = c * 4; a0 = s[j]; a1 = s[j + 1]; a2 = s[j + 2]; a3 = s[j + 3];
        s[j] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
        s[j + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
        s[j + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
        s[j + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
      }
      for (i = 0; i < 16; i++) s[i] ^= w[r * 16 + i];
    }
    for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = t;
    for (i = 0; i < 16; i++) s[i] ^= w[160 + i];
    return s;
  }
  function aesCbcEncrypt(plain, key) {
    var w = expandKey(key);
    var padLen = 16 - (plain.length % 16);
    var data = new Uint8Array(plain.length + padLen);
    data.set(plain);
    data.fill(padLen, plain.length);
    var out = new Uint8Array(data.length);
    var prev = key;
    for (var off = 0; off < data.length; off += 16) {
      var block = new Uint8Array(16);
      for (var i = 0; i < 16; i++) block[i] = data[off + i] ^ prev[i];
      var e = encryptBlock(block, w);
      out.set(e, off);
      prev = e;
    }
    return out;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof btoa === 'function') return btoa(s);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    return '';
  }
  function randomHex(len) {
    var bytes = new Uint8Array(len);
    if (globalScope.crypto && globalScope.crypto.getRandomValues) globalScope.crypto.getRandomValues(bytes);
    else for (var i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
    var s = '';
    for (var j = 0; j < bytes.length; j++) s += bytes[j].toString(16).padStart(2, '0');
    return s;
  }
  function clock() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }
  function nowMs() {
    if (globalScope.performance && globalScope.performance.now) return globalScope.performance.now();
    return Date.now();
  }

  /* MD5（RFC 1321，UTF-8 输入，32 位小写 hex）——仅用于 getAccessToken 的 paramMd5 */
  function md5(str) {
    var bytes = enc.encode(String(str));
    var K = [], S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    for (var k = 0; k < 64; k++) K[k] = Math.floor(Math.abs(Math.sin(k + 1)) * 4294967296) | 0;
    var len = bytes.length;
    var nBlocks = ((len + 8) >> 6) + 1;
    var words = new Int32Array(nBlocks * 16);
    for (var i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    words[nBlocks * 16 - 2] = (len * 8) | 0;
    words[nBlocks * 16 - 1] = Math.floor(len / 536870912) | 0;
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var blk = 0; blk < words.length; blk += 16) {
      var A = a0, B = b0, C = c0, D = d0;
      for (var j = 0; j < 64; j++) {
        var F, g;
        if (j < 16) { F = (B & C) | (~B & D); g = j; }
        else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
        else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * j) % 16; }
        var tmp = D;
        D = C;
 C = B;
        var x = (A + F + K[j] + words[blk + g]) | 0;
 B = (B + ((x << S[j]) | (x >>> (32 - S[j])))) | 0;
        A = tmp;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    var out = '';
    [a0, b0, c0, d0].forEach(function (v) {
      for (var b = 0; b < 4; b++) out += ((v >>> (b * 8)) & 0xff).toString(16).padStart(2, '0');
    });
    return out;
  }

  /* 签名：AES-CBC/PKCS7，Key = IV = appSecret；优先 WebCrypto，失败回退纯 JS */
  function signString(appSecret, text) {
    var keyBytes = enc.encode(appSecret);
    if (globalScope.crypto && globalScope.crypto.subtle && globalScope.crypto.subtle.importKey) {
      return globalScope.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt'])
        .then(function (k) {
          return globalScope.crypto.subtle.encrypt({ name: 'AES-CBC', iv: keyBytes }, k, enc.encode(text));
        })
        .then(function (buf) { return bytesToB64(new Uint8Array(buf)); })
        .catch(function () { return bytesToB64(aesCbcEncrypt(enc.encode(text), keyBytes)); });
    }
    return Promise.resolve(bytesToB64(aesCbcEncrypt(enc.encode(text), keyBytes)));
  }

  /* ============================== 状态 ==============================*/
  var config = null;
  var initialized = false;
  var token = null;
  var tokenExpiresAt = 0;
  var initData = null;
  var initPromise = null;
  var refreshPromise = null;
  var fileContexts = {};
  var apiLogs = [];
  var events = [];
  var listeners = { 'sdk:log': [], 'sdk:error': [] };
  var reqSeq = 0;
  var lastPlay = null;

  function SdkError(errorCode, message, detailCode, extra) {
    this.name = 'LAAFFICError';
    this.errorCode = errorCode;
    this.message = message || '未知错误';
    this.detailCode = detailCode == null ? null : detailCode;
    if (extra) for (var k in extra) this[k] = extra[k];
    var stack = (new Error(this.message)).stack;
    if (stack) this.stack = stack;
  }
  SdkError.prototype = Object.create(Error.prototype);
  SdkError.prototype.constructor = SdkError;
  SdkError.prototype.getErrorCode = function () { return this.errorCode; };
  SdkError.prototype.getMessage = function () { return this.message; };
  SdkError.prototype.toString = function () { return '[LAAFFIC SDK ' + this.errorCode + '] ' + this.message; };

  function emit(name, payload) {
    var arr = listeners[name] || [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (e) { /* 订阅方异常不影响 SDK */ }
    }
  }
  function on(name, handler) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(handler);
    return function off() {
      var idx = listeners[name].indexOf(handler);
      if (idx >= 0) listeners[name].splice(idx, 1);
    };
  }
  function off(name, handler) {
    var idx = (listeners[name] || []).indexOf(handler);
    if (idx >= 0) listeners[name].splice(idx, 1);
  }
  function debugLog() {
    if (!config || !config.debug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[LAAFFIC]');
    if (typeof console !== 'undefined' && console.log) console.log.apply(console, args);
  }
  function pushApiLog(rec) {
    apiLogs.push(rec);
    if (apiLogs.length > 150) apiLogs.shift();
    emit('sdk:log', rec);
  }
  function track(name, payload) {
    var rec = { kind: 'event', event: name, payload: payload || {}, at: Date.now(), time: clock() };
    events.push(rec);
    if (events.length > 200) events.shift();
    emit('sdk:log', rec);
    if (config && config.debug) debugLog('event', name, payload || {});
    return rec;
  }

  /* ============================== 传输层 ==============================*/
  function joinUrl(base, path) {
    if (!base) return path;
    return String(base).replace(/\/+$/, '') + path;
  }
  async function sendRaw(path, headers, rawBody) {
    if (config && typeof config.transport === 'function') {
      return config.transport({ method: 'POST', path: path, headers: headers, body: rawBody });
    }
    if (/^mock:\/\//i.test(String(config.baseUrl))) {
      var gw = globalScope.LAAFFICMockGateway;
      if (!gw || typeof gw.request !== 'function') {
        throw new SdkError(ErrorCode.NETWORK, '本地 mock 网关未加载（sdk/mock/gateway.js）');
      }
      return gw.request({ method: 'POST', path: path, headers: headers, body: rawBody });
    }
    var url = joinUrl(config.baseUrl, path);
    if (typeof fetch !== 'function') throw new SdkError(ErrorCode.NETWORK, '当前环境不支持 fetch');
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        appId: headers.appId,
        uid: headers.uid,
        apiSignature: headers.apiSignature,
        timestamp: headers.timestamp,
        nonce: headers.nonce,
        token: headers.token || ''
      },
      body: rawBody
    });
    return { status: res.status, body: await res.text() };
  }

  async function sendRequest(apiPath, data, opts) {
    opts = opts || {};
    if (!config) throw new SdkError(ErrorCode.CONFIG, '请先调用 LCDK.init(config)');
    var started = nowMs();
    var requestId = 'req_' + (++reqSeq).toString(36) + '_' + randomHex(3);
    var ts = String(Date.now());
    var nonce = randomHex(16);
    var rawBody = JSON.stringify({
      baseInfo: {
        model: 'SM-G9810',
        brand: 'samsung',
        manufacturer: 'samsung',
        device: 'x1q',
        osVersion: '12',
        language: config.language || 'zh',
        pkgName: config.pkgName
      },
      data: data || {}
    });
    var headers = {
      appId: config.appId,
      uid: config.uid,
      timestamp: ts,
      nonce: nonce
    };
    var signText = 'POST\n' + apiPath + '\n' + ts + '\n' + nonce + '\n' + rawBody + '\n';
    headers.apiSignature = await signString(config.appSecret, signText);
    if (token && !opts.noToken) headers.token = token;

    var rec = {
      kind: 'api', requestId: requestId, api: opts.api || apiPath, method: 'POST',
      path: apiPath, at: Date.now(), time: clock(), status: 'pending',
      code: null, httpStatus: null, durationMs: null, requestBytes: rawBody.length,
      idempotencyKey: (data && data.idempotencyKey) || null
    };
    if (config.debug) debugLog('→', rec.api, rec.requestId);

    try {
      var res = await sendRaw(apiPath, headers, rawBody);
      rec.httpStatus = res.status;
      var json;
      try { json = JSON.parse(res.body); } catch (e) { throw new SdkError(ErrorCode.PARSE, '响应不是合法 JSON'); }
      var dataCode = json && json.data ? json.data.dataCode : null;
      rec.code = dataCode;
      if (!json || json.code !== 200 || !json.data || dataCode !== 0) {
        var msg = (json && json.data && (json.data.dataMsg || json.data.msg)) || (json && json.msg) || '请求失败';
        var err = new SdkError(dataCode == null ? ErrorCode.UNKNOWN : dataCode, msg, json ? json.code : null, {
          path: apiPath, requestId: requestId, response: json
        });
        throw err;
      }
      rec.status = 'success';
      rec.durationMs = Math.round(nowMs() - started);
      pushApiLog(rec);
      if (config.debug) debugLog('←', rec.api, rec.code, rec.durationMs + 'ms');
      return json.data;
    } catch (err) {
      rec.status = 'error';
      rec.durationMs = Math.round(nowMs() - started);
      rec.code = err && err.errorCode != null ? err.errorCode : rec.code;
      rec.message = (err && err.message) || String(err);
      pushApiLog(rec);
      var info = {
        errorCode: rec.code,
        message: rec.message,
        detailCode: err && err.detailCode != null ? err.detailCode : rec.httpStatus,
        api: rec.api, path: apiPath, requestId: requestId,
        at: Date.now(), time: clock()
      };
      if (config.debug && typeof console !== 'undefined' && console.warn) console.warn('[LAAFFIC] api error', info);
      emit('sdk:error', info);
      if (err instanceof SdkError) throw err;
      throw new SdkError(ErrorCode.NETWORK, '网络请求失败：' + rec.message, rec.httpStatus, {
        path: apiPath, requestId: requestId
      });
    }
  }

  /* getAccessToken 入参：paramMd5 = MD5(uid + appId + appSecret + pkgName)，32 位小写 */
  function tokenParams() {
    return { paramMd5: md5(config.uid + config.appId + config.appSecret + config.pkgName) };
  }

  async function refreshToken() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async function () {
      var data = await sendRequest('/sdk/app/getAccessToken', tokenParams(), { noToken: true, api: 'auth.refreshToken' });
      token = data.token;
      tokenExpiresAt = Date.now() + (Number(data.expiresIn) || 7200) * 1000;
      if (initData) for (var k in data) initData[k] = data[k];
      else initData = data;
      debugLog('token refreshed');
      track('token_refresh', { expiresIn: data.expiresIn });
      return data;
    })();
    try { return await refreshPromise; } finally { refreshPromise = null; }
  }

  async function call(apiPath, data, opts) {
    opts = opts || {};
    if (!initialized && !opts.bootstrap) {
      throw new SdkError(ErrorCode.NOT_INIT, 'SDK 未初始化，请先 await LCDK.init(config)');
    }
    try {
      return await sendRequest(apiPath, data, opts);
    } catch (err) {
      if (err && err.errorCode === ErrorCode.TOKEN_EXPIRED && initialized && !opts._retried && !opts.bootstrap) {
        /* token 过期：自动续期一次后重试（注入 1002 时仍会失败，交给 UI 兜底） */
        try {
          await refreshToken();
        } catch (refreshErr) {
          throw err;
        }
        return sendRequest(apiPath, data, Object.assign({}, opts, { _retried: true }));
      }
      throw err;
    }
  }

  /* ============================== 初始化 ==============================*/
  function validateInit(opts) {
    if (!opts || !opts.appId) throw new SdkError(ErrorCode.PARAM_EMPTY, 'init 缺少 appId');
    if (!opts.appSecret) throw new SdkError(ErrorCode.PARAM_EMPTY, 'init 缺少 appSecret');
    if (enc.encode(String(opts.appSecret)).length !== 16) {
      throw new SdkError(ErrorCode.SECRET_INVALID, 'appSecret 必须是 16 字节 UTF-8（当前 ' + enc.encode(String(opts.appSecret)).length + ' 字节）');
    }
    if (!opts.uid) {
      var stored = null;
      try { stored = globalScope.localStorage && globalScope.localStorage.getItem('laffic_uid'); } catch (e) { stored = null; }
      opts.uid = stored || ('uid_' + randomHex(12));
      try { if (globalScope.localStorage) globalScope.localStorage.setItem('laffic_uid', opts.uid); } catch (e) { /* ignore */ }
    }
  }

  function init(options) {
    if (initPromise) return initPromise;
    validateInit(options || {});
    config = {
      appId: String(options.appId),
      appSecret: String(options.appSecret),
      uid: String(options.uid),
      pkgName: options.pkgName || 'ai.laffic.demo',
      language: options.language || 'zh',
      debug: !!options.debug,
      baseUrl: options.baseUrl || DEFAULT_BASE_URL,
      transport: typeof options.transport === 'function' ? options.transport : null
    };
    initialized = false;
    token = null;
    tokenExpiresAt = 0;
    initData = null;
    apiLogs = [];
    events = [];
    lastPlay = null;
    var started = nowMs();
    debugLog('init', { appId: config.appId, uid: config.uid, baseUrl: config.baseUrl, pkgName: config.pkgName });

    initPromise = (async function () {
      try {
        var data = await sendRequest('/sdk/app/getAccessToken', tokenParams(), { bootstrap: true, noToken: true, api: 'app.getAccessToken' });
        token = data.token;
        tokenExpiresAt = Date.now() + (Number(data.expiresIn) || 7200) * 1000;
        initData = data;
        initialized = true;
        var durationMs = Math.round(nowMs() - started);
        track('sdk_init', {
          appId: config.appId, uid: config.uid, durationMs: durationMs,
          version: VERSION, baseUrl: config.baseUrl, pkgName: config.pkgName
        });
        return data;
      } catch (err) {
        initPromise = null;
        initialized = false;
        throw err;
      }
    })();
    return initPromise;
  }

  /* ============================== 内容层 ==============================*/
  async function requestLanguageList() {
    var res = await call('/sdk/app/getLanguageList', {}, { api: 'app.requestLanguageList' });
    return res.list || [];
  }
  async function requestCategoryList() {
    var res = await call('/sdk/app/getCategoryList', {}, { api: 'app.requestCategoryList' });
    return res.list || [];
  }
  async function requestTagList() {
    var res = await call('/sdk/app/getTagList', {}, { api: 'app.requestTagList' });
    return res.list || [];
  }
  async function requestDefaultDramasList(pageIndex, count, opts) {
    opts = opts || {};
    var res = await call('/sdk/app/getDefaultDramasList', {
      pageIndex: pageIndex || 1,
      count: count || 20,
      languageCodes: opts.languageCodes || [config.language || 'zh'],
      categoryCode: opts.categoryCode || '',
      sort: opts.sort || 'default',
      vids: Array.isArray(opts.vids) && opts.vids.length ? opts.vids : undefined
    }, { api: 'app.requestDefaultDramasList' });
    return res;
  }
  async function requestDramaByVid(vid) {
    if (!vid) throw new SdkError(ErrorCode.PARAM_EMPTY, 'vid 不能为空');
    var res = await call('/sdk/app/getDefaultDramasList', {
      pageIndex: 1, count: 1, vids: [vid], languageCodes: [config.language || 'zh']
    }, { api: 'app.requestDramaByVid' });
    var list = res.list || [];
    if (!list.length) throw new SdkError(ErrorCode.CONTENT_OFFLINE, '剧集不存在或已下架');
    return list[0];
  }
  async function searchDramas(keyword, pageIndex, count, opts) {
    opts = opts || {};
    var res = await call('/sdk/app/searchDramas', {
      keyword: keyword || '', pageIndex: pageIndex || 1, count: count || 20,
      languageCodes: opts.languageCodes || [config.language || 'zh'],
      categoryCode: opts.categoryCode || '',
      sort: opts.sort || 'default'
    }, { api: 'app.searchDramas' });
    return res;
  }
  async function refreshPlayUrl(vid, episodes) {
    var list = Array.isArray(episodes) ? episodes : (episodes == null ? [] : [episodes]);
    var res = await call('/sdk/app/refreshPlayUrl', { vid: vid, episodes: list }, { api: 'app.refreshPlayUrl' });
    (res.episodes || []).forEach(function (ep) {
      fileContexts[ep.fileId] = { vid: vid, episode: Number(ep.index) };
    });
    return res.episodes || [];
  }
  async function getFavList(pageIndex, count) {
    var res = await call('/sdk/app/getFavList', {
      pageIndex: pageIndex || 1, count: count || 20,
      languageCodes: [config.language || 'zh']
    }, { api: 'app.getFavList' });
    return res;
  }
  async function getLikeList(pageIndex, count) {
    var res = await call('/sdk/app/getLikeList', {
      pageIndex: pageIndex || 1, count: count || 20,
      languageCodes: [config.language || 'zh']
    }, { api: 'app.getLikeList' });
    return res;
  }
  async function getPlaceholder(language) {
    var res = await call('/sdk/app/getPlaceholder', { language: language || config.language || 'zh' }, { api: 'app.getPlaceholder' });
    return res.keywords || [];
  }
  async function refreshPlayFile(vid, episodes) {
    var list = Array.isArray(episodes) ? episodes : (episodes == null ? [] : [episodes]);
    var res = await call('/sdk/app/refreshPlayFile', { vid: vid, episodes: list }, { api: 'app.refreshPlayFile' });
    (res.episodes || []).forEach(function (ep) {
      fileContexts[ep.fileId] = { vid: vid, episode: Number(ep.index) };
    });
    return res.episodes || [];
  }
  async function userAction(payload) {
    var res = await call('/sdk/app/userAction', payload || {}, { api: 'app.userAction' });
    track('content_user_action', {
      action: res.action, vid: res.vid, episode: res.episode, status: res.status
    });
    return res;
  }

  function normalizeAction(action) {
    if (typeof action === 'number') {
      if (action === 0) return 'PLAY_END';
      if (action === 1) return 'PLAY_START';
      if (action === 25) return 'PLAY_PROGRESS_25';
      if (action === 50) return 'PLAY_PROGRESS_50';
      if (action === 75) return 'PLAY_PROGRESS_75';
      if (action === 100) return 'PLAY_PROGRESS_100';
      return 'PLAY_PROGRESS_' + action;
    }
    return String(action || '').toUpperCase();
  }

  function logPlayInfo(fileId, action, positionMs) {
    if (!fileId) return Promise.resolve(null);
    var name = normalizeAction(action);
    var ctx = fileContexts[fileId] || {};
    var pos = Math.max(0, Number(positionMs) || 0);
    lastPlay = { fileId: fileId, positionMs: pos, at: Date.now() };
    var pct = 0;
    if (name === 'PLAY_PROGRESS_25') pct = 25;
    else if (name === 'PLAY_PROGRESS_50') pct = 50;
    else if (name === 'PLAY_PROGRESS_75') pct = 75;
    else if (name === 'PLAY_PROGRESS_100') pct = 100;

    var eventName = 'content_play_progress';
    if (name === 'PLAY_START') eventName = 'content_play_start';
    else if (name === 'PLAY_END') eventName = 'content_play_end';
    var payload = {
      vid: ctx.vid || null, episode: ctx.episode || null, fileId: fileId,
      positionMs: pos, action: name
    };
    if (pct) payload.percent = pct;
    if (name === 'PLAY_END') payload.playedMs = pos;
    if (name === 'PLAY_START' || name === 'PLAY_END' || pct) track(eventName, payload);

    var actionCode = name === 'PLAY_END' ? 0 : name === 'PLAY_START' ? 1 : (pct || 0);
    return call('/sdk/app/log/play', {
      fileId: fileId, action: name, actionCode: actionCode,
      positionMs: pos, vid: ctx.vid || '', episode: ctx.episode || 0
    }, { api: 'app.logPlayInfo' }).then(function (res) {
      return res;
    }).catch(function (err) {
      /* 埋点失败不打断播放；错误已通过 sdk:error 抛出 */
      debugLog('logPlayInfo failed', err && err.message);
      return null;
    });
  }

  function onStop() {
    if (!lastPlay) return Promise.resolve(null);
    var lp = lastPlay;
    lastPlay = null;
    return logPlayInfo(lp.fileId, 'PLAY_END', lp.positionMs);
  }

  /* ============================== 公开面 ==============================*/
  /* 切换内容语种（影响后续请求的 baseInfo.language 与默认 languageCodes），无需重新 init */
  function setLanguage(language) {
    if (!config || !language) return;
    config.language = String(language);
  }
  function getVersion() { return VERSION; }
  function getInitData() { return initData ? JSON.parse(JSON.stringify(initData)) : null; }
  function getVodAppId() { return initData ? initData.vodAppId : null; }
  function getVodLicenseUrl() { return initData ? initData.vodLicenseUrl : null; }
  function getVodLicenseKey() { return initData ? initData.vodLicenseKey : null; }
  function getSession() {
    return {
      appId: config && config.appId,
      uid: config && config.uid,
      pkgName: config && config.pkgName,
      baseUrl: config && config.baseUrl,
      initialized: initialized,
      token: token,
      tokenExpiresAt: tokenExpiresAt,
      version: VERSION
    };
  }
  function getApiLogs() { return apiLogs.slice(); }
  function getEvents() { return events.slice(); }

  function destroy() {
    onStop();
    initialized = false;
    token = null;
    tokenExpiresAt = 0;
    config = null;
    initPromise = null;
    fileContexts = {};
    for (var k in listeners) listeners[k] = [];
  }

  return {
    VERSION: VERSION,
    version: VERSION,
    ErrorCode: ErrorCode,
    PlayAction: PlayAction,
    init: init,
    setLanguage: setLanguage,
    on: on,
    off: off,
    getVersion: getVersion,
    getInitData: getInitData,
    getVodAppId: getVodAppId,
    getVodLicenseUrl: getVodLicenseUrl,
    getVodLicenseKey: getVodLicenseKey,
    getSession: getSession,
    getApiLogs: getApiLogs,
    getEvents: getEvents,
    requestLanguageList: requestLanguageList,
    requestCategoryList: requestCategoryList,
    requestTagList: requestTagList,
    requestDefaultDramasList: requestDefaultDramasList,
    requestDramaByVid: requestDramaByVid,
    searchDramas: searchDramas,
    refreshPlayUrl: refreshPlayUrl,
    refreshPlayFile: refreshPlayFile,
    getFavList: getFavList,
    getLikeList: getLikeList,
    getPlaceholder: getPlaceholder,
    userAction: userAction,
    logPlayInfo: logPlayInfo,
    onStop: onStop,
    destroy: destroy,
    __internal: {
      signString: signString,
      md5: md5,
      aesCbcEncrypt: function (secret, text) {
        return bytesToB64(aesCbcEncrypt(enc.encode(text), enc.encode(secret)));
      }
    }
  };
});
