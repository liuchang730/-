'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  resumeAudio, playCharge, stopCharge, playJump,
  playLand, playPerfect, playFall, playMilestone,
  playVictory, playContinue, playLandmark, playStart,
} from '@/lib/sounds';

/* ========== MODULE-LEVEL CONSTANTS ========== */
const BG_THRESHOLDS = [0, 10, 20, 30, 40, 50, 70, 80, 90, 100, 110, 130, 150, 160, 170, 180, 190, 200];
const LANDMARK_NAMES = ['校门', '慎思楼', '明辨楼', '图书馆', '行知楼', '诚明楼', '曦池', '小路', '二食堂', '林荫大道', '博学楼', '三食堂', '天猫超市', '小白房子', '博远楼', '琢玉讲堂', '博纳楼', '启铸恭温楼'];
function getBgIndex(score: number): number {
  for (let i = BG_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= BG_THRESHOLDS[i]) return i;
  }
  return 0;
}

/* ========== LOCAL COMMENTARY DATA (奶酪口吻) ========== */
// 地标解说（索引对应bg0~bg17，小猫奶酪口吻，每条约30字）
const LANDMARK_COMMENTARY: string[] = [
  '欢迎来到校门！奶酪陪你逛校园喵～',
  '慎思楼～北边自习圣地，智慧教室超安静喵！',
  '明辨楼～外语金融学院在这，紧挨图书馆喵！',
  '图书馆～校园中心的书海宝藏，快来学习喵！',
  '行知楼～机房实验室齐备，理论实践两不误喵！',
  '诚明楼～阶梯教室普通教室都有，上课方便喵！',
  '曦池～弧形喷泉加睡莲，观景亭超美喵！',
  '小路～去二食堂的必经之路，穿过林荫喵！',
  '二食堂～蜜雪冰城麻辣拌烤盘饭，好吃喵！',
  '林荫大道～绿树成荫风景好，散步超舒服喵！',
  '博学楼～东侧自习+创客社区，预约座位喵！',
  '三食堂～亚洲第一大食堂！三层超多美食喵！',
  '天猫超市～各种商品应有尽有，想买啥有啥喵！',
  '小白房子～喝咖啡晒太阳聊天，超惬意喵！',
  '博远楼～校史馆和会议室在这，办公教学兼具喵！',
  '琢玉讲堂～名师讲座精彩活动，拓展视野喵！',
  '博纳楼～经管教研基地，设施先进喵！',
  '启铸恭温楼～华侨学院主楼，最西边喵！',
];

// 精准落点夸赞
const PERFECT_LAND_TEXTS: string[] = [
  '哇！精准落点！太厉害了喵～',
  '中心满分！手速超棒哒喵！',
  '完美着陆！奶酪崇拜你喵～',
  '太准了！简直是跳一跳大师喵！',
  '精准如猫！落点稳稳的喵～',
];

// 掉落鼓励
const GAME_OVER_TEXTS: string[] = [
  '别灰心喵～再来一次一定行！',
  '没关系哒～奶酪相信你喵！',
  '加油喵～下一把更厉害！',
  '跌倒不可怕，爬起来继续跳喵！',
  '奶酪陪你，一定可以的喵～',
];

// 高分夸赞（按分数段）- 右上方独立对话框
const HIGH_SCORE_TEXTS: Record<number, string> = {
  50: '已达50分！校园一半打卡完成，继续加油往前跳喵！',
  100: '100分！你太强了！胜利就在前方，继续冲！',
  150: '150分！简直是校园打卡达人！离通关不远了！',
  200: '200分满分！恭喜打卡校园成功！你是最棒的！',
};

// 开场欢迎
const GAME_START_TEXTS: string[] = [
  '跳一跳开始啦！奶酪陪你逛校园，长按蓄力跳喵～',
  '欢迎来到校园打卡！长按蓄力跳跃，加油喵！',
  '校园探险开始！跟着奶酪一起打卡地标喵～',
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ===== 对战全局变量（模块级别声明，保证 JSX onClick 可正常读写，避免未定义报错）===== */
// 回合标识：0=玩家回合，1=奶酪AI回合，-1=对局结束
// 兜底兼容：如果变量不存在则直接初始化，避免引用报错
let turnOwner = 0;
// AI行动锁：true代表奶酪正在跳跃，禁止重复触发AI、禁止玩家操作
let isAiMoving = false;
// AI跳跃触发标记：防止AI同一回合重复跳跃
let aiJumpTriggered = false;
// 玩家掉落标记：false=未掉落，true=已掉落（触发直接结算）
let playerFallCount = false;
// 奶酪AI掉落标记
let cheeseFallCount = false;
// 玩家分数
let playerScore = 0;
// 奶酪AI分数
let cheeseScore = 0;
// 奶酪跳跃次数计数器
let cheeseJumpCount = 0;
// 玩家跳跃完成标记：true=玩家刚刚完成了一次蓄力跳跃，此时允许检测玩家掉落
let playerJustCompletedJump = false;
// 对战模式定时器管理集合：保存所有对战相关的 setTimeout id，结算时统一清除
const battleTimerIds = new Set<number>();

/* ========== TYPES ========== */
interface Platform {
  x: number;
  y: number;
  hw: number;
  hd: number;
  bh: number;
  skin: string; // platform skin type
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Commentary {
  text: string;
  alpha: number;
  life: number;
  maxLife: number;
}

/* ========== CONFIGURATION ========== */
const C = {
  PLAT_BASE_HW: 70,
  PLAT_HD_RATIO: 0.55,
  PLAT_BODY_H: 28,
  PLAT_DIST_MIN: 90,
  PLAT_DIST_MAX: 210,
  POWER_SCALE: 0.19,
  MAX_CHARGE: 1500,
  JUMP_HEIGHT: 130,
  CENTER_R: 13,
  PW: 20,
  PH: 32,
};

function getPlatHW(score: number): number {
  if (score >= 150) return 40;
  if (score >= 100) return 50;
  if (score >= 50) return 60;
  return C.PLAT_BASE_HW;
}

/* ========== PLATFORM SKINS (Image-based) ========== */
const PLAT_SKIN_NAMES = [
  'leaf',       // 绿叶平台
  'cloud',      // 白云平台
  'blossom',    // 粉色樱花云平台
  'starry',     // 星空平台
  'rainbow',    // 彩虹云平台
  'yarnball',   // 毛线团平台
] as const;
type SkinType = typeof PLAT_SKIN_NAMES[number];

const PLAT_SKIN_URLS: Record<SkinType, string> = {
  leaf: '/plat-leaf.png',
  cloud: '/plat-cloud.png',
  blossom: '/plat-blossom.png',
  starry: '/plat-starry.png',
  rainbow: '/plat-rainbow.png',
  yarnball: '/plat-yarnball.png',
};

// Categories for landmark-based priority
const NATURE_SKINS: SkinType[] = ['leaf', 'cloud', 'blossom'];
const CUTE_SKINS: SkinType[] = ['starry', 'rainbow', 'yarnball'];
const CAMPUS_SKINS: SkinType[] = ['leaf'];

// Landmark → preferred skin category mapping
const LANDMARK_SKIN_MAP: Record<string, SkinType[]> = {
  '校门': CAMPUS_SKINS, '慎思楼': CAMPUS_SKINS, '明辨楼': CAMPUS_SKINS,
  '图书馆': CAMPUS_SKINS, '行知楼': CAMPUS_SKINS, '诚明楼': CAMPUS_SKINS,
  '博学楼': CAMPUS_SKINS, '博远楼': CAMPUS_SKINS, '博纳楼': CAMPUS_SKINS,
  '启铸恭温楼': CAMPUS_SKINS, '琢玉讲堂': CAMPUS_SKINS,
  '曦池': NATURE_SKINS, '小路': NATURE_SKINS, '林荫大道': NATURE_SKINS,
  '二食堂': CUTE_SKINS, '三食堂': CUTE_SKINS,
  '天猫超市': CUTE_SKINS, '小白房子': CUTE_SKINS,
};

// Track last used skin to avoid consecutive repeats
let lastSkin: SkinType | null = null;

function pickSkin(bgIdx: number): SkinType {
  const landmark = LANDMARK_NAMES[bgIdx];
  const preferred = LANDMARK_SKIN_MAP[landmark];
  let skin: SkinType;
  // 50% chance to use preferred category, 50% pure random
  if (preferred && Math.random() < 0.5) {
    const pool = preferred.filter(s => s !== lastSkin);
    skin = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : preferred[Math.floor(Math.random() * preferred.length)];
  } else {
    const pool = PLAT_SKIN_NAMES.filter(s => s !== lastSkin);
    skin = pool[Math.floor(Math.random() * pool.length)];
  }
  lastSkin = skin;
  return skin;
}

/* ========== UTILITIES ========== */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function drawRoundRect(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);
  cx.arcTo(x + w, y, x + w, y + r, r);
  cx.lineTo(x + w, y + h - r);
  cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);
  cx.arcTo(x, y + h, x, y + h - r, r);
  cx.lineTo(x, y + r);
  cx.arcTo(x, y, x + r, y, r);
  cx.closePath();
}

