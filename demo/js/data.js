/* =============
 * NEON STACK · 配置
 * sdk  —— LAAFFIC 内容 API 接入参数（开通后由 LAAFFIC 下发）
 * game —— 游戏自身的经济与数值（与 LAAFFIC 无关）
 * ===========*/
(function (global) {
  'use strict';
  global.LAFFIC_DEMO = {
    version: '6.0.0',
    sdk: {
      appId: 'laffic_demo_001',
      appSecret: 'LAAFFIC_DEMO_168',
      uid: 'demo_user_8848',
      pkgName: 'ai.laffic.demo',
      debug: false,
      // 'mock' = 随包本地参考网关（离线演示）；'live' = 正式 API（建议经自己的 BFF 代理签名）
      mode: 'mock',
      baseUrl: 'mock://local',
      liveBaseUrl: 'https://open.laaffic.io/sdk'
    },
    game: {
      storeKey: 'neon_save_v6',
      start: { coins: 1200, gems: 60, energy: 5, bombs: 2, slows: 2, level: 5, xp: 340 },
      energyMax: 5,
      energyRegenMs: 10 * 60 * 1000,
      refillGems: 30,
      reviveGems: 20,
      blitzMs: 120000,
      dailyGoal: 20,
      blitzUnlockLv: 3,
      dailyUnlockLv: 5,
      coinPerScore: 0.02,   // 结算：每 50 分 1 金币
      starScores: [1500, 5000, 12000],
      watchCoins: 50,       // 剧场里看完一集
      watchDailyLimit: 5,
      bombPrice: 300,
      slowPrice: 200,
      xpPerGame: 40,
      xpPerLevel: 500,
      checkin: [100, 150, 200, 250, 300, 400, { gems: 50 }],
      skins: [
        { id: 'candy', price: 0, style: 'candy', palette: null },
        { id: 'ocean', price: 1500, style: 'candy', palette: { I: '#5EE7FF', O: '#9CF6FF', T: '#3E8BFF', S: '#2FD3B5', Z: '#6C7BFF', J: '#2357D9', L: '#7FD7FF' } },
 { id: 'sunset', price: 2500, style: 'candy', palette: { I: '#FFB86B', O: '#FFE07A', T: '#FF7A9A', S: '#FF9F5A', Z: '#FF5E7A', J: '#C76BFF', L: '#FFC56B' } },
        { id: 'gem', price: 120, currency: 'gems', style: 'gem', palette: { I: '#38E1FF', O: '#FFD447', T: '#C77DFF', S: '#4CE68A', Z: '#FF4D6D', J: '#4D7CFF', L: '#FF9F43' } }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
