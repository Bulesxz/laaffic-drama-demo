/* ============================================================================
 * LAAFFIC Content SDK · 本地 Mock 网关（参考实现，非生产代码）
 * ----------------------------------------------------------------------------
 * 目标：在浏览器里 1:1 模拟 https://open.laaffic.io/sdk 的服务端行为：
 *   - 仅内容路由：/sdk/app/*（包括 getAccessToken / 列表 / 详情 / 播放地址 / 播放日志）
 *   - 真校验 AES-CBC 签名、timestamp(±5min)、nonce 防重放、token 过期
 *   - 80–300ms 网络延迟；可注入 弱网 / 1001 / 1002（内容接口）
 *   - 只提供内容数据与播放地址；金币/奖励逻辑不在此网关
 *
 * 使用：<script src="sdk/mock/gateway.js"></script>
 *       window.LAAFFICMockGateway.request({ method, path, headers, body })
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '2.0.0';
  var STORE_KEY = 'laffic_mock_gateway_v3';

  /* 后台登记的应用（Demo 用固定值；appSecret 必须恰好 16 字节 UTF-8） */
  var APPS = {
    'laffic_demo_001': {
      appSecret: 'LAAFFIC_DEMO_168',
      pkgName: 'ai.laffic.demo',
      uids: ['demo_user_8848']
    }
  };

  /* ========================== AES-128-CBC（PKCS#7）=========================
   * 浏览器里有 WebCrypto 时 mock 也用 WebCrypto 验签；否则退回本文件内的
   * 纯 JS 实现。两条路径输出必须一致（qa.py / 单测会对比）。
   * ======================================================================*/
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
  var TE = new TextEncoder();

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
      w[i] = w[i - 16] ^ t0;
      w[i + 1] = w[i - 15] ^ t1;
      w[i + 2] = w[i - 14] ^ t2;
      w[i + 3] = w[i - 13] ^ t3;
    }
    return w;
  }
  function encryptBlock(input, w) {
    var s = new Uint8Array(input);
    var i, r;
    for (i = 0; i < 16; i++) s[i] ^= w[i];
    for (r = 1; r < 10; r++) {
      for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
      var t;
      t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
      t = s[2]; s[2] = s[10]; s[10] = t;
      t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = t;
      for (var c = 0; c < 4; c++) {
        var j = c * 4, a0 = s[j], a1 = s[j + 1], a2 = s[j + 2], a3 = s[j + 3];
        s[j] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
        s[j + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
        s[j + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
        s[j + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
      }
      for (i = 0; i < 16; i++) s[i] ^= w[r * 16 + i];
    }
    for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    var q;
    q = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = q;
    q = s[2]; s[2] = s[10]; s[10] = q;
    q = s[6]; s[6] = s[14]; s[14] = q;
    q = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = q;
    for (i = 0; i < 16; i++) s[i] ^= w[160 + i];
    return s;
  }
  function aesCbcEncrypt(plain, key) {
    var w = expandKey(key);
    var pad = 16 - (plain.length % 16);
    var data = new Uint8Array(plain.length + pad);
    data.set(plain);
    data.fill(pad, plain.length);
    var out = new Uint8Array(data.length);
    var prev = key;
    for (var off = 0; off < data.length; off += 16) {
      var block = new Uint8Array(16);
      for (var i = 0; i < 16; i++) block[i] = data[off + i] ^ prev[i];
      var enc = encryptBlock(block, w);
      out.set(enc, off);
      prev = enc;
    }
    return out;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  /* WebCrypto 验签（可用时优先；纯 JS 作为无 WebCrypto 环境兜底） */
  function sign(secret, text) {
    var key = TE.encode(secret);
    if (global.crypto && global.crypto.subtle && global.crypto.subtle.importKey) {
      return global.crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt'])
        .then(function (k) {
          return global.crypto.subtle.encrypt({ name: 'AES-CBC', iv: key }, k, TE.encode(text));
        })
        .then(function (buf) { return bytesToB64(new Uint8Array(buf)); })
        .catch(function () { return bytesToB64(aesCbcEncrypt(TE.encode(text), key)); });
    }
    return Promise.resolve(bytesToB64(aesCbcEncrypt(TE.encode(text), key)));
  }

  /* ============================== 工具 ==============================*/
  function pad2(n) { return String(n).padStart(2, '0'); }
  function hex(n) {
    var s = '';
    var chars = '0123456789abcdef';
    for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * 16));
    return s;
  }
  function dateStr(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayStr() { return dateStr(Date.now()); }
  function nowTime(ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function md5ish(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  /* ============================== 内容库 ==============================*/
  /* 演示剧库：中英两个语种。字段只包含线上内容 API 实际返回的字段；
   * 热度/评分/锁集/时长/播放进度不属于内容 API，由接入方自己的业务决定。 */
  /* 剧库数据在 sdk/mock/catalog.js（42 部 · 10 个分类 · 中英双语）。
   * 字段只包含线上内容 API 实际返回的字段；热度/评分/锁集/时长/播放进度不属于内容 API。 */
  var CAT = global.LAAFFIC_MOCK_CATALOG;
  if (!CAT) throw new Error('LAAFFIC mock catalog missing: load sdk/mock/catalog.js before gateway.js');
  var CATEGORIES = CAT.categories;
  var TAGS = CAT.tags;
  var LANGUAGES = [
    { id: 1, languageName: '中文', languageCode: 'zh' },
    { id: 2, languageName: 'English', languageCode: 'en' }
  ];
  var PLACEHOLDERS = CAT.placeholders;
  var DRAMAS = CAT.dramas;
  var PUBLISH = {};
  DRAMAS.forEach(function (d) { PUBLISH[d.vid] = d.publishTime; });

  /* 语种：languageCodes[0] → data.language → baseInfo.language；演示剧库只有 zh / en */
  function pickLang(data, baseInfo) {
    var code = (data && data.languageCodes && data.languageCodes[0]) || (data && data.language) || (baseInfo && baseInfo.language) || 'en';
    return String(code).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  }
  function catView(c, lang) { return { categoryCode: c.categoryCode, categoryName: c.name.zh, categoryNameLanguage: c.name[lang] }; }
  function tagView(t, lang) { return { tagCode: t.tagCode, tagName: t.name.zh, tagNameLanguage: t.name[lang] }; }
  function titleOf(d, lang) { return d.title[lang] || d.title.en; }
  function descOf(d, lang) { return d.desc[lang] || d.desc.en; }
  function clipOf(d) { return 'assets/clips30/' + (d.clip || d.vid) + '-30s.mp4'; }

  function dramaByVid(vid) {
    for (var i = 0; i < DRAMAS.length; i++) if (DRAMAS[i].vid === vid) return DRAMAS[i];
    return null;
  }

  /* ============================== 状态 ==============================*/
  var memoryFallback = null;
  var state = null;
  var errorMode = 'normal';

  function storageGet() {
    try { return global.localStorage.getItem(STORE_KEY); } catch (e) { return memoryFallback; }
  }
  function storageSet(raw) {
    try { global.localStorage.setItem(STORE_KEY, raw); } catch (e) { memoryFallback = raw; }
  }
  function storageRemove() {
    try { global.localStorage.removeItem(STORE_KEY); } catch (e) { memoryFallback = null; }
  }

  function newAccount(uid) {
    return {
      uid: uid,
      watched: {},
      collect: { qianwang: true, langwang: true, zhanshen: true },
      likes: {},
      playLogs: []
    };
  }

  function seedState() {
    var accounts = {};
    ['demo_user_8848'].forEach(function (uid) { accounts[uid] = newAccount(uid); });
    return { v: 1, accounts: accounts, tokens: {}, nonces: {}, createdAt: Date.now() };
  }

  function load() {
    var raw = storageGet();
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1 && parsed.accounts) { state = parsed; return; }
      } catch (e) { /* ignore, reseed */ }
    }
    state = seedState();
    save();
  }
  function save() { try { storageSet(JSON.stringify(state)); } catch (e) { /* quota */ } }

  function ensureAccount(uid) {
    if (!state.accounts[uid]) { state.accounts[uid] = newAccount(uid); save(); }
    return state.accounts[uid];
  }

  /* ============================== 响应封装 ==============================*/
  function ok(payload) {
    var data = { dataCode: 0, dataMsg: 'success' };
    if (payload) for (var k in payload) data[k] = payload[k];
    return { code: 200, msg: null, data: data, timestamp: Date.now(), version: VERSION };
  }
  function fail(dataCode, dataMsg, extra) {
    var data = { dataCode: dataCode, dataMsg: dataMsg };
    if (extra) for (var k in extra) data[k] = extra[k];
    return { code: 200, msg: null, data: data, timestamp: Date.now(), version: VERSION };
  }

  /* ============================== 内容视图 ==============================*/
  function episodesFor(acc, drama, full) {
    var likes = acc.likes[drama.vid] || {};
    var list = [];
    var max = full ? drama.total : 1;
    for (var i = 1; i <= max; i++) {
      var ep = {
        id: drama.vid + '_ep_' + i,
        index: i,
        fileId: 'file_' + drama.vid + '_' + i,
        coverImage: 'assets/posters/' + drama.vid + '.jpg',
        isLiked: !!likes[i],
        totalLikeCount: 1200 + ((drama.collectBase + i * 37) % 900) + (likes[i] ? 1 : 0)
      };
      list.push(ep);
    }
    return list;
  }

  function dramaView(acc, drama, full, lang) {
    lang = lang || 'en';
    var tags = drama.tags.map(function (code) {
      var t = TAGS.filter(function (x) { return x.tagCode === code; })[0];
      return t ? tagView(t, lang) : { tagCode: code, tagName: code, tagNameLanguage: code };
    });
    var cat = CATEGORIES.filter(function (c) { return c.categoryCode === drama.categoryCode; })[0] || CATEGORIES[0];
    var collected = !!acc.collect[drama.vid];
    var view = {
      vid: drama.vid,
      title: titleOf(drama, lang),
      total: drama.total,
      desc: descOf(drama, lang),
      coverImage: 'assets/posters/' + drama.vid + '.jpg',
      thumbnailLargeUrl: 'assets/posters/' + drama.vid + '.jpg',
      thumbnailMediumUrl: 'assets/posters/' + drama.vid + '.jpg',
      thumbnailSmallUrl: 'assets/posters/' + drama.vid + '.jpg',
      language: lang,
      sType: drama.sType,
      publishTime: PUBLISH[drama.vid],
      isCollected: collected,
      totalCollectCount: drama.collectBase + (collected ? 1 : 0),
      categories: [{ categoryCode: cat.categoryCode, categoryNameLanguage: cat.name[lang] }],
      tags: tags.map(function (t) { return { tagCode: t.tagCode, tagNameLanguage: t.tagNameLanguage }; }),
      episodes: episodesFor(acc, drama, full)
    };
    return view;
  }

  /* ============================== 路由处理 ==============================*/
  function listDramas(acc, data) {
    var page = Math.max(1, Number(data.pageIndex) || 1);
    var count = Math.max(1, Math.min(50, Number(data.count) || 20));
    var list = DRAMAS.slice();
    if (data.vids && data.vids.length) {
      list = list.filter(function (d) { return data.vids.indexOf(d.vid) >= 0; });
    }
    if (data.categoryCode && data.categoryCode !== 'all') {
      list = list.filter(function (d) { return d.categoryCode === data.categoryCode; });
    }
    if (data.keyword) {
      /* 线上口径：按剧名模糊匹配（中英任一语种标题命中即可）；简介、标签不参与 */
      var lkw = String(data.keyword).toLowerCase();
      list = list.filter(function (d) { return [d.title.zh, d.title.en].some(function (t) { return String(t).toLowerCase().indexOf(lkw) >= 0; }); });
    }
    /* default = 推荐（按分类交错，避免同题材扎堆）；hot = 收藏数；new = 发布时间 */
    if (!data.sort || data.sort === 'default') {
      var buckets = {}, order = [];
      list.forEach(function (d) { if (!buckets[d.categoryCode]) { buckets[d.categoryCode] = []; order.push(d.categoryCode); } buckets[d.categoryCode].push(d); });
      order.forEach(function (k) { buckets[k].sort(function (a, b) { return b.collectBase - a.collectBase; }); });
      var mixed = [], more = true;
      for (var round = 0; more; round++) { more = false; order.forEach(function (k) { if (buckets[k][round]) { mixed.push(buckets[k][round]); more = true; } }); }
      list = mixed;
    }
    /* hot = 收藏数；new = 发布时间 */
    if (data.sort === 'hot') list.sort(function (a, b) { return b.collectBase - a.collectBase; });
    if (data.sort === 'new') list.sort(function (a, b) { return PUBLISH[b.vid] < PUBLISH[a.vid] ? -1 : 1; });
    var start = (page - 1) * count;
    var slice = list.slice(start, start + count);
    return {
      list: slice.map(function (d) { return dramaView(acc, d, !!(data.vids && data.vids.length), data._lang); }),
      total: list.length,
      pageIndex: page,
      count: count,
      hasNextPage: start + count < list.length
    };
  }

  function handleTokens(acc, headers, data, baseInfo) {
    /* paramMd5 = MD5(uid + appId + appSecret + pkgName)；复用参考 SDK 的 MD5 实现 */
    var sdk = global.LAAFFIC && global.LAAFFIC.ContentSDK;
    var md5 = sdk && sdk.__internal && sdk.__internal.md5;
    if (md5) {
      var app = APPS[headers.appId];
      var expect = md5(String(headers.uid) + headers.appId + app.appSecret + (baseInfo.pkgName || app.pkgName));
      if (data.paramMd5 !== expect) return fail(1001, 'paramMd5 mismatch');
    }
    var token = hex(32);
    state.tokens[token] = {
      token: token, uid: acc.uid, appId: headers.appId,
      createdAt: Date.now(), expiresAt: Date.now() + 7200 * 1000
    };
    save();
    return ok({
      token: token,
      expiresIn: 7200,
      vodAppId: '1500012345',
      vodLicenseKey: 'license_demo_' + hex(8),
      vodLicenseUrl: 'mock://vod/license/v1'
    });
  }

  async function route(method, path, headers, rawBody, body) {
    var app = APPS[headers.appId];
    if (!app) return fail(1001, 'appId not authorized');
    var baseInfo = (body && body.baseInfo) || {};
    var data = (body && body.data) || {};
    if (baseInfo.pkgName && baseInfo.pkgName !== app.pkgName) {
      return fail(1001, 'pkgName does not match app registration');
    }
    var acc = ensureAccount(String(headers.uid));
    var lang = pickLang(data, baseInfo);

    /* 1002 注入：签名与 token 正常流程仍会走，第二个请求起持续过期 */
    if (errorMode === 'error1002' && path !== '/sdk/app/getAccessToken') {
      return fail(1002, 'Token expired (injected 1002). Re-init the SDK.');
    }
    if (errorMode === 'error1001') return fail(1001, 'Signature check failed (injected 1001)');

    if (path === '/sdk/app/getAccessToken') return handleTokens(acc, headers, data, baseInfo);
    if (!headers.token || !state.tokens[headers.token]) return fail(1002, 'Token invalid or expired');
    var tok = state.tokens[headers.token];
    if (tok.expiresAt < Date.now()) return fail(1002, 'Token expired');
    if (tok.uid !== headers.uid || tok.appId !== headers.appId) return fail(1002, 'Token does not match uid/appId');

    switch (path) {
      case '/sdk/app/getLanguageList':
        return ok({ list: LANGUAGES });

      case '/sdk/app/getCategoryList':
        return ok({ list: CATEGORIES.map(function (c) { return catView(c, lang); }) });

      case '/sdk/app/getTagList':
        return ok({ list: TAGS.map(function (t) { return tagView(t, lang); }) });

      case '/sdk/app/getDefaultDramasList': {
        var payload = listDramas(acc, Object.assign({}, data, { _lang: lang }));
        return ok(payload);
      }

      case '/sdk/app/searchDramas': {
        var res = listDramas(acc, {
          pageIndex: data.pageIndex, count: data.count,
          keyword: data.keyword, categoryCode: data.categoryCode,
          sort: data.sort, vids: data.vids, _lang: lang
        });
        return ok({ list: res.list, total: res.total, pageIndex: res.pageIndex, count: res.count, hasNextPage: res.hasNextPage, keyword: data.keyword || '' });
      }

      case '/sdk/app/refreshPlayUrl': {
        var drama = dramaByVid(data.vid);
        if (!drama) return fail(3001, 'Content is no longer available');
        var indexes = data.episodes || data.indexes || [];
        if (indexes.length > 20) return fail(4000, 'episodes: at most 20 per request');
        if (!indexes.length) {
          indexes = [];
          for (var i = 1; i <= drama.total; i++) indexes.push(i);
        }
        var expireTime = Date.now() + 3600 * 1000;
        var list = indexes.map(function (idx) {
          var n = Number(idx);
          return {
            index: n,
            episode: n,
            fileId: 'file_' + drama.vid + '_' + n,
            playInfoUrl: clipOf(drama),
                   expireTime: expireTime,
            playerSign: 'psign_' + md5ish(drama.vid + '_' + n + '_' + expireTime)
          };
        });
        return ok({ vid: drama.vid, total: drama.total, episodes: list, expireTime: expireTime });
      }

      case '/sdk/app/userAction': {
        var d = dramaByVid(data.vid);
        if (!d) return fail(3001, 'Content is no longer available');
        var action = data.action;
        var status;
        if (action === 'collect') {
          var want = data.status === undefined ? !acc.collect[data.vid] : !!data.status;
   acc.collect[data.vid] = want;
   acc.collectAt = acc.collectAt || {};
   if (want) acc.collectAt[data.vid] = Date.now();
          status = want;
        } else if (action === 'like') {
          var epIdx = Number(data.episode) || 1;
          acc.likes[data.vid] = acc.likes[data.vid] || {};
          var wantLike = data.status === undefined ? !acc.likes[data.vid][epIdx] : !!data.status;
          acc.likes[data.vid][epIdx] = wantLike;
          status = wantLike;
        } else if (action === 'played') {
          acc.watched[data.vid] = acc.watched[data.vid] || [];
          var e2 = Number(data.episode) || 1;
          if (acc.watched[data.vid].indexOf(e2) < 0) acc.watched[data.vid].push(e2);
          status = true;
        } else {
          return fail(4000, 'Unsupported action (collect / like / played)');
        }
        save();
        return ok({
          action: action, status: status,
          vid: data.vid, episode: Number(data.episode) || 0
        });
      }

      case '/sdk/app/getFavList': {
        var favPage = Math.max(1, Number(data.pageIndex) || 1);
        var favSize = Math.max(1, Math.min(50, Number(data.count) || 20));
        acc.collectAt = acc.collectAt || {};
        var favAll = DRAMAS.filter(function (d) { return !!acc.collect[d.vid]; })
   .sort(function (a, b) { return (acc.collectAt[b.vid] || 0) - (acc.collectAt[a.vid] || 0); })
   .map(function (d) {
     var v = dramaView(acc, d, false, lang);
     return { vid: v.vid, title: v.title, total: v.total, coverImage: v.coverImage, categories: v.categories, tags: v.tags };
   });
        var favStart = (favPage - 1) * favSize;
        return ok({ list: favAll.slice(favStart, favStart + favSize), total: favAll.length, pageIndex: favPage, count: favSize, hasNextPage: favStart + favSize < favAll.length });
      }

      case '/sdk/app/getLikeList': {
        var likePage = Math.max(1, Number(data.pageIndex) || 1);
        var likeSize = Math.max(1, Math.min(50, Number(data.count) || 20));
        var likeAll = [];
        Object.keys(acc.likes || {}).forEach(function (vid) {
          var d = dramaByVid(vid);
          if (!d) return;
          Object.keys(acc.likes[vid]).forEach(function (ep) {
            if (acc.likes[vid][ep]) likeAll.push({ vid: vid, title: titleOf(d, lang), total: d.total, episode: Number(ep), coverImage: 'assets/posters/' + vid + '.jpg' });
          });
        });
        var likeStart = (likePage - 1) * likeSize;
        return ok({ list: likeAll.slice(likeStart, likeStart + likeSize), total: likeAll.length, pageIndex: likePage, count: likeSize, hasNextPage: likeStart + likeSize < likeAll.length });
      }

      case '/sdk/app/getPlaceholder': {
        var pool = PLACEHOLDERS[lang] || [];
 return ok({ keywords: pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [], language: lang });
      }

      case '/sdk/app/refreshPlayFile': {
        var fd = dramaByVid(data.vid);
        if (!fd) return fail(3001, 'Content is no longer available');
        var fIdx = data.episodes || data.indexes || [];
        if (fIdx.length > 20) return fail(4000, 'episodes: at most 20 per request');
        if (!fIdx.length) { fIdx = []; for (var k = 1; k <= fd.total; k++) fIdx.push(k); }
        var fExpire = Date.now() + 3600 * 1000;
        var fList = fIdx.map(function (idx) {
          var n = Number(idx);
          return {
            index: n, episode: n,
            fileId: 'file_' + fd.vid + '_' + n,
            playInfoUrl: clipOf(fd),
            expireTime: fExpire,
            playerSign: 'psign_' + md5ish(fd.vid + '_' + n + '_' + fExpire)
          };
        });
        return ok({ vid: fd.vid, total: fd.total, episodes: fList, expireTime: fExpire });
      }

      case '/sdk/app/log/play': {
        acc.playLogs.unshift({
          fileId: data.fileId, action: data.action, positionMs: data.positionMs,
          vid: data.vid, episode: data.episode, at: Date.now()
        });
        if (acc.playLogs.length > 60) acc.playLogs.length = 60;
        save();
        return ok({ received: true, action: data.action, fileId: data.fileId, positionMs: data.positionMs });
      }

      default:
        return fail(4004, 'Endpoint not found: ' + path);
    }
  }

  /* ============================== 入口 ==============================*/
  function delayMs() {
    if (errorMode === 'weak') return 1500 + Math.floor(Math.random() * 120);
    return 80 + Math.floor(Math.random() * 220);
  }

  async function request(opts) {
    opts = opts || {};
    var startedAt = Date.now();
    var method = (opts.method || 'POST').toUpperCase();
    var path = opts.path || '';
    var headers = opts.headers || {};
    var body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body || {});
    await sleep(delayMs());

    var result;
    try {
      if (errorMode === 'error1001') {
        result = fail(1001, 'Signature check failed (injected 1001)');
      } else {
        /* 1) 时间戳 */
        var ts = Number(headers.timestamp);
        if (!isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
          result = fail(1003, 'Timestamp expired (±5 min allowed)');
        } else if (!headers.nonce || state.nonces[headers.nonce]) {
          result = fail(1001, headers.nonce ? 'Nonce reused (anti-replay)' : 'Missing nonce');
        } else if (!APPS[headers.appId]) {
          result = fail(1001, 'appId not authorized');
        } else {
          /* 2) 真验签 */
          var app = APPS[headers.appId];
          var plain = method + '\n' + path + '\n' + String(headers.timestamp) + '\n' + String(headers.nonce) + '\n' + body + '\n';
          var expect = await sign(app.appSecret, plain);
          if (expect !== headers.apiSignature) {
            result = fail(1001, 'Signature mismatch. Check appSecret / request body.');
          } else if (app.uids.indexOf(String(headers.uid)) < 0) {
            result = fail(1001, 'uid does not belong to this appId');
          } else {
            /* 3) 记录 nonce（验签通过后） */
            state.nonces[headers.nonce] = Date.now();
            var cutoff = Date.now() - 5 * 60 * 1000;
            Object.keys(state.nonces).forEach(function (n) { if (state.nonces[n] < cutoff) delete state.nonces[n]; });
            save();
            result = await route(method, path, headers, body, parseBody(body));
          }
        }
      }
    } catch (e) {
      result = fail(5000, 'mock gateway error: ' + (e && e.message ? e.message : e));
    }

    var text = JSON.stringify(result);
    return {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-mock-gateway': VERSION },
      body: text,
      meta: { delayMs: Date.now() - startedAt, injected: errorMode }
    };
  }

  function parseBody(body) {
    try { return JSON.parse(body || '{}'); } catch (e) { return {}; }
  }

  /* ============================== 调试面 ==============================*/
  var MODES = ['normal', 'weak', 'error1001', 'error1002'];

  function setErrorMode(mode) {
    if (MODES.indexOf(mode) < 0) return false;
    errorMode = mode;
    return true;
  }
  function getErrorMode() { return errorMode; }

  function reset() {
    storageRemove();
    state = seedState();
    errorMode = 'normal';
    save();
    return true;
  }

  load();

  global.LAAFFICMockGateway = {
    VERSION: VERSION,
    APPS: APPS,
    request: request,
    setErrorMode: setErrorMode,
    getErrorMode: getErrorMode,
    modes: MODES.slice(),
    reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
