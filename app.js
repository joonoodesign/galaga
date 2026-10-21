/**
 * 🚀 전준우의 갤러그 (CAPTAIN JUNWOO GALAGA)
 * 아빠가 아들 전준우를 위해 만든 스페셜 아케이드 슈팅 게임
 * 지원 환경: 아이폰(iOS), 아이패드(iPadOS), PC 브라우저 + 24시간 클라우드 랭킹 동기화
 */

const STORAGE_KEY = 'junwoo_galaga_data_v1';
const SYNC_CONFIG_KEY = 'junwoo_galaga_sync_cfg_v1';
const HIDE_TUT_KEY = 'junwoo_galaga_hide_tut_v1';
const GH_REPO_PATH = 'joonoodesign/galaga';
const GH_DB_FILE = 'junwoo_galaga_db.json';

// ==================== 업적(훈장) 정의 ====================
const ACHIEVEMENTS_DEF = [
  { id: 'first_sortie', icon: '🚀', title: '전준우 첫 출격', desc: '첫 우주 함대 출격 완료' },
  { id: 'dual_fighter', icon: '🛸', title: '전준우 합체 파이터', desc: '보스 트랙터 빔 구출 또는 2대 합체 달성' },
  { id: 'stage_3_clear', icon: '🎯', title: '챌린징 스테이지 정복', desc: '보너스 스테이지(STAGE 3) 클리어' },
  { id: 'score_10k', icon: '🌟', title: '10,000점 돌파 에이스', desc: '단일 게임 10,000점 이상 획득' },
  { id: 'score_30k', icon: '👑', title: '은하계 사령관 전준우', desc: '단일 게임 30,000점 이상 획득' },
  { id: 'sharpshooter', icon: '🎖️', title: '백발백중 명사수', desc: '30발 이상 발사 후 명중률 60% 이상' }
];

// 기본 앱 데이터 (명예의 전당 + 업적 + 커스텀 설정)
function getDefaultAppData() {
  return {
    updatedAt: Date.now(),
    highScore: 20000,
    customCheerMsg: '우주 최강 전준우 화이팅! 사랑해 아들!',
    bgTheme: 'junwoo_galaxy',
    shipSkin: 'junwoo_gold',
    pilotName: '전준우',
    achievements: ['first_sortie'],
    leaderboard: [
      { name: '전준우👑', score: 20000, stage: 5, ratio: '68.5%', date: '2026-10-21' },
      { name: 'JUNWOO', score: 15400, stage: 4, ratio: '62.0%', date: '2026-10-21' },
      { name: '아빠응원단', score: 12000, stage: 3, ratio: '55.2%', date: '2026-10-21' },
      { name: 'ACE-JW', score: 8500, stage: 2, ratio: '51.0%', date: '2026-10-21' },
      { name: 'GALAGA81', score: 5000, stage: 1, ratio: '45.0%', date: '2026-10-21' }
    ]
  };
}

let appData = loadLocalData();
let syncConfig = loadSyncConfig();
let lastGhSha = null;
let isSyncing = false;

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultAppData(), ...parsed };
    }
  } catch (e) {}
  return getDefaultAppData();
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { ghToken: '', gdriveUrl: '' };
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
}

// ==================== 8비트 레트로 사운드 & 전준우 음성 응원 엔진 ====================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.bgmEnabled = true;
    this.voiceEnabled = true;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = 'square', vol = 0.12, slideTo = null) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playNoise(duration = 0.2, vol = 0.15) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 레이저 발사음
  playShoot(isDual = false) {
    this.playTone(isDual ? 1100 : 880, 0.11, 'square', 0.09, 220);
    if (isDual) {
      setTimeout(() => this.playTone(1320, 0.09, 'triangle', 0.08, 330), 25);
    }
  }

  // 적 격추음
  playEnemyHit(type = 'zako') {
    if (type === 'boss_damage') {
      this.playTone(320, 0.12, 'sawtooth', 0.12, 580);
      return;
    }
    if (type === 'boss') {
      this.playNoise(0.28, 0.18);
      this.playTone(440, 0.25, 'sawtooth', 0.14, 90);
    } else if (type === 'goei') {
      this.playNoise(0.16, 0.12);
      this.playTone(580, 0.16, 'square', 0.1, 160);
    } else {
      this.playNoise(0.12, 0.1);
      this.playTone(680, 0.14, 'square', 0.09, 200);
    }
  }

  // 플레이어 피격 폭발음
  playPlayerExplosion() {
    this.playNoise(0.55, 0.24);
    this.playTone(240, 0.5, 'sawtooth', 0.18, 45);
  }

  // 적기 급강하 사운드
  playEnemyDive() {
    this.playTone(720, 0.28, 'sine', 0.06, 260);
  }

  // 보스 트랙터 빔 사운드
  playTractorBeam() {
    if (!this.sfxEnabled) return;
    [440, 554, 659, 554].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.09, 'sine', 0.07), idx * 70);
    });
  }

  // 전준우 출격 오리지널 갤러그 팡파르
  playStartFanfare() {
    if (!this.sfxEnabled) return;
    const notes = [
      { f: 392, d: 0.12, t: 0 },
      { f: 523, d: 0.12, t: 130 },
      { f: 659, d: 0.12, t: 260 },
      { f: 784, d: 0.22, t: 390 },
      { f: 659, d: 0.12, t: 630 },
      { f: 784, d: 0.36, t: 760 }
    ];
    notes.forEach(n => {
      setTimeout(() => this.playTone(n.f, n.d, 'square', 0.11), n.t);
    });
  }

  // 듀얼 파이터 합체 성공 팡파르!
  playDualFighterFanfare() {
    if (!this.sfxEnabled) return;
    const notes = [
      { f: 523, d: 0.1, t: 0 },
      { f: 659, d: 0.1, t: 110 },
      { f: 784, d: 0.1, t: 220 },
      { f: 1046, d: 0.28, t: 330 },
      { f: 784, d: 0.1, t: 620 },
      { f: 1046, d: 0.4, t: 740 }
    ];
    notes.forEach(n => {
      setTimeout(() => this.playTone(n.f, n.d, 'triangle', 0.15), n.t);
    });
  }

  // 준우포 (스타버스트 필살기) 사운드
  playStarburstSfx() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.playTone(440 + i * 110, 0.12, 'square', 0.11);
      }, i * 55);
    }
  }

  // 준우의 우주 출격 BGM (8비트 아르페지오 루프)
  startBgm() {
    this.stopBgm();
    if (!this.bgmEnabled) return;
    // 영웅적인 우주 행진곡 베이스라인 & 멜로디
    const melody = [
      261.6, 329.6, 392.0, 523.3,
      293.7, 369.9, 440.0, 587.3,
      329.6, 392.0, 493.9, 659.3,
      392.0, 329.6, 261.6, 392.0
    ];
    this.bgmStep = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.bgmEnabled || gameState !== 'PLAYING') return;
      const freq = melody[this.bgmStep % melody.length];
      this.playTone(freq * 0.5, 0.14, 'triangle', 0.045);
      this.bgmStep++;
    }, 210);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // 우주 사령부 전준우 음성 응원 (Web Speech API)
  speakCheer(text) {
    if (!this.voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = 1.12;
      utter.pitch = 1.15;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  }
}

const sound = new SoundEngine();

