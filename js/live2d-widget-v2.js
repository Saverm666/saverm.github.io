// Stable Sayaka Live2D widget for desktop pages.
(function() {
  const MIN_DESKTOP_WIDTH = 768;
  const MODEL_PATH = '/live2d_models/sayaka/model.model3.json';
  const PARAMS_PATH = '/live2d_models/sayaka/params.json';
  const CONTAINER_ID = 'live2d-widget-container';
  const CANVAS_ID = 'live2d-canvas';
  const SCRIPT_SOURCES = [
    '/js/live2dcubismcore.min.js?v=1.0.1',
    '/js/pixi.min.js?v=6.5.2',
    '/js/pixi-live2d-display-c4.min.js?v=0.4.0'
  ];
  const MODEL_SCALE = 0.24;
  const DEFAULT_BOTTOM_OFFSET = 8;
  const EXTRA_DROP_PX = 35;
  const BUBBLE_TOP_OFFSET = 254;
  const VOICE_FALLBACK_SOURCES = ['/audio/sayaka_baka.mp3'];
  const STATE_STORAGE_KEY = 'sayaka-live2d-widget-state-v1';
  const GREETING_COOLDOWN_MS = 10 * 60 * 1000;
  const DEFAULT_PARAMS = {
    modelScale: 1.3
  };
  const DAY_PERIOD_PROFILES = {
    morning: {
      idleMinMs: 18000,
      idleMaxMs: 28000,
      messages: {
        greeting: [
          '早安，今天也一起打起精神吧。',
          '早上好，要开始今天的浏览了吗？'
        ],
        tap: [
          '早晨就这么有活力，不错嘛。',
          '清醒一点，继续出发。'
        ],
        idle: [
          '我先帮你看着这页内容。',
          '先喘口气，慢慢看。'
        ]
      }
    },
    daytime: {
      idleMinMs: 16000,
      idleMaxMs: 24000,
      messages: {
        greeting: [
          '欢迎回来，今天想看点什么？',
          '白天就该元气满满地逛博客。'
        ],
        tap: [
          '我在，继续往下看吧。',
          '这下注意到我了吧。'
        ],
        idle: [
          '这会儿适合认真看看新东西。',
          '我先安静待机，有事再叫我。'
        ]
      }
    },
    evening: {
      idleMinMs: 20000,
      idleMaxMs: 30000,
      messages: {
        greeting: [
          '傍晚好，节奏可以慢一点。',
          '晚上适合放松着随便看看。'
        ],
        tap: [
          '别急，慢慢来。',
          '嗯，我还在这里。'
        ],
        idle: [
          '天色暗下来了，别太累。',
          '我先陪你安静一会儿。'
        ]
      }
    },
    night: {
      idleMinMs: 22000,
      idleMaxMs: 32000,
      messages: {
        greeting: [
          '夜深了，记得早点休息。',
          '晚上好，安静一点也挺好。'
        ],
        tap: [
          '还没睡呀？那我陪你一会儿。',
          '夜里也别盯屏幕太久。'
        ],
        idle: [
          '这会儿适合慢慢看，不用着急。',
          '我先守在这里，你也别太晚。'
        ]
      }
    }
  };
  let widgetStateCache = null;

  if (window.__sayakaLive2DInitStarted) return;
  window.__sayakaLive2DInitStarted = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  async function init() {
    if (window.innerWidth < MIN_DESKTOP_WIDTH) {
      console.log('[Live2D] Skipped on mobile viewport.');
      return;
    }

    if (document.getElementById(CANVAS_ID)) return;

    try {
      await loadDependencies();

      const PIXI = window.PIXI;
      const live2d = PIXI && PIXI.live2d;
      if (!PIXI || !live2d || !live2d.Live2DModel) {
        throw new Error('PIXI.live2d.Live2DModel is unavailable.');
      }

      if (typeof live2d.cubism4Ready === 'function') {
        await live2d.cubism4Ready();
      }

      const params = await loadParams();
      const view = createCanvas();
      const app = new PIXI.Application({
        view: view.canvas,
        width: view.size.width,
        height: view.size.height,
        antialias: true,
        autoStart: true,
        autoDensity: true,
        transparent: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1
      });

      const model = await live2d.Live2DModel.from(MODEL_PATH, {
        autoInteract: false
      });

      app.stage.addChild(model);
      layoutModel(model, view.size.width, view.size.height, params);
      bindInteractions(model, view);

      const resize = debounce(() => {
        if (window.innerWidth < MIN_DESKTOP_WIDTH) {
          view.container.style.display = 'none';
          return;
        }

        const nextSize = getCanvasSize();
        view.container.style.display = 'block';
        view.container.style.width = nextSize.width + 'px';
        view.container.style.height = nextSize.height + 'px';
        view.container.style.bottom = getBottomOffset() + 'px';
        app.renderer.resize(nextSize.width, nextSize.height);
        constrainContainerPosition(view.container);
        layoutModel(model, nextSize.width, nextSize.height, params);
      }, 100);

      window.addEventListener('resize', resize);
      console.log('[Live2D] Sayaka widget ready.');
    } catch (error) {
      console.error('[Live2D] Failed to initialize widget:', error);
    }
  }

  function getCanvasSize() {
    const viewportHeight = window.innerHeight || 800;
    const maxHeight = Math.max(420, Math.floor(viewportHeight * 0.86));

    if (window.innerWidth >= 1440) {
      return { width: 360, height: Math.min(760, maxHeight) };
    }

    if (window.innerWidth >= 1100) {
      return { width: 320, height: Math.min(700, maxHeight) };
    }

    return { width: 280, height: Math.min(620, maxHeight) };
  }

  function createCanvas() {
    const size = getCanvasSize();
    const savedState = loadWidgetState();
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    const bubble = document.createElement('div');
    const initialLeft = clamp(
      Number.isFinite(savedState.left) ? savedState.left : 0,
      -size.width * 0.35,
      window.innerWidth - size.width * 0.65
    );

    container.id = CONTAINER_ID;
    Object.assign(container.style, {
      position: 'fixed',
      left: initialLeft + 'px',
      bottom: getBottomOffset() + 'px',
      width: size.width + 'px',
      height: size.height + 'px',
      zIndex: '9999',
      pointerEvents: 'none'
    });

    canvas.id = CANVAS_ID;
    Object.assign(canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'auto',
      cursor: 'pointer',
      touchAction: 'none'
    });

    Object.assign(bubble.style, {
      position: 'absolute',
      top: BUBBLE_TOP_OFFSET + 'px',
      left: '56%',
      maxWidth: '220px',
      padding: '10px 14px',
      borderRadius: '14px',
      border: '1px solid rgba(108, 131, 168, 0.2)',
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#24324a',
      fontSize: '13px',
      lineHeight: '1.45',
      boxShadow: '0 12px 30px rgba(28, 43, 67, 0.16)',
      opacity: '0',
      transform: 'translate3d(0, 8px, 0)',
      transition: 'opacity 180ms ease, transform 180ms ease',
      pointerEvents: 'none',
      backdropFilter: 'blur(10px)'
    });

    container.appendChild(canvas);
    container.appendChild(bubble);
    document.body.appendChild(container);

    return { container, canvas, bubble, size };
  }

  function layoutModel(model, width, height, params) {
    const bounds = model.getLocalBounds();
    const tune = Object.assign({}, DEFAULT_PARAMS, params || {});
    const fitScale = Math.min((width * 0.8) / bounds.width, (height * 0.94) / bounds.height);
    const scale = Math.min(fitScale, MODEL_SCALE * (tune.modelScale / DEFAULT_PARAMS.modelScale));

    model.scale.set(scale);
    model.x = width / 2 - (bounds.x + bounds.width / 2) * scale;
    model.y = height - (bounds.y + bounds.height) * scale;
  }

  function bindInteractions(model, view) {
    const canvas = view.canvas;
    const container = view.container;
    const bubble = view.bubble;
    const animationCatalog = getAnimationCatalog(model);
    const voicePlayer = createVoicePlayer();
    let pointerDown = false;
    let dragged = false;
    let dragStartX = 0;
    let originLeft = 0;
    let bubbleTimer = 0;
    let idleTimer = 0;

    scheduleIdleReaction();
    maybePlayGreeting();

    canvas.addEventListener('pointermove', (event) => {
      if (pointerDown) {
        const deltaX = event.clientX - dragStartX;
        if (!dragged && Math.abs(deltaX) > 4) {
          dragged = true;
        }

        if (dragged) {
          updateContainerLeft(originLeft + deltaX);
        }
      }

      focusPointer(event);
    });

    canvas.addEventListener('pointerdown', (event) => {
      pointerDown = true;
      dragged = false;
      dragStartX = event.clientX;
      originLeft = parseFloat(container.style.left) || 0;
      scheduleIdleReaction();

      if (canvas.setPointerCapture) {
        canvas.setPointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener('pointerup', (event) => {
      finishPointer(event, true);
    });

    canvas.addEventListener('pointercancel', (event) => {
      finishPointer(event, false);
    });

    canvas.addEventListener('lostpointercapture', () => {
      pointerDown = false;
    });

    window.addEventListener('beforeunload', () => {
      clearTimeout(idleTimer);
      clearTimeout(bubbleTimer);
      voicePlayer.pause();
      voicePlayer.removeAttribute('src');
      voicePlayer.load();
      voicePlayer.remove();
    }, { once: true });

    function playMotion(entry) {
      if (!entry) return;
      model.motion(entry.group, entry.index).catch((error) => {
        console.warn('[Live2D] Motion playback failed:', error);
      });
    }

    function finishPointer(event, shouldTap) {
      const wasDragged = dragged;
      pointerDown = false;
      dragged = false;

      if (canvas.releasePointerCapture && canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (!shouldTap || wasDragged) return;

      if (typeof model.tap === 'function') {
        const point = getCanvasPointerPosition(event);
        model.tap(point.x, point.y);
      }

      triggerReaction('tap', { withVoice: true, textMode: 'neutral' });
    }

    function focusPointer(event) {
      if (typeof model.focus !== 'function') return;
      const point = getCanvasPointerPosition(event);
      model.focus(point.x, point.y);
    }

    function getCanvasPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    function updateContainerLeft(nextLeft) {
      const clampedLeft = clamp(nextLeft, -container.offsetWidth * 0.35, window.innerWidth - container.offsetWidth * 0.65);
      container.style.left = clampedLeft + 'px';
      saveWidgetState({ left: clampedLeft });
    }

    function triggerReaction(type, options) {
      const profile = getDayPeriodProfile();
      const tune = Object.assign({ withVoice: false, textMode: 'default' }, options || {});
      playMotion(pickMotionEntry(animationCatalog, type));
      playExpression(profile, type);
      if (tune.withVoice) {
        playVoice(pickVoiceEntry(animationCatalog));
      }
      if (tune.textMode === 'default') {
        showBubble(pickMessage(profile.messages[type]));
      } else if (tune.textMode === 'neutral') {
        showBubble(pickNeutralVoiceMessage());
      } else if (tune.textMode === 'silent') {
        hideBubble();
      }
      scheduleIdleReaction();
    }

    function maybePlayGreeting() {
      const profile = getDayPeriodProfile();
      const state = loadWidgetState();
      const lastGreetingAt = Number(state.lastGreetingAt) || 0;
      if (state.lastGreetingPeriod === profile.key && Date.now() - lastGreetingAt < GREETING_COOLDOWN_MS) {
        return;
      }

      window.setTimeout(() => {
        playMotion(pickMotionEntry(animationCatalog, 'greeting'));
        playExpression(profile, 'greeting');
        showBubble(pickMessage(profile.messages.greeting));
        saveWidgetState({
          lastGreetingAt: Date.now(),
          lastGreetingPeriod: profile.key
        });
      }, 600);
    }

    function scheduleIdleReaction() {
      clearTimeout(idleTimer);
      const profile = getDayPeriodProfile();
      const idleDelay = randomInt(profile.idleMinMs, profile.idleMaxMs);
      idleTimer = window.setTimeout(() => {
        triggerReaction('idle');
      }, idleDelay);
    }

    function playExpression(profile, type) {
      if (typeof model.expression !== 'function' || animationCatalog.expressionCount <= 0) return;
      const expressionIndex = pickExpressionIndex(animationCatalog.expressionCount, profile.key, type);
      if (expressionIndex === null) return;

      model.expression(expressionIndex).catch((error) => {
        console.warn('[Live2D] Expression playback failed:', error);
      });
    }

    function playVoice(entry) {
      const sources = [];
      if (entry && entry.src) {
        sources.push(entry.src);
      }
      VOICE_FALLBACK_SOURCES.forEach((src) => {
        if (!sources.includes(src)) {
          sources.push(src);
        }
      });
      tryPlayVoiceSources(sources, 0);
    }

    function tryPlayVoiceSources(sources, index) {
      if (!Array.isArray(sources) || index >= sources.length) return;

      const nextSource = sources[index];

      try {
        voicePlayer.pause();
        voicePlayer.src = nextSource;
        voicePlayer.currentTime = 0;
        voicePlayer.load();

        const playPromise = voicePlayer.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((error) => {
            if (index + 1 < sources.length) {
              tryPlayVoiceSources(sources, index + 1);
              return;
            }

            console.warn('[Live2D] Voice playback failed:', error);
          });
        }
      } catch (error) {
        if (index + 1 < sources.length) {
          tryPlayVoiceSources(sources, index + 1);
          return;
        }

        console.warn('[Live2D] Voice playback failed:', error);
      }
    }

    function showBubble(text) {
      if (!bubble || !text) return;
      clearTimeout(bubbleTimer);
      bubble.textContent = text;
      bubble.style.opacity = '1';
      bubble.style.transform = 'translate3d(0, 0, 0)';
      bubbleTimer = window.setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translate3d(0, 8px, 0)';
      }, 4200);
    }

    function hideBubble() {
      if (!bubble) return;
      clearTimeout(bubbleTimer);
      bubble.style.opacity = '0';
      bubble.style.transform = 'translate3d(0, 8px, 0)';
    }
  }

  function getAnimationCatalog(model) {
    const settings = model && model.internalModel && model.internalModel.settings;
    const motions = settings && (
      (settings.json && settings.json.FileReferences && settings.json.FileReferences.Motions) ||
      settings.motions
    );
    const motionEntries = [];
    const groups = ['Motion', 'Motion#2'];

    groups.forEach((group) => {
      if (!Array.isArray(motions && motions[group])) return;
      motions[group].forEach((definition, index) => {
        if (!definition || !definition.File) return;
        motionEntries.push({ group, index });
      });
    });
    const voiceEntries = Array.isArray(motions && motions['Voice#3'])
      ? motions['Voice#3']
        .filter((definition) => definition && definition.Sound)
        .map((definition) => ({
          name: definition.Name || '',
          src: resolveModelAssetPath(definition.Sound)
        }))
      : [];

    return {
      motionEntries,
      expressionCount: Array.isArray(settings && settings.expressions) ? settings.expressions.length : 0,
      voiceEntries
    };
  }

  function createVoicePlayer() {
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = 0.72;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    return audio;
  }

  async function loadDependencies() {
    for (const src of SCRIPT_SOURCES) {
      await loadScript(src);
    }
  }

  async function loadParams() {
    try {
      const response = await fetch(PARAMS_PATH, { cache: 'no-store' });
      if (!response.ok) return DEFAULT_PARAMS;
      const data = await response.json();
      return data && typeof data === 'object' ? data : DEFAULT_PARAMS;
    } catch (error) {
      console.warn('[Live2D] Failed to load params.json, using defaults.', error);
      return DEFAULT_PARAMS;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-live2d-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.live2dSrc = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  function debounce(fn, wait) {
    let timer = null;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function constrainContainerPosition(container) {
    const currentLeft = parseFloat(container.style.left) || 0;
    const nextLeft = clamp(currentLeft, -container.offsetWidth * 0.35, window.innerWidth - container.offsetWidth * 0.65);
    container.style.left = nextLeft + 'px';
    container.style.bottom = getBottomOffset() + 'px';
    container.style.top = 'auto';
    saveWidgetState({ left: nextLeft });
  }

  function getBottomOffset() {
    const sideTools = document.querySelector('.side-tools');
    if (!sideTools) return DEFAULT_BOTTOM_OFFSET - EXTRA_DROP_PX;

    const bottom = parseFloat(window.getComputedStyle(sideTools).bottom);
    return Number.isFinite(bottom) ? bottom - EXTRA_DROP_PX : DEFAULT_BOTTOM_OFFSET - EXTRA_DROP_PX;
  }

  function resolveModelAssetPath(relativePath) {
    if (!relativePath) return '';
    if (/^(?:https?:)?\/\//.test(relativePath) || relativePath.startsWith('/')) {
      return relativePath;
    }

    return getModelBasePath() + relativePath.replace(/^\.\//, '');
  }

  function getModelBasePath() {
    const lastSlashIndex = MODEL_PATH.lastIndexOf('/');
    return lastSlashIndex >= 0 ? MODEL_PATH.slice(0, lastSlashIndex + 1) : '/';
  }

  function loadWidgetState() {
    if (widgetStateCache) return widgetStateCache;

    try {
      const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
      widgetStateCache = raw ? JSON.parse(raw) : {};
    } catch (error) {
      widgetStateCache = {};
    }

    return widgetStateCache;
  }

  function saveWidgetState(patch) {
    const nextState = Object.assign({}, loadWidgetState(), patch || {});
    widgetStateCache = nextState;

    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      console.warn('[Live2D] Failed to persist widget state:', error);
    }
  }

  function getDayPeriodProfile() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return Object.assign({ key: 'morning' }, DAY_PERIOD_PROFILES.morning);
    if (hour >= 11 && hour < 17) return Object.assign({ key: 'daytime' }, DAY_PERIOD_PROFILES.daytime);
    if (hour >= 17 && hour < 22) return Object.assign({ key: 'evening' }, DAY_PERIOD_PROFILES.evening);
    return Object.assign({ key: 'night' }, DAY_PERIOD_PROFILES.night);
  }

  function pickMotionEntry(animationCatalog, type) {
    const motionEntries = animationCatalog && animationCatalog.motionEntries;
    if (!Array.isArray(motionEntries) || !motionEntries.length) return null;

    const preferredGroup = type === 'idle' ? 'Motion#2' : 'Motion';
    const preferredEntries = motionEntries.filter((entry) => entry.group === preferredGroup);
    const source = preferredEntries.length ? preferredEntries : motionEntries;
    return source[Math.floor(Math.random() * source.length)] || null;
  }

  function pickVoiceEntry(animationCatalog) {
    const voiceEntries = animationCatalog && animationCatalog.voiceEntries;
    if (!Array.isArray(voiceEntries) || !voiceEntries.length) return null;
    return voiceEntries[Math.floor(Math.random() * voiceEntries.length)] || null;
  }

  function pickExpressionIndex(expressionCount, periodKey, type) {
    if (!expressionCount) return null;

    const pools = {
      morning: {
        greeting: [0, 3, 4],
        tap: [0, 2, 4, 5],
        idle: [1, 3, 4]
      },
      daytime: {
        greeting: [0, 2, 4, 5],
        tap: [0, 2, 4, 5, 6],
        idle: [1, 2, 5]
      },
      evening: {
        greeting: [1, 2, 5, 6],
        tap: [1, 2, 5, 6, 7],
        idle: [1, 5, 6]
      },
      night: {
        greeting: [1, 3, 6, 7],
        tap: [1, 3, 5, 6, 7],
        idle: [1, 3, 6]
      }
    };
    const fallbackPool = [];
    for (let index = 0; index < expressionCount; index += 1) {
      fallbackPool.push(index);
    }
    const scopedPool = (((pools[periodKey] || {})[type]) || fallbackPool)
      .filter((index) => index >= 0 && index < expressionCount);
    const source = scopedPool.length ? scopedPool : fallbackPool;
    return source[Math.floor(Math.random() * source.length)] || 0;
  }

  function pickMessage(messages) {
    if (!Array.isArray(messages) || !messages.length) return '';
    return messages[Math.floor(Math.random() * messages.length)];
  }

  function pickNeutralVoiceMessage() {
    const neutralMessages = [
      '...',
      '嗯？',
      '在呢。',
      '听得到哦。'
    ];
    return neutralMessages[Math.floor(Math.random() * neutralMessages.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
})();
