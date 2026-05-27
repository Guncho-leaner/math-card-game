/**
 * 「どうぶつさんすうカード」 Application Logic
 * State management, Speech Recognition, Speech Synthesis, SVG Mascots.
 */

// ==========================================
// 1. GAME CONSTANTS & STATE
// ==========================================
const GAME_CONFIG = {
  totalQuestions: 10,
  praisePhrases: [
    "わぁー！すごいっ！大正解！",
    "やったー！大正解！天才だね！",
    "せいかい！その調子、その調子！",
    "すばらしいっ！とってもかっこいいよ！",
    "大正解！すっごく上手だね！"
  ],
  encouragePhrases: [
    "あちゃー、おしいっ！次はきっとできるよ！",
    "大丈夫、大丈夫！次は絶対いけるよ！",
    "あきらめないで！もう一回やってみよう！",
    "おしいっ！もうちょっとだったね！"
  ]
};

const state = {
  screen: 'TITLE', // TITLE, SELECT, GAME, RESULT
  currentQuestion: 0,
  correctCount: 0,
  num1: 0,
  num2: 0,
  operator: '+', // '+' or '-'
  correctAnswer: 0,
  isAnswered: false,
  mascotType: 'panda', // 'panda' or 'rabbit'
  recognitionActive: false,
  keypadActive: false,
  keypadInput: '',
  gameMode: 'ADDITION', // ADDITION, SUBTRACTION
  gameLevel: 'TERM1' // TERM1, TERM2, TERM3
};

// ==========================================
// 2. SPEECH RECOGNITION & SYNTHESIS SETUP
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

// Map Japanese numbers/pronunciations to numerical values
const JAPANESE_NUM_MAP = {
  'れい': 0, 'ぜろ': 0, 'ゼロ': 0, 'いち': 1, 'に': 2, 'さん': 3, 'よん': 4, 'し': 4,
  'ご': 5, 'ごう': 5, 'ろく': 6, 'なな': 7, 'しち': 7, 'はち': 8, 'きゅう': 9, 'く': 9,
  'じゅう': 10, 'じゅういち': 11, 'じゅうに': 12, 'じゅうさん': 13, 'じゅうし': 14,
  'じゅうよん': 14, 'じゅうご': 15, 'じゅうろく': 16, 'じゅうなな': 17, 'じゅうはち': 18,
  'じゅうきゅう': 19, 'じゅっ': 10, 'じゅ': 10, 'じゅうっ': 10,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

// Active audio variable to track current playing file
let activeAudioPlayer = null;
const audioCache = {};

/**
 * Gets or creates a cached Audio object for the given path
 */
function getCachedAudio(path) {
  if (!audioCache[path]) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audioCache[path] = audio;
  }
  return audioCache[path];
}

/**
 * Pre-caches common structural and level audio files
 */
function preloadCommonAudio() {
  const commonFiles = [
    'dai.wav', 'mon.wav', 'wa.wav', 'ikutsukana.wav', 'plus.wav', 'minus.wav',
    'dayo.wav', 'kotaewane.wav', 'result_10.wav', 'result_8.wav', 'result_5.wav', 'result_low.wav'
  ];
  
  commonFiles.forEach(file => {
    getCachedAudio(file);
  });

  // Preload numbers 0 to 10
  for (let i = 0; i <= 10; i++) {
    getCachedAudio(`num_${i}.wav`);
  }

  // Preload praise and encourage
  for (let i = 0; i < 5; i++) {
    getCachedAudio(`praise_${i}.wav`);
  }
  for (let i = 0; i < 4; i++) {
    getCachedAudio(`encourage_${i}.wav`);
  }
}

/**
 * Stops any active audio sequence playback
 */
function stopAllAudio() {
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer.onended = null;
    activeAudioPlayer.onerror = null;
    activeAudioPlayer = null;
  }
}

/**
 * Plays a sequence of audio files (WAV) one after another
 * @param {string[]} paths - Array of audio paths
 * @param {function} callback - Callback on complete
 */
function playAudioSequence(paths, callback = null) {
  stopAllAudio();
  
  if (paths.length === 0) {
    if (callback) callback();
    return;
  }

  let index = 0;
  let cbCalled = false; // ensure callback only once

  function playNext() {
    if (index >= paths.length) {
      activeAudioPlayer = null;
      if (callback && !cbCalled) {
        cbCalled = true;
        const cb = callback;
        callback = null; // Ensure callback is only called once
        cb();
      }
      return;
    }

    const path = paths[index];
    index++;

    const audio = getCachedAudio(path);
    activeAudioPlayer = audio;
    audio.currentTime = 0; // Reset playback position

    let resolved = false;

    function handleNext() {
      if (resolved) return;
      resolved = true;
      audio.onended = null;
      audio.onerror = null;
      playNext();
    }

    audio.onended = handleNext;

    audio.onerror = (e) => {
      console.warn("Audio sequence item failed:", path, e);
      handleNext();
    };

    audio.play().catch(e => {
      console.warn("Audio sequence item playback blocked:", path, e);
      handleNext();
    });
  }

  playNext();
}

/**
 * Pre-rendered Speech Actions
 */
function speakQuestion(qNum, num1, op, num2, callback = null) {
  const opFile = op === '+' ? 'plus.wav' : 'minus.wav';
  const paths = [
    `dai.wav`,
    `num_${qNum}.wav`,
    `mon.wav`,
    `num_${num1}.wav`,
    `${opFile}`,
    `num_${num2}.wav`,
    `wa.wav`,
    `ikutsukana.wav`
  ];
  playAudioSequence(paths, callback);
}