// ==================== 도트 스프라이트 매트릭스 ====================
// R: 빨강, W: 흰색, B: 파랑, Y: 노랑, G: 초록, C: 시안, M: 보라, O: 주황
const SPRITES = {
  player: [
    ".....Y.....",
    ".....Y.....",
    "....WWW....",
    "....WWW....",
    "...WWBWW...",
    "..R.WBW.R..",
    ".RRWWBWWWR.",
    ".RRWWWWWRR.",
    "RRR.WWW.RRR",
    "R.R..W..R.R"
  ],
  boss1: [
    "...GGGGG...",
    "..GGGGGGG..",
    ".GGYGGGYGG.",
    ".GGGGGGGGG.",
    "GGGYYYYYGGG",
    "GG.YYYYY.GG",
    "G..Y.Y.Y..G",
    "...Y...Y..."
  ],
  boss2: [
    "G..GGGGG..G",
    ".GGGGGGGGG.",
    ".GGYGGGYGG.",
    "GGGGGGGGGGG",
    "..GYYYYYG..",
    "..GYYYYYG..",
    ".G.Y.Y.Y.G.",
    "G.........G"
  ],
  goei1: [
    "..R.....R..",
    ".RRR...RRR.",
    "RRRRWRWRRRR",
    "RRRRWWWRRRR",
    ".R.WWWWW.R.",
    "...R.W.R...",
    "..R.....R.."
  ],
  goei2: [
    "....R.R....",
    "..RRRRRRR..",
    ".RRRWRWRRR.",
    "..RRWWWRR..",
    "...WWWWW...",
    "..R.R.R.R..",
    ".R.......R."
  ],
  zako1: [
    "..Y.....Y..",
    "...B...B...",
    "..BBBBBBB..",
    ".BBYYYYYBB.",
    "BBRYYYYYRBB",
    "B.RRRRRRR.B",
    "...R...R..."
  ],
  zako2: [
    "....Y.Y....",
    "...BBBBB...",
    "..BBBBBBB..",
    "..BYYYYYB..",
    ".BRYYYYYRB.",
    "..RRRRRRR..",
    ".R.......R."
  ]
};

function getColorMap(skin = 'junwoo_gold', isDamagedBoss = false) {
  if (isDamagedBoss) {
    return {
      G: '#2979ff',
      Y: '#ff1744',
      R: '#ff9100',
      W: '#ffffff',
      B: '#00e5ff'
    };
  }
  if (skin === 'junwoo_gold') {
    return {
      W: '#ffe600',
      R: '#00f2fe',
      B: '#ff0844',
      Y: '#ffffff',
      G: '#00e676'
    };
  }
  if (skin === 'cyber_cyan') {
    return {
      W: '#00f2fe',
      R: '#b721ff',
      B: '#ffe600',
      Y: '#ffffff',
      G: '#00e676'
    };
  }
  // classic_white
  return {
    W: '#ffffff',
    R: '#ff1744',
    B: '#2979ff',
    Y: '#ffe600',
    G: '#00e676'
  };
}

