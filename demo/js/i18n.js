/* =============
 * NEON STACK · 界面文案（中 / 英）
 * 剧名、简介、分类、标签由内容 API 按语种返回，不在这里维护。
 * ===========*/
(function (global) {
  'use strict';
  var DICT = {
    zh: {
      'splash.tips': ['正在整理方块…', '正在准备今日挑战…', '正在加载剧场…'],
      'common.new': '新', 'common.ok': '好的', 'common.close': '关闭', 'common.free': '免费', 'common.claim': '领取', 'common.claimed': '已领取', 'common.go': '去完成',
      'tab.home': '首页', 'tab.tasks': '任务', 'tab.theater': '剧场', 'tab.shop': '商店', 'tab.me': '我',
      'home.best': '最高分', 'home.play': '开始游戏', 'home.daily': '每日任务', 'home.checkin': '签到', 'home.rank': '排行', 'home.theater': '剧场',
      'mode.classic': '经典', 'mode.classicSub': '无尽模式',
      'mode.blitz': '限时', 'mode.blitzSub': '2 分钟冲分',
      'mode.daily': '每日挑战', 'mode.dailySub': '消 {n} 行', 'mode.dailyDone': '今日已完成', 'mode.lockLv': '{n} 级解锁',
      'game.next': '下一个', 'game.level': '第 {l} 级 · {n} 行', 'game.gesture': '左右滑动移动 · 点击旋转 · 下滑落下',
      'game.time': '剩余 {s} 秒', 'game.goal': '还差 {n} 行',
      'combo.2': '漂亮！', 'combo.3': '太棒了！', 'combo.4': '完美四消！', 'combo.chain': '{n} 连击',
      'pause.title': '暂停', 'pause.resume': '继续游戏', 'pause.restart': '重新开始', 'pause.quit': '回到首页', 'pause.quitTip': '退出后本局分数不保存',
      'revive.title': '继续挑战？', 'revive.body': '清除底部 4 行，分数保留', 'revive.gems': '{n} 钻石复活', 'revive.watch': '看一集短剧复活', 'revive.skip': '不了，结算',
      'result.title': '本局结束', 'result.win': '挑战成功', 'result.best': '最高分 {v}', 'result.newBest': '新纪录！',
      'result.lines': '消行', 'result.level': '等级', 'result.time': '用时',
      'result.double': '看一集短剧 奖励翻倍', 'result.collect': '领取', 'result.again': '再来一局', 'result.home': '回到首页',
      'reward.doubled': '奖励已翻倍', 'reward.got': '获得 {n} 金币',
      'energy.title': '体力不足', 'energy.body': '每 10 分钟恢复 1 点体力，也可以用钻石补满或看一集短剧免费领取。', 'energy.refill': '{n} 钻石补满', 'energy.watch': '看一集短剧 +1 体力', 'energy.next': '{t} 后恢复 1 点',
      'theater.title': '剧场', 'theater.search': '搜剧名、演员、题材', 'theater.sortDefault': '推荐', 'theater.sortHot': '最多收藏', 'theater.sortNew': '最新上架',
      'theater.all': '全部', 'theater.empty': '没找到相关短剧，换个词试试', 'theater.results': '“{k}” 共 {n} 部',
      'theater.continue': '继续观看', 'theater.epOf': '第 {e} 集 / 共 {n} 集', 'theater.eps': '{n} 集', 'theater.done': '完结', 'theater.ongoing': '连载中', 'theater.hot': '本周热播 Top 10',
      'theater.saves': '{n} 收藏', 'theater.newTag': '新剧上线', 'theater.seeAll': '全部 {n} 部', 'theater.allShows': '全部短剧', 'theater.loading': '加载中…', 'theater.end': '共 {n} 部，已经到底了', 'theater.ongoingEps': '更新至 {n} 集', 'theater.watchBonus': '看完 1 集 +{n} 金币',
      'detail.play': '播放第 {e} 集', 'detail.start': '立即观看', 'detail.eps': '选集 · 共 {n} 集', 'detail.released': '{d} 上架', 'detail.saved': '已收藏', 'detail.save': '收藏',
      'player.episodes': '选集', 'player.ep': '第 {e} 集 · 共 {n} 集', 'player.rewardTip': '看完可领奖励', 'player.rewardGot': '奖励已到账', 'player.last': '已是最后一集',
      'player.quitTitle': '现在退出？', 'player.quitBody': '看完这一集才能领取奖励', 'player.keep': '继续看', 'player.quit': '放弃奖励',
      'tasks.title': '任务', 'tasks.streak': '连续签到', 'tasks.streakDays': '已连续 {n} 天', 'tasks.day': '第 {n} 天', 'tasks.checkin': '签到领取',
      'task.play3': '完成 3 局游戏', 'task.lines30': '累计消除 30 行', 'task.score5k': '单局得分达到 5,000', 'task.watch2': '在剧场看完 2 集短剧', 'task.bomb': '使用 1 次炸弹',
      'shop.title': '商店', 'shop.items': '道具', 'shop.skins': '皮肤', 'shop.coins': '金币',
      'item.bomb': '炸弹', 'item.bombDesc': '清除落点周围 3×3', 'item.slow': '减速', 'item.slowDesc': '30 秒内下落变慢',
      'item.pack': '新手礼包', 'item.packDesc': '炸弹 ×5 · 减速 ×5 · 200 钻石', 'item.limited': '限时',
      'skin.candy': '糖果', 'skin.ocean': '深海', 'skin.sunset': '晚霞', 'skin.gem': '宝石', 'skin.equip': '使用', 'skin.inUse': '使用中',
      'coins.free': '看一集短剧', 'coins.freeDesc': '每天 5 次', 'coins.leftToday': '今日剩 {n} 次',
      'iap.note': '演示版本不接入真实支付', 'iap.p1': '¥6', 'iap.p2': '¥30', 'iap.p3': '¥68',
      'me.watching': '在看的剧', 'me.saved': '收藏的剧', 'me.empty': '还没有，去剧场看看',
      'me.games': '对局', 'me.best': '最高分', 'me.lines': '消行', 'me.lv': '等级 {n} · 再得 {x} 经验升级',
      'set.title': '设置', 'set.sound': '音效', 'set.music': '音乐', 'set.haptic': '振动', 'set.lang': '语言', 'set.privacy': '隐私政策', 'set.terms': '用户协议', 'set.reset': '清除本地数据',
      'set.resetConfirm': '确定清除？金币、道具和进度会重置。', 'set.version': '版本 {v}',
      'dev.title': '开发者面板', 'dev.body': '本 App 调用 LAAFFIC 内容 API 的实时记录。短剧内容（剧库、详情、播放、收藏点赞）来自 API；金币、任务、道具、体力为游戏自身逻辑。', 'dev.empty': '还没有请求', 'dev.unlocked': '已开启开发者面板',
      'rank.title': '本周排行', 'rank.me': '我',
      'toast.noCoins': '金币不够了', 'toast.noGems': '钻石不够了', 'toast.bought': '购买成功', 'toast.equipped': '已换上 {n}', 'toast.loadFail': '网络开小差了，请稍后重试', 'toast.reqFail': '内容加载失败（{c}），请重试',
      'toast.noItem': '道具不够，去商店看看', 'toast.limitWatch': '今天的次数用完了', 'toast.privacy': '演示版本暂不提供', 'toast.checked': '签到成功', 'toast.notDone': '没看完，奖励未发放', 'toast.saved': '已收藏', 'toast.unsaved': '已取消收藏'
    },
    en: {
      'splash.tips': ['Stacking blocks…', 'Preparing today\'s challenge…', 'Loading the theater…'],
      'common.new': 'NEW', 'common.ok': 'OK', 'common.close': 'Close', 'common.free': 'Free', 'common.claim': 'Claim', 'common.claimed': 'Claimed', 'common.go': 'Go',
      'tab.home': 'Home', 'tab.tasks': 'Tasks', 'tab.theater': 'Theater', 'tab.shop': 'Shop', 'tab.me': 'Me',
      'home.best': 'Best', 'home.play': 'Play', 'home.daily': 'Daily', 'home.checkin': 'Rewards', 'home.rank': 'Ranks', 'home.theater': 'Theater',
      'mode.classic': 'Classic', 'mode.classicSub': 'Endless',
      'mode.blitz': 'Blitz', 'mode.blitzSub': '2-min sprint',
      'mode.daily': 'Daily', 'mode.dailySub': 'Clear {n} lines', 'mode.dailyDone': 'Done today', 'mode.lockLv': 'Unlocks at Lv {n}',
      'game.next': 'Next', 'game.level': 'Level {l} · {n} lines', 'game.gesture': 'Swipe to move · Tap to rotate · Swipe down to drop',
      'game.time': '{s}s left', 'game.goal': '{n} lines to go',
      'combo.2': 'Nice!', 'combo.3': 'Great!', 'combo.4': 'Tetris!', 'combo.chain': '{n}x combo',
      'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.restart': 'Restart', 'pause.quit': 'Home', 'pause.quitTip': 'Your score for this game won\'t be saved',
      'revive.title': 'Keep going?', 'revive.body': 'Clear the bottom 4 rows and keep your score', 'revive.gems': 'Revive for {n} gems', 'revive.watch': 'Watch an episode to revive', 'revive.skip': 'No thanks',
      'result.title': 'Game over', 'result.win': 'Challenge complete', 'result.best': 'Best {v}', 'result.newBest': 'New best!',
      'result.lines': 'Lines', 'result.level': 'Level', 'result.time': 'Time',
      'result.double': 'Watch an episode to double', 'result.collect': 'Collect', 'result.again': 'Play again', 'result.home': 'Home',
      'reward.doubled': 'Reward doubled', 'reward.got': '+{n} coins',
      'energy.title': 'Out of energy', 'energy.body': 'Energy refills 1 every 10 minutes. Refill now with gems, or watch an episode for 1 free energy.', 'energy.refill': 'Refill for {n} gems', 'energy.watch': 'Watch an episode · +1 energy', 'energy.next': 'Next in {t}',
      'theater.title': 'Theater', 'theater.search': 'Search titles and genres', 'theater.sortDefault': 'For you', 'theater.sortHot': 'Most saved', 'theater.sortNew': 'New',
      'theater.all': 'All', 'theater.empty': 'Nothing found. Try another word.', 'theater.results': '{n} results for “{k}”',
      'theater.continue': 'Continue watching', 'theater.epOf': 'Episode {e} of {n}', 'theater.eps': '{n} eps', 'theater.done': 'Complete', 'theater.ongoing': 'Ongoing', 'theater.hot': 'Top 10 this week',
      'theater.saves': '{n} saves', 'theater.newTag': 'New release', 'theater.seeAll': 'All {n}', 'theater.allShows': 'All shows', 'theater.loading': 'Loading…', 'theater.end': '{n} shows · that is all for now', 'theater.ongoingEps': '{n} eps · ongoing', 'theater.watchBonus': '+{n} coins per episode',
      'detail.play': 'Play episode {e}', 'detail.start': 'Watch now', 'detail.eps': 'Episodes · {n}', 'detail.released': 'Released {d}', 'detail.saved': 'Saved', 'detail.save': 'Save',
      'player.episodes': 'Episodes', 'player.ep': 'Episode {e} of {n}', 'player.rewardTip': 'Finish to claim', 'player.rewardGot': 'Reward claimed', 'player.last': 'This is the last episode',
      'player.quitTitle': 'Leave now?', 'player.quitBody': 'Finish this episode to get your reward', 'player.keep': 'Keep watching', 'player.quit': 'Leave',
      'tasks.title': 'Tasks', 'tasks.streak': 'Daily rewards', 'tasks.streakDays': '{n}-day streak', 'tasks.day': 'Day {n}', 'tasks.checkin': 'Claim today',
      'task.play3': 'Play 3 games', 'task.lines30': 'Clear 30 lines', 'task.score5k': 'Score 5,000 in one game', 'task.watch2': 'Watch 2 episodes in Theater', 'task.bomb': 'Use a bomb',
      'shop.title': 'Shop', 'shop.items': 'Items', 'shop.skins': 'Skins', 'shop.coins': 'Coins',
      'item.bomb': 'Bomb', 'item.bombDesc': 'Clears a 3×3 area', 'item.slow': 'Slow-mo', 'item.slowDesc': 'Slower drops for 30s',
      'item.pack': 'Starter pack', 'item.packDesc': '5 bombs · 5 slow-mo · 200 gems', 'item.limited': 'Limited',
      'skin.candy': 'Candy', 'skin.ocean': 'Ocean', 'skin.sunset': 'Sunset', 'skin.gem': 'Jewel', 'skin.equip': 'Equip', 'skin.inUse': 'In use',
      'coins.free': 'Watch an episode', 'coins.freeDesc': '5 times a day', 'coins.leftToday': '{n} left today',
      'iap.note': 'Payments are disabled in this build', 'iap.p1': '$0.99', 'iap.p2': '$4.99', 'iap.p3': '$9.99',
      'me.watching': 'Watching', 'me.saved': 'Saved shows', 'me.empty': 'Nothing yet. Visit the Theater.',
      'me.games': 'Games', 'me.best': 'Best', 'me.lines': 'Lines', 'me.lv': 'Level {n} · {x} XP to next',
      'set.title': 'Settings', 'set.sound': 'Sound', 'set.music': 'Music', 'set.haptic': 'Vibration', 'set.lang': 'Language', 'set.privacy': 'Privacy policy', 'set.terms': 'Terms of service', 'set.reset': 'Clear local data',
      'set.resetConfirm': 'Clear all data? Coins, items and progress will reset.', 'set.version': 'Version {v}',
      'dev.title': 'Developer panel', 'dev.body': 'Live calls this app makes to the LAAFFIC Content API. Shows, details, playback and saves/likes come from the API; coins, tasks, items and energy are the game\'s own logic.', 'dev.empty': 'No requests yet', 'dev.unlocked': 'Developer panel enabled',
      'rank.title': 'This week', 'rank.me': 'You',
      'toast.noCoins': 'Not enough coins', 'toast.noGems': 'Not enough gems', 'toast.bought': 'Purchased', 'toast.equipped': '{n} equipped', 'toast.loadFail': 'Connection problem. Try again shortly.', 'toast.reqFail': 'Couldn\'t load content ({c}). Try again.',
      'toast.noItem': 'Out of items. Visit the shop.', 'toast.limitWatch': 'No more today', 'toast.privacy': 'Not available in this build', 'toast.checked': 'Claimed', 'toast.notDone': 'Not finished — no reward', 'toast.saved': 'Saved', 'toast.unsaved': 'Removed from saved'
    }
  };

  var KEY = 'neon_lang';
  var lang = 'zh';
  try {
    var s = localStorage.getItem(KEY);
    if (s === 'zh' || s === 'en') lang = s;  /* 默认中文；设置里可切 English */
  } catch (e) { /* ignore */ }

  function t(key, p) {
    var v = (DICT[lang] && DICT[lang][key]);
    if (v == null) v = DICT.en[key];
    if (v == null) return key;
    if (typeof v !== 'string') return v;
    return p ? v.replace(/\{(\w+)\}/g, function (m, k) { return p[k] != null ? p[k] : m; }) : v;
  }
  function apply(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }
  var subs = [];
  global.I18N = {
    t: t, apply: apply,
    get lang() { return lang; },
    setLang: function (l) {
      if ((l !== 'zh' && l !== 'en') || l === lang) return;
      lang = l;
      try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
      apply();
      subs.forEach(function (f) { try { f(l); } catch (e) { /* ignore */ } });
    },
    onChange: function (f) { subs.push(f); },
    has: function (k) { return DICT.zh[k] != null && DICT.en[k] != null; },
    keys: function () { return [Object.keys(DICT.zh), Object.keys(DICT.en)]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
