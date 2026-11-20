/* =============
 * LAAFFIC 本地演示剧库（mock 网关使用；线上由内容 API 返回）
 * 42 部 · 10 个分类 · 中 / 英双语。海报 assets/posters/<vid>.jpg；样片按题材复用 assets/clips30/*.mp4
 * ===========*/
(function (global) {
  'use strict';
  var C = [
    ['urban', '都市', 'Urban'], ['romance', '甜宠', 'Romance'], ['ceo', '豪门总裁', 'Billionaire'],
    ['revenge', '逆袭', 'Comeback'], ['suspense', '悬疑', 'Mystery'], ['fantasy', '奇幻', 'Fantasy'],
    ['werewolf', '狼人', 'Werewolf'], ['costume', '古装', 'Period'], ['war', '战神', 'Legend'], ['family', '家庭', 'Family']
  ];
  var TG = [
    ['counterattack', '逆袭', 'Comeback'], ['revenge', '复仇', 'Revenge'], ['sweet', '甜宠', 'Sweet'], ['contract', '契约婚姻', 'Contract marriage'],
    ['suspense', '悬疑', 'Suspense'], ['twist', '反转', 'Twist'], ['werewolf', '狼人', 'Werewolf'], ['destiny', '宿命', 'Destiny'],
    ['rebirth', '重生', 'Rebirth'], ['hidden', '隐藏身份', 'Hidden identity'], ['cute', '萌宝', 'Cute kid'], ['ceo', '霸总', 'CEO'],
    ['palace', '宫斗', 'Palace'], ['medic', '神医', 'Healer'], ['war', '战神', 'War god'], ['family', '亲情', 'Family ties'],
    ['star', '娱乐圈', 'Showbiz'], ['crime', '探案', 'Crime'], ['time', '穿越', 'Time travel'], ['system', '系统', 'System']
  ];
  /* vid, cat, total, sType, publish, saves, tags, clip, poster, zhTitle, zhDesc, enTitle, enDesc */
  var D = [
    ['qianwang', 'urban', 72, 1, '2026-09-02', 48213, ['counterattack', 'revenge'], 'qianwang', null, '逆光而来', '被逐出家门的沈砚，在父亲病倒那晚回到老宅，撞见了十年前那场大火的真相。', 'Chasing the Light', 'Cast out by his family, Shen Yan returns home the night his father collapses and walks into the truth behind a fire ten years ago.'],
    ['baofu', 'ceo', 80, 1, '2026-10-18', 36580, ['hidden', 'twist'], 'baofu', null, '豪门从天而降', '外卖员救下一位老人，醒来成了集团继承人。所有人都说他走运，只有他知道这场相认从一开始就是局。', 'High Stakes', 'A delivery rider saves an old man and wakes up as heir to a conglomerate. Everyone calls it luck. He knows the reunion was a trap.'],
    ['tianchong', 'romance', 90, 0, '2026-11-08', 72106, ['sweet', 'contract'], 'tianchong', null, '契约新娘', '为了救母亲，她签下三个月的婚约。最后一天，那个从不回家的丈夫撕掉了离婚协议。', 'The Contract Bride', 'To save her mother, she signs a three-month marriage contract. On the last day, the husband who never came home tears up the divorce papers.'],
    ['xiaoxiong', 'suspense', 60, 1, '2026-08-21', 28933, ['suspense', 'crime'], 'xiaoxiong', null, '夜宴疑云', '十二位客人，一间密室。主人死了，所有人都说自己没离开过餐桌，可桌上少了一副餐具。', 'Night Banquet', 'Twelve guests, one locked room. The host is dead, everyone swears they never left the table, and one place setting is missing.'],
    ['wodi', 'suspense', 64, 1, '2026-10-03', 25470, ['suspense', 'twist'], 'wodi', null, '双面卧底', '入职第一天，他发现自己的工位属于一个三年前就死了的人。全公司都记得那个人，除了他自己。', 'Double Agent', 'On his first day, he finds his desk belonged to a man who died three years ago. The whole company remembers him, except him.'],
    ['xixuegui', 'fantasy', 70, 0, '2026-11-15', 19862, ['werewolf', 'destiny'], 'xixuegui', null, '吸血鬼的新娘', '血月之夜，她被选为新娘。新郎不是人类，而整个村子都在等这场婚礼结束。', 'The Vampire\'s Bride', 'On the night of the red moon she is chosen as the bride. The groom is not human, and the whole village is waiting for the wedding to end.'],

    ['shanhun', 'ceo', 88, 1, '2026-10-26', 91240, ['ceo', 'hidden'], 'baofu', 'mansion|gold|couple', '闪婚总裁是首富', '她以为嫁了个穷司机，直到婚礼当天，整条街的豪车都在等他。', 'Married to the Secret Billionaire', 'She thought she married a broke driver, until every luxury car in the city showed up at the wedding.'],
    ['lihun', 'ceo', 76, 1, '2026-09-30', 66812, ['revenge', 'hidden'], 'tianchong', 'office|ice|woman', '离婚后前夫追悔莫及', '签完离婚协议那天，她当众摘下了藏了五年的身份。', 'Begging for My Ex-Wife Back', 'The day she signed the divorce papers, she revealed the identity she had hidden for five years.'],
    ['qianjin', 'ceo', 82, 1, '2026-10-12', 54320, ['counterattack', 'family'], 'tianchong', 'ballroom|rose|woman', '真千金回来了', '被抱错二十年的真千金回家，假千金却先一步拿走了一切。', 'The Real Heiress Returns', 'Switched at birth, the real heiress comes home twenty years later, only to find the fake one has taken everything.'],
    ['mengbao', 'ceo', 96, 0, '2026-11-17', 48765, ['cute', 'ceo'], 'tianchong', 'city|peach|family', '萌宝助攻：爹地快追妈咪', '五年前她带着孩子离开，五年后孩子亲手把亲爹拉回了家。', 'Daddy, Win Mommy Back', 'Five years ago she left with their baby. Now the kid is dragging his father back home.'],
    ['tijia', 'romance', 80, 1, '2026-09-14', 83110, ['sweet', 'hidden'], 'tianchong', 'ballroom|rose|couple', '替嫁甜妻', '替姐姐嫁给传闻中毁容的少爷，揭下面具那一刻，她愣住了。', 'The Substitute Bride', 'She marries the rumored disfigured heir in her sister\'s place. When the mask comes off, she can\'t breathe.'],
    ['daojishi', 'romance', 60, 1, '2026-08-30', 39908, ['sweet', 'destiny'], 'tianchong', 'rain|rose|couple', '心动倒计时', '她只剩九十天的记忆，他决定每天重新追她一次。', 'Countdown to Love', 'She has ninety days of memory left. He decides to win her over again every single day.'],
    ['zhuma', 'romance', 70, 0, '2026-11-11', 45602, ['sweet', 'star'], 'tianchong', 'stage|violet|couple', '我的竹马是影帝', '她是十八线小助理，他是全网顶流。可他偏偏只记得小时候那句"长大娶你"。', 'My Childhood Sweetheart Is a Movie Star', 'She is a nobody assistant. He is the biggest star in the country, and he still remembers his childhood promise to marry her.'],
    ['pianchong', 'romance', 66, 1, '2026-10-05', 51230, ['sweet', 'ceo'], 'tianchong', 'city|violet|woman', '偏偏宠你', '全城都知道陆总冷漠，只有她知道，他会在凌晨三点给她煮面。', 'Spoiled Only by You', 'The whole city knows the CEO is cold. Only she knows he cooks her noodles at three in the morning.'],
    ['chongsheng', 'revenge', 84, 1, '2026-09-08', 77405, ['rebirth', 'revenge'], 'qianwang', 'ballroom|crimson|woman', '重生之我是大女主', '被闺蜜和未婚夫联手害死后，她睁开眼，回到了订婚前一天。', 'Reborn to Rule', 'Betrayed and killed by her best friend and fiancé, she wakes up on the day before her engagement.'],
    ['zhuixu', 'revenge', 100, 1, '2026-08-16', 98871, ['hidden', 'counterattack'], 'baofu', 'mansion|gold|man', '赘婿归来', '被岳家看不起三年，他一个电话，叫来了半个商界。', 'The Son-in-Law Strikes Back', 'Looked down on by his in-laws for three years, he makes one phone call and half the business world shows up.'],
    ['caiyuan', 'revenge', 58, 1, '2026-10-21', 33670, ['counterattack', 'system'], 'qianwang', 'office|teal|man', '被裁员后我成了老板', '被裁员的第二天，他收购了这家公司。', 'Fired, Then Hired as CEO', 'The day after he was laid off, he bought the company.'],
    ['zhibo', 'revenge', 62, 0, '2026-11-14', 29014, ['counterattack', 'star'], 'qianwang', 'stage|crimson|woman', '一夜爆红', '摆摊卖了十年煎饼的她，因为一场直播成了全网最想见的人。', 'Viral Overnight', 'After ten years selling street pancakes, one livestream makes her the person everyone wants to meet.'],
    ['diqiye', 'suspense', 48, 1, '2026-09-20', 41250, ['suspense', 'twist'], 'xiaoxiong', 'rain|ice|woman', '第七夜', '连续六晚，同一个陌生号码在午夜打来。第七晚，她接了。', 'The Seventh Night', 'For six nights the same unknown number calls at midnight. On the seventh, she answers.'],
    ['wusheng', 'suspense', 54, 1, '2026-10-09', 30482, ['crime', 'suspense'], 'wodi', 'rain|teal|woman', '无声证人', '唯一的目击者是个哑女，而凶手就住在她隔壁。', 'Silent Witness', 'The only witness can\'t speak, and the killer lives next door.'],
    ['jingzhong', 'suspense', 50, 0, '2026-11-12', 22516, ['suspense', 'twist'], 'wodi', 'home|ice|woman', '镜中人', '搬进新家的第一晚，她发现镜子里的自己慢了半拍。', 'The Woman in the Mirror', 'On her first night in the new house, she notices her reflection is half a second late.'],
    ['wanmei', 'suspense', 60, 1, '2026-08-27', 36004, ['suspense', 'twist'], 'xiaoxiong', 'home|crimson|man', '完美丈夫', '结婚三年，她才发现丈夫每晚都在同一时间出门。', 'The Perfect Husband', 'Three years into the marriage, she realizes her husband leaves the house at the same time every night.'],
    ['longzu', 'fantasy', 90, 0, '2026-11-02', 38820, ['destiny', 'hidden'], 'xixuegui', 'moon|gold|man', '龙族少主', '他在人间当了二十年普通人，直到额头那片鳞开始发光。', 'Heir of the Dragon', 'He lived as an ordinary man for twenty years, until the scale on his forehead began to glow.'],
    ['yueguang', 'fantasy', 72, 1, '2026-09-25', 27140, ['destiny', 'sweet'], 'xixuegui', 'moon|violet|couple', '月光契约', '为了救妹妹，她和月光下的陌生人立了契约。代价是，她必须爱上他。', 'Moonlight Pact', 'To save her sister, she makes a pact with a stranger under the moon. The price: she has to fall in love with him.'],
    ['shikong', 'fantasy', 66, 1, '2026-10-15', 31877, ['time', 'sweet'], 'xixuegui', 'palace|violet|couple', '时空恋人', '每次她睡着，就会醒在一千年前，那个将军的身边。', 'Lovers Across Time', 'Every time she falls asleep, she wakes up a thousand years ago beside the same general.'],
    ['langwang', 'werewolf', 86, 1, '2026-09-11', 102450, ['werewolf', 'revenge'], 'xixuegui', 'moon|ice|woman', '狼王的弃妃', '满月仪式上，狼王当众拒绝了她。没人知道，她才是失落的月神血脉。', 'The Alpha\'s Rejected Mate', 'The alpha rejects her in front of the whole pack at the full moon. No one knows she carries the lost moon goddess\'s blood.'],
    ['yinlang', 'werewolf', 78, 0, '2026-11-06', 61783, ['werewolf', 'destiny'], 'xixuegui', 'moon|teal|wolf', '银狼之心', '被族群驱逐的银狼，在雪夜救下了敌对家族的女儿。', 'Heart of the Silver Wolf', 'An exiled silver wolf saves the daughter of a rival clan on a snowy night.'],
    ['gulang', 'werewolf', 70, 1, '2026-10-01', 47210, ['werewolf', 'sweet'], 'xixuegui', 'moon|crimson|couple', '孤狼与公主', '她是被选来联姻的公主，他是不肯低头的孤狼首领。', 'The Lone Wolf and the Princess', 'She is the princess sent to seal an alliance. He is the lone alpha who refuses to bow.'],
    ['fenggui', 'costume', 92, 1, '2026-09-05', 70356, ['palace', 'revenge'], 'qianwang', 'palace|crimson|robeW', '凤归朝', '冷宫十年，她带着先帝遗诏回到了朝堂。', 'Return of the Empress', 'After ten years in the cold palace, she returns to court with the late emperor\'s final decree.'],
    ['shenyi', 'costume', 80, 1, '2026-10-19', 58420, ['medic', 'counterattack'], 'qianwang', 'palace|teal|robeW', '神医嫡女', '被嫡母陷害投河，她醒来后，一根银针救了整座城。', 'The Genius Healer', 'Framed and thrown into the river by her stepmother, she wakes up and saves the whole city with a single needle.'],
    ['jiangjun', 'costume', 74, 0, '2026-11-09', 40118, ['sweet', 'palace'], 'tianchong', 'palace|rose|couple', '将军的逃跑新娘', '大婚当夜，新娘翻墙跑了。将军笑了：她跑不出我的城。', 'The General\'s Runaway Bride', 'On the wedding night the bride climbs the wall and runs. The general smiles. She can\'t leave his city.'],
    ['changan', 'costume', 64, 1, '2026-08-24', 33392, ['crime', 'suspense'], 'wodi', 'palace|gold|robeM', '长安夜行', '长安城连夜失踪七个更夫，新上任的捕头只有三天。', 'Night Watch of Chang\'an', 'Seven night watchmen vanish from Chang\'an. The new constable has three days.'],
    ['zhanshen', 'war', 100, 1, '2026-08-12', 120880, ['war', 'family'], 'baofu', 'battle|gold|soldier', '战神归来', '退役五年，女儿被欺负的那天，北境三十万将士齐声喊出他的名字。', 'Return of the War God', 'Five years retired, the day his daughter is bullied, three hundred thousand soldiers call his name.'],
    ['longwang', 'war', 96, 1, '2026-09-17', 87210, ['war', 'hidden'], 'baofu', 'city|gold|man', '龙王殿', '他是上门女婿，也是龙王殿唯一的主人。', 'Dragon King\'s Hall', 'To his in-laws he is a useless son-in-law. To the Dragon King\'s Hall, he is the only master.'],
    ['bingwang', 'war', 82, 0, '2026-11-04', 52640, ['war', 'counterattack'], 'qianwang', 'battle|ice|soldier', '最强兵王', '一个人，一把刀，守住了边境线上最后一个哨所。', 'The Last Soldier', 'One man, one blade, holding the last outpost on the border.'],
    ['waimai', 'war', 76, 1, '2026-10-07', 64075, ['hidden', 'war'], 'baofu', 'rain|gold|man', '外卖小哥是战神', '雨夜送餐时，他顺手救了一个被围的女孩。第二天，整座城都在找他。', 'The Delivery Guy Is a Legend', 'Delivering food on a rainy night, he saves a girl from a gang. By morning, the whole city is looking for him.'],
    ['mama', 'family', 60, 1, '2026-09-28', 56740, ['family', 'counterattack'], 'qianwang', 'home|peach|woman', '妈妈的第二人生', '五十岁离婚后，她开了一家面馆，前夫一家排着队来道歉。', 'Mom\'s Second Life', 'Divorced at fifty, she opens a noodle shop, and her ex-husband\'s family lines up to apologize.'],
    ['huijia', 'family', 40, 1, '2026-11-16', 24310, ['family', 'sweet'], 'tianchong', 'home|gold|family', '回家过年', '离家十年的儿子，在除夕夜带回了一个秘密。', 'Home for the New Year', 'After ten years away, a son comes home on New Year\'s Eve with a secret.'],
    ['cuowei', 'family', 70, 0, '2026-10-29', 35021, ['family', 'twist'], 'wodi', 'home|teal|family', '错位人生', '一次亲子鉴定，让两个家庭的二十年全部被推翻。', 'Switched at Birth', 'One paternity test overturns twenty years of two families\' lives.'],
    ['shenhao', 'urban', 90, 0, '2026-11-13', 69800, ['system', 'counterattack'], 'baofu', 'city|teal|man', '神豪系统', '每花一块钱返现十倍。他决定，先把整栋楼买下来。', 'The Billion-Dollar System', 'Every dollar he spends comes back tenfold. He decides to start by buying the whole building.'],
    ['yinghun', 'urban', 68, 1, '2026-09-22', 43380, ['star', 'contract'], 'tianchong', 'stage|rose|woman', '隐婚影后', '颁奖台上，影后说要感谢一个人。台下的总裁，悄悄红了耳朵。', 'The Movie Queen\'s Secret Marriage', 'On stage, the award winner thanks one person. In the audience, a CEO quietly turns red.'],
    ['baobiao', 'urban', 72, 1, '2026-10-24', 38190, ['star', 'hidden'], 'qianwang', 'stage|ice|man', '顶流的保镖', '新来的保镖不说话、不拍照，却在舞台坍塌的那一秒，挡在了她前面。', 'Bodyguard to a Superstar', 'The new bodyguard never talks and never takes photos. When the stage collapses, he is the one in front of her.']
  ];
  global.LAAFFIC_MOCK_CATALOG = {
    categories: C.map(function (c) { return { categoryCode: c[0], name: { zh: c[1], en: c[2] } }; }),
    tags: TG.map(function (t) { return { tagCode: t[0], name: { zh: t[1], en: t[2] } }; }),
    dramas: D.map(function (d) {
      return { vid: d[0], categoryCode: d[1], total: d[2], sType: d[3], publishTime: d[4], collectBase: d[5], tags: d[6], clip: d[7], poster: d[8],
        title: { zh: d[9], en: d[11] }, desc: { zh: d[10], en: d[12] } };
    }),
    placeholders: { zh: ['战神', '重生', '契约婚姻', '狼王', '萌宝', '神医', '豪门'], en: ['Billionaire', 'Werewolf', 'Revenge', 'Rebirth', 'Secret baby', 'Mystery'] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