function drawPixelSprite(ctx, matrix, centerX, centerY, scale = 2.6, colorMap) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const startX = centerX - (cols * scale) / 2;
  const startY = centerY - (rows * scale) / 2;

  for (let r = 0; r < rows; r++) {
    const rowStr = matrix[r];
    for (let c = 0; c < cols; c++) {
      const ch = rowStr[c];
      if (ch === '.') continue;
      ctx.fillStyle = colorMap[ch] || '#ffffff';
      ctx.fillRect(startX + c * scale, startY + r * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }
}

// ==================== 게임 상태 및 엔티티 변수 ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CW = canvas.width;   // 440
const CH = canvas.height;  // 560

let gameState = 'MENU'; // MENU, STAGE_INTRO, PLAYING, PAUSED, GAMEOVER
let difficultyMode = 'junwoo'; // 'junwoo' | 'normal'
let currentScore = 0;
let currentStage = 1;
let lives = 5;
let isDualFighter = false;
let starburstCount = 1;
let shotsFired = 0;
let hitsCount = 0;
let stageIntroTimer = 0;
let isChallengingStage = false;
let challengeHits = 0;
let challengeTotalSpawned = 0;

const keys = { left: false, right: false, fire: false };
let autoFireEnabled = true;
let touchDragTargetX = null;

// 플레이어 객체
const player = {
  x: CW / 2,
  y: CH - 58,
  speed: 4.5,
  cooldown: 0,
  invincibleTimer: 0,
  capturedShipAvailable: false
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let floatingTexts = [];
let stars = [];
let comets = [];
let bgScrollTicker = 0;

// 다층 별빛 배경 초기화
function initStars() {
  stars = [];
  const colors = ['#ffffff', '#00f2fe', '#ffe600', '#ff6b9d', '#a3bded'];
  for (let i = 0; i < 85; i++) {
    stars.push({
      x: Math.random() * CW,
      y: Math.random() * CH,
      size: Math.random() < 0.25 ? 2.2 : 1.3,
      speed: 0.4 + Math.random() * 1.8,
      color: colors[Math.floor(Math.random() * colors.length)],
      blinkOffset: Math.random() * Math.PI * 2
    });
  }
}

// 응원 토스트 배너 표시
let cheerTimeout = null;
function showCheerBanner(text, speakText = null) {
  const banner = document.getElementById('cheerBanner');
  const txtEl = document.getElementById('cheerBannerText');
  if (banner && txtEl) {
    txtEl.textContent = text;
    banner.classList.remove('hidden');
    if (cheerTimeout) clearTimeout(cheerTimeout);
    cheerTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, 2800);
  }
  if (speakText) {
    sound.speakCheer(speakText);
  }
}

// 전준우 랜덤 응원 문구
const JUNWOO_CHEERS = [
  { banner: '★ 전준우 함장님 나이스 샷! ★', voice: '전준우 함장님 나이스 샷!' },
  { banner: '🚀 우주 최강 에이스 전준우! 🚀', voice: '우주 최강 에이스 전준우 화이팅!' },
  { banner: '👑 역시 전준우! 백발백중 명사수! 👑', voice: '역시 전준우! 백발백중 명사수!' },
  { banner: '⚡ CAPTAIN JUNWOO SUPER POWER! ⚡', voice: '전준우 슈퍼 파워 발동!' },
  { banner: '💖 아빠가 항상 응원하는 전준우 최고! 💖', voice: '아빠가 항상 응원하는 전준우 최고!' }
];

function triggerRandomJunwooCheer() {
  const item = JUNWOO_CHEERS[Math.floor(Math.random() * JUNWOO_CHEERS.length)];
  sound.playDualFighterFanfare();
  showCheerBanner(item.banner, item.voice);
  spawnFloatingText(CW / 2, CH / 2 - 40, '★ JUNWOO POWER! ★', '#ffe600');
}

// ==================== 스테이지 및 적 편대 생성 ====================
function setupStage(stageNum) {
  bullets = [];
  enemyBullets = [];
  enemies = [];
  isChallengingStage = (stageNum % 3 === 0);
  challengeHits = 0;
  challengeTotalSpawned = 0;
  starburstCount = difficultyMode === 'junwoo' ? 2 : 1;

  const gridStartX = 58;
  const gridSpacingX = 36;
  const gridStartY = 76;
  const gridSpacingY = 30;

  // 40기 편대 구성:
  // Row 0: 보스 갤러그 4기 (cols 3, 4, 5, 6)
  // Row 1: 고에이 8기 (cols 1..8)
  // Row 2: 고에이 8기 (cols 1..8)
  // Row 3: 자코 10기 (cols 0..9)
  // Row 4: 자코 10기 (cols 0..9)
  const layout = [
    { row: 0, type: 'boss', cols: [3, 4, 5, 6] },
    { row: 1, type: 'goei', cols: [1, 2, 3, 4, 5, 6, 7, 8] },
    { row: 2, type: 'goei', cols: [1, 2, 3, 4, 5, 6, 7, 8] },
    { row: 3, type: 'zako', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { row: 4, type: 'zako', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
  ];

  let spawnIndex = 0;
  layout.forEach(group => {
    group.cols.forEach((col, idx) => {
      const homeX = gridStartX + col * gridSpacingX;
      const homeY = gridStartY + group.row * gridSpacingY;
      const fromLeft = (spawnIndex % 2 === 0);
      const waveGroup = Math.floor(spawnIndex / 8);
      const delay = waveGroup * 65 + (spawnIndex % 8) * 10;

      enemies.push({
        id: spawnIndex,
        type: group.type,
        hp: group.type === 'boss' ? 2 : 1,
        maxHp: group.type === 'boss' ? 2 : 1,
        row: group.row,
        col: col,
        homeX,
        homeY,
        x: fromLeft ? -30 : CW + 30,
        y: -30,
        state: 'ENTERING', // ENTERING, FORMATION, DIVING, TRACTOR_BEAM, RETURNING
        enterTimer: -delay,
        fromLeft,
        diveTimer: 0,
        divePathX: 0,
        beamTimer: 0,
        hasCapturedShip: false,
        animFrame: 0
      });
      spawnIndex++;
    });
  });

  challengeTotalSpawned = enemies.length;
  stageIntroTimer = 135; // 약 2.2초 인트로 표시
  gameState = 'STAGE_INTRO';

  document.getElementById('txtStageNum').textContent = String(stageNum);

  if (stageNum === 1) {
    sound.playStartFanfare();
    showCheerBanner(`★ CAPTAIN ${appData.pilotName || '전준우'} 출격! ★`, `${appData.pilotName || '전준우'} 함장님, 출격 준비 완료! 레디 고!`);
  } else if (isChallengingStage) {
    sound.playDualFighterFanfare();
    showCheerBanner(`🎯 STAGE ${stageNum} 보너스 챌린징 스테이지!`, `보너스 스테이지! 준우의 백발백중 솜씨를 보여줘!`);
  } else {
    sound.playStartFanfare();
    showCheerBanner(`🚀 STAGE ${stageNum} 돌입! 전준우 화이팅!`, `스테이지 ${stageNum} 시작! 전준우 화이팅!`);
  }
}

// ==================== 게임 시작 및 조작 ====================
function startGame() {
  const nameInput = document.getElementById('pilotNameInput');
  const skinSelect = document.getElementById('shipSkinSelect');
  appData.pilotName = (nameInput.value || '전준우').trim();
  appData.shipSkin = skinSelect.value || 'junwoo_gold';
  saveLocalData();

  currentScore = 0;
  currentStage = 1;
  shotsFired = 0;
  hitsCount = 0;
  lives = difficultyMode === 'junwoo' ? 5 : 3;
  isDualFighter = false;
  player.x = CW / 2;
  player.invincibleTimer = 90;

  unlockAchievement('first_sortie');
  updateScoreboardUI();

  document.getElementById('gameOverlay').classList.add('hidden');
  setupStage(1);
  sound.startBgm();
}

function updateScoreboardUI() {
  document.getElementById('txtCurrentScore').textContent = String(currentScore).padStart(2, '0');
  if (currentScore > appData.highScore) {
    appData.highScore = currentScore;
  }
  document.getElementById('txtHighScore').textContent = String(appData.highScore).padStart(2, '0');
}

// 미사일 발사
function firePlayerBullet() {
  if (player.cooldown > 0) return;
  const maxBullets = isDualFighter ? 6 : 3;
  if (bullets.length >= maxBullets) return;

  sound.playShoot(isDualFighter);
  shotsFired++;

  if (isDualFighter) {
    bullets.push({ x: player.x - 14, y: player.y - 14, vy: -9.5, color: '#00f2fe' });
    bullets.push({ x: player.x + 14, y: player.y - 14, vy: -9.5, color: '#ffe600' });
  } else {
    bullets.push({ x: player.x, y: player.y - 16, vy: -9.5, color: '#ffe600' });
  }
  player.cooldown = isDualFighter ? 11 : 13;
}

// ⚡준우포 (스타버스트 필살기 또는 즉시 합체 지원)
function activateJunwooStarburst() {
  if (gameState !== 'PLAYING' && gameState !== 'STAGE_INTRO') return;

  if (starburstCount <= 0) {
    spawnFloatingText(player.x, player.y - 25, '⚡준우포 충전 필요!', '#ff9100');
    return;
  }
  starburstCount--;
  sound.playStarburstSfx();
  player.invincibleTimer = 150;

  // 아직 합체 전이면 준우 영웅 모드 보너스로 듀얼 파이터 합체도 함께 활성화!
  if (!isDualFighter && difficultyMode === 'junwoo') {
    isDualFighter = true;
    unlockAchievement('dual_fighter');
    showCheerBanner('⚡ 전준우 스타버스트 & 더블 파이터 합체! ⚡', '전준우 더블 파이터 합체 성공! 무적 파워!');
  } else {
    showCheerBanner('⚡ 전준우 필살기 스타버스트 발사!! ⚡', '전준우 스타버스트 발사!');
  }

  // 부채꼴 황금 별빛 미사일 9발 발사
  for (let angle = -40; angle <= 40; angle += 10) {
    const rad = (angle * Math.PI) / 180;
    bullets.push({
      x: player.x,
      y: player.y - 14,
      vx: Math.sin(rad) * 7.5,
      vy: -Math.cos(rad) * 8.5,
      color: '#ffe600',
      isStarburst: true
    });
  }
  createExplosion(player.x, player.y - 10, '#00f2fe', 18);
}

// 파티클 및 플로팅 텍스트
function createExplosion(x, y, baseColor = '#ff0844', count = 16) {
  const palette = [baseColor, '#ffe600', '#ffffff', '#00f2fe', '#ff5252'];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 4.2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 22 + Math.floor(Math.random() * 16),
      maxLife: 38,
      size: 2 + Math.random() * 3,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }
}

function spawnFloatingText(x, y, text, color = '#ffe600') {
  floatingTexts.push({ x, y, text, color, life: 45 });
}

// ==================== 메인 업데이트 루프 ====================
let globalTick = 0;

function updateGame() {
  globalTick++;
  bgScrollTicker += 0.6;

  // 별빛 배경 이동
  for (const s of stars) {
    s.y += s.speed * (gameState === 'PLAYING' ? 1.3 : 0.7);
    if (s.y > CH) {
      s.y = -4;
      s.x = Math.random() * CW;
    }
  }

  // 간헐적 별똥별(혜성) 생성
  if (Math.random() < 0.012 && comets.length < 2) {
    comets.push({
      x: Math.random() * CW,
      y: -10,
      vx: (Math.random() - 0.5) * 3,
      vy: 5 + Math.random() * 4,
      life: 60
    });
  }
  for (let i = comets.length - 1; i >= 0; i--) {
    comets[i].x += comets[i].vx;
    comets[i].y += comets[i].vy;
    comets[i].life--;
    if (comets[i].life <= 0 || comets[i].y > CH + 20) comets.splice(i, 1);
  }

  if (gameState !== 'STAGE_INTRO' && gameState !== 'PLAYING') return;

  if (gameState === 'STAGE_INTRO') {
    stageIntroTimer--;
    if (stageIntroTimer <= 0) {
      gameState = 'PLAYING';
    }
  }

  // 플레이어 이동 처리
  const halfWidth = isDualFighter ? 26 : 15;
  if (keys.left) player.x -= player.speed;
  if (keys.right) player.x += player.speed;
  if (touchDragTargetX !== null) {
    const diff = touchDragTargetX - player.x;
    player.x += diff * 0.25;
  }
  player.x = Math.max(halfWidth + 8, Math.min(CW - halfWidth - 8, player.x));

  if (player.cooldown > 0) player.cooldown--;
  if (player.invincibleTimer > 0) player.invincibleTimer--;

  // 미사일 발사 (수동 또는 자동연사)
  if (gameState === 'PLAYING' && (keys.fire || autoFireEnabled)) {
    firePlayerBullet();
  }

  // 아군 미사일 이동
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.vx) b.x += b.vx;
    b.y += b.vy;
    if (b.y < -15 || b.x < -10 || b.x > CW + 10) {
      bullets.splice(i, 1);
    }
  }

  // 적 미사일 이동 및 플레이어 피격 체크
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;
    if (eb.y > CH + 15) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (player.invincibleTimer <= 0) {
      const hitW = isDualFighter ? 24 : 13;
      if (Math.abs(eb.x - player.x) < hitW && Math.abs(eb.y - player.y) < 13) {
        enemyBullets.splice(i, 1);
        handlePlayerHit();
        break;
      }
    }
  }

  // 편대 좌우 호흡 움직임
  const formationSwayX = Math.sin(globalTick * 0.035) * 18;
  const formationBreathY = Math.cos(globalTick * 0.05) * 3;

  // 급강하 공격 트리거 (일반 스테이지에서 주기적으로 실행)
  if (gameState === 'PLAYING' && !isChallengingStage) {
    const diveInterval = Math.max(38, 85 - currentStage * 6);
    if (globalTick % diveInterval === 0) {
      const formationEnemies = enemies.filter(e => e.state === 'FORMATION');
      if (formationEnemies.length > 0) {
        const attacker = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
        attacker.state = 'DIVING';
        attacker.diveTimer = 0;
        attacker.startX = attacker.x;
        attacker.startY = attacker.y;
        attacker.targetX = player.x + (Math.random() - 0.5) * 70;
        sound.playEnemyDive();
      }
    }
  }

  // 적기 상태 업데이트
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (globalTick % 16 === 0) e.animFrame = 1 - e.animFrame;

    if (e.state === 'ENTERING') {
      e.enterTimer++;
      if (e.enterTimer < 0) continue;

      const t = Math.min(1, e.enterTimer / 75);
      // 화려한 곡선 진입 궤적
      const sideSign = e.fromLeft ? 1 : -1;
      const startX = e.fromLeft ? -20 : CW + 20;
      const loopX = CW / 2 + sideSign * Math.sin(t * Math.PI * 2) * 115;
      const loopY = 50 + Math.sin(t * Math.PI) * 190;

      if (isChallengingStage) {
        // 챌린징 스테이지는 곡예 비행 후 화면 밖으로 퇴장
        const ct = e.enterTimer / 140;
        e.x = CW / 2 + sideSign * Math.cos(ct * Math.PI * 2.5) * 155;
        e.y = -20 + ct * (CH + 80) + Math.sin(ct * Math.PI * 3) * 55;
        if (ct >= 1.15) {
          enemies.splice(i, 1);
          continue;
        }
      } else {
        e.x = (1 - t) * loopX + t * (e.homeX + formationSwayX);
        e.y = (1 - t) * loopY + t * (e.homeY + formationBreathY);
        if (t >= 1) {
          e.state = 'FORMATION';
        }
      }
    } else if (e.state === 'FORMATION') {
      e.x = e.homeX + formationSwayX;
      e.y = e.homeY + formationBreathY;
    } else if (e.state === 'DIVING') {
      e.diveTimer++;
      const spd = 2.8 + Math.min(2.2, currentStage * 0.22);
      e.y += spd;
      e.x += Math.sin(e.diveTimer * 0.08) * 3.2 + (player.x - e.x) * 0.015;

      // 보스 갤러그 트랙터 빔 발사 체크
      if (
        e.type === 'boss' &&
        !isDualFighter &&
        !e.beamUsed &&
        Math.abs(e.y - (CH - 185)) < 6
      ) {
        e.state = 'TRACTOR_BEAM';
        e.beamTimer = 130;
        e.beamUsed = true;
        sound.playTractorBeam();
      }

      // 급강하 중 적 미사일 발사
      if (e.diveTimer === 24 || e.diveTimer === 52) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const bulletSpd = difficultyMode === 'junwoo' ? 3.8 : 4.6;
        enemyBullets.push({
          x: e.x,
          y: e.y + 10,
          vx: (dx / dist) * bulletSpd * 0.65,
          vy: bulletSpd
        });
      }

      // 플레이어와 적기 본체 충돌 체크
      if (player.invincibleTimer <= 0) {
        const hitW = isDualFighter ? 24 : 15;
        if (Math.abs(e.x - player.x) < hitW && Math.abs(e.y - player.y) < 16) {
          createExplosion(e.x, e.y, '#ff9100', 14);
          enemies.splice(i, 1);
          handlePlayerHit();
          continue;
        }
      }

      if (e.y > CH + 24) {
        e.y = -20;
        e.state = 'RETURNING';
      }
    } else if (e.state === 'TRACTOR_BEAM') {
      e.beamTimer--;
      // 트랙터 빔 범위 안에 플레이어가 들어오면 포획 & 보스 격추 시 즉시 합체 이벤트!
      if (Math.abs(player.x - e.x) < 34 && e.beamTimer > 20 && e.beamTimer < 110) {
        e.hasCapturedShip = true;
        spawnFloatingText(e.x, e.y - 24, '보스 격추 시 2대 합체!', '#00f2fe');
      }
      if (e.beamTimer <= 0) {
        e.state = 'RETURNING';
      }
    } else if (e.state === 'RETURNING') {
      const targetX = e.homeX + formationSwayX;
      const targetY = e.homeY + formationBreathY;
      e.x += (targetX - e.x) * 0.1;
      e.y += (targetY - e.y) * 0.1;
      if (Math.hypot(targetX - e.x, targetY - e.y) < 4) {
        e.state = 'FORMATION';
      }
    }

    // 아군 미사일과 적기 충돌 판정
    for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
      const b = bullets[bIdx];
      if (Math.abs(b.x - e.x) < 15 && Math.abs(b.y - e.y) < 14) {
        bullets.splice(bIdx, 1);
        hitsCount++;
        e.hp--;

        if (e.hp > 0) {
          // 보스 1타 피격 (초록 -> 파랑 변신)
          sound.playEnemyHit('boss_damage');
          spawnFloatingText(e.x, e.y - 10, 'HIT!', '#00f2fe');
        } else {
          // 적기 격추 완료!
          const isDiving = e.state !== 'FORMATION';
          let pts = 50;
          if (e.type === 'zako') pts = isDiving ? 100 : 50;
          if (e.type === 'goei') pts = isDiving ? 160 : 80;
          if (e.type === 'boss') pts = isDiving ? 400 : 150;

          // 보스가 트랙터 빔 중이거나 포획 기체가 있을 때 격추하면 듀얼 파이터 합체!
          if (e.type === 'boss' && (e.state === 'TRACTOR_BEAM' || e.hasCapturedShip || (!isDualFighter && difficultyMode === 'junwoo' && isDiving))) {
            isDualFighter = true;
            pts = 800;
            sound.playDualFighterFanfare();
            unlockAchievement('dual_fighter');
            showCheerBanner('🛸 전준우 더블 파이터 합체 성공!! (2연사 파워업!)', '전준우 더블 파이터 합체 성공! 무적 파워!');
            spawnFloatingText(player.x, player.y - 30, '★ DUAL FIGHTER 합체! ★', '#00f2fe');
          } else {
            sound.playEnemyHit(e.type);
          }

          currentScore += pts;
          challengeHits++;
          createExplosion(e.x, e.y, e.type === 'boss' ? '#00e676' : '#ff0844', e.type === 'boss' ? 22 : 13);
          spawnFloatingText(e.x, e.y, `+${pts}`, pts >= 400 ? '#00f2fe' : '#ffe600');

          // 점수 업적 체크
          if (currentScore >= 10000) unlockAchievement('score_10k');
          if (currentScore >= 30000) unlockAchievement('score_30k');

          updateScoreboardUI();
          enemies.splice(i, 1);
        }
        break;
      }
    }
  }

  // 파티클 업데이트
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // 플로팅 텍스트 업데이트
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y -= 0.9;
    ft.life--;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // 스테이지 클리어 체크
  if (gameState === 'PLAYING' && enemies.length === 0) {
    if (isChallengingStage) {
      unlockAchievement('stage_3_clear');
      const bonus = challengeHits === challengeTotalSpawned ? 10000 : challengeHits * 100;
      currentScore += bonus;
      updateScoreboardUI();
      spawnFloatingText(CW / 2, CH / 2, `CHALLENGE BONUS +${bonus}점!`, '#00f2fe');
    }
    currentStage++;
    setupStage(currentStage);
  }
}