function speakPraise(callback = null) {
  const randomIndex = Math.floor(Math.random() * 5); // 0 to 4
  const paths = [`praise_${randomIndex}.wav`];
  playAudioSequence(paths, callback);
}

function speakEncourage(correctAnswer, callback = null) {
  const randomIndex = Math.floor(Math.random() * 4); // 0 to 3
  const paths = [
    `encourage_${randomIndex}.wav`,
    `kotaewane.wav`,
    `num_${correctAnswer}.wav`,
    `dayo.wav`
  ];
  playAudioSequence(paths, callback);
}

function speakResult(correctCount, callback = null) {
  let file = 'result_low.wav';
  if (correctCount === 10) {
    file = 'result_10.wav';
  } else if (correctCount >= 8) {
    file = 'result_8.wav';
  } else if (correctCount >= 5) {
    file = 'result_5.wav';
  }
  playAudioSequence([`${file}`], callback);
}


// ==========================================
// 3. SVG ANIMAL MASCOT GENERATORS
// ==========================================
/**
 * Generates responsive high-quality SVG illustrations for Panda and Rabbit
 * @param {string} type - 'panda' | 'rabbit'
 * @param {string} expression - 'idle' | 'happy' | 'shocked'
 */
function getMascotSVG(type, expression) {
  const isPanda = type === 'panda';
  
  if (isPanda) {
    // ---------------------------------
    // PANDA MASCOT SVG (Premium Adorable)
    // ---------------------------------
    let eyesHTML = `
      <!-- Eye Patches -->
      <ellipse cx="66" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(-12, 66, 108)" />
      <ellipse cx="134" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(12, 134, 108)" />
      <!-- Sparkling Eyes -->
      <circle cx="70" cy="106" r="8" fill="#1C1A21" />
      <circle cx="130" cy="106" r="8" fill="#1C1A21" />
      <circle cx="68" cy="103" r="3.5" fill="#ffffff" />
      <circle cx="128" cy="103" r="3.5" fill="#ffffff" />
      <circle cx="72" cy="109" r="1.5" fill="#ffffff" />
      <circle cx="132" cy="109" r="1.5" fill="#ffffff" />
    `;
    let mouthHTML = `
      <!-- Nose -->
      <path d="M 96 122 Q 100 119 104 122 Q 100 127 96 122 Z" fill="#36333D" />
      <!-- Cute Cat Mouth -->
      <path d="M 92 130 Q 96 134 100 130 Q 104 134 108 130" stroke="#36333D" stroke-width="3.5" stroke-linecap="round" fill="none" />
    `;
    let handsHTML = `
      <!-- Left Hand -->
      <circle cx="45" cy="168" r="14" fill="url(#darkGrad)" filter="url(#shadow)" />
      <!-- Right Hand -->
      <circle cx="155" cy="168" r="14" fill="url(#darkGrad)" filter="url(#shadow)" />
    `;
    let particlesHTML = '';

    if (expression === 'happy') {
      eyesHTML = `
        <!-- Eye Patches -->
        <ellipse cx="66" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(-12, 66, 108)" />
        <ellipse cx="134" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(12, 134, 108)" />
        <!-- Happy closed eyes (^^) inside patches -->
        <path d="M 57 108 Q 67 96 77 108" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" fill="none" />
        <path d="M 123 108 Q 133 96 143 108" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" fill="none" />
      `;
      mouthHTML = `
        <!-- Nose -->
        <path d="M 96 122 Q 100 119 104 122 Q 100 127 96 122 Z" fill="#36333D" />
        <!-- Happy Open Smiling Mouth -->
        <g>
          <path d="M 92 128 C 92 145, 108 145, 108 128 Z" fill="#FFA6B7" stroke="#36333D" stroke-width="3.5" stroke-linecap="round" />
          <path d="M 96 136 Q 100 131 104 136 Q 100 144 96 136" fill="#FF5E7E" />
        </g>
      `;
      handsHTML = `
        <!-- Waving Happy Raised Hands -->
        <circle cx="32" cy="135" r="14" fill="url(#darkGrad)" filter="url(#shadow)" />
        <circle cx="168" cy="135" r="14" fill="url(#darkGrad)" filter="url(#shadow)" />
      `;
      particlesHTML = `
        <!-- Little floating gold stars -->
        <path d="M 30 65 L 32 70 L 37 70 L 33 73 L 35 78 L 30 75 L 25 78 L 27 73 L 23 70 L 28 70 Z" fill="#FFE066" opacity="0.9" />
        <path d="M 170 75 L 172 80 L 177 80 L 173 83 L 175 88 L 170 85 L 165 88 L 167 83 L 163 80 L 168 80 Z" fill="#FFE066" opacity="0.9" />
        <!-- Floating pink heart -->
        <path d="M 160 50 C 158 45, 150 45, 150 51 C 150 57, 160 62, 160 62 C 160 62, 170 57, 170 51 C 170 45, 162 45, 160 50 Z" fill="#FF708A" opacity="0.9" />
      `;
    } else if (expression === 'shocked') {
      eyesHTML = `
        <!-- Eye Patches -->
        <ellipse cx="66" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(-12, 66, 108)" />
        <ellipse cx="134" cy="108" rx="21" ry="25" fill="url(#darkGrad)" transform="rotate(12, 134, 108)" />
        <!-- Shocked Wide Eyes -->
        <circle cx="66" cy="106" r="9" fill="#ffffff" />
        <circle cx="66" cy="106" r="4.5" fill="#1C1A21" />
        <circle cx="134" cy="106" r="9" fill="#ffffff" />
        <circle cx="134" cy="106" r="4.5" fill="#1C1A21" />
      `;
      mouthHTML = `
        <!-- Nose -->
        <path d="M 96 122 Q 100 119 104 122 Q 100 127 96 122 Z" fill="#36333D" />
        <!-- Shocked Small Oval Mouth -->
        <ellipse cx="100" cy="134" rx="7" ry="10" fill="#FF8E9E" stroke="#36333D" stroke-width="3" />
      `;
      handsHTML = `
        <!-- Surprise Hands holding cheeks -->
        <circle cx="50" cy="150" r="13" fill="url(#darkGrad)" filter="url(#shadow)" />
        <circle cx="150" cy="150" r="13" fill="url(#darkGrad)" filter="url(#shadow)" />
      `;
      particlesHTML = `
        <!-- Blue sweat drops -->
        <path d="M 33 85 C 33 85, 23 100, 28 105 C 33 110, 43 100, 33 85 Z" fill="url(#sweatGrad)" opacity="0.9" />
        <path d="M 167 85 C 167 85, 177 100, 172 105 C 167 110, 157 100, 167 85 Z" fill="url(#sweatGrad)" opacity="0.9" />
      `;
    }
 
    return `
      <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#4A5568" flood-opacity="0.12" />
          </filter>
          <radialGradient id="whiteGrad" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="75%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#F2F5FA" />
          </radialGradient>
          <linearGradient id="darkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4A4753" />
            <stop offset="100%" stop-color="#2D2B36" />
          </linearGradient>
          <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FF94A4" stop-opacity="0.65" />
            <stop offset="60%" stop-color="#FF94A4" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#FF94A4" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="sweatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#A5F3FC" />
            <stop offset="100%" stop-color="#38BDF8" />
          </linearGradient>
        </defs>

        <!-- Body -->
        <circle cx="100" cy="175" r="54" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="3" />
        <path d="M 50 170 C 50 144, 150 144, 150 170 Z" fill="url(#darkGrad)" />
        
        <!-- Ears -->
        <circle cx="52" cy="52" r="26" fill="url(#darkGrad)" filter="url(#shadow)" />
        <circle cx="148" cy="52" r="26" fill="url(#darkGrad)" filter="url(#shadow)" />
        <circle cx="52" cy="52" r="12" fill="#FFA6B7" />
        <circle cx="148" cy="52" r="12" fill="#FFA6B7" />
        
        <!-- Head -->
        <ellipse cx="100" cy="110" rx="72" ry="64" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        
        <!-- Little green sprout on head (Super Cute Accessory) -->
        <path d="M 100 48 Q 98 38 100 32" stroke="#4A3B32" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M 100 32 C 90 32, 90 22, 100 24 C 100 22, 96 20, 100 32 Z" fill="#8DE33B" />
        <path d="M 100 32 C 110 32, 110 22, 100 24 C 100 22, 104 20, 100 32 Z" fill="#B2EC5D" />

        <!-- Eye Patches & Eyes -->
        ${eyesHTML}
        
        <!-- Airbrush Rosy Cheeks -->
        <circle cx="46" cy="128" r="14" fill="url(#blushGrad)" />
        <circle cx="154" cy="128" r="14" fill="url(#blushGrad)" />
        
        <!-- Nose & Mouth -->
        ${mouthHTML}
        
        <!-- Hands -->
        ${handsHTML}

        <!-- Happy particles / Shocked sweat -->
        ${particlesHTML}
      </svg>
    `;
  } else {
    // ---------------------------------
    // RABBIT MASCOT SVG (Premium Adorable)
    // ---------------------------------
    let earsHTML = `
      <!-- Normal Tall Ears -->
      <path d="M 60 70 C 40 -15, 80 -15, 85 70 Z" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
      <path d="M 140 70 C 160 -15, 120 -15, 115 70 Z" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
      <!-- Inner Pink Ears -->
      <path d="M 64 60 C 50 10, 76 10, 80 60 Z" fill="url(#earPinkGrad)" />
      <path d="M 136 60 C 150 10, 124 10, 120 60 Z" fill="url(#earPinkGrad)" />
    `;
    let eyesHTML = `
      <!-- Sparkling Eyes -->
      <circle cx="66" cy="108" r="8" fill="#1C1A21" />
      <circle cx="134" cy="108" r="8" fill="#1C1A21" />
      <circle cx="64" cy="105" r="3.5" fill="#ffffff" />
      <circle cx="132" cy="105" r="3.5" fill="#ffffff" />
      <circle cx="68" cy="111" r="1.5" fill="#ffffff" />
      <circle cx="136" cy="111" r="1.5" fill="#ffffff" />
    `;
    let mouthHTML = `
      <!-- Tiny Pink Nose -->
      <polygon points="97,122 103,122 100,125" fill="#FF8EA2" />
      <!-- Cute Cat Mouth & Teeth -->
      <path d="M 92 130 Q 96 134 100 130 Q 104 134 108 130" stroke="#36333D" stroke-width="3" stroke-linecap="round" fill="none" />
      <rect x="97" y="130" width="6" height="4" fill="#ffffff" stroke="#36333D" stroke-width="2" />
    `;
    let handsHTML = `
      <!-- Normal Hands -->
      <circle cx="50" cy="168" r="12" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
      <circle cx="150" cy="168" r="12" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
    `;
    let particlesHTML = '';

    if (expression === 'happy') {
      earsHTML = `
        <!-- One Happy Folded Ear -->
        <path d="M 60 70 C 40 -15, 80 -15, 85 70 Z" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        <path d="M 64 60 C 50 10, 76 10, 80 60 Z" fill="url(#earPinkGrad)" />
        
        <path d="M 115 70 C 120 40, 140 30, 150 40 C 160 50, 145 60, 125 70 Z" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        <path d="M 120 65 C 125 45, 138 38, 144 45 C 150 52, 140 58, 125 65 Z" fill="url(#earPinkGrad)" />
      `;
      eyesHTML = `
        <!-- Happy closed eyes (^^) -->
        <path d="M 56 110 Q 66 98 76 110" stroke="#36333D" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M 124 110 Q 134 98 144 110" stroke="#36333D" stroke-width="5" stroke-linecap="round" fill="none" />
      `;
      mouthHTML = `
        <!-- Tiny Pink Nose -->
        <polygon points="97,122 103,122 100,125" fill="#FF8EA2" />
        <!-- Wide Open Smiling Mouth with Buck Teeth -->
        <path d="M 90 126 C 90 144, 110 144, 110 126 Z" fill="#FFA6B7" stroke="#36333D" stroke-width="3.5" />
        <rect x="96" y="126" width="8" height="4" fill="#ffffff" />
      `;
      handsHTML = `
        <!-- Waving Waving raised hands -->
        <circle cx="34" cy="136" r="12" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        <circle cx="166" cy="136" r="12" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
      `;
      particlesHTML = `
        <!-- Little floating gold stars -->
        <path d="M 30 65 L 32 70 L 37 70 L 33 73 L 35 78 L 30 75 L 25 78 L 27 73 L 23 70 L 28 70 Z" fill="#FFE066" opacity="0.9" />
        <path d="M 170 75 L 172 80 L 177 80 L 173 83 L 175 88 L 170 85 L 165 88 L 167 83 L 163 80 L 168 80 Z" fill="#FFE066" opacity="0.9" />
        <!-- Floating pink heart -->
        <path d="M 160 50 C 158 45, 150 45, 150 51 C 150 57, 160 62, 160 62 C 160 62, 170 57, 170 51 C 170 45, 162 45, 160 50 Z" fill="#FF708A" opacity="0.9" />
      `;
    } else if (expression === 'shocked') {
      eyesHTML = `
        <!-- Anime-style squeezed shocked eyes (>_<) -->
        <path d="M 58 104 L 68 112 L 58 120" stroke="#36333D" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <path d="M 142 104 L 132 112 L 142 120" stroke="#36333D" stroke-width="4.5" stroke-linecap="round" fill="none" />
      `;
      mouthHTML = `
        <!-- Tiny Pink Nose -->
        <polygon points="97,122 103,122 100,125" fill="#FF8EA2" />
        <!-- Shocked Small Oval Mouth -->
        <circle cx="100" cy="134" r="8" fill="#FF8E9E" stroke="#36333D" stroke-width="3" />
      `;
      handsHTML = `
        <!-- Shocked paws up to cheeks -->
        <circle cx="52" cy="148" r="11" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        <circle cx="148" cy="148" r="11" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
      `;
      particlesHTML = `
        <!-- Blue sweat drops -->
        <path d="M 33 85 C 33 85, 23 100, 28 105 C 33 110, 43 100, 33 85 Z" fill="url(#sweatGrad)" opacity="0.9" />
        <path d="M 167 85 C 167 85, 177 100, 172 105 C 167 110, 157 100, 167 85 Z" fill="url(#sweatGrad)" opacity="0.9" />
      `;
    }

    return `
      <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#4A5568" flood-opacity="0.12" />
          </filter>
          <radialGradient id="whiteGrad" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="75%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#F2F5FA" />
          </radialGradient>
          <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FF94A4" stop-opacity="0.65" />
            <stop offset="60%" stop-color="#FF94A4" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#FF94A4" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="earPinkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFB3C1" />
            <stop offset="100%" stop-color="#FFA2B4" />
          </linearGradient>
          <linearGradient id="sweatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#A5F3FC" />
            <stop offset="100%" stop-color="#38BDF8" />
          </linearGradient>
        </defs>

        <!-- Body -->
        <circle cx="100" cy="175" r="48" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="3" />
        
        <!-- Ears -->
        ${earsHTML}
        
        <!-- Head -->
        <ellipse cx="100" cy="115" rx="70" ry="60" fill="url(#whiteGrad)" stroke="#E8ECF2" stroke-width="2" filter="url(#shadow)" />
        
        <!-- Cute Flower Accessory on Left Ear (Premium touch) -->
        <g transform="translate(60, 66)">
          <circle cx="-6" cy="0" r="5" fill="#FF8EA2" />
          <circle cx="6" cy="0" r="5" fill="#FF8EA2" />
          <circle cx="0" cy="-6" r="5" fill="#FF8EA2" />
          <circle cx="0" cy="6" r="5" fill="#FF8EA2" />
          <circle cx="0" cy="0" r="4" fill="#FFD043" />
        </g>

        <!-- Eyes -->
        ${eyesHTML}
        
        <!-- Airbrush Rosy Cheeks -->
        <circle cx="46" cy="126" r="14" fill="url(#blushGrad)" />
        <circle cx="154" cy="126" r="14" fill="url(#blushGrad)" />
        
        <!-- Nose & Mouth -->
        ${mouthHTML}
        
        <!-- Hands -->
        ${handsHTML}

        <!-- Happy particles / Shocked sweat -->
        ${particlesHTML}
      </svg>
    `;
  }
}