/* ========== COMPONENT ========== */
function RuleBlock({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{
      display: 'flex', gap: '12px', marginBottom: '14px',
      padding: '12px 16px', background: 'rgba(255,255,255,0.7)',
      borderRadius: '12px', border: '1px solid #FFE0C0',
    }}>
      <span style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, color: '#C65D00', fontSize: 'clamp(14px,3vw,17px)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: 'clamp(13px,2.8vw,15px)', color: '#6B4226', lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  );
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement>(null); // 右侧AI赛道画布
  const [coverPhase, setCoverPhase] = useState<'cover'|'rules'|'map'|'playing'|'ai_rules'|'ai_difficulty'|'ai_battle'>('cover');
  const [aiDifficulty, setAiDifficulty] = useState<'easy'|'normal'|'hard'>('normal');
  const [isAiBattleMode, setIsAiBattleMode] = useState(false); // 是否处于AI对战模式

  // Use refs for all game state to avoid React re-renders
  const stateRef = useRef<string>('idle');
  const platformsRef = useRef<Platform[]>([]);
  const pIdxRef = useRef(0);
  const playerRef = useRef({ x: 0, y: 0, z: 0, squash: 0 });
  const camRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const comboRef = useRef(0);
  const centerComboRef = useRef(0);
  const prevBgIdxRef = useRef(0);
  const currentBgIdxRef = useRef(0);
  const chargeStartRef = useRef(0);
  const chargeTimeRef = useRef(0);
  const jumpElapsedRef = useRef(0);
  const jumpDurationRef = useRef(0);
  const jumpFromRef = useRef({ x: 0, y: 0 });
  const jumpLandRef = useRef({ x: 0, y: 0 });
  const jumpDirRef = useRef({ x: 0, y: 0 });
  const jumpDistRef = useRef(0);
  const fallVelocityRef = useRef(0);
  const fallRotationRef = useRef(0);
  const lastTSRef = useRef(0);
  const floatsRef = useRef<FloatText[]>([]);
  const platSquashRef = useRef(0);
  const restartAtRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const commentaryRef = useRef<Commentary | null>(null);
  const animFrameRef = useRef(0);
  const bgImgsRef = useRef<(HTMLImageElement | null)[]>(new Array(18).fill(null));
  const bgFadeRef = useRef({ from: 0, to: 0, progress: 1 }); // progress 0→1, 1=done
  const agentAvatarRef = useRef<HTMLImageElement | null>(null);
  const agentComfortRef = useRef<HTMLImageElement | null>(null);
  const agentHappyRef = useRef<HTMLImageElement | null>(null);
  const agentMoodRef = useRef<'normal' | 'comfort' | 'happy'>('normal');
  const agentMoodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStartTriggeredRef = useRef(false);
  const milestoneRef = useRef<Commentary | null>(null);
  const landmarkInfoRef = useRef<{ text: string; name: string } | null>(null); // 左上角地标信息，持续到下一地标
 const camelImgRef = useRef<HTMLImageElement | null>(null); // 骆驼角色图片
  const isAiBattleModeRef = useRef(false); // 闭包安全引用AI模式标志
  const playerFallCountRef = useRef(0); // 玩家掉落计数(前2次免死)
  const aiFallCountRef = useRef(0); // AI掉落计数
  const aiJumpTriggeredRef = useRef(false); // 防止AI同一回合重复跳跃
  const startGameRef = useRef<() => void>(); // 保存startGame函数引用

 /* ---- AI对战模式状态 ---- */
  const [aiRound, setAiRound] = useState<'player' | 'ai' | 'result'>('player'); // 当前回合
  const [playerFinalScore, setPlayerFinalScore] = useState(0); // 玩家最终分数
  const [aiFinalScore, setAiFinalScore] = useState(0); // AI最终分数
  const [displayScore, setDisplayScore] = useState(0); // 用于AI对战页面显示的分数
  const aiRoundRef = useRef(aiRound);
  const coverPhaseRef = useRef(coverPhase);
  const aiDifficultyRef = useRef(aiDifficulty);
  const aiLastJumpTimeRef = useRef(0); // AI上次跳跃时间
  const aiJumpDurationRef = useRef(0);
  const aiJumpFromRef = useRef({ x: 0, y: 0 });
  const aiJumpLandRef = useRef({ x: 0, y: 0 });
  const aiJumpDirRef = useRef({ x: 0, y: 0 });
  
  /* ---- 轮流对战模式状态 ---- */
  const [currentTurn, setCurrentTurn] = useState<'player' | 'ai'>('player'); // 当前行动方
  const [aiScore, setAiScore] = useState(0); // AI实时分数
  const currentTurnRef = useRef(currentTurn);
  const aiScoreRef = useRef(aiScore);
  const aiCamelRef = useRef({ x: 0, y: 0 }); // AI骆驼位置
  const aiCamelStateRef = useRef<'idle' | 'charging' | 'jumping'>('idle'); // AI骆驼状态
  const aiChargeStartRef = useRef(0); // AI蓄力开始时间
  const aiPlatformIndexRef = useRef(1); // AI当前目标平台索引
  const aiPlatformsRef = useRef<any[]>([]); // AI独立平台列表
  const aiScoreDisplayRef = useRef(0); // AI分数显示动画
  const aiJumpDistRef = useRef(0);
  const aiFallVelocityRef = useRef(0);
  const aiFallRotationRef = useRef(0);
  const aiFloatsRef = useRef<FloatText[]>([]);
  const aiPlatSquashRef = useRef(0);
  const aiSizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const aiBgFadeRef = useRef({ from: 0, to: 0, progress: 1 });
  const aiAnimFrameRef = useRef(0);
  const aiLastTSRef = useRef(0);
  const aiGameStartTriggeredRef = useRef(false);

  /* ---- 生命值系统 ---- */
  const playerLivesRef = useRef(3);
  const aiLivesRef = useRef(3);
  const [playerLives, setPlayerLives] = useState(3);
  const [aiLives, setAiLives] = useState(3);
  const [gameResult, setGameResult] = useState<'playing'|'player_win'|'ai_win'|'draw'|null>(null);

  /* ---- AI决策状态 ---- */
  const aiConsecutiveMissesRef = useRef(0);
  const aiTargetChargeRef = useRef(0); // AI计算的蓄力时间
  const platImgsRef = useRef<Record<string, HTMLImageElement | null>>({}); // 平台图片缓存
  const soundOnRef = useRef(true); // 音效开关
  const [soundOn, setSoundOn] = useState(true); // 音效UI状态
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null); // 背景音乐音频实例
  const bgmMutedRef = useRef(false); // 背景音乐静音开关
  const [bgmMuted, setBgmMuted] = useState(false); // 背景音乐静音UI状态
  const bgmStartedRef = useRef(false); // 是否已开始播放

  /* ---- Sound wrapper (respects mute toggle) ---- */
  const sfx = useCallback((fn: () => void) => {
    if (soundOnRef.current) fn();
  }, []);

  /* ---- Show local commentary text ---- */
  const showCommentary = useCallback(
    (text: string, mood?: 'normal' | 'comfort' | 'happy') => {
      // 设置头像情绪状态
      if (mood) agentMoodRef.current = mood;

      // 清除之前的情绪计时器
      if (agentMoodTimerRef.current) {
        clearTimeout(agentMoodTimerRef.current);
        agentMoodTimerRef.current = null;
      }

      // 3秒后恢复常态头像
      agentMoodTimerRef.current = setTimeout(() => {
        agentMoodRef.current = 'normal';
        agentMoodTimerRef.current = null;
      }, 3000);

      // Set commentary text (直接显示完整文本)
      commentaryRef.current = {
        text,
        alpha: 1,
        life: 0,
        maxLife: 5000,
      };
    },
    []
  );

  /* ---- Show milestone text in upper-right corner ---- */
  const showMilestone = useCallback(
    (text: string) => {
      milestoneRef.current = {
        text,
        alpha: 1,
        life: 0,
        maxLife: 4000,
      };
    },
    []
  );

  /* ---- Show landmark info in upper-left corner (persists until next landmark) ---- */
  const showLandmarkInfo = useCallback(
    (name: string, text: string) => {
      landmarkInfoRef.current = { name, text };
    },
    []
  );

  /* ---- Trigger commentary via ref (stable across renders) ---- */
  const triggerCommentaryRef = useRef<(scene: string) => void>(() => {});

  useEffect(() => {
    triggerCommentaryRef.current = (scene: string) => {
      const score = scoreRef.current;
      const bgIdx = getBgIndex(score);

      let text = '';
      let mood: 'normal' | 'comfort' | 'happy' = 'normal';

      switch (scene) {
        case 'game_start':
          text = pickRandom(GAME_START_TEXTS);
          mood = 'normal';
          break;
        case 'perfect_land':
          text = pickRandom(PERFECT_LAND_TEXTS);
          mood = 'happy';
          break;
        case 'high_score': {
          text = `${score}分啦！好厉害喵～继续冲！`;
          mood = 'happy';
          break;
        }
        case 'game_over':
          text = pickRandom(GAME_OVER_TEXTS);
          mood = 'comfort';
          break;
        case 'landmark': {
          const lmName = LANDMARK_NAMES[bgIdx] || '新地标';
          const lmText = LANDMARK_COMMENTARY[bgIdx] || '新地标到啦喵！';
          showLandmarkInfo(lmName, lmText);
          text = `到达${lmName}啦喵！`;
          mood = 'normal';
          break;
        }
        default:
          text = '加油喵～';
          mood = 'normal';
      }

      showCommentary(text, mood);
    };
  }, [showCommentary]);

  // 同步refs
  useEffect(() => {
    aiRoundRef.current = aiRound;
  }, [aiRound]);
  
  useEffect(() => {
    coverPhaseRef.current = coverPhase;
    if (coverPhase === 'playing' && startGameRef.current) {
      console.log("[对战调试] 进入游戏模式，自动重新初始化游戏");
      startGameRef.current();
    }
    if (bgmStartedRef.current && bgmAudioRef.current && !bgmMutedRef.current) {
      bgmAudioRef.current.play().catch(() => {});
    }
  }, [coverPhase]);
  
  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);
  
  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);
  
  useEffect(() => {
    aiDifficultyRef.current = aiDifficulty;
 }, [aiDifficulty]);
  
  useEffect(() => {
    isAiBattleModeRef.current = isAiBattleMode;
    if (!isAiBattleMode) {
      console.log("[对战调试] 模式从PK切换为单人，执行强制清理");
      battleTimerIds.forEach(id => clearTimeout(id));
      battleTimerIds.clear();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      turnOwner = 0;
      isAiMoving = false;
      aiJumpTriggered = false;
      playerScore = 0;
      cheeseScore = 0;
      playerFallCount = false;
      cheeseFallCount = false;
      platformsRef.current = [];
      playerRef.current = { x: 0, y: 0, z: 0, squash: 0 };
      aiCamelRef.current = { x: 0, y: 0 };
    }
  }, [isAiBattleMode]);

  useEffect(() => {
    return () => {
      console.log("[对战调试] 组件卸载，执行全局游戏资源清理");
      battleTimerIds.forEach(id => clearTimeout(id));
      battleTimerIds.clear();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      turnOwner = 0;
      isAiMoving = false;
      aiJumpTriggered = false;
      playerScore = 0;
      cheeseScore = 0;
      playerFallCount = false;
      cheeseFallCount = false;
      platformsRef.current = [];
      playerRef.current = { x: 0, y: 0, z: 0, squash: 0 };
      aiCamelRef.current = { x: 0, y: 0 };
    };
  }, []);

  useEffect(() => {
    const audio = new Audio('/bgm.mp3');
    audio.loop = true;
    audio.volume = 0.4;
    bgmAudioRef.current = audio;

    const handleFirstInteraction = () => {
      if (!bgmStartedRef.current && bgmAudioRef.current) {
        bgmStartedRef.current = true;
        bgmAudioRef.current.play().catch(() => {});
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
      }
    };
  }, []);

 // 同步显示分数
  useEffect(() => {
    if (coverPhase === 'ai_battle' && aiRound !== 'result') {
      const syncScore = () => {
        setDisplayScore(scoreRef.current);
      };
      const interval = setInterval(syncScore, 100);
      return () => clearInterval(interval);
    }
 }, [coverPhase, aiRound]);

 // 玩家回合掉落后，切换到AI回合
 useEffect(() => {
   if (coverPhase === 'ai_battle' && aiRound === 'player') {
     // 监听玩家掉落
     const checkPlayerFall = () => {
       if (stateRef.current === 'continue_prompt') {
         setPlayerFinalScore(scoreRef.current);
         setAiRound('ai');
         // 重置游戏状态给AI使用
         setTimeout(() => {
           // 重置分数和平台
           scoreRef.current = 0;
           pIdxRef.current = 0;
           stateRef.current = 'idle';
         }, 500);
       }
     };
     const interval = setInterval(checkPlayerFall, 100);
     return () => clearInterval(interval);
   }
 }, [coverPhase, aiRound]);

 useEffect(() => {
   const canvas = canvasRef.current;
   if (!canvas) return;
   const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ---- Load background images ---- */
    const bgUrls = ['/bg.png', '/bg1.png', '/bg2.png', '/bg3.png', '/bg4.png', '/bg5.png', '/bg6.png', '/bg7.png', '/bg8.png', '/bg9.png', '/bg10.png', '/bg11.png', '/bg12.png', '/bg13.png', '/bg14.png', '/bg15.png', '/bg16.png', '/bg17.png'];
    bgUrls.forEach((url, i) => {
      if (!bgImgsRef.current[i]) {
        const img = new Image();
        img.src = url;
        img.onload = () => { bgImgsRef.current[i] = img; };
      }
    });

    /* ---- Load agent avatar (3 states) ---- */
    if (!agentAvatarRef.current) {
      const avatar = new Image();
      avatar.src = '/agent-avatar.png';
      avatar.onload = () => { agentAvatarRef.current = avatar; };
    }
    if (!agentComfortRef.current) {
      const comfort = new Image();
      comfort.src = '/agent-comfort.png';
      comfort.onload = () => { agentComfortRef.current = comfort; };
    }
    if (!agentHappyRef.current) {
      const happy = new Image();
      happy.src = '/agent-happy.png';
      happy.onload = () => { agentHappyRef.current = happy; };
    }

    /* ---- Load camel image ---- */
    if (!camelImgRef.current) {
      const cImg = new Image();
      cImg.src = '/camel.png';
      cImg.onload = () => { camelImgRef.current = cImg; };
    }

    /* ---- Load platform skin images ---- */
    PLAT_SKIN_NAMES.forEach((skin) => {
      if (!platImgsRef.current[skin]) {
        const img = new Image();
        img.src = PLAT_SKIN_URLS[skin];
        img.onload = () => { platImgsRef.current[skin] = img; };
      }
    });

    /* ---- Platform helpers ---- */
    function makePlat(x: number, y: number, hw?: number): Platform {
      const halfW = hw ?? getPlatHW(scoreRef.current);
      return {
        x,
        y,
        hw: halfW,
        hd: halfW * C.PLAT_HD_RATIO,
        bh: C.PLAT_BODY_H,
        skin: pickSkin(currentBgIdxRef.current),
      };
    }

    function addNextPlat() {
      const plats = platformsRef.current;
      const last = plats[plats.length - 1];
      const dir = Math.random() < 0.5 ? 1 : -1;
      const d =
        C.PLAT_DIST_MIN +
        Math.random() * (C.PLAT_DIST_MAX - C.PLAT_DIST_MIN);
      plats.push(makePlat(last.x + dir * d, last.y - d * 0.5));
    }

    /* ---- Resize ---- */
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h, dpr };
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---- 奶酪自动跳跃逻辑（重命名为runCheeseJump） ---- */
    function runCheeseJump() {
      // ======== 调试日志：进入奶酪跳跃函数 ========
      console.log('[对战调试] 进入奶酪跳跃函数，当前 isAiMoving =', isAiMoving, ', turnOwner =', turnOwner);
      
      // 仅校验：是否为人机对战场景 且 turnOwner === 1
      if (!isAiBattleModeRef.current || turnOwner !== 1) {
        console.log('[对战调试] 奶酪跳跃被拦截：不是对战模式或不是AI回合，当前 isAiBattleMode =', isAiBattleModeRef.current, ', turnOwner =', turnOwner);
        return;
      }
      const plats = platformsRef.current;
      const idx = pIdxRef.current;
      if (idx >= plats.length - 1) return;
      
      // ======================================
      // 通过检查，开始执行奶酪跳跃（isAiMoving已由玩家落地时设置为true，全程保持锁定直到动画结束）
      // ======================================
      // ===== 新增：AI开始跳跃 -> 重置玩家跳跃标记，暂时关闭玩家掉落检测 =====
      playerJustCompletedJump = false;
      console.log('[对战调试] 奶酪开始行动，isAiMoving 已为 true，保持全程锁定，playerJustCompletedJump=false（关闭玩家掉落检测）');
      
      const curP = plats[idx];
      const nextP = plats[idx + 1];
      const dx = nextP.x - curP.x;
      const dy = nextP.y - curP.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idealCharge = dist / C.POWER_SCALE;
      let missProb, perfectProb;
      switch (aiDifficultyRef.current) {
        case 'easy': missProb = 0.80; perfectProb = 0.05; break;
        case 'normal': missProb = 0.30; perfectProb = 0.20; break;
        case 'hard': missProb = 0.10; perfectProb = 0.45; break;
      }
      
      // 前3跳保护机制：前3次跳跃强制稳定落地，不会失误掉落
      const isProtectedJump = cheeseJumpCount < 3;
      console.log('[对战调试] 奶酪准备跳跃，当前跳跃次数 =', cheeseJumpCount, '，是否保护跳 =', isProtectedJump, '，难度 =', aiDifficultyRef.current);
      
      const willMiss = isProtectedJump ? false : Math.random() < missProb;
      let chargeTime;
      if (willMiss) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        chargeTime = idealCharge * (1 + dir * (0.3 + Math.random() * 0.4));
      } else {
        // 保护跳时强制完美落点
        chargeTime = isProtectedJump ? idealCharge : (Math.random() < perfectProb ? idealCharge : idealCharge * (0.90 + Math.random() * 0.20));
      }
      chargeTime = Math.max(100, Math.min(C.MAX_CHARGE, chargeTime));
      console.log('[对战调试] 奶酪准备跳跃，蓄力时间 =', chargeTime, 'ms，难度 =', aiDifficultyRef.current);
      startCharge();
      setTimeout(() => { 
        console.log('[对战调试] 奶酪释放跳跃');
        releaseCharge(); 
      }, chargeTime);
    }

    /* ---- Init game ---- */
    function startGame() {
      resize();
      stateRef.current = 'idle';
      platformsRef.current = [];
      pIdxRef.current = 0;
      scoreRef.current = 0;
      comboRef.current = 0;
      centerComboRef.current = 0;
      chargeTimeRef.current = 0;
      platSquashRef.current = 0;
      floatsRef.current = [];
      commentaryRef.current = null;
      milestoneRef.current = null;
      landmarkInfoRef.current = null;
      bgFadeRef.current = { from: 0, to: 0, progress: 1 };
      bestRef.current = parseInt(
        localStorage.getItem('jump_best') || '0',
        10
      );

      // AI对战模式重置
      // ===== 模块级别变量完整重置（保证 JSX onClick 可正常读写）=====
      // 回合标识清零
      turnOwner = 0;
      isAiMoving = false;
      aiJumpTriggered = false;
      // 分数清零
      playerScore = 0;
      cheeseScore = 0;
      // 掉落标记清零
      playerFallCount = false;
      cheeseFallCount = false;
      // 奶酪跳跃次数清零
      cheeseJumpCount = 0;
      // 玩家跳跃标记重置
      playerJustCompletedJump = false;
      // 销毁上一局所有残留定时器
      battleTimerIds.forEach(id => clearTimeout(id));
      battleTimerIds.clear();
      // ===== 同步原有 ref 状态（保持游戏其他逻辑正常）=====
      playerFallCountRef.current = 0;
      aiFallCountRef.current = 0;
      aiJumpTriggeredRef.current = false;

      console.log('[对战调试] 游戏初始化：turnOwner=0（玩家回合）, isAiMoving=false（解锁）, playerJustCompletedJump=false, battleTimerIds已清空');
      // ===== 新增：AI对战模式下初始化UI分数状态 + 打印新对局日志 =====
      if (isAiBattleModeRef.current) {
        setAiScore(0);
        scoreRef.current = 0;
        // ======== 新增：每一次重置对局时增加打印 ========
        console.log('[对战调试] 新对局初始化完成，分数归零，回合重置');
        // PK对战初始化完成解说
        showCommentary("PK对决开始！你和奶酪交替跳跃，先到100分或让对手掉落即可获胜！", 'normal');
      }

      platformsRef.current.push(makePlat(sizeRef.current.w / 2, sizeRef.current.h * 0.6));
      for (let i = 0; i < 6; i++) addNextPlat();

      const p0 = platformsRef.current[0];
      playerRef.current = { x: p0.x, y: p0.y, z: 0, squash: 0 };

      updateCamTarget();
      camRef.current.x = camRef.current.tx;
      camRef.current.y = camRef.current.ty;

      // 首次加载触发开场欢迎
      if (!gameStartTriggeredRef.current) {
        gameStartTriggeredRef.current = true;
        agentMoodRef.current = 'normal';
        setTimeout(() => triggerCommentaryRef.current('game_start'), 500);
      }
    }
    startGameRef.current = startGame;

    function updateCamTarget() {
      const pIdx = pIdxRef.current;
      const plats = platformsRef.current;
      const cur = plats[pIdx];
      const next = plats[pIdx + 1];
      let mx = cur.x;
      let my = cur.y;
      if (next) {
        mx = (cur.x + next.x) / 2;
        my = (cur.y + next.y) / 2;
      }
      camRef.current.tx = sizeRef.current.w / 2 - mx;
      camRef.current.ty = sizeRef.current.h * 0.48 - my;
    }

    /* ---- Rendering ---- */
    function drawBgImg(img: HTMLImageElement) {
      const { w, h } = sizeRef.current;
      const imgRatio = img.width / img.height;
      const canvasRatio = w / h;
      let sw: number, sh: number, sx: number, sy: number;
      if (imgRatio > canvasRatio) {
        sh = img.height;
        sw = sh * canvasRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = sw / canvasRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    }

    function drawBg() {
      const { w, h } = sizeRef.current;
      const imgs = bgImgsRef.current;
      const fade = bgFadeRef.current;
      const fromImg = imgs[fade.from];
      const toImg = imgs[fade.to];

      if (fromImg || toImg) {
        // Draw "from" image at full opacity
        if (fromImg) {
          ctx!.globalAlpha = 1;
          drawBgImg(fromImg);
        } else {
          // Fallback gradient
          const g = ctx!.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#E8F4F8');
          g.addColorStop(1, '#F5F0E8');
          ctx!.fillStyle = g;
          ctx!.fillRect(0, 0, w, h);
        }

        // Draw "to" image with fade-in alpha on top
        if (fade.progress > 0 && toImg) {
          ctx!.globalAlpha = fade.progress;
          drawBgImg(toImg);
          ctx!.globalAlpha = 1;
        } else if (fade.progress > 0 && !toImg) {
          const g = ctx!.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#E8F4F8');
          g.addColorStop(1, '#F5F0E8');
          ctx!.globalAlpha = fade.progress;
          ctx!.fillStyle = g;
          ctx!.fillRect(0, 0, w, h);
          ctx!.globalAlpha = 1;
        }

        // Light overlay to keep platforms visible
        ctx!.fillStyle = 'rgba(255,255,255,0.18)';
        ctx!.fillRect(0, 0, w, h);
      } else {
        // Nothing loaded yet
        const g = ctx!.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#E8F4F8');
        g.addColorStop(1, '#F5F0E8');
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }
    }

    function drawPlat(p: Platform, isCurrent: boolean) {
      const x = p.x;
      let y = p.y;
      let hw = p.hw;
      let hd = p.hd;
      let bh = p.bh;
      const skin = p.skin || 'leaf';

      if (isCurrent && platSquashRef.current > 0) {
        const sq = platSquashRef.current * 0.3;
        hd = hd * (1 - sq);
        bh = bh * (1 - sq * 0.5);
      }

      // Try to draw platform using preloaded image
      const platImg = platImgsRef.current[skin];
      if (platImg && platImg.complete && platImg.naturalWidth > 0) {
        // Scale image to fit platform bounding box while preserving aspect ratio
        const totalW = hw * 2;
        const totalH = hd * 2 + bh;
        const imgW = platImg.naturalWidth;
        const imgH = platImg.naturalHeight;
        const scaleX = totalW / imgW;
        const scaleY = totalH / imgH;
        const scale = Math.min(scaleX, scaleY);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        // Center the image on the platform position
        const drawX = x - drawW / 2;
        const drawY = y - hd - (drawH - (hd * 2 + bh)) / 2;

        ctx!.save();
        ctx!.drawImage(platImg, drawX, drawY, drawW, drawH);
        ctx!.restore();
      } else {
        // Fallback: simple colored diamond while image loads
        const draw3Faces = (topClr: string, leftClr: string, rightClr: string) => {
          ctx!.beginPath();
          ctx!.moveTo(x, y + hd);
          ctx!.lineTo(x - hw, y);
          ctx!.lineTo(x - hw, y + bh);
          ctx!.lineTo(x, y + hd + bh);
          ctx!.closePath();
          ctx!.fillStyle = leftClr;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.moveTo(x, y + hd);
          ctx!.lineTo(x + hw, y);
          ctx!.lineTo(x + hw, y + bh);
          ctx!.lineTo(x, y + hd + bh);
          ctx!.closePath();
          ctx!.fillStyle = rightClr;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.moveTo(x, y - hd);
          ctx!.lineTo(x + hw, y);
          ctx!.lineTo(x, y + hd);
          ctx!.lineTo(x - hw, y);
          ctx!.closePath();
          ctx!.fillStyle = topClr;
          ctx!.fill();
        };
        draw3Faces('#D4A574', '#A67B5B', '#C49A6C');
      }

      // Center dot for landing reference (subtle)
      ctx!.beginPath();
      ctx!.arc(x, y, 3, 0, Math.PI * 2);
      ctx!.fillStyle = 'rgba(0,0,0,0.15)';
      ctx!.fill();
    }

    function drawPlayer() {
      const player = playerRef.current;
      const state = stateRef.current;
      const x = player.x;
      const y = player.y;
      const z = player.z;
      const sq = player.squash;
      const sf = 1 - sq * 0.35; // squash: compress height
      const wf = 1 + sq * 0.25; // squash: widen

      const px = x;
      const py = y - z;

      // Jumping: stretch vertically, narrow horizontally
      let hScale = wf;
      let vScale = sf;
      if (state === 'jumping') {
        const t = jumpElapsedRef.current / jumpDurationRef.current;
        const stretch = 1 + Math.sin(t * Math.PI) * 0.15;
        vScale = sf * stretch;
        hScale = wf / stretch;
      }

      ctx!.save();
      ctx!.globalAlpha = 1;
      ctx!.translate(px, py);
      if (state === 'falling') {
        ctx!.rotate(fallRotationRef.current);
      }

      // Shadow (fixed size, matches camel)
      const shadowR = 12;
      ctx!.beginPath();
      ctx!.ellipse(0, 2, shadowR * hScale, 3, 0, 0, Math.PI * 2);
      ctx!.fillStyle = 'rgba(0,0,0,0.10)';
      ctx!.fill();

      // Determine facing direction: camel original faces RIGHT in the image
      // If next platform is to the LEFT on screen, mirror so head faces left toward target
      const plats = platformsRef.current;
      const pIdx = pIdxRef.current;
      const curP = plats[pIdx];
      const nextP = plats[pIdx + 1];
      const facingLeft = nextP && curP && nextP.x < curP.x;

      // Draw camel image (feet at origin, body above)
      const cImg = camelImgRef.current;
      if (cImg) {
        const imgW = cImg.naturalWidth;
        const imgH = cImg.naturalHeight;
        // Fixed camel size = 0.35 of initial platform width, does NOT shrink with platform
        const camelTargetW = 140 * 0.35; // ~0.35 of initial platform width (hw=70), fixed
        const baseScale = camelTargetW / imgW;
        const drawW = imgW * baseScale * hScale;
        const drawH = imgH * baseScale * vScale;
        // Center horizontally on feet position, draw above
        if (facingLeft) {
          ctx!.scale(-1, 1);
        }
        // Slight horizontal offset so camel's body center (not image center) aligns with platform
        const bodyOffset = facingLeft ? drawW * 0.05 : -drawW * 0.05;
        const drawX = -drawW / 2 + bodyOffset;
        const drawY = -drawH;
        ctx!.drawImage(cImg, drawX, drawY, drawW, drawH);
      } else {
        // Fallback: dark charcoal chess piece
        ctx!.beginPath();
        const bw = C.PW * hScale;
        const bh = C.PH * vScale;
        ctx!.ellipse(0, -bh * 0.15, bw, bh * 0.85, 0, 0, Math.PI * 2);
        ctx!.fillStyle = '#3A3A3A';
        ctx!.fill();
        ctx!.beginPath();
        ctx!.ellipse(0, -bh * 0.85, bw * 0.45, bh * 0.28, 0, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.restore();
    }

    function drawFloats() {
      const floats = floatsRef.current;
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        ctx!.globalAlpha = f.alpha;
        ctx!.fillStyle = f.color;
        ctx!.font = 'bold 22px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(f.text, f.x, f.y);
      }
      ctx!.globalAlpha = 1;
    }

    function drawCommentary() {
      const cm = commentaryRef.current;
      if (!cm || cm.alpha <= 0 || !cm.text) return;

      const { w, h } = sizeRef.current;
      const avatarSize = 70;
      const margin = 20;
      const avatarCX = w - avatarSize / 2 - margin;
      const avatarCY = h - avatarSize / 2 - margin;

      ctx!.save();
      ctx!.globalAlpha = cm.alpha;

      // Text formatting
      const fontSize = 15;
      const lineHeight = 22;
      const font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
      ctx!.font = font;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';

      const padX = 14;
      const padY = 10;
      const maxBubbleW = Math.min(220, w - avatarSize - margin * 2 - 40); // 气泡最大宽度
      const textMaxW = maxBubbleW - padX * 2;

      // 手动换行：按字符宽度拆行
      const lines: string[] = [];
      let currentLine = '';
      for (const ch of cm.text) {
        const testLine = currentLine + ch;
        const testW = ctx!.measureText(testLine).width;
        if (testW > textMaxW && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = ch;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const bubbleW = Math.max(
        ...lines.map((l) => ctx!.measureText(l).width)
      ) + padX * 2;
      const bubbleH = lines.length * lineHeight + padY * 2;
      const tailW = 10;
      const tailH = 8;

      // Position: to the left of avatar, vertically centered with avatar
      const bx = w - avatarSize - margin - tailW - bubbleW;
      const by = avatarCY - bubbleH / 2;

      // Draw bubble background with rounded corners
      drawRoundRect(ctx!, bx, by, bubbleW, bubbleH, 14);
      ctx!.fillStyle = 'rgba(255,255,255,0.92)';
      ctx!.fill();
      // Light border
      ctx!.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx!.lineWidth = 1;
      ctx!.stroke();

      // Draw tail pointing right toward avatar
      ctx!.beginPath();
      ctx!.moveTo(bx + bubbleW, by + bubbleH / 2 - tailH / 2);
      ctx!.lineTo(bx + bubbleW + tailW, avatarCY);
      ctx!.lineTo(bx + bubbleW, by + bubbleH / 2 + tailH / 2);
      ctx!.closePath();
      ctx!.fillStyle = 'rgba(255,255,255,0.92)';
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx!.stroke();

      // Draw text lines (dark color for white bubble)
      ctx!.fillStyle = '#333';
      ctx!.font = font;
      ctx!.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx!.fillText(lines[i], bx + padX, by + padY + i * lineHeight);
      }

      ctx!.restore();
    }

    function drawMilestone() {
      const ms = milestoneRef.current;
      if (!ms || ms.alpha <= 0 || !ms.text) return;

      const { w } = sizeRef.current;

      ctx!.save();
      ctx!.globalAlpha = ms.alpha;

      const fontSize = 14;
      const lineHeight = 20;
      const font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
      ctx!.font = font;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';

      const padX = 14;
      const padY = 10;
      const maxBubbleW = Math.min(260, w - 40);
      const textMaxW = maxBubbleW - padX * 2;

      // 手动换行
      const lines: string[] = [];
      let currentLine = '';
      for (const ch of ms.text) {
        const testLine = currentLine + ch;
        const testW = ctx!.measureText(testLine).width;
        if (testW > textMaxW && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = ch;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const bubbleW = Math.max(
        ...lines.map((l) => ctx!.measureText(l).width)
      ) + padX * 2;
      const bubbleH = lines.length * lineHeight + padY * 2;

      // 右上方位置，距顶部和右边各20px
      const margin = 20;
      const bx = w - bubbleW - margin;
      const by = margin;

      // 金色装饰条
      drawRoundRect(ctx!, bx, by, bubbleW, bubbleH, 12);
      ctx!.fillStyle = 'rgba(255,255,255,0.95)';
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(255,215,0,0.5)';
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // 左侧金色竖条装饰
      ctx!.fillStyle = '#FFD700';
      drawRoundRect(ctx!, bx, by, 4, bubbleH, 2);
      ctx!.fill();

      // 绘制文本
      ctx!.fillStyle = '#333';
      ctx!.font = font;
      ctx!.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx!.fillText(lines[i], bx + padX + 2, by + padY + i * lineHeight);
      }

      ctx!.restore();
    }

    function drawLandmarkInfo() {
      const li = landmarkInfoRef.current;
      if (!li || !li.text) return;

      const { w } = sizeRef.current;

      ctx!.save();

      const fontSize = 13;
      const lineHeight = 19;
      const font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
      ctx!.font = font;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';

      const padX = 14;
      const padY = 10;
      const maxBubbleW = Math.min(240, w * 0.4);
      const textMaxM = maxBubbleW - padX * 2;

      // 拆行
      const lines: string[] = [];
      let cur = '';
      for (const ch of li.text) {
        const t = cur + ch;
        if (ctx!.measureText(t).width > textMaxM && cur.length > 0) {
          lines.push(cur);
          cur = ch;
        } else {
          cur = t;
        }
      }
      if (cur) lines.push(cur);

      const nameFont = `bold 15px "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
      ctx!.font = nameFont;
      const nameW = ctx!.measureText(li.name).width;

      ctx!.font = font;
      const bodyW = Math.max(...lines.map((l) => ctx!.measureText(l).width));
      const bubbleW = Math.max(nameW, bodyW) + padX * 2;
      const nameH = 22;
      const bubbleH = nameH + lines.length * lineHeight + padY * 2;

      // 左上方，距顶部和左边各16px
      const margin = 16;
      const bx = margin;
      const by = margin;

      // 白色圆角背景
      drawRoundRect(ctx!, bx, by, bubbleW, bubbleH, 10);
      ctx!.fillStyle = 'rgba(255,255,255,0.92)';
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(168,216,185,0.5)';
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // 左侧薄荷绿竖条装饰
      ctx!.fillStyle = '#A8D8B9';
      drawRoundRect(ctx!, bx, by, 4, bubbleH, 2);
      ctx!.fill();

      // 地标名称（深色粗体）
      ctx!.fillStyle = '#333';
      ctx!.font = nameFont;
      ctx!.textBaseline = 'top';
      ctx!.fillText(li.name, bx + padX + 2, by + padY);

      // 分隔线
      const sepY = by + padY + nameH - 2;
      ctx!.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(bx + padX + 2, sepY);
      ctx!.lineTo(bx + bubbleW - padX, sepY);
      ctx!.stroke();

      // 解说文本
      ctx!.fillStyle = '#555';
      ctx!.font = font;
      for (let i = 0; i < lines.length; i++) {
        ctx!.fillText(lines[i], bx + padX + 2, sepY + 4 + i * lineHeight);
      }

      ctx!.restore();
    }

    function drawUI() {
      const { w, h } = sizeRef.current;
      const state = stateRef.current;
      const score = scoreRef.current;
      const best = bestRef.current;

      // Score - 在AI对战模式下显示双分数和回合提示
      if (isAiBattleModeRef.current) {
        // 回合提示 - 添加白色背景气泡
        ctx!.font = 'bold 20px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'top';
        const turnText = currentTurnRef.current === 'player' ? '🎮 轮到你跳跃' : '🤖 轮到奶酪跳跃';
        const turnTextW = ctx!.measureText(turnText).width;
        ctx!.fillStyle = 'rgba(255,255,255,0.9)';
        drawRoundRect(ctx!, w / 2 - turnTextW / 2 - 8, 11, turnTextW + 16, 28, 8);
        ctx!.fill();
        ctx!.fillStyle = currentTurnRef.current === 'player' ? 'rgba(255,160,60,0.95)' : 'rgba(100,200,255,0.95)';
        ctx!.fillText(turnText, w / 2, 15);
        
        // 左侧玩家分数 - 添加白色背景气泡
        ctx!.font = 'bold 28px Arial, sans-serif';
        const playerScoreText = '你: ' + playerScore;
        const playerScoreW = ctx!.measureText(playerScoreText).width;
        ctx!.fillStyle = 'rgba(255,255,255,0.9)';
        drawRoundRect(ctx!, 12, 42, playerScoreW + 16, 36, 8);
        ctx!.fill();
        ctx!.fillStyle = 'rgba(255,160,60,0.95)';
        ctx!.textAlign = 'left';
        ctx!.fillText(playerScoreText, 20, 50);
        
        // 右侧AI分数 - 添加白色背景气泡
        const aiScoreText = '奶酪: ' + cheeseScore;
        const aiScoreW = ctx!.measureText(aiScoreText).width;
        ctx!.fillStyle = 'rgba(255,255,255,0.9)';
        drawRoundRect(ctx!, w - aiScoreW - 28, 42, aiScoreW + 16, 36, 8);
        ctx!.fill();
        ctx!.fillStyle = 'rgba(100,200,255,0.95)';
        ctx!.textAlign = 'right';
        ctx!.fillText(aiScoreText, w - 20, 50);
      } else {
        // 普通模式：显示单个分数
        ctx!.fillStyle = 'rgba(0,0,0,0.55)';
        ctx!.font = 'bold 36px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'top';
        ctx!.fillText(String(score), w / 2, 30);

        // Best
        ctx!.font = '14px Arial, sans-serif';
        ctx!.fillStyle = 'rgba(0,0,0,0.30)';
        ctx!.fillText('\u6700\u9AD8 ' + best, w / 2, 72);
      }

      // Power bar
      if (state === 'charging') {
        const barW = 64;
        const barH = 8;
        const bx = w / 2 - barW / 2;
        const by = h - 80;
        const fill = Math.min(chargeTimeRef.current / C.MAX_CHARGE, 1);

        ctx!.fillStyle = 'rgba(0,0,0,0.15)';
        drawRoundRect(ctx!, bx, by, barW, barH, 4);
        ctx!.fill();

        const fw = Math.max(barW * fill, 4);
        if (fill > 0.75) ctx!.fillStyle = '#E74C3C';
        else if (fill > 0.45) ctx!.fillStyle = '#F39C12';
        else ctx!.fillStyle = '#27AE60';
        drawRoundRect(ctx!, bx, by, fw, barH, 4);
        ctx!.fill();
      }

      // Start hint
      if (state === 'idle' && score === 0) {
        ctx!.fillStyle = 'rgba(0,0,0,0.35)';
        ctx!.font = '16px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'bottom';
        ctx!.fillText('\u957F\u6309\u84C4\u529B\uFF0C\u677E\u5F00\u8DF3\u8DC3', w / 2, h - 40);
      }

      // Continue prompt (fell off platform)
      if (state === 'continue_prompt') {
        ctx!.fillStyle = 'rgba(0,0,0,0.35)';
        ctx!.fillRect(0, 0, w, h);

        ctx!.fillStyle = '#fff';
        ctx!.font = 'bold 28px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText('\u6389\u843D\u4E86\uFF01', w / 2, h / 2 - 50);

        ctx!.font = '20px Arial, sans-serif';
        ctx!.fillText('\u5F53\u524D\u5F97\u5206: ' + score, w / 2, h / 2 - 10);

        // Continue button
        const btnW = 160, btnH = 48;
        const btnX = w / 2 - btnW / 2;
        const btnY = h / 2 + 30;
        drawRoundRect(ctx!, btnX, btnY, btnW, btnH, 24);
        ctx!.fillStyle = '#FF7832';
        ctx!.fill();
        ctx!.fillStyle = '#fff';
        ctx!.font = 'bold 18px Arial, sans-serif';
        ctx!.fillText('\u7EE7\u7EED\u6311\u6218', w / 2, btnY + btnH / 2);
      }

      // Victory (reached 200 points)
      if (state === 'victory') {
        ctx!.fillStyle = 'rgba(0,0,0,0.45)';
        ctx!.fillRect(0, 0, w, h);

        ctx!.fillStyle = '#FFD700';
        ctx!.font = 'bold 32px Arial, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText('\u606D\u559C\u6253\u5361\u6821\u56ED\u6210\u529F\uFF01', w / 2, h / 2 - 50);

        ctx!.fillStyle = '#fff';
        ctx!.font = '22px Arial, sans-serif';
        ctx!.fillText('\u6700\u7EC8\u5F97\u5206: ' + score, w / 2, h / 2);

        ctx!.font = '16px Arial, sans-serif';
        ctx!.fillStyle = 'rgba(255,255,255,0.7)';
        ctx!.fillText('\u6700\u9AD8: ' + best, w / 2, h / 2 + 35);

        ctx!.fillStyle = 'rgba(255,255,255,0.75)';
        ctx!.fillText('\u70B9\u51FB\u91CD\u65B0\u5F00\u59CB', w / 2, h / 2 + 80);
      }
    }

    /* ---- Draw agent avatar (bottom-right, 70px, 3 mood states) ---- */
    function drawAgentAvatar() {
      const mood = agentMoodRef.current;
      let avatar: HTMLImageElement | null = null;
      if (mood === 'comfort') avatar = agentComfortRef.current;
      else if (mood === 'happy') avatar = agentHappyRef.current;
      else avatar = agentAvatarRef.current;

      if (!avatar) return;
      const { w, h } = sizeRef.current;
      const size = 70;
      const margin = 20;
      const ax = w - size - margin;
      const ay = h - size - margin;

      // Shadow
      ctx!.save();
      ctx!.shadowColor = 'rgba(0,0,0,0.25)';
      ctx!.shadowBlur = 8;
      ctx!.shadowOffsetY = 2;
      ctx!.beginPath();
      ctx!.arc(ax + size / 2, ay + size / 2, size / 2 + 4, 0, Math.PI * 2);
      ctx!.closePath();
      // 在AI对战模式下使用金色边框
      ctx!.fillStyle = isAiBattleModeRef.current ? '#FFD700' : '#fff';
      ctx!.fill();

      // 在AI对战模式下添加金色外圈
      if (isAiBattleModeRef.current) {
        ctx!.strokeStyle = '#FFA500';
        ctx!.lineWidth = 3;
        ctx!.stroke();
      }

      // Reset shadow
      ctx!.shadowColor = 'transparent';
      ctx!.shadowBlur = 0;
      ctx!.shadowOffsetY = 0;

      // Circular clip for avatar
      ctx!.beginPath();
      ctx!.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
      ctx!.closePath();
      ctx!.clip();
      ctx!.drawImage(avatar, ax, ay, size, size);
      ctx!.restore();
    }

    /* ---- Game Logic ---- */
    function startCharge() {
      if (stateRef.current !== 'idle') return;
      stateRef.current = 'charging';
      chargeStartRef.current = performance.now();
      chargeTimeRef.current = 0;
      platSquashRef.current = 0;
      sfx(playCharge);
    }

    function releaseCharge() {
      if (stateRef.current !== 'charging') return;

      sfx(stopCharge);

      chargeTimeRef.current = Math.min(
        performance.now() - chargeStartRef.current,
        C.MAX_CHARGE
      );
      const power = chargeTimeRef.current * C.POWER_SCALE;

      const plats = platformsRef.current;
      const pIdx = pIdxRef.current;
      const cur = plats[pIdx];
      const next = plats[pIdx + 1];
      if (!next) {
        stateRef.current = 'idle';
        return;
      }

      const dx = next.x - cur.x;
      const dy = next.y - cur.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      jumpDirRef.current = { x: dx / len, y: dy / len };
      jumpDistRef.current = power;
      jumpFromRef.current = { x: playerRef.current.x, y: playerRef.current.y };
      jumpLandRef.current = {
        x: playerRef.current.x + (dx / len) * power,
        y: playerRef.current.y + (dy / len) * power,
      };

      jumpDurationRef.current = 350 + power * 0.4;
      jumpElapsedRef.current = 0;
      stateRef.current = 'jumping';
      playerRef.current.squash = 0;
      platSquashRef.current = 0;
      sfx(playJump);
    }

    function checkLanding() {
      const pIdx = pIdxRef.current;
      const plats = platformsRef.current;
      const next = plats[pIdx + 1];
      if (!next) {
        // ===== 奶酪AI跳跃：没有下一个平台 =====
        // AI动作结束，释放行动锁。
        if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') {
          isAiMoving = false;
        }
        startFalling();
        return;
      }

      const player = playerRef.current;
      const dx = player.x - next.x;
      const dy = player.y - next.y;

      if (Math.abs(dx) / next.hw + Math.abs(dy) / next.hd <= 1) {
        pIdxRef.current = pIdx + 1;

        const d = dist(player.x, player.y, next.x, next.y);
        const isCenter = d < C.CENTER_R;
        let pts: number;
        if (isCenter) {
          centerComboRef.current += 1;
          pts = 2 * centerComboRef.current;
        } else {
          centerComboRef.current = 0;
          pts = 1;
        }
        scoreRef.current += pts;

        // PK对战模式：独立加分逻辑
        if (isAiBattleModeRef.current) {
          if (currentTurnRef.current === 'player') {
            if (playerScore < 100) {
              playerScore += pts;
            }
          } else if (currentTurnRef.current === 'ai') {
            if (cheeseScore < 100) {
              cheeseScore += pts;
            }
          }
        }

        // Update best score
        if (scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          localStorage.setItem('jump_best', String(bestRef.current));
        }

        // Check if background should transition
        const newBgIdx = getBgIndex(scoreRef.current);
        const fade = bgFadeRef.current;
        if (newBgIdx !== fade.to && fade.progress >= 1) {
          fade.from = fade.to;
          fade.to = newBgIdx;
          fade.progress = 0;
        }

        // Combo tracking (any consecutive successful landing)
        comboRef.current += 1;

        // Sound effect
        if (isCenter) {
          sfx(playPerfect);
        } else {
          sfx(playLand);
        }

        // Floating text (above camel head so it's not hidden)
        floatsRef.current.push({
          x: player.x,
          y: player.y - C.PH * 2.4 - 10,
          text: '+' + pts,
          color: isCenter ? '#D4A017' : '#fff',
          alpha: 1,
          life: 0,
          maxLife: 800,
        });

        // Trigger commentary - 5种场景统一由奶酪智能体输出
        if (isCenter) {
          // 精准落点加分 → happy头像
          agentMoodRef.current = 'happy';
          triggerCommentaryRef.current('perfect_land');
        } else if (scoreRef.current >= 50 && [50, 100, 150, 200].some(m => scoreRef.current - pts < m && scoreRef.current >= m)) {
          // 高分里程碑（分数刚跨过阈值）→ 右上方独立对话框 + happy头像
          const milestones = [50, 100, 150, 200];
          let reachedMilestone = 0;
          for (const m of milestones) {
            if (scoreRef.current >= m) reachedMilestone = m;
          }
          if (HIGH_SCORE_TEXTS[reachedMilestone]) {
            showMilestone(HIGH_SCORE_TEXTS[reachedMilestone]);
            sfx(playMilestone);
          }
          agentMoodRef.current = 'happy';
          triggerCommentaryRef.current('high_score');
        } else if (comboRef.current >= 3) {
          // 连胜3次以上 → happy头像
          agentMoodRef.current = 'happy';
          triggerCommentaryRef.current('high_score');
        }

        // 地标切换时触发解说（延迟避免覆盖其他解说）
        if (newBgIdx > prevBgIdxRef.current) {
          const targetIdx = newBgIdx;
          prevBgIdxRef.current = targetIdx;
          currentBgIdxRef.current = targetIdx;
          sfx(playLandmark);
          // 地标场景 → 左上角持续显示地标信息 + 奶酪头像旁简短提示
          setTimeout(() => {
            agentMoodRef.current = 'normal';
            const landmarkName = LANDMARK_NAMES[targetIdx] || '新地标';
            const landmarkText = LANDMARK_COMMENTARY[targetIdx] || '新地标到啦喵！';
            showLandmarkInfo(landmarkName, landmarkText);
            showCommentary(`到达${landmarkName}啦喵！`, 'normal');
          }, 1500);
        }

        // Snap
        player.x = next.x;
        player.y = next.y;
        player.z = 0;

        // Generate more
        while (platformsRef.current.length - pIdxRef.current < 6) addNextPlat();

        // Trim
        if (pIdxRef.current > 3) {
          platformsRef.current.splice(0, pIdxRef.current - 1);
          pIdxRef.current = 1;
        }

        updateCamTarget();
        if (scoreRef.current >= 100) {
          // ===== 达到100分触发结算 =====
          if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') {
            // AI动作结束，释放行动锁。（所有结束分支第一行：解锁isAiMoving）
            isAiMoving = false;
            turnOwner = -1;
            // 奶酪分数已在加分逻辑中独立更新，无需同步
            
            // ======== 调试日志：奶酪达到100分 ========
            console.log('[对战调试] 奶酪达到100分，已设置 isAiMoving=false, turnOwner=-1, cheeseScore=' + cheeseScore);
            
            setAiScore(scoreRef.current);
            // 积分结算
            if (playerFallCount === false && cheeseFallCount === false) {
              stateRef.current = 'game_over';
              if (playerScore > cheeseScore) {
                setGameResult('player_win');
                showCommentary('全程零失误！你率先达到100分，实力碾压奶酪！', 'happy');
              } else if (cheeseScore > playerScore) {
                setGameResult('ai_win');
                showCommentary('奶酪稳定发挥先到100分，本次PK惜败！', 'happy');
              } else {
                setGameResult('draw');
                showCommentary('双方都达到100分，本局平局，再来一局分出高下！', 'normal');
              }
            }
          } else if (isAiBattleModeRef.current && currentTurnRef.current === 'player') {
            // 玩家达到100分
            turnOwner = -1;
            // 玩家分数已在加分逻辑中独立更新，无需同步
            console.log('[对战调试] 玩家达到100分，playerScore=' + playerScore);
            // 积分结算
            if (playerFallCount === false && cheeseFallCount === false) {
              stateRef.current = 'game_over';
              if (playerScore > cheeseScore) {
                setGameResult('player_win');
                showCommentary('全程零失误！你率先达到100分，实力碾压奶酪！', 'happy');
              } else if (cheeseScore > playerScore) {
                setGameResult('ai_win');
                showCommentary('奶酪稳定发挥先到100分，本次PK惜败！', 'happy');
              } else {
                setGameResult('draw');
                showCommentary('双方都达到100分，本局平局，再来一局分出高下！', 'normal');
              }
            }
          } else {
            showVictory();
          }
        } else {
          stateRef.current = 'idle';
          // AI对战模式回合切换
          if (isAiBattleModeRef.current) {
            if (currentTurnRef.current === 'player') {
              // ======================================
              // 玩家成功落地 -> 切换AI回合
              // ======================================
              // ======== 调试日志：玩家落地成功，准备切换奶酪回合 ========
              console.log('[对战调试] 玩家落地，准备切换奶酪回合，当前 turnOwner =', turnOwner, '，isAiMoving =', isAiMoving);
              
              // 玩家分数已在加分逻辑中独立更新，无需同步
              // 积分结算校验
              if (playerFallCount === false && cheeseFallCount === false) {
                if (playerScore >= 100 || cheeseScore >= 100) {
                  console.log("[对战调试] 双方无掉落，积分达标触发结算");
                  battleTimerIds.forEach(id => clearTimeout(id));
                  battleTimerIds.clear();
                  turnOwner = -1;
                  if (playerScore > cheeseScore) {
                    stateRef.current = 'game_over';
                    setGameResult('player_win');
                    showCommentary('全程零失误！你率先达到100分，实力碾压奶酪！', 'happy');
                  } else if (cheeseScore > playerScore) {
                    stateRef.current = 'game_over';
                    setGameResult('ai_win');
                    showCommentary('奶酪稳定发挥先到100分，本次PK惜败！', 'happy');
                  } else {
                    stateRef.current = 'game_over';
                    setGameResult('draw');
                    showCommentary('双方都达到100分，本局平局，再来一局分出高下！', 'normal');
                  }
                  return;
                }
              }
              turnOwner = 1;
              isAiMoving = true;
              // ===== 新增：玩家跳跃成功落地 -> 重置玩家跳跃标记，关闭玩家掉落检测 =====
              playerJustCompletedJump = false;
              console.log('[对战调试] 已设置 turnOwner=1, isAiMoving=true，playerJustCompletedJump=false（关闭玩家掉落检测），playerScore=' + playerScore + '，等待600ms后调用奶酪跳跃');
              // PK解说：玩家成功跳跃加分后
              showCommentary(`漂亮！成功加分，当前你的分数：${playerScore}`, 'happy');
              // PK解说：回合切换为AI奶酪回合
              showCommentary("奶酪开始跳跃，小心它拉开分数差距！", 'normal');
              
              // 延迟调用奶酪跳跃，不在定时器里修改isAiMoving，全程保持isAiMoving=true
              // ===== 新增：保存定时器id到battleTimerIds，方便结算时统一清除 =====
              const t1 = window.setTimeout(() => {
                console.log('[对战调试] 600ms延迟到达，调用 runCheeseJump()，当前 isAiMoving =', isAiMoving, ', turnOwner =', turnOwner);
                setCurrentTurn('ai');
                runCheeseJump();
              }, 600);
              battleTimerIds.add(t1);
            } else if (currentTurnRef.current === 'ai') {
              // ======================================
              // 奶酪AI跳跃成功落地、未掉落 -> 切回玩家回合
              // ======================================
              // AI动作结束，释放行动锁。（所有结束分支第一行：解锁isAiMoving）
              isAiMoving = false;
              turnOwner = 0;
              // 奶酪分数已在加分逻辑中独立更新，无需同步
              // 积分结算校验
              if (playerFallCount === false && cheeseFallCount === false) {
                if (playerScore >= 100 || cheeseScore >= 100) {
                  console.log("[对战调试] 双方无掉落，积分达标触发结算");
                  battleTimerIds.forEach(id => clearTimeout(id));
                  battleTimerIds.clear();
                  turnOwner = -1;
                  if (playerScore > cheeseScore) {
                    stateRef.current = 'game_over';
                    setGameResult('player_win');
                    showCommentary('全程零失误！你率先达到100分，实力碾压奶酪！', 'happy');
                  } else if (cheeseScore > playerScore) {
                    stateRef.current = 'game_over';
                    setGameResult('ai_win');
                    showCommentary('奶酪稳定发挥先到100分，本次PK惜败！', 'happy');
                  } else {
                    stateRef.current = 'game_over';
                    setGameResult('draw');
                    showCommentary('双方都达到100分，本局平局，再来一局分出高下！', 'normal');
                  }
                  return;
                }
              }
              aiJumpTriggered = false;
              cheeseJumpCount++;
              console.log('[对战调试] 奶酪落地成功，当前跳跃次数 =', cheeseJumpCount, '，已设置 isAiMoving=false, turnOwner=0, cheeseScore=' + cheeseScore + '，准备同步分数并等待300ms切换到玩家回合');
              
              const isCenter = dist(playerRef.current.x, playerRef.current.y, next.x, next.y) < C.CENTER_R;
              aiJumpTriggeredRef.current = false;
              setAiScore(scoreRef.current);
              // PK解说：奶酪成功跳跃加分后
              showCommentary(`奶酪稳稳落地，它的分数提升至${cheeseScore}！`, 'normal');
              // PK解说：回合切换为玩家回合
              showCommentary("轮到你操作骆驼，稳住落点别掉下去！", 'normal');
              // ===== 新增：保存定时器id到battleTimerIds =====
              const t2 = window.setTimeout(() => { setCurrentTurn('player'); }, 300);
              battleTimerIds.add(t2);
            }
          }
        }
      } else {
        const cur = plats[pIdx];
        const cdx = player.x - cur.x;
        const cdy = player.y - cur.y;
        if (Math.abs(cdx) / cur.hw + Math.abs(cdy) / cur.hd <= 1) {
          player.x = cur.x;
          player.y = cur.y;
          player.z = 0;
          // Reset combo on short jump back
          comboRef.current = 0;
          centerComboRef.current = 0;
          stateRef.current = 'idle';
          // ===== 玩家AI跳跃：跳短了回落到当前平台（轻微失误，免死适用场景）=====
          if (isAiBattleModeRef.current && currentTurnRef.current === 'player') {
            // 玩家跳短回落到当前平台 -> 属于「跳跃中途轻微失误、未完全掉出赛道」
            // 重置 playerJustCompletedJump=false，不再触发后续的 startFalling 掉落检测
            playerJustCompletedJump = false;
            console.log('[对战调试] 玩家跳短回落到当前平台：轻微失误，免死适用，重置playerJustCompletedJump=false，玩家可以继续跳跃');
          }
          // ===== 奶酪AI跳跃：跳短了回落到当前平台 =====
          if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') {
            // AI动作结束，释放行动锁。（所有结束分支第一行：解锁isAiMoving）
            isAiMoving = false;
            
            // ======== 调试日志：奶酪跳短了 ========
            console.log('[对战调试] 奶酪跳短了，已设置 isAiMoving=false，进入掉落结算');
            
            // 奶酪未前进，直接进入掉落结算
            startFalling();
          }
        } else {
          // ===== 奶酪AI跳跃：跳偏了 =====
          if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') {
            // AI动作结束，释放行动锁。（所有结束分支第一行：解锁isAiMoving）
            isAiMoving = false;
            
            // ======== 调试日志：奶酪跳偏了 ========
            console.log('[对战调试] 奶酪跳偏了，已设置 isAiMoving=false，进入掉落');
          }
          startFalling();
        }
      }
    }

    function startFalling() {
      stateRef.current = 'falling';
      sfx(playFall);
      fallVelocityRef.current = 0;
      fallRotationRef.current = 0;
      comboRef.current = 0;
      centerComboRef.current = 0;
      // AI对战模式：追踪掉落计数
      if (isAiBattleModeRef.current) {
        const turn = currentTurnRef.current;
        if (turn === 'player') {
          // ======================================
          // 玩家跳跃：开始掉落 -> 仅在玩家自己完成跳跃后才允许检测
          // ======================================
          // ===== 限制玩家掉落检测的触发时机 =====
          // 只有 playerJustCompletedJump === true（玩家自己刚刚完成了一次蓄力跳跃）才执行玩家掉落检测
          // AI跳跃期间、回合切换间隙，playerJustCompletedJump===false，防止误触发玩家结算
          if (!playerJustCompletedJump) {
            console.log('[对战调试] 玩家掉落被拦截：playerJustCompletedJump=false（非玩家自己跳跃期间），跳过玩家掉落检测，当前 turnOwner=', turnOwner, ', isAiMoving=', isAiMoving);
            return;
          }
          // ===== 通过检查：玩家确实自己跳跃后掉落 =====
          // 此时玩家已经完全跳离平台，即将开始下坠，这里只增加计数作为统计用途
          // 真正的结算在 showContinuePrompt 中（z < -300 时触发）
          console.log('[对战调试] 玩家掉落检测通过：playerJustCompletedJump=true，玩家已完全跳离平台，准备进入下落动画，当前计数 =', playerFallCount + 1);
          playerJustCompletedJump = false;
          // 同步模块级别变量（保证 JSX onClick 可访问）
          playerFallCount = true;
          playerFallCountRef.current = 1;
          agentMoodRef.current = 'comfort';
          triggerCommentaryRef.current('game_over');
        } else {
          // ======================================
          // 奶酪AI跳跃：开始掉落 -> 解锁行动锁
          // ======================================
          // AI动作结束，释放行动锁。（所有结束分支第一行：解锁isAiMoving）
          isAiMoving = false;
          
          // ======== 调试日志：奶酪开始掉落 ========
          console.log('[对战调试] 奶酪开始掉落，已设置 isAiMoving=false，奶酪掉落计数 =', cheeseFallCount + 1);

          // 同步模块级别变量（保证 JSX onClick 可访问）
          cheeseFallCount = true;
          aiFallCountRef.current = 1;
          showCommentary('奶酪失误了喵...下次一定！', 'comfort');
        }
      } else {
        agentMoodRef.current = 'comfort';
        triggerCommentaryRef.current('game_over');
      }
    }

    function showContinuePrompt() {
      // AI对战模式：免死判定或判负
      if (isAiBattleModeRef.current) {
        const turn = currentTurnRef.current;
        const fallCount = turn === 'player' ? playerFallCountRef.current : aiFallCountRef.current;
        aiJumpTriggered = false;
        aiJumpTriggeredRef.current = false;
        
        // ====================================================================
        // 【执行优先级1】先判断：玩家是否触发完全掉落赛道
        // 玩家掉落后立刻执行结算弹窗，不再向下执行免死相关代码！
        // 免死逻辑仅适用于「跳跃中途轻微失误、未完全掉出赛道」场景
        // 一旦到达这里（z < -300），说明玩家已经完全掉出赛道，免死直接失效
        // ====================================================================
        if (turn === 'player') {
          // ======================================
          // 玩家完全掉落赛道 -> 立即结算玩家失败！
          // （免死逻辑不再判断，直接失效）
          // ======================================
          console.log('[对战调试] 玩家掉落结算，当前 isAiMoving =', isAiMoving, '，掉落次数 =', fallCount, '，免死逻辑直接失效（玩家已完全掉出赛道）');
          
          // ======== 强制掉落必弹出结算面板：第一行添加结算弹窗唤起 ========
          // 屏蔽全部操作、清空循环标记
          isAiMoving = false;
          turnOwner = -1; // -1代表对局结束，禁止任何跳跃输入
          // 清空所有延迟定时器
          battleTimerIds.forEach(id => clearTimeout(id));
          battleTimerIds.clear();
          // 强制渲染结算界面（奶酪获胜）
          stateRef.current = 'game_over';
          setGameResult('ai_win');
          showCommentary('你掉落平台，奶酪赢得这局PK！', 'happy');
          // ======== 新增：结算打印 ========
          console.log('[对战调试] 对局终止，唤起结算弹窗，关闭所有对战循环');
          
          // 直接终止当前代码执行，不再运行免死、回合切换代码
          return;
        }
        
        // ====================================================================
        // 【执行优先级2】只有未检测到玩家掉落时，才到达此处
        // （即 turn === 'ai' 的场景）此时执行奶酪掉落结算
        // ====================================================================
        if (turn === 'ai') {
          // ======================================
          // 奶酪AI跳跃：掉落平台 -> 直接结算玩家胜利
          // ======================================
          // AI动作结束，释放行动锁。（所有结束分支第一行：双重保险解锁isAiMoving）
          isAiMoving = false;
          // 结算触发后清空所有对战定时器
          battleTimerIds.forEach(id => clearTimeout(id));
          battleTimerIds.clear();
          
          // ======== 调试日志：奶酪掉落结算 ========
          console.log('[对战调试] 进入奶酪掉落结算，已设置 isAiMoving=false，battleTimerIds已清空，弹出玩家胜利结算面板（setGameResult player_win），终止所有回合');
          
          // 奶酪掉落：直接弹出结算面板，终止所有回合循环，不切换回合
          stateRef.current = 'game_over';
          setGameResult('player_win');
          showCommentary('奶酪失足掉落，你拿下本局胜利！', 'happy');
          // ======== 新增：结算打印 ========
          console.log('[对战调试] 对局终止，唤起结算弹窗，关闭所有对战循环');
        }
        
        return;
      }
      stateRef.current = 'continue_prompt';
    }

    function continueGame() {
      const pIdx = pIdxRef.current;
      const plats = platformsRef.current;
      const cur = plats[pIdx];
      playerRef.current = { x: cur.x, y: cur.y, z: 0, squash: 0 };
      fallVelocityRef.current = 0;
      fallRotationRef.current = 0;
      // 继续游戏 → 恢复常态头像
      agentMoodRef.current = 'normal';
      stateRef.current = 'idle';
      restartAtRef.current = performance.now();
      sfx(playContinue);
    }

    function showVictory() {
      stateRef.current = 'victory';
      sfx(playVictory);
      if (scoreRef.current > bestRef.current) {
        bestRef.current = scoreRef.current;
        localStorage.setItem('jump_best', String(bestRef.current));
      }
    }

    /* ---- Update ---- */
    function update(dt: number) {
      // ====================================================================
      // 【执行优先级0】对局生命周期锁定：任意一方掉落触发结算后，立刻屏蔽所有游戏逻辑
      // 只有点击【再来一局】完成变量重置，才重新开放跳跃操作
      // ====================================================================
      if (isAiBattleModeRef.current && stateRef.current === 'game_over') {
        // 游戏已结束，停止所有游戏逻辑更新（玩家蓄力、AI跳跃、平台检测）
        return;
      }

      const cam = camRef.current;
      cam.x = lerp(cam.x, cam.tx, 0.06);
      cam.y = lerp(cam.y, cam.ty, 0.06);

      // ======== 调试日志：每帧打印对战状态（AI回合时） ========
      if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') {
        // 仅保留动画运行时的状态提示，不再主动触发 AI 跳跃
        // AI跳跃现在唯一由玩家落地后的 setTimeout 来触发
        if (isAiMoving && !aiJumpTriggeredRef.current) {
          // 这是调试用的状态快照，不拦截定时器
          console.log('[对战调试] 主循环检测：AI回合，isAiMoving=true, aiJumpTriggered=false，等待玩家落地后的定时器');
        }
      }

      // Advance background fade
      const fade = bgFadeRef.current;
      if (fade.progress < 1) {
        fade.progress = Math.min(1, fade.progress + dt / 1200); // 1.2s crossfade
      }

      const state = stateRef.current;

      if (state === 'charging') {
        chargeTimeRef.current = Math.min(
          performance.now() - chargeStartRef.current,
          C.MAX_CHARGE
        );
        const cf = chargeTimeRef.current / C.MAX_CHARGE;
        playerRef.current.squash = Math.min(cf, 1) * 0.8;
        platSquashRef.current = Math.min(cf, 1) * 0.8;
      }

      if (state === 'jumping') {
        jumpElapsedRef.current += dt;
        const t = Math.min(jumpElapsedRef.current / jumpDurationRef.current, 1);
        const jf = jumpFromRef.current;
        const jl = jumpLandRef.current;
        playerRef.current.x = lerp(jf.x, jl.x, t);
        playerRef.current.y = lerp(jf.y, jl.y, t);
        playerRef.current.z = C.JUMP_HEIGHT * 4 * t * (1 - t);
        if (t >= 1) {
          playerRef.current.z = 0;
          checkLanding();
        }
      }

      if (state === 'falling') {
        fallVelocityRef.current += dt * 0.008;
        playerRef.current.z -= fallVelocityRef.current;
        playerRef.current.y += fallVelocityRef.current * 0.3;
        fallRotationRef.current += dt * 0.005;
        // PK解说：玩家即将掉落预警
        if (isAiBattleModeRef.current && playerRef.current.z < -200 && playerRef.current.z >= -300) {
          showCommentary("危险！再偏移就要掉落输掉本局！", 'comfort');
        }
        if (playerRef.current.z < -300) {
          showContinuePrompt();
        }
      }

      // Floats
      const floats = floatsRef.current;
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life += dt;
        f.y -= dt * 0.04;
        f.alpha = 1 - f.life / f.maxLife;
        if (f.life >= f.maxLife) floats.splice(i, 1);
      }

      // Commentary fade
      const cm = commentaryRef.current;
      if (cm && cm.text) {
        cm.life += dt;
        if (cm.life > cm.maxLife * 0.6) {
          cm.alpha = Math.max(
            0,
            1 - (cm.life - cm.maxLife * 0.6) / (cm.maxLife * 0.4)
          );
        }
        if (cm.life >= cm.maxLife) {
          commentaryRef.current = null;
        }
      }

      // Milestone fade
      const ms = milestoneRef.current;
      if (ms && ms.text) {
        ms.life += dt;
        if (ms.life > ms.maxLife * 0.6) {
          ms.alpha = Math.max(
            0,
            1 - (ms.life - ms.maxLife * 0.6) / (ms.maxLife * 0.4)
          );
        }
        if (ms.life >= ms.maxLife) {
          milestoneRef.current = null;
        }
      }
    }

    /* ---- Render ---- */
    function render() {
      const { w, h } = sizeRef.current;
      ctx!.clearRect(0, 0, w, h);
      drawBg();

      ctx!.save();
      ctx!.translate(camRef.current.x, camRef.current.y);

      // Sort for depth
      const plats = platformsRef.current;
      const drawList: { type: string; y: number; idx: number }[] = [];
      for (let i = 0; i < plats.length; i++) {
        drawList.push({ type: 'plat', y: plats[i].y, idx: i });
      }
      drawList.push({ type: 'player', y: playerRef.current.y, idx: -1 });
      drawList.sort((a, b) => a.y - b.y);

      for (const item of drawList) {
        if (item.type === 'plat') {
          drawPlat(plats[item.idx], item.idx === pIdxRef.current);
        } else {
          drawPlayer();
        }
      }

      drawFloats();

      ctx!.restore();

      drawUI();
      if (!isAiBattleModeRef.current) {
        drawLandmarkInfo();
        drawMilestone();
        drawAgentAvatar();
        drawCommentary();
      } else {
        drawAgentAvatar();
        drawCommentary();
      }
    }

    /* ---- Input ---- */
    function onPointerDown(e: Event) {
      e.preventDefault();
      // 在AI对战模式下，AI回合时禁用玩家输入
      if (isAiBattleModeRef.current && currentTurnRef.current === 'ai') return;
      // 对战模式下：只有 turnOwner===0（当前是玩家回合），才能响应蓄力跳跃
      if (isAiBattleModeRef.current && turnOwner !== 0) return;
      resumeAudio();
      if (stateRef.current === 'continue_prompt') {
        continueGame();
        return;
      }
      if (stateRef.current === 'victory' || stateRef.current === 'over') {
        // 单人模式结束 -> 调用 startGame，完全不改动单人模式逻辑
        startGame();
        restartAtRef.current = performance.now();
        return;
      }
      if (stateRef.current === 'game_over') {
        // 对战模式结束 -> 调用项目原有 startGame 初始化逻辑
        startGame();
        setCurrentTurn('player');
        setGameResult(null);
        restartAtRef.current = performance.now();
        console.log('[对战调试] 画布点击重置：新对局初始化完成，分数归零，回合重置');
        return;
      }
      if (performance.now() - restartAtRef.current < 300) return;
      startCharge();
    }

    function onPointerUp(e: Event) {
      e.preventDefault();
      // ===== 新增：玩家释放跳跃 -> 标记玩家完成了一次蓄力跳跃 =====
      // 只有玩家自己输入才会设置此标记，用于控制掉落检测的触发时机
      if (isAiBattleModeRef.current) {
        playerJustCompletedJump = true;
        console.log('[对战调试] 玩家释放跳跃，设置 playerJustCompletedJump=true，允许后续玩家掉落检测');
      }
      releaseCharge();
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchend', onPointerUp, { passive: false });
    canvas.addEventListener('touchmove', (e: Event) => e.preventDefault(), {
      passive: false,
    });
    canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    // Keyboard
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        onPointerDown(e);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        onPointerUp(e);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Resize
    function onResize() {
      resize();
      updateCamTarget();
    }
    window.addEventListener('resize', onResize);

    /* ---- Game Loop ---- */
    function loop(ts: number) {
      const dt = lastTSRef.current ? Math.min(ts - lastTSRef.current, 50) : 16;
      lastTSRef.current = ts;
      update(dt);
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    }

    startGame();
    animFrameRef.current = requestAnimationFrame(loop);

    /* ---- Cleanup ---- */
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener('mousedown', onPointerDown);
      canvas.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchend', onPointerUp);
      canvas.removeEventListener('contextmenu', (e: Event) => e.preventDefault());
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const phase = coverPhase;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
        }}
      />

      {/* ===== 音效开关 ===== */}
      {(phase === 'playing' || phase === 'cover') && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 10,
          display: 'flex', gap: '8px',
        }}>
          <button
            onClick={() => { soundOnRef.current = !soundOnRef.current; setSoundOn(soundOnRef.current); }}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '18px', lineHeight: '36px',
              textAlign: 'center', padding: 0,
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => {
              bgmMutedRef.current = !bgmMutedRef.current;
              setBgmMuted(bgmMutedRef.current);
              if (bgmAudioRef.current) {
                bgmAudioRef.current.muted = bgmMutedRef.current;
              }
            }}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '18px', lineHeight: '36px',
              textAlign: 'center', padding: 0,
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {bgmMuted ? '🎵' : '🎶'}
          </button>
        </div>
      )}

      {/* ===== 游戏封面 ===== */}
      {phase === 'cover' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            backgroundImage: 'url(/cover-bg.jpg)',
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        >
          {/* 半透明遮罩让标题更清晰 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.25) 100%)',
          }} />

          {/* 标题 - 黄色描边风格 */}
          <h1 style={{
            position: 'relative', zIndex: 1,
            marginTop: '10vh',
            fontSize: 'clamp(36px, 9vw, 80px)',
            fontWeight: 900,
            color: '#FFD93D',
            textShadow: '3px 3px 0 #8B5E1A, -1px -1px 0 #8B5E1A, 1px -1px 0 #8B5E1A, -1px 1px 0 #8B5E1A, 1px 1px 0 #8B5E1A, 0 4px 16px rgba(0,0,0,0.4)',
            letterSpacing: '6px',
            animation: 'coverTitleIn 0.8s ease-out both',
            WebkitTextStroke: '1px #6B4200',
          }}>
            首经贸跳跳驼
          </h1>

          {/* 骆驼和小猫角色区域 */}
          <div style={{
            position: 'absolute', zIndex: 1,
            bottom: '22vh',
            left: 0, right: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            padding: '0 6vw',
            pointerEvents: 'none',
          }}>
            {/* 左侧 - 骆驼 */}
            <div style={{
              animation: 'coverCamelBounce 1.8s ease-in-out infinite',
            }}>
              <img
                src="/camel.png"
                alt="跳跳驼"
                style={{
                  width: 'clamp(110px, 24vw, 220px)',
                  height: 'auto',
                  filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
            {/* 右侧 - 奶酪猫 */}
            <div style={{
              animation: 'coverCatPulse 2s ease-in-out infinite',
            }}>
              <img
                src="/agent-avatar.png"
                alt="奶酪"
                style={{
                  width: 'clamp(110px, 24vw, 220px)',
                  height: 'auto',
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.8)',
                  filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
          </div>

          {/* 按钮区域 */}
          <div style={{
            position: 'absolute', zIndex: 1,
            bottom: '28vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px',
            animation: 'coverBtnIn 0.6s 0.5s ease-out both',
          }}>
            <button
              onClick={() => { resumeAudio(); sfx(playStart); setIsAiBattleMode(false); setCoverPhase('rules'); }}
              style={{
                padding: '16px 60px',
                fontSize: 'clamp(20px, 4.5vw, 30px)',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #FFB347, #FF9A3C)',
                border: '3px solid #8B5E1A',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255,160,60,0.45)',
                animation: 'coverBtnPulse 2s 1.2s ease-in-out infinite',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              单人闯关
            </button>
            <button
              onClick={() => { resumeAudio(); sfx(playStart); setCoverPhase('ai_rules'); }}
              style={{
                padding: '14px 48px',
                fontSize: 'clamp(16px, 3.5vw, 24px)',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: '2px solid #4a5568',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(102,126,234,0.3)',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              和奶酪PK
            </button>
          </div>
        </div>
      )}

      {/* ===== 游戏规则 ===== */}
      {phase === 'rules' && (
        <div
          onClick={() => setCoverPhase('playing')}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'linear-gradient(180deg, #FFF5EB 0%, #FFEDD5 50%, #FFE0C0 100%)',
            overflowY: 'auto', padding: 'clamp(20px,4vw,40px) 20px',
            animation: 'rulesFadeIn 0.5s ease-out both',
            cursor: 'pointer',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(22px,5vw,34px)', fontWeight: 800, color: '#C65D00',
            marginBottom: '16px', marginTop: 'clamp(16px,3vh,40px)',
          }}>
            🐫 首经贸跳跳驼
          </h2>
          <p style={{
            fontSize: 'clamp(14px,3vw,17px)', lineHeight: 1.8, color: '#5D3A1A',
            maxWidth: '520px', textAlign: 'center', marginBottom: '24px',
          }}>
            你将化身首经贸er小骆驼，在校园地图中开启跳跃冒险，从校门一路跳遍教学楼、操场、食堂等标志性地点。
            校宠橘白猫「奶酪」会全程陪伴，用软萌喵系语气为你讲解校园趣事、加油打气，带你沉浸式打卡校园风光~
          </p>

          <div style={{ maxWidth: '520px', width: '100%' }}>
            <RuleBlock icon="🎮" title="玩法" text="长按蓄力、松开跳跃，成功跳到下一个平台即可前进，掉落也不怕，跳到终点即为胜利✌🏻" />
            <RuleBlock icon="🐱" title="奶酪向导" text="首经贸校宠橘白猫，会用软萌语气为你介绍校园、失误时安慰你、高分时夸夸你，踩芝士/毛线团平台还会触发专属互动彩蛋！" />
            <RuleBlock icon="✨" title="得分&平台" text="普通平台+1分，完美落点可获得更多+分，还有多种校园主题皮肤平台等你来解锁~" />
            <RuleBlock icon="📍" title="目标" text="挑战更高分，打卡更多校园场景，收集奶酪的全部互动台词！" />
          </div>

          {/* 校园地图按钮 */}
          <button
            onClick={e => { e.stopPropagation(); setCoverPhase('map'); }}
            style={{
              marginTop: '24px', padding: '10px 36px',
              fontSize: 'clamp(14px,3vw,18px)', fontWeight: 700,
              color: '#C65D00', background: '#fff',
              border: '2px solid #FFB366', borderRadius: '50px',
              cursor: 'pointer', boxShadow: '0 2px 10px rgba(255,140,50,0.2)',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            📍 校园地图
          </button>

          <p style={{
            marginTop: '20px', fontSize: '13px', color: '#B08050',
            marginBottom: 'clamp(20px,4vh,60px)',
          }}>
            点击空白处开始游戏
          </p>
        </div>
      )}

      {/* ===== 校园地图 ===== */}
      {phase === 'map' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: '#FFF8F0',
            overflowY: 'auto', padding: '20px',
            animation: 'rulesFadeIn 0.4s ease-out both',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(20px,4vw,28px)', fontWeight: 800, color: '#C65D00',
            marginBottom: '16px', marginTop: '16px',
          }}>
            📍 校园地图
          </h2>
          <img
            src="/campus-map.jpg"
            alt="校园地图"
            style={{
              maxWidth: '95%', maxHeight: '70vh',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              objectFit: 'contain',
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '20px' }}>
            <button
              onClick={() => setCoverPhase('rules')}
              style={{
                padding: '10px 32px', fontSize: 'clamp(14px,3vw,18px)', fontWeight: 700,
                color: '#C65D00', background: '#fff',
                border: '2px solid #FFB366', borderRadius: '50px', cursor: 'pointer',
              }}
            >
              ← 返回
            </button>
            <button
              onClick={() => setCoverPhase('playing')}
              style={{
                padding: '10px 32px', fontSize: 'clamp(14px,3vw,18px)', fontWeight: 700,
                color: '#fff', background: 'linear-gradient(135deg, #FF7832, #FF9A56)',
                border: 'none', borderRadius: '50px', cursor: 'pointer',
              }}
            >
              开始游戏 →
            </button>
          </div>
        </div>
      )}

      {/* ===== AI对战规则 ===== */}
      {phase === 'ai_rules' && (
        <div
          onClick={() => setCoverPhase('ai_difficulty')}
          style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            animation: 'rulesFadeIn 0.4s ease-out both',
            cursor: 'pointer',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#fff',
            marginBottom: '24px', textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            和奶酪PK对战说明
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '16px',
            padding: '24px 30px',
            marginBottom: '24px',
            maxWidth: '420px',
            width: '85%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              fontSize: 'clamp(14px, 3vw, 16px)',
              color: '#555',
              lineHeight: 1.9,
              textAlign: 'left',
            }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>1. 游玩方式：</strong>你和奶酪轮流跳跃，你跳完一次，再轮到奶酪跳，交替进行；
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>2. 输赢两种判定：</strong>
                <div style={{ marginTop: '6px', paddingLeft: '16px' }}>
                  ① 谁不小心跳出平台掉落，直接输掉这一局；<br />
                  ② 如果全程两个人都没掉下去，谁先攒满100分，谁直接获胜；
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>3. 三档难度差别：</strong>
                <div style={{ marginTop: '6px', paddingLeft: '16px' }}>
                  ✅ 新手难度：奶酪容易失误、落点偏差大，容错高，适合刚上手的玩家；<br />
                  ⚖️ 标准难度：奶酪很少失误，跳跃很稳定，需要你稳定操作才能比拼分数；<br />
                  🔥 困难难度：奶酪落点几乎零偏差，极少掉落，非常考验你的跳跃精准度；
                </div>
              </div>
              <div>
                <strong>4. 结束操作：</strong>对局结束后可以再来一局重新对战，或是返回主页清空全部对局进度。
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 'clamp(16px, 3vw, 18px)',
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 500,
          }}>
            点击任意位置继续选择难度 →
          </div>
        </div>
      )}

      {/* ===== AI难度选择 ===== */}
      {phase === 'ai_difficulty' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            animation: 'rulesFadeIn 0.4s ease-out both',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: '#fff',
            marginBottom: '40px', textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            选择对战难度
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '80%', maxWidth: '400px' }}>
            <button
              onClick={() => { setAiDifficulty('easy'); setIsAiBattleMode(true); setCurrentTurn('player'); setAiScore(0); setCoverPhase('playing'); }}
              style={{
                padding: '16px 40px',
                fontSize: 'clamp(16px, 3.5vw, 22px)',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #48bb78, #38a169)',
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(72,187,120,0.4)',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              🌱 新手难度
            </button>
            <button
              onClick={() => { setAiDifficulty('normal'); setIsAiBattleMode(true); setCurrentTurn('player'); setAiScore(0); setCoverPhase('playing'); }}
              style={{
                padding: '16px 40px',
                fontSize: 'clamp(16px, 3.5vw, 22px)',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #ed8936, #dd6b20)',
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(237,137,54,0.4)',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              ⚡ 标准难度
            </button>
            <button
              onClick={() => { setAiDifficulty('hard'); setIsAiBattleMode(true); setCurrentTurn('player'); setAiScore(0); setCoverPhase('playing'); }}
              style={{
                padding: '16px 40px',
                fontSize: 'clamp(16px, 3.5vw, 22px)',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #e53e3e, #c53030)',
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(229,62,62,0.4)',
                transition: 'transform 0.15s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              🔥 困难难度
            </button>
          </div>
          <button
            onClick={() => setCoverPhase('cover')}
            style={{
              marginTop: '40px',
              padding: '10px 32px',
              fontSize: 'clamp(14px, 3vw, 18px)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.15)',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            ← 返回
          </button>
        </div>
      )}

      {/* ===== AI对战结算界面 ===== */}
      {phase === 'playing' && isAiBattleMode && gameResult !== null && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            animation: 'rulesFadeIn 0.4s ease-out both',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #FFF5EB, #FFEDD5)',
            borderRadius: '20px', padding: 'clamp(24px,4vw,40px) clamp(20px,3vw,32px)',
            maxWidth: '400px', width: '85%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'clamp(36px, 8vw, 56px)',
              marginBottom: '8px',
            }}>
              {gameResult === 'player_win' ? '🏆' : gameResult === 'draw' ? '🤝' : '😿'}
            </div>
            <div style={{
              fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800,
              color: gameResult === 'player_win' ? '#E67E22' : gameResult === 'draw' ? '#3498DB' : '#764ba2',
              marginBottom: '12px',
            }}>
              {gameResult === 'player_win' ? '你赢了！' : gameResult === 'draw' ? '平局！' : '奶酪赢了！'}
            </div>
            <div style={{
              fontSize: 'clamp(15px, 3.5vw, 20px)', fontWeight: 600,
              color: '#5D3A1A', marginBottom: '8px',
            }}>
              最终比分
            </div>
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 'clamp(24px,5vw,48px)',
              marginBottom: '20px',
            }}>
              <div>
                <div style={{ fontSize: 'clamp(12px,2.5vw,14px)', color: '#999', marginBottom: '4px' }}>你</div>
                <div style={{ fontSize: 'clamp(28px,6vw,40px)', fontWeight: 900, color: '#E67E22' }}>{playerScore}</div>
              </div>
              <div style={{ fontSize: '28px', color: '#ccc', alignSelf: 'center' }}>:</div>
              <div>
                <div style={{ fontSize: 'clamp(12px,2.5vw,14px)', color: '#999', marginBottom: '4px' }}>奶酪</div>
                <div style={{ fontSize: 'clamp(28px,6vw,40px)', fontWeight: 900, color: '#3498DB' }}>{cheeseScore}</div>
              </div>
            </div>
            <div style={{
              fontSize: 'clamp(13px, 2.8vw, 16px)', color: '#6B4226', lineHeight: 1.7,
              marginBottom: '20px', padding: '0 8px',
            }}>
              {gameResult === 'player_win'
                ? '你打败了奶酪！太厉害了喵～'
                : gameResult === 'draw'
                ? '双方均达到100分，本局平局！'
                : '奶酪略胜一筹！下次你一定能赢喵！'}
            </div>
            {/* ===== 新增：对战结算两个按钮 ===== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              {/* 【再来一局】按钮：先执行完整变量重置，再重新初始化赛道平台、骆驼与奶酪角色位置，刷新对战场景 */}
              <button
                onClick={() => {
                  const restartBattle = () => {
                    console.log("[对战调试] 点击【再来一局】按钮，开始完整变量重置");
                    // 清空旧对局定时器，防止延迟逻辑干扰新对局
                    if (typeof battleTimerIds !== "undefined") {
                      battleTimerIds.forEach(id => clearTimeout(id));
                      battleTimerIds.clear();
                    }

                    // 兜底校验所有变量，不存在就初始化，杜绝XX is not defined
                    if (typeof turnOwner === "undefined") turnOwner = 0;
                    if (typeof isAiMoving === "undefined") isAiMoving = false;
                    if (typeof aiJumpTriggered === "undefined") aiJumpTriggered = false;
                    if (typeof playerScore === "undefined") playerScore = 0;
                    if (typeof cheeseScore === "undefined") cheeseScore = 0;
                    if (typeof playerFallCount === "undefined") playerFallCount = false;
                    if (typeof cheeseFallCount === "undefined") cheeseFallCount = false;

                    // 重置对战回合状态
                    turnOwner = 0;
                    isAiMoving = false;
                    aiJumpTriggered = false;

                    // 分数、掉落标记全部清零
                    playerScore = 0;
                    cheeseScore = 0;
                    playerFallCount = false;
                    cheeseFallCount = false;

                    // 1. 强制复位骆驼、奶酪初始坐标（解决开局角色消失）
                    // 游戏开局原生坐标：第一个平台位置 = (屏幕宽度/2, 屏幕高度*0.6)
                    playerRef.current.x = sizeRef.current.w / 2;
                    playerRef.current.y = sizeRef.current.h * 0.6;
                    playerRef.current.z = 0;
                    playerRef.current.squash = 0;
                    aiCamelRef.current.x = sizeRef.current.w / 2;
                    aiCamelRef.current.y = sizeRef.current.h * 0.6;

                    // 2. 清空平台数组并重新生成平台（内联逻辑，不调用 makePlat/addNextPlat）
                    platformsRef.current = [];
                    // 创建初始平台
                    const startX = sizeRef.current.w / 2;
                    const startY = sizeRef.current.h * 0.6;
                    const hw = 70;
                    platformsRef.current.push({
                      x: startX,
                      y: startY,
                      hw: hw,
                      hd: hw * 0.55,
                      bh: 28,
                      skin: pickSkin(currentBgIdxRef.current)
                    });
                    // 生成后续6个平台（内联 addNextPlat 逻辑）
                    for (let i = 0; i < 6; i++) {
                      const plats = platformsRef.current;
                      const last = plats[plats.length - 1];
                      const dir = Math.random() < 0.5 ? 1 : -1;
                      const d = 90 + Math.random() * (210 - 90);
                      plats.push({
                        x: last.x + dir * d,
                        y: last.y - d * 0.5,
                        hw: hw,
                        hd: hw * 0.55,
                        bh: 28,
                        skin: pickSkin(currentBgIdxRef.current)
                      });
                    }

                    // 同步 UI 分数和 ref 状态
                    scoreRef.current = 0;
                    stateRef.current = 'idle';
                    pIdxRef.current = 0;
                    comboRef.current = 0;
                    centerComboRef.current = 0;
                    chargeTimeRef.current = 0;
                    platSquashRef.current = 0;
                    floatsRef.current = [];
                    playerFallCountRef.current = 0;
                    aiFallCountRef.current = 0;
                    aiJumpTriggeredRef.current = false;
                    playerJustCompletedJump = false;

                    // 更新相机目标位置（内联 updateCamTarget 逻辑）
                    const p0 = platformsRef.current[0];
                    camRef.current.tx = sizeRef.current.w / 2 - p0.x;
                    camRef.current.ty = sizeRef.current.h * 0.48 - p0.y;
                    camRef.current.x = camRef.current.tx;
                    camRef.current.y = camRef.current.ty;

                    // 关闭结算弹窗（复用项目现有 setGameResult）
                    setAiScore(0);
                    setCurrentTurn('player');
                    setGameResult(null);
                    // PK解说：点击再来一局重置完成
                    showCommentary("新一局PK开启，重新比拼！", 'normal');

                    console.log("[对战调试] 新对局初始化完成：坐标复位、分数清零、平台清空");
                  };
                  restartBattle();
                }}
                style={{
                  width: '100%',
                  padding: 'clamp(12px, 2.5vw, 16px) clamp(16px, 3vw, 24px)',
                  background: 'linear-gradient(135deg, #E67E22, #F39C12)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: 'clamp(15px, 3.5vw, 18px)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(230, 126, 34, 0.3)',
                }}
              >
                🎮 再来一局
              </button>
              {/* 【返回主页】按钮：执行全局游戏状态清理后退出 */}
              <button
                onClick={() => {
                  console.log("[对战调试] 点击返回主页，执行全局游戏状态清理");
                  // 1. 清空所有PK对局残留定时器，阻断后台延时逻辑
                  battleTimerIds.forEach(id => clearTimeout(id));
                  battleTimerIds.clear();

                  // 2. 全局重置所有PK对战状态变量（和再来一局重置变量完全一致）
                  turnOwner = 0;
                  isAiMoving = false;
                  aiJumpTriggered = false;
                  playerScore = 0;
                  cheeseScore = 0;
                  cheeseJumpCount = 0;
                  playerFallCount = false;
                  cheeseFallCount = false;
                  playerJustCompletedJump = false;

                  // 3. 强制清空平台数组，清除旧PK赛道缓存
                  platformsRef.current = [];

                  // 4. 重置角色坐标，清除掉落超边界残留位置
                  playerRef.current = { x: 0, y: 0, z: 0, squash: 0 };
                  aiCamelRef.current = { x: 0, y: 0 };

                  // 5. 清空画布缓冲区
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                  }

                  // 6. 关闭结算弹窗，返回主页
                  setGameResult(null);
                  setIsAiBattleMode(false);
                  setCoverPhase('cover');
                }}
                style={{
                  width: '100%',
                  padding: 'clamp(12px, 2.5vw, 16px) clamp(16px, 3vw, 24px)',
                  background: 'transparent',
                  color: '#7F8C8D',
                  border: '2px solid #D5D8DC',
                  borderRadius: '12px',
                  fontSize: 'clamp(15px, 3.5vw, 18px)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🏠 返回主页
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