function handlePlayerHit() {
  sound.playPlayerExplosion();
  createExplosion(player.x, player.y, '#ff0844', 30);

  // 듀얼 파이터 상태라면 목숨 차감 없이 싱글 파이터로만 전환!
  if (isDualFighter) {
    isDualFighter = false;
    player.invincibleTimer = 110;
    spawnFloatingText(player.x, player.y - 20, '기체 1대 분리! 전투 계속!', '#00f2fe');
    return;
  }

  lives--;
  if (lives <= 0) {
    triggerGameOver();
  } else {
    player.x = CW / 2;
    player.invincibleTimer = 130;
    showCheerBanner(`💪 전준우 함장님 힘내세요! (남은 기체 ${lives}대)`, '전준우 함장님 힘내세요! 다시 출격!');
  }
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  sound.stopBgm();

  const ratioNum = shotsFired > 0 ? (hitsCount / shotsFired) * 100 : 0;
  const ratioStr = `${ratioNum.toFixed(1)}%`;

  if (shotsFired >= 30 && ratioNum >= 60) {
    unlockAchievement('sharpshooter');
  }

  // 명예의 전당 등록
  const today = new Date().toISOString().slice(0, 10);
  appData.leaderboard.push({
    name: `${appData.pilotName || '전준우'}`,
    score: currentScore,
    stage: currentStage,
    ratio: ratioStr,
    date: today
  });
  appData.leaderboard.sort((a, b) => b.score - a.score);
  appData.leaderboard = appData.leaderboard.slice(0, 10);

  if (currentScore > appData.highScore) {
    appData.highScore = currentScore;
  }

  commitData();

  // 게임오버 오버레이 표시
  document.getElementById('overlayTitle').textContent = 'MISSION COMPLETE!';
  document.getElementById('overlaySubtitle').innerHTML =
    `<strong>${appData.pilotName || '전준우'} 함장님</strong> 멋진 전투였습니다! 다시 출격해 볼까요?`;
  document.getElementById('overlayGuideGrid').style.display = 'none';

  const statsBox = document.getElementById('gameOverStats');
  statsBox.classList.remove('hidden');
  document.getElementById('statFinalScore').textContent = `${currentScore.toLocaleString()}점`;
  document.getElementById('statFinalStage').textContent = `STAGE ${currentStage}`;
  document.getElementById('statShotsFired').textContent = `${shotsFired}발`;
  document.getElementById('statHitsCount').textContent = `${hitsCount}기`;
  document.getElementById('statHitRatio').textContent = ratioStr;
  document.getElementById('btnStartGame').textContent = '🚀 전준우 함대 다시 출격! (RETRY)';

  document.getElementById('gameOverlay').classList.remove('hidden');
  sound.speakCheer(`전준우 함장님 수고하셨습니다! 최종 점수 ${currentScore}점!`);
}