// Set mascot HTML on display
function setMascotExpression(expression) {
  const container = document.getElementById('game-mascot');
  container.innerHTML = getMascotSVG(state.mascotType, expression);

  // Apply CSS animations based on status
  container.classList.remove('jump', 'shake');
  if (expression === 'happy') {
    container.classList.add('jump');
  } else if (expression === 'shocked') {
    container.classList.add('shake');
  }
}

// ==========================================
// 4. SCREEN NAVIGATION
// ==========================================
/**
 * Checks for a saved game in localStorage and toggles the visibility of the "つづきから" button.
 */
function checkSavedGame() {
  const saved = localStorage.getItem('saved_game_state');
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    if (saved) {
      resumeBtn.style.display = 'flex';
    } else {
      resumeBtn.style.display = 'none';
    }
  }
}

function navigateTo(screenName) {
  state.screen = screenName;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  
  if (screenName === 'TITLE') {
    document.getElementById('screen-title').classList.add('active');
    checkSavedGame();
  } else if (screenName === 'SELECT') {
    document.getElementById('screen-select').classList.add('active');
    showSelectStep('mode');
  } else if (screenName === 'GAME') {
    document.getElementById('screen-game').classList.add('active');
  } else if (screenName === 'RESULT') {
    document.getElementById('screen-result').classList.add('active');
  }
}

function showSelectStep(step) {
  document.querySelectorAll('.select-step').forEach(s => s.classList.remove('active'));
  if (step === 'mode') {
    document.getElementById('select-step-mode').classList.add('active');
  } else if (step === 'level') {
    document.getElementById('select-step-level').classList.add('active');
    
    // Update level selection header based on game mode
    const modeText = state.gameMode === 'ADDITION' ? 'たしざん' : 'ひきざん';
    document.getElementById('select-level-title').textContent = `${modeText} の レベルを えらぼう！`;
  }
}

// ==========================================
// 5. GAME LOGIC
// ==========================================
function startNewGame() {
  state.currentQuestion = 0;
  state.correctCount = 0;
  state.isAnswered = false;
  state.keypadInput = '';
  
  navigateTo('GAME');
  nextQuestion();
}

function nextQuestion() {
  if (state.nextInProgress) return; // prevent re-entrancy
  state.nextInProgress = true;

  if (state.currentQuestion >= GAME_CONFIG.totalQuestions) {
    endGame();
    state.nextInProgress = false;
    return;
  }

  state.currentQuestion++;
  state.isAnswered = false;
  state.keypadInput = '';
  
  // Alternate mascots to keep engagement high!
  state.mascotType = state.currentQuestion % 2 === 0 ? 'rabbit' : 'panda';

  // Generate Equation
  generateEquation();

  // Reset UI elements
  updateGameUI();
  setMascotExpression('idle');

  // Trigger pre-rendered high-quality local voice sequence
  // Set operator based on chosen mode
  state.operator = state.gameMode === 'ADDITION' ? '+' : '-';

  if (state.gameMode === 'ADDITION') {
    if (state.gameLevel === 'TERM1') {
      // 1がっき: Answers up to 10 (A + B <= 10)
      const correct = Math.floor(Math.random() * 9) + 2; // sum: 2 to 10
      state.num1 = Math.floor(Math.random() * (correct - 1)) + 1; // 1 to correct-1
      state.num2 = correct - state.num1;
      state.correctAnswer = correct;
    } else if (state.gameLevel === 'TERM2') {
      // 2がっき: Answers up to 20 (mainly 11 to 20)
      const correct = Math.floor(Math.random() * 10) + 11; // sum: 11 to 20
      state.num1 = Math.floor(Math.random() * (correct - 2)) + 1; // 1 to correct-1
      state.num2 = correct - state.num1;
      state.correctAnswer = correct;
    } else {
      // 3がっき: Answers above 20 (double digit + single/double digit, e.g. 21 to 99)
      state.num1 = Math.floor(Math.random() * 60) + 15; // 15 to 74
      state.num2 = Math.floor(Math.random() * 20) + 10; // 10 to 29
      state.correctAnswer = state.num1 + state.num2; // always > 20
    }
  } else {
    // SUBTRACTION
    if (state.gameLevel === 'TERM1') {
      // 1がっき: Subtraction within 10 (A <= 10, Answer >= 1)
      state.num1 = Math.floor(Math.random() * 9) + 2; // 2 to 10
      state.num2 = Math.floor(Math.random() * (state.num1 - 1)) + 1; // 1 to num1-1
      state.correctAnswer = state.num1 - state.num2;
    } else if (state.gameLevel === 'TERM2') {
      // 2がっき: Subtraction within 20 (11 <= A <= 20, Answer >= 1)
      state.num1 = Math.floor(Math.random() * 10) + 11; // A: 11 to 20
      state.num2 = Math.floor(Math.random() * (state.num1 - 1)) + 1; // 1 to num1-1
      state.correctAnswer = state.num1 - state.num2;
    } else {
      // 3がっき: Subtraction with answers above 20 (A - B = Answer, where Answer >= 20)
      const correct = Math.floor(Math.random() * 50) + 20; // Answer: 20 to 69
      state.num2 = Math.floor(Math.random() * 25) + 5; // B: 5 to 29
      state.num1 = correct + state.num2; // A: 25 to 98
      state.correctAnswer = correct;
    }
  }
}