// ==================== 캔버스 렌더링 루프 ====================
function renderGame() {
  // 1. 우주 배경 테마 렌더링
  const theme = appData.bgTheme || 'junwoo_galaxy';
  if (theme === 'classic_arcade') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CW, CH);
  } else if (theme === 'supernova') {
    const grad = ctx.createRadialGradient(CW / 2, CH * 0.35, 20, CW / 2, CH * 0.5, 360);
    grad.addColorStop(0, '#2a0826');
    grad.addColorStop(0.5, '#0e0722');
    grad.addColorStop(1, '#03040c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
  } else {
    // 전준우 네온 은하계 (기본)
    const grad = ctx.createRadialGradient(CW / 2, CH * 0.32, 15, CW / 2, CH * 0.5, 350);
    grad.addColorStop(0, '#0c2052');
    grad.addColorStop(0.55, '#060c28');
    grad.addColorStop(1, '#02040d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
  }

  // 2. 배경 별빛 & 혜성 렌더링
  for (const s of stars) {
    const alpha = 0.45 + 0.55 * Math.sin(globalTick * 0.06 + s.blinkOffset);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;

  for (const c of comets) {
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x - c.vx * 5, c.y - c.vy * 5);
    ctx.stroke();
  }

  // 3. 전준우 전용 우주 홀로그램 워터마크 & 응원 전광판 (배경에 은은하게 빛남)
  ctx.save();
  ctx.textAlign = 'center';

  // 은하계 회전 링
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(CW / 2, CH * 0.46, 128 + Math.sin(globalTick * 0.02) * 6, 0, Math.PI * 2);
  ctx.stroke();

  // 중앙 배경 홀로그램 엠블럼
  ctx.fillStyle = 'rgba(0, 242, 254, 0.11)';
  ctx.font = '900 24px Pretendard, sans-serif';
  ctx.fillText(`★ CAPTAIN ${appData.pilotName || '전준우'} ★`, CW / 2, CH * 0.44);

  ctx.fillStyle = 'rgba(255, 230, 0, 0.13)';
  ctx.font = '700 12px Pretendard, sans-serif';
  ctx.fillText(appData.customCheerMsg || '우주 최강 전준우 화이팅! 사랑해 아들!', CW / 2, CH * 0.485);
  ctx.restore();

  // 4. 적기 및 트랙터 빔 렌더링
  for (const e of enemies) {
    // 트랙터 빔 렌더링
    if (e.state === 'TRACTOR_BEAM') {
      const beamH = 155;
      const grad = ctx.createLinearGradient(e.x, e.y + 12, e.x, e.y + 12 + beamH);
      grad.addColorStop(0, 'rgba(0, 242, 254, 0.65)');
      grad.addColorStop(0.5, 'rgba(41, 121, 255, 0.35)');
      grad.addColorStop(1, 'rgba(0, 242, 254, 0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(e.x - 8, e.y + 12);
      ctx.lineTo(e.x + 8, e.y + 12);
      ctx.lineTo(e.x + 42, e.y + 12 + beamH);
      ctx.lineTo(e.x - 42, e.y + 12 + beamH);
      ctx.closePath();
      ctx.fill();

      // 빔 파동 링
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) {
        const ry = e.y + 20 + ((globalTick * 2 + r * 36) % (beamH - 15));
        const rw = 10 + ((ry - e.y) / beamH) * 32;
        ctx.strokeRect(e.x - rw, ry, rw * 2, 4);
      }
    }

    let spriteMatrix = SPRITES.zako1;
    if (e.type === 'boss') {
      spriteMatrix = e.animFrame === 0 ? SPRITES.boss1 : SPRITES.boss2;
    } else if (e.type === 'goei') {
      spriteMatrix = e.animFrame === 0 ? SPRITES.goei1 : SPRITES.goei2;
    } else {
      spriteMatrix = e.animFrame === 0 ? SPRITES.zako1 : SPRITES.zako2;
    }

    const isDamagedBoss = e.type === 'boss' && e.hp === 1;
    drawPixelSprite(ctx, spriteMatrix, e.x, e.y, 2.5, getColorMap('classic_white', isDamagedBoss));
  }

  // 5. 플레이어 기체 렌더링
  if (gameState === 'PLAYING' || gameState === 'STAGE_INTRO') {
    const blinkHide = player.invincibleTimer > 0 && Math.floor(globalTick / 4) % 2 === 0;
    if (!blinkHide) {
      const skinMap = getColorMap(appData.shipSkin || 'junwoo_gold', false);
      if (isDualFighter) {
        drawPixelSprite(ctx, SPRITES.player, player.x - 14, player.y, 2.5, skinMap);
        drawPixelSprite(ctx, SPRITES.player, player.x + 14, player.y, 2.5, skinMap);
      } else {
        drawPixelSprite(ctx, SPRITES.player, player.x, player.y, 2.6, skinMap);
      }
    }

    // 무적 보호막 표시
    if (player.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, isDualFighter ? 32 : 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 6. 아군 미사일 & 적 미사일 렌더링
  for (const b of bullets) {
    ctx.fillStyle = b.color || '#ffe600';
    if (b.isStarburst) {
      ctx.fillRect(b.x - 3, b.y - 6, 6, 12);
    } else {
      ctx.fillRect(b.x - 2, b.y - 6, 4, 11);
      ctx.fillStyle = '#ff0844';
      ctx.fillRect(b.x - 2, b.y + 2, 4, 3);
    }
  }

  for (const eb of enemyBullets) {
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(eb.x - 2.5, eb.y - 5, 5, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(eb.x - 1.5, eb.y - 2, 3, 4);
  }

  // 7. 폭발 파티클 & 점수 플로팅 텍스트
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '900 13px Courier New, monospace';
  for (const ft of floatingTexts) {
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();

  // 8. 스테이지 인트로 텍스트 표시
  if (gameState === 'STAGE_INTRO') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2fe';
    ctx.font = '900 24px Courier New, monospace';
    ctx.fillText(isChallengingStage ? `CHALLENGING STAGE` : `STAGE ${currentStage}`, CW / 2, CH / 2 - 12);

    ctx.fillStyle = '#ffe600';
    ctx.font = '800 15px Pretendard, sans-serif';
    ctx.fillText(`CAPTAIN ${appData.pilotName || '전준우'} READY!`, CW / 2, CH / 2 + 18);
    ctx.restore();
  }

  // 9. 하단 상태바 (남은 잔기 아이콘, 준우포 횟수, 스테이지 배지)
  drawBottomHud();
}

function drawBottomHud() {
  ctx.fillStyle = 'rgba(3, 6, 20, 0.85)';
  ctx.fillRect(0, CH - 32, CW, 32);
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, CH - 32);
  ctx.lineTo(CW, CH - 32);
  ctx.stroke();

  // 좌측: 남은 목숨 아이콘
  const skinMap = getColorMap(appData.shipSkin || 'junwoo_gold', false);
  for (let i = 0; i < Math.min(lives, 6); i++) {
    drawPixelSprite(ctx, SPRITES.player, 20 + i * 22, CH - 16, 1.35, skinMap);
  }

  // 중앙: ⚡준우포 필살기 잔여 횟수 및 합체 상태
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 11px Pretendard, sans-serif';
  ctx.fillStyle = isDualFighter ? '#00f2fe' : '#ffe600';
  const modeTxt = isDualFighter ? '🛸 DUAL FIGHTER 가동중' : `⚡준우포: ${starburstCount}발`;
  ctx.fillText(modeTxt, CW / 2 + 10, CH - 12);

  // 우측: 스테이지 깃발 배지
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff0844';
  ctx.fillText(`🚩 STAGE ${currentStage}`, CW - 12, CH - 12);
  ctx.restore();
}

function gameLoop() {
  updateGame();
  renderGame();
  requestAnimationFrame(gameLoop);
}

// ==================== 리더보드 & 훈장 UI 렌더링 ====================
function unlockAchievement(achId) {
  if (!Array.isArray(appData.achievements)) appData.achievements = [];
  if (!appData.achievements.includes(achId)) {
    appData.achievements.push(achId);
    const found = ACHIEVEMENTS_DEF.find(a => a.id === achId);
    if (found) {
      spawnFloatingText(CW / 2, CH / 2 - 50, `🎖️ 훈장 획득: ${found.title}!`, '#ffe600');
    }
    commitData();
  }
}

function renderDashboardUI() {
  updateScoreboardUI();

  // 리더보드 렌더링
  const listEl = document.getElementById('leaderboardList');
  if (listEl) {
    const list = appData.leaderboard || [];
    listEl.innerHTML = list.map((item, idx) => {
      const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
      return `
        <div class="rank-item ${rankClass}">
          <span class="rank-badge">${medal}</span>
          <span class="rank-pilot">${escapeHtml(item.name)}</span>
          <span class="rank-stage">STAGE ${item.stage || 1}</span>
          <span class="rank-score">${Number(item.score || 0).toLocaleString()}</span>
        </div>
      `;
    }).join('');
  }

  // 업적 훈장 렌더링
  const achGrid = document.getElementById('achievementsGrid');
  const unlocked = appData.achievements || [];
  const progTxt = document.getElementById('badgeProgressText');
  if (progTxt) {
    progTxt.textContent = `${unlocked.length} / ${ACHIEVEMENTS_DEF.length} 달성`;
  }
  if (achGrid) {
    achGrid.innerHTML = ACHIEVEMENTS_DEF.map(ach => {
      const isUnlocked = unlocked.includes(ach.id);
      return `
        <div class="ach-card ${isUnlocked ? 'unlocked' : ''}">
          <span class="ach-icon">${ach.icon}</span>
          <div class="ach-info">
            <strong>${ach.title}</strong>
            <small>${ach.desc}</small>
          </div>
        </div>
      `;
    }).join('');
  }

  // 커스텀 설정 반영
  const bgSel = document.getElementById('bgThemeSelect');
  if (bgSel && appData.bgTheme) bgSel.value = appData.bgTheme;
  const cheerIn = document.getElementById('customCheerInput');
  if (cheerIn && appData.customCheerMsg) cheerIn.value = appData.customCheerMsg;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ==================== 24시간 클라우드 DB 동기화 엔진 (GitHub db-store & Google Drive) ====================
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

function checkUrlSyncParams() {
  const hash = window.location.hash || '';
  if (hash.includes('ghSync=')) {
    const match = hash.match(/ghSync=([^&]+)/);
    if (match && match[1]) {
      try {
        const decodedToken = atob(decodeURIComponent(match[1]));
        if (decodedToken.startsWith('gh') || decodedToken.startsWith('github_pat')) {
          syncConfig.ghToken = decodedToken;
          saveSyncConfig();
        }
      } catch (e) {}
    }
    try {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch (e) {}
  }
}

function updateSyncStatusBadge() {
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncStatusText');
  const qrBox = document.getElementById('qrContainer');
  const qrImg = document.getElementById('qrImage');

  if (!dot || !txt) return;
  dot.className = 'sync-dot';

  if (syncConfig.ghToken) {
    dot.classList.add('online');
    txt.textContent = '24시간 클라우드 동기화 중';
    if (qrBox && qrImg) {
      const shareUrl = `${window.location.origin}${window.location.pathname}#ghSync=${btoa(syncConfig.ghToken)}`;
      qrBox.style.display = 'flex';
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`;
    }
  } else if (syncConfig.gdriveUrl) {
    dot.classList.add('online');
    txt.textContent = '구글 드라이브 동기화 중';
  } else {
    txt.textContent = '클라우드 동기화 설정';
    if (qrBox) qrBox.style.display = 'none';
  }
}

async function commitData(skipRemote = false) {
  appData.updatedAt = Date.now();
  saveLocalData();
  renderDashboardUI();
  if (!skipRemote) {
    await pushToRemoteSync();
  }
}

async function pullFromRemoteSync() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    if (syncConfig.ghToken) {
      const apiUrl = `https://api.github.com/repos/${GH_REPO_PATH}/contents/${GH_DB_FILE}`;
      const res = await fetch(`${apiUrl}?ref=db-store&t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${syncConfig.ghToken}`,
          'Accept': 'application/vnd.github+json'
        },
        cache: 'no-store'
      });
      if (res.ok) {
        const meta = await res.json();
        if (meta && meta.sha) lastGhSha = meta.sha;
        if (meta && meta.content) {
          const remote = JSON.parse(base64ToUtf8(meta.content));
          if (remote && (remote.updatedAt || 0) > (appData.updatedAt || 0)) {
            appData = { ...getDefaultAppData(), ...remote };
            saveLocalData();
            renderDashboardUI();
          }
        }
      }
    } else if (syncConfig.gdriveUrl) {
      const res = await fetch(`${syncConfig.gdriveUrl}?mode=api&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const remote = await res.json();
        if (remote && (remote.updatedAt || 0) > (appData.updatedAt || 0)) {
          appData = { ...getDefaultAppData(), ...remote };
          saveLocalData();
          renderDashboardUI();
        }
      }
    }
  } catch (e) {
  } finally {
    isSyncing = false;
    updateSyncStatusBadge();
  }
}

async function pushToRemoteSync() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    if (syncConfig.ghToken) {
      const apiUrl = `https://api.github.com/repos/${GH_REPO_PATH}/contents/${GH_DB_FILE}`;
      if (!lastGhSha) {
        const check = await fetch(`${apiUrl}?ref=db-store&t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${syncConfig.ghToken}`,
            'Accept': 'application/vnd.github+json'
          },
          cache: 'no-store'
        });
        if (check.ok) {
          const m = await check.json();
          if (m && m.sha) lastGhSha = m.sha;
        }
      }
      const body = {
        message: `Update Junwoo Galaga High Score (${appData.highScore})`,
        content: utf8ToBase64(JSON.stringify(appData, null, 2)),
        branch: 'db-store'
      };
      if (lastGhSha) body.sha = lastGhSha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${syncConfig.ghToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (putRes.ok) {
        const putData = await putRes.json();
        if (putData && putData.content && putData.content.sha) {
          lastGhSha = putData.content.sha;
        }
      }
    } else if (syncConfig.gdriveUrl) {
      await fetch(syncConfig.gdriveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(appData)
      });
    }
  } catch (e) {
  } finally {
    isSyncing = false;
    updateSyncStatusBadge();
  }
}

// ==================== 이벤트 리스너 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  checkUrlSyncParams();
  renderDashboardUI();
  updateSyncStatusBadge();
  pullFromRemoteSync();

  // 10초마다 자동 랭킹 동기화 폴링
  setInterval(() => {
    if (gameState !== 'PLAYING') pullFromRemoteSync();
  }, 10000);

  // 게임 시작 버튼
  document.getElementById('btnStartGame').addEventListener('click', () => {
    sound.init();
    startGame();
  });

  // 난이도 선택 버튼
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficultyMode = btn.getAttribute('data-diff') || 'junwoo';
    });
  });

  // 상단 준우 응원 버튼
  document.getElementById('btnCheerTrigger').addEventListener('click', () => {
    sound.init();
    triggerRandomJunwooCheer();
  });

  // 사운드/옵션 토글 버튼들
  const btnSfx = document.getElementById('btnToggleSfx');
  btnSfx.addEventListener('click', () => {
    sound.sfxEnabled = !sound.sfxEnabled;
    btnSfx.classList.toggle('active', sound.sfxEnabled);
    btnSfx.textContent = sound.sfxEnabled ? '🔊 효과음 ON' : '🔇 효과음 OFF';
  });

  const btnBgm = document.getElementById('btnToggleBgm');
  btnBgm.addEventListener('click', () => {
    sound.bgmEnabled = !sound.bgmEnabled;
    btnBgm.classList.toggle('active', sound.bgmEnabled);
    btnBgm.textContent = sound.bgmEnabled ? '🎵 준우 BGM ON' : '🔇 준우 BGM OFF';
    if (sound.bgmEnabled && gameState === 'PLAYING') sound.startBgm();
    else sound.stopBgm();
  });

  const btnVoice = document.getElementById('btnToggleVoice');
  btnVoice.addEventListener('click', () => {
    sound.voiceEnabled = !sound.voiceEnabled;
    btnVoice.classList.toggle('active', sound.voiceEnabled);
    btnVoice.textContent = sound.voiceEnabled ? '🎙️ 준우 음성응원 ON' : '🔇 음성응원 OFF';
  });

  const btnAutoFire = document.getElementById('btnToggleAutoFire');
  btnAutoFire.addEventListener('click', () => {
    autoFireEnabled = !autoFireEnabled;
    btnAutoFire.classList.toggle('active', autoFireEnabled);
    btnAutoFire.textContent = autoFireEnabled ? '🔥 자동연사 ON' : '🔥 자동연사 OFF';
  });

  const btnPause = document.getElementById('btnPauseGame');
  btnPause.addEventListener('click', () => {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      btnPause.textContent = '▶️ 계속하기';
      showCheerBanner('⏸️ 일시정지 중 (계속하려면 버튼을 누르세요)');
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      btnPause.textContent = '⏸️ 일시정지';
    }
  });

  // 현재 게임 중단 및 대기화면 복귀 (점수 자동 기록)
  const stopCurrentGameToMenu = () => {
    if (gameState === 'PLAYING' || gameState === 'STAGE_INTRO' || gameState === 'PAUSED') {
      btnPause.textContent = '⏸️ 일시정지';
      triggerGameOver();
    } else {
      sound.stopBgm();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      document.getElementById('gameOverlay').classList.remove('hidden');
      showCheerBanner('🏠 대기 화면으로 돌아왔습니다.');
    }
  };

  // 앱 완전 종료 / 창 닫기
  const exitApplication = () => {
    if (gameState === 'PLAYING' || gameState === 'STAGE_INTRO' || gameState === 'PAUSED') {
      triggerGameOver();
    }
    sound.stopBgm();
    sound.speakCheer('전준우 함장님, 오늘도 멋진 우주 비행이었습니다! 다음에 또 만나요!');
    setTimeout(() => {
      window.close();
      // 브라우저 보안 정책으로 탭이 바로 안 닫힐 경우 종료 완료 화면 표시
      document.getElementById('overlayTitle').textContent = 'SEE YOU AGAIN, JUNWOO!';
      document.getElementById('overlaySubtitle').innerHTML =
        `<strong>전준우 함장님</strong>, 모든 전투 기록이 안전하게 저장되었습니다!<br/>언제든 아래 버튼을 눌러 다시 출격하거나 브라우저 탭을 닫으실 수 있습니다.`;
      document.getElementById('gameOverlay').classList.remove('hidden');
    }, 300);
  };

  const btnStopGame = document.getElementById('btnStopGame');
  if (btnStopGame) btnStopGame.addEventListener('click', stopCurrentGameToMenu);

  const btnExitApp = document.getElementById('btnExitApp');
  if (btnExitApp) btnExitApp.addEventListener('click', exitApplication);

  const btnCloseWindow = document.getElementById('btnCloseWindow');
  if (btnCloseWindow) btnCloseWindow.addEventListener('click', exitApplication);

  // 키보드 컨트롤
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'KeyZ') {
      e.preventDefault();
      keys.fire = true;
      if (gameState === 'PLAYING') firePlayerBullet();
    }
    if (e.code === 'KeyX') {
      activateJunwooStarburst();
    }
    if (e.code === 'KeyP') {
      btnPause.click();
    }
    if (e.code === 'Escape') {
      stopCurrentGameToMenu();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space' || e.code === 'KeyZ') keys.fire = false;
  });

  // 모바일 터치 버튼 이벤트
  const bindHoldButton = (btnId, keyName, onPress) => {
    const el = document.getElementById(btnId);
    if (!el) return;
    const start = (ev) => {
      ev.preventDefault();
      sound.init();
      el.classList.add('pressed');
      if (keyName) keys[keyName] = true;
      if (onPress) onPress();
    };
    const end = (ev) => {
      ev.preventDefault();
      el.classList.remove('pressed');
      if (keyName) keys[keyName] = false;
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  };

  bindHoldButton('btnTouchLeft', 'left');
  bindHoldButton('btnTouchRight', 'right');
  bindHoldButton('btnTouchFire', 'fire', () => {
    if (gameState === 'PLAYING') firePlayerBullet();
  });
  bindHoldButton('btnTouchSpecial', null, () => {
    activateJunwooStarburst();
  });

  // 드래그 터치 조종 (캔버스 & 드래그 패드)
  const handleTouchMoveCoords = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * CW;
    touchDragTargetX = Math.max(20, Math.min(CW - 20, relX));
  };

  const dragZone = document.getElementById('touchDragZone');
  [canvas, dragZone].forEach(zone => {
    if (!zone) return;
    zone.addEventListener('touchstart', (e) => {
      if (gameState !== 'PLAYING' && gameState !== 'STAGE_INTRO') return;
      if (e.touches.length > 0) handleTouchMoveCoords(e.touches[0].clientX);
    }, { passive: true });
    zone.addEventListener('touchmove', (e) => {
      if (gameState !== 'PLAYING' && gameState !== 'STAGE_INTRO') return;
      e.preventDefault();
      if (e.touches.length > 0) handleTouchMoveCoords(e.touches[0].clientX);
    }, { passive: false });
    zone.addEventListener('touchend', () => {
      touchDragTargetX = null;
    });
  });

  // 전준우 전용 콘솔 설정 변경
  document.getElementById('bgThemeSelect').addEventListener('change', (e) => {
    appData.bgTheme = e.target.value;
    commitData();
  });

  document.getElementById('btnSaveCheerMsg').addEventListener('click', () => {
    const val = document.getElementById('customCheerInput').value.trim();
    if (val) {
      appData.customCheerMsg = val;
      commitData();
      showCheerBanner(`💬 응원 문구 변경: ${val}`, val);
    }
  });

  document.getElementById('btnRefreshRank').addEventListener('click', () => {
    pullFromRemoteSync();
  });

  // ==================== 5단계 튜토리얼 모달 ====================
  const tutModal = document.getElementById('tutorialModal');
  const chkHideTut = document.getElementById('chkHideTutorialAuto');
  const btnTutPrev = document.getElementById('btnTutPrev');
  const btnTutNext = document.getElementById('btnTutNext');
  let curTutStep = 0;
  const totalTutSteps = 5;

  function showTutorialStep(idx) {
    curTutStep = Math.max(0, Math.min(totalTutSteps - 1, idx));
    document.querySelectorAll('#tutorialModal .tutorial-slide').forEach(s => {
      s.classList.toggle('active', Number(s.getAttribute('data-slide')) === curTutStep);
    });
    document.querySelectorAll('#tutDots .tut-dot').forEach(d => {
      d.classList.toggle('active', Number(d.getAttribute('data-step')) === curTutStep);
    });
    btnTutPrev.style.display = curTutStep === 0 ? 'none' : 'inline-block';
    btnTutNext.textContent = curTutStep === totalTutSteps - 1 ? '출격 준비 완료! 🚀' : '다음 단계 →';
  }

  document.getElementById('btnOpenTutorial').addEventListener('click', () => {
    chkHideTut.checked = localStorage.getItem(HIDE_TUT_KEY) === '1';
    showTutorialStep(0);
    tutModal.classList.add('open');
  });

  document.getElementById('btnCloseTutorialModal').addEventListener('click', () => {
    tutModal.classList.remove('open');
  });

  btnTutPrev.addEventListener('click', () => showTutorialStep(curTutStep - 1));
  btnTutNext.addEventListener('click', () => {
    if (curTutStep < totalTutSteps - 1) showTutorialStep(curTutStep + 1);
    else tutModal.classList.remove('open');
  });

  document.querySelectorAll('#tutDots .tut-dot').forEach(dot => {
    dot.addEventListener('click', () => showTutorialStep(Number(dot.getAttribute('data-step'))));
  });

  chkHideTut.addEventListener('change', (e) => {
    localStorage.setItem(HIDE_TUT_KEY, e.target.checked ? '1' : '0');
  });

  if (localStorage.getItem(HIDE_TUT_KEY) !== '1') {
    showTutorialStep(0);
    tutModal.classList.add('open');
  }

  // ==================== 클라우드 & 구글 드라이브 동기화 모달 ====================
  const syncModal = document.getElementById('syncModal');
  document.getElementById('btnOpenSync').addEventListener('click', () => {
    document.getElementById('ghTokenInput').value = syncConfig.ghToken || '';
    document.getElementById('gdriveUrlInput').value = syncConfig.gdriveUrl || '';
    updateSyncStatusBadge();
    syncModal.classList.add('open');
  });

  document.getElementById('btnCloseSyncModal').addEventListener('click', () => {
    syncModal.classList.remove('open');
  });

  document.getElementById('btnSaveGhToken').addEventListener('click', async () => {
    syncConfig.ghToken = document.getElementById('ghTokenInput').value.trim();
    saveSyncConfig();
    await pullFromRemoteSync();
    await pushToRemoteSync();
    alert('24시간 GitHub 클라우드 DB 연결 및 동기화가 완료되었습니다!');
  });

  document.getElementById('btnCopyGhShareLink').addEventListener('click', () => {
    if (!syncConfig.ghToken) {
      alert('먼저 클라우드 동기화 토큰이 연결되어 있어야 합니다.');
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}#ghSync=${btoa(syncConfig.ghToken)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('전준우의 갤러그 원클릭 자동연결 링크가 복사되었습니다!\n카카오톡으로 보내서 열면 아이폰·아이패드·PC가 즉시 연동됩니다.');
    });
  });

  document.getElementById('btnSaveGdriveUrl').addEventListener('click', async () => {
    syncConfig.gdriveUrl = document.getElementById('gdriveUrlInput').value.trim();
    saveSyncConfig();
    await pushToRemoteSync();
    await pullFromRemoteSync();
    alert('내 구글 드라이브 DB 연결이 완료되었습니다!');
  });

  document.getElementById('btnCopyGdriveScript').addEventListener('click', () => {
    const code = [
      "// 전준우의 갤러그 - 구글 드라이브 실시간 랭킹 DB 스크립트",
      "const DB_FILE_NAME = 'junwoo_galaga_db.json';",
      "function getOrCreateDbFile() {",
      "  const files = DriveApp.getFilesByName(DB_FILE_NAME);",
      "  if (files.hasNext()) return files.next();",
      "  return DriveApp.createFile(DB_FILE_NAME, JSON.stringify({ updatedAt: 0 }), MimeType.PLAIN_TEXT);",
      "}",
      "function doGet(e) {",
      "  const content = getOrCreateDbFile().getBlob().getDataAsString('UTF-8') || '{\"updatedAt\":0}';",
      "  return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);",
      "}",
      "function doPost(e) {",
      "  const rawBody = e.postData && e.postData.contents ? e.postData.contents : '{}';",
      "  getOrCreateDbFile().setContent(rawBody);",
      "  return ContentService.createTextOutput(JSON.stringify({ ok: true, savedAt: Date.now() })).setMimeType(ContentService.MimeType.JSON);",
      "}"
    ].join('\n');
    navigator.clipboard.writeText(code).then(() => {
      alert('구글 드라이브 연동 Apps Script 코드가 복사되었습니다!\nhttps://script.google.com 에서 새 프로젝트에 붙여넣고 웹 앱으로 배포해 주세요.');
    });
  });

  document.getElementById('btnForcePullCloud').addEventListener('click', async () => {
    await pullFromRemoteSync();
    alert('클라우드에서 최신 랭킹 데이터를 불러왔습니다!');
  });

  document.getElementById('btnForcePushCloud').addEventListener('click', async () => {
    await pushToRemoteSync();
    alert('현재 기기의 랭킹과 기록을 클라우드에 저장했습니다!');
  });

  document.getElementById('btnExportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `전준우갤러그_랭킹백업.json`;
    a.click();
  });

  document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (imported && Array.isArray(imported.leaderboard)) {
          appData = { ...getDefaultAppData(), ...imported };
          commitData();
          alert('랭킹 및 기록 백업 파일을 성공적으로 복원했습니다!');
        }
      } catch (err) {
        alert('올바른 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  });

  // 메인 렌더링 루프 시작
  requestAnimationFrame(gameLoop);
});