function generateEquation() {
  // Set operator based on chosen mode
  state.operator = state.gameMode === 'ADDITION' ? '+' : '-';

  if (state.gameMode === 'ADDITION') {
    if (state.gameLevel === 'TERM1') {
      // 1がっき: Answers up to 10 (A + B <= 10)
      const correct = Math.floor(Math.random() * 9) + 2; // sum: 2 to 10
      state.num1 = Math.floor(Math.random() * (correct - 1)) + 1; // 1 to correct-1
      state.num2 = correct - state.num1;
      state.correctAnswer = correct;
    } else if (state.gameLevel === 'TERM2') {
      // 2がっき: Answers up to 20 (mainly 11 to 20)
      const correct = Math.floor(Math.random() * 10) + 11; // sum: 11 to 20
      state.num1 = Math.floor(Math.random() * (correct - 2)) + 1; // 1 to correct-1
      state.num2 = correct - state.num1;
      state.correctAnswer = correct;
    } else {
      // 3がっき: Answers above 20 (double digit + single/double digit, e.g. 21 to 99)
      state.num1 = Math.floor(Math.random() * 60) + 15; // 15 to 74
      state.num2 = Math.floor(Math.random() * 20) + 10; // 10 to 29
      state.correctAnswer = state.num1 + state.num2; // always > 20
    }
  } else {
    // SUBTRACTION
    if (state.gameLevel === 'TERM1') {
      // 1がっき: Subtraction within 10 (A <= 10, Answer >= 1)
      state.num1 = Math.floor(Math.random() * 9) + 2; // 2 to 10
      state.num2 = Math.floor(Math.random() * (state.num1 - 1)) + 1; // 1 to num1-1
      state.correctAnswer = state.num1 - state.num2;
    } else if (state.gameLevel === 'TERM2') {
      // 2がっき: Subtraction within 20 (11 <= A <= 20, Answer >= 1)
      state.num1 = Math.floor(Math.random() * 10) + 11; // A: 11 to 20
      state.num2 = Math.floor(Math.random() * (state.num1 - 1)) + 1; // 1 to num1-1
      state.correctAnswer = state.num1 - state.num2;
    } else {
      // 3がっき: Subtraction with answers above 20 (A - B = Answer, where Answer >= 20)
      const correct = Math.floor(Math.random() * 50) + 20; // Answer: 20 to 69
      state.num2 = Math.floor(Math.random() * 25) + 5; // B: 5 to 29
      state.num1 = correct + state.num2; // A: 25 to 98
      state.correctAnswer = correct;
    }
  }
}

function updateGameUI() {
  // Update header text
  document.getElementById('question-number').textContent = `だいいちもん (${state.currentQuestion} / 10)`;
  document.getElementById('stars-score').textContent = `⭐️ ${state.correctCount}`;
  
  // Update progress bar
  const progressPercent = ((state.currentQuestion - 1) / GAME_CONFIG.totalQuestions) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;

  // Equation elements
  document.getElementById('equation-num1').textContent = state.num1;
  document.getElementById('equation-op').textContent = state.operator;
  document.getElementById('equation-num2').textContent = state.num2;

  // Answer box
  const answerBox = document.getElementById('answer-box');
  answerBox.textContent = '?';
  answerBox.className = 'math-answer-box';

  // Speech helper text
  document.getElementById('feedback-message').textContent = 'こたえを こえに だしてね！';
  document.getElementById('feedback-message').style.color = 'var(--color-text-muted)';
}

function handleAnswerEvaluation(answer) {
  if (state.isAnswered) return;
  state.isAnswered = true;

  // Stop recognition while evaluating
  stopListening();

  const isCorrect = parseInt(answer, 10) === state.correctAnswer;
  const answerBox = document.getElementById('answer-box');
  answerBox.textContent = answer;

  if (isCorrect) {
    state.correctCount++;
    answerBox.className = 'math-answer-box correct';
    setMascotExpression('happy');
    
    document.getElementById('feedback-message').textContent = 'せいかい！ すごいぞ！ 🎉';
    document.getElementById('feedback-message').style.color = 'var(--color-green-dark)';
    document.getElementById('stars-score').textContent = `⭐️ ${state.correctCount}`;

    speakPraise(() => {
      // Small pause before moving on
      setTimeout(nextQuestion, 1200);
    });
  } else {
    answerBox.className = 'math-answer-box incorrect';
    setMascotExpression('shocked');

    document.getElementById('feedback-message').textContent = `おしい！ こたえは ${state.correctAnswer} だよ 💡`;
    document.getElementById('feedback-message').style.color = 'var(--color-pink-dark)';

    speakEncourage(state.correctAnswer, () => {
      setTimeout(nextQuestion, 1500);
    });
  }
}

function endGame() {
  navigateTo('RESULT');

  // Fill progress bar to 100%
  document.getElementById('progress-fill').style.width = '100%';

  // Final score rendering
  document.getElementById('final-score').textContent = `${state.correctCount} / 10`;

  let comment = '';
  let fanfaresText = '';
  if (state.correctCount === 10) {
    comment = '全問正解！すごすぎる！かんぺきな天才だね！🏅';
    fanfaresText = "わぁー！すごーい！かんぺき！全問正解、おめでとう！";
  } else if (state.correctCount >= 8) {
    comment = 'たいへんよくできました！すばらしい！🌟';
    fanfaresText = `やったね！${state.correctCount}問せいかい！たいへんよくできました！`;
  } else if (state.correctCount >= 5) {
    comment = 'がんばったね！そのちょうしだよ！👍';
    fanfaresText = `よくがんばったね！${state.correctCount}問せいかい！その調子だよ！`;
  } else {
    comment = 'さいごまであきらめずにえらい！つぎはもっとできるよ！🔥';
    fanfaresText = "最後まであきらめずにがんばって、とってもえらいね！次もがんばろう！";
  }

  document.getElementById('final-comment').textContent = comment;

  // Star decoration render
  const starsContainer = document.getElementById('result-stars');
  starsContainer.innerHTML = '';
  
  // Award 5 stars proportionally
  const starsEarned = Math.round((state.correctCount / 10) * 5);
  for (let i = 1; i <= 5; i++) {
    const starSpan = document.createElement('span');
    starSpan.className = 'star';
    starSpan.textContent = '★';
    
    // Stagger star golden activation
    setTimeout(() => {
      if (i <= starsEarned) {
        starSpan.classList.add('gold');
      }
    }, i * 150);

    starsContainer.appendChild(starSpan);
  }

  // Voice final congratulations
  speakResult(state.correctCount);
}

// ==========================================
// 6. SPEECH RECOGNITION HANDLING
// ==========================================
function startListening() {
  if (!recognition || state.isAnswered) return;

  try {
    recognition.start();
  } catch (e) {
    // Already running or permission issues
    console.warn("Speech recognition start failed:", e);
  }
}

function stopListening() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Not active
    }
  }
  updateMicUI(false);
}

function updateMicUI(active) {
  state.recognitionActive = active;
  const answerBox = document.getElementById('answer-box');
  const micContainer = document.getElementById('screen-game');
  
  if (active && !state.isAnswered) {
    answerBox.classList.add('listening');
    micContainer.classList.add('listening');
    document.getElementById('mic-text').textContent = 'こたえを どうぞ！ 🎤';
    document.getElementById('mic-text').classList.add('speech-active');
  } else {
    answerBox.classList.remove('listening');
    micContainer.classList.remove('listening');
    document.getElementById('mic-text').textContent = 'こたえを まっています... 🎤';
    document.getElementById('mic-text').classList.remove('speech-active');
  }
}

if (recognition) {
  recognition.onstart = () => {
    updateMicUI(true);
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log("Speech recognition result received:", transcript);
    
    const parsedNumber = parseSpeechToNumber(transcript);
    if (parsedNumber !== null) {
      handleAnswerEvaluation(parsedNumber);
    } else {
      // Recognized speech but couldn't parse a number (e.g. child said hello)
      document.getElementById('feedback-message').textContent = 'すうじを おおきなこえで いってね！';
      document.getElementById('feedback-message').style.color = 'var(--color-pink-dark)';
    }
  };

  recognition.onerror = (event) => {
    console.log("Speech Recognition error type:", event.error);
    
    if (event.error === 'not-allowed') {
      document.getElementById('mic-text').textContent = 'マイクをつかうのを きょかしてね 🔓';
    }
  };

  recognition.onend = () => {
    updateMicUI(false);
    // AUTO-RESTART RECOGNITION:
    // If the game is still active, not answered yet, and in active game screen, restart!
    if (state.screen === 'GAME' && !state.isAnswered && !state.keypadActive) {
      setTimeout(startListening, 600);
    }
  };
}

/**
 * Normalizes speech input and returns integer string or null
 * Handles numeric values, Japanese Kanji/Hiragana numbers.
 * @param {string} text - Speech transcription text
 */
function parseSpeechToNumber(text) {
  // Remove spaces
  let cleanText = text.replace(/\s+/g, '');
  
  // 1. Direct Regex match for standard digits
  const digitsMatch = cleanText.match(/\d+/);
  if (digitsMatch) {
    return parseInt(digitsMatch[0], 10);
  }

  // 2. Direct mapping for exact words e.g. "ご" (5)
  if (JAPANESE_NUM_MAP[cleanText] !== undefined) {
    return JAPANESE_NUM_MAP[cleanText];
  }

  // 3. Scan transcription for sound variations
  // E.g. "ごう" (often heard for 5), "しち" (7), etc.
  for (let key in JAPANESE_NUM_MAP) {
    if (cleanText.includes(key)) {
      return JAPANESE_NUM_MAP[key];
    }
  }

  return null;
}

// ==========================================
// 7. KEYPAD FALLBACK SYSTEM
// ==========================================
function toggleKeypad() {
  state.keypadActive = !state.keypadActive;
  const keypad = document.getElementById('keypad');
  const toggleBtn = document.getElementById('btn-toggle-keypad');

  if (state.keypadActive) {
    keypad.classList.add('active');
    toggleBtn.textContent = 'こえでこたえる！';
    // Temporarily halt background mic listening to prevent keyboard noise recognition
    stopListening();
  } else {
    keypad.classList.remove('active');
    toggleBtn.textContent = 'こえがでないときは ここをおしてね';
    state.keypadInput = '';
    // Re-engage voice recognition
    startListening();
  }
}

function handleKeypadPress(number) {
  if (state.isAnswered) return;

  state.keypadInput += number;
  const answerBox = document.getElementById('answer-box');
  answerBox.textContent = state.keypadInput;

  // Auto-evaluation logic based on answer length:
  // If the correct answer is a single digit (e.g. 8), as soon as they type 1 digit, evaluate!
  // If correct answer is two digits (e.g. 18), wait until they type 2 digits, then evaluate!
  const targetLength = state.correctAnswer.toString().length;
  
  if (state.keypadInput.length >= targetLength) {
    handleAnswerEvaluation(state.keypadInput);
  }
}

function clearKeypad() {
  state.keypadInput = '';
  document.getElementById('answer-box').textContent = '?';
}

// ==========================================
// 8. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // TUTORIAL DIALOG
  const dialog = document.getElementById('tutorial-dialog');
  
  document.getElementById('btn-tutorial').addEventListener('click', () => {
    dialog.showModal();
  });

  document.getElementById('btn-close-tutorial').addEventListener('click', () => {
    dialog.close();
  });

  // TITLE SCREEN BUTTONS
  document.getElementById('btn-start').addEventListener('click', () => {
    navigateTo('SELECT');
  });

  // MODE SELECTION BUTTONS (Step 1)
  document.getElementById('btn-select-add').addEventListener('click', () => {
    state.gameMode = 'ADDITION';
    showSelectStep('level');
  });

  document.getElementById('btn-select-sub').addEventListener('click', () => {
    state.gameMode = 'SUBTRACTION';
    showSelectStep('level');
  });

  document.getElementById('btn-select-mode-back').addEventListener('click', () => {
    navigateTo('TITLE');
  });

  // LEVEL SELECTION BUTTONS (Step 2)
  document.querySelectorAll('.btn-level').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-level');
      state.gameLevel = targetBtn.getAttribute('data-level');
      startNewGame();
    });
  });

  document.getElementById('btn-select-level-back').addEventListener('click', () => {
    showSelectStep('mode');
  });

  // RESULTS SCREEN CONTROLS
  document.getElementById('btn-restart').addEventListener('click', () => {
    startNewGame();
  });

  document.getElementById('btn-back-title').addEventListener('click', () => {
    navigateTo('TITLE');
  });

  // KEYPAD ACTIONS
  document.getElementById('btn-toggle-keypad').addEventListener('click', toggleKeypad);

  document.querySelectorAll('.keypad-btn:not(.keypad-btn-clear)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const num = e.target.getAttribute('data-num');
      handleKeypadPress(num);
    });
  });

  document.getElementById('keypad-btn-clear').addEventListener('click', clearKeypad);

  // GAME CONTROL ACTIONS (中断 / やめる / つづきから)
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      const saved = localStorage.getItem('saved_game_state');
      if (saved) {
        try {
          const savedState = JSON.parse(saved);
          state.currentQuestion = savedState.currentQuestion;
          state.correctCount = savedState.correctCount;
          state.gameMode = savedState.gameMode;
          state.gameLevel = savedState.gameLevel;

          // Clear saved state now that we've loaded it
          localStorage.removeItem('saved_game_state');

          // Navigate and start
          navigateTo('GAME');
          
          // Re-generate equations and setup UI
          state.nextInProgress = false; // Ensure nextQuestion isn't locked
          nextQuestion();
        } catch (e) {
          console.error("Failed to parse saved game state:", e);
          localStorage.removeItem('saved_game_state');
          checkSavedGame();
        }
      }
    });
  }

  document.getElementById('btn-game-suspend').addEventListener('click', () => {
    // Stop active audio and recognition
    stopAllAudio();
    stopListening();

    // Save game state
    // We save currentQuestion - 1 because nextQuestion will increment it by 1 when resuming
    const savedState = {
      currentQuestion: state.currentQuestion - 1,
      correctCount: state.correctCount,
      gameMode: state.gameMode,
      gameLevel: state.gameLevel
    };
    localStorage.setItem('saved_game_state', JSON.stringify(savedState));

    alert('ゲームを ちゅうだん しました。つぎは つづきから あそべるよ！');

    // Reset temporary states
    state.isAnswered = false;
    state.keypadInput = '';

    navigateTo('TITLE');
  });

  document.getElementById('btn-game-quit').addEventListener('click', () => {
    if (confirm('ゲームを やめますか？ (すすんだところは きえちゃいます)')) {
      // Stop active audio and recognition
      stopAllAudio();
      stopListening();

      // Clear saved state
      localStorage.removeItem('saved_game_state');

      // Reset temporary states
      state.isAnswered = false;
      state.keypadInput = '';

      navigateTo('TITLE');
    }
  });

  // Initialize title screen mascot
  document.getElementById('title-mascot-svg').style.animation = 'floatMascot 4s infinite ease-in-out';
  
  // Check for any saved game on load
  checkSavedGame();

  // Pre-load essential audio assets for instant playback
  preloadCommonAudio();
});
