// Stable Sayaka Live2D widget for desktop pages.
(function() {
  // ---- Core constants & default config -----------------------------------
  const MIN_DESKTOP_WIDTH = 768;
  const MODEL_PATH = '/live2d_models/sayaka/model.model3.json';
  const PARAMS_PATH = '/live2d_models/sayaka/params.json';
  const CONTAINER_ID = 'live2d-widget-container';
  const CANVAS_ID = 'live2d-canvas';
  const HIT_AREA_ID = 'live2d-hit-area';
  const SCRIPT_SOURCES = [
    '/js/live2dcubismcore.min.js?v=1.0.1',
    '/js/pixi.min.js?v=6.5.2',
    '/js/pixi-live2d-display-c4.min.js?v=0.4.0'
  ];
  const MODEL_SCALE = 0.24;
  const DEFAULT_BOTTOM_OFFSET = 8;
  const EXTRA_DROP_PX = 35;
  const BUBBLE_TOP_OFFSET = 204;
  const VOICE_FALLBACK_SOURCES = ['/audio/sayaka_baka.mp3'];
  const STATE_STORAGE_KEY = 'sayaka-live2d-widget-state-v1';
  const GREETING_COOLDOWN_MS = 10 * 60 * 1000;
  const HIT_AREA_PADDING_PX = 10;
  const HIT_AREA_SYNC_INTERVAL_MS = 80;
  const HIT_AREA_MIN_OPACITY = 0.05;
  const DEFAULT_PARAMS = {
    modelScale: 1.3
  };
  const DEFAULT_WIDGET_CONFIG = {
    tapVoiceEvery: 5,
    tapTextPool: [],
    tapTextPoolByEmotion: {
      cheerful: ['这下注意到我了吧。'],
      gentle: ['我在，继续往下看吧。'],
      shy: ['嗯，我在呢。'],
      caring: ['有事就叫我。']
    }
  };
  const DAY_PERIOD_PROFILES = {
    morning: {
      idleMinMs: 18000,
      idleMaxMs: 28000,
      emotions: {
        greeting: ['cheerful', 'gentle'],
        tap: ['cheerful', 'serious'],
        idle: ['calm', 'gentle']
      },
      messages: {
        greeting: {
          cheerful: ['早安，今天也一起打起精神吧。'],
          gentle: ['早上好，要开始今天的浏览了吗？']
        },
        tap: {
          cheerful: ['早晨就这么有活力，不错嘛。'],
          serious: ['清醒一点，继续出发。']
        },
        idle: {
          calm: ['我先帮你看着这页内容。'],
          gentle: ['先喘口气，慢慢看。']
        }
      }
    },
    daytime: {
      idleMinMs: 16000,
      idleMaxMs: 24000,
      emotions: {
        greeting: ['cheerful', 'gentle'],
        tap: ['gentle', 'cheerful', 'annoyed'],
        idle: ['calm', 'caring']
      },
      messages: {
        greeting: {
          gentle: ['欢迎回来，今天想看点什么？'],
          cheerful: ['白天就该元气满满地逛博客。']
        },
        tap: {
          gentle: ['我在，继续往下看吧。'],
          cheerful: ['这下注意到我了吧。']
        },
        idle: {
          calm: ['这会儿适合认真看看新东西。'],
          caring: ['我先安静待机，有事再叫我。']
        }
      }
    },
    evening: {
      idleMinMs: 20000,
      idleMaxMs: 30000,
      emotions: {
        greeting: ['gentle', 'calm'],
        tap: ['gentle', 'shy', 'serious'],
        idle: ['caring', 'calm']
      },
      messages: {
        greeting: {
          gentle: ['傍晚好，节奏可以慢一点。'],
          calm: ['晚上适合放松着随便看看。']
        },
        tap: {
          gentle: ['别急，慢慢来。'],
          shy: ['嗯，我还在这里。']
        },
        idle: {
          caring: ['天色暗下来了，别太累。'],
          calm: ['我先陪你安静一会儿。']
        }
      }
    },
    night: {
      idleMinMs: 22000,
      idleMaxMs: 32000,
      emotions: {
        greeting: ['caring', 'calm'],
        tap: ['caring', 'serious', 'annoyed'],
        idle: ['calm', 'caring']
      },
      messages: {
        greeting: {
          caring: ['夜深了，记得早点休息。'],
          calm: ['晚上好，安静一点也挺好。']
        },
        tap: {
          caring: ['还没睡呀？那我陪你一会儿。'],
          serious: ['夜里也别盯屏幕太久。']
        },
        idle: {
          calm: ['这会儿适合慢慢看，不用着急。'],
          caring: ['我先守在这里，你也别太晚。']
        }
      }
    }
  };
  // Expression indexes come from model.model3.json -> FileReferences.Expressions:
  // 0: mtn_ex_010  neutral / soft
  // 1: mtn_ex_011  closed-eye smile
  // 2: mtn_ex_020  troubled / displeased
  // 3: mtn_ex_030  determined / stern
  // 4: mtn_ex_040  gentle smile
  // 5: mtn_ex_041  bright laugh
  // 6: mtn_ex_050  startled
  // 7: mtn_ex_060  wink / playful smile
  // These labels are inferred from expression parameter files in source/live2d_models/sayaka/exp/.
  const EXPRESSION_POOLS_BY_EMOTION = {
    annoyed: [2, 3],
    calm: [0],
    caring: [0, 4],
    cheerful: [1, 5],
    gentle: [0, 4],
    serious: [2, 3],
    shy: [1],
    surprised: [6],
    playful: [7]
  };
  const LEGACY_EXPRESSION_POOLS = {
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
      updateInteractionRegion(model, view);
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
        updateInteractionRegion(model, view);
      }, 100);

      window.addEventListener('resize', resize);
      console.log('[Live2D] Sayaka widget ready.');
    } catch (error) {
      console.error('[Live2D] Failed to initialize widget:', error);
    }
  }

  // ---- Layout & canvas shell ---------------------------------------------
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
    const hitArea = document.createElement('div');
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
      pointerEvents: 'none',
      touchAction: 'none'
    });

    hitArea.id = HIT_AREA_ID;
    Object.assign(hitArea.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      display: 'none',
      pointerEvents: 'auto',
      cursor: 'default',
      touchAction: 'none',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      clipPath: 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'
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
    container.appendChild(hitArea);
    container.appendChild(bubble);
    document.body.appendChild(container);

    return { container, canvas, hitArea, bubble, size };
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
    const hitArea = view.hitArea;
    const container = view.container;
    const bubble = view.bubble;
    const animationCatalog = getAnimationCatalog(model);
    const widgetConfig = getLive2DWidgetConfig();
    const voicePlayer = createVoicePlayer();
    let pointerDown = false;
    let pointerStartedOnModel = false;
    let dragged = false;
    let dragStartX = 0;
    let originLeft = 0;
    let bubbleTimer = 0;
    let idleTimer = 0;
    let tapCount = 0;
    let interactionRegionFrame = 0;
    let lastInteractionRegionSyncAt = 0;

    syncInteractionRegion(performance.now());
    scheduleIdleReaction();
    maybePlayGreeting();

    hitArea.addEventListener('pointermove', (event) => {
      const point = getCanvasPointerPosition(event, canvas);
      const isStrictHit = pointerStartedOnModel || isModelMeshHit(model, point.x, point.y);
      hitArea.style.cursor = pointerDown ? 'grabbing' : (isStrictHit ? 'pointer' : 'default');

      if (pointerDown) {
        const deltaX = event.clientX - dragStartX;
        if (!dragged && Math.abs(deltaX) > 4) {
          dragged = true;
        }

        if (dragged) {
          updateContainerLeft(originLeft + deltaX);
        }
      }

      if (!isStrictHit) return;
      focusPointer(point);
    });

    hitArea.addEventListener('pointerdown', (event) => {
      const point = getCanvasPointerPosition(event, canvas);
      if (!isModelMeshHit(model, point.x, point.y)) {
        pointerStartedOnModel = false;
        hitArea.style.cursor = 'default';
        return;
      }

      pointerDown = true;
      pointerStartedOnModel = true;
      dragged = false;
      dragStartX = event.clientX;
      originLeft = parseFloat(container.style.left) || 0;
      hitArea.style.cursor = 'grabbing';
      scheduleIdleReaction();
      event.preventDefault();

      if (hitArea.setPointerCapture) {
        hitArea.setPointerCapture(event.pointerId);
      }
    });

    hitArea.addEventListener('pointerup', (event) => {
      finishPointer(event, true);
    });

    hitArea.addEventListener('pointercancel', (event) => {
      finishPointer(event, false);
    });

    hitArea.addEventListener('pointerleave', () => {
      if (!pointerDown) {
        hitArea.style.cursor = 'default';
      }
    });

    hitArea.addEventListener('lostpointercapture', () => {
      pointerDown = false;
      pointerStartedOnModel = false;
      hitArea.style.cursor = 'default';
    });

    window.addEventListener('beforeunload', () => {
      window.cancelAnimationFrame(interactionRegionFrame);
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
      const hadStrictHit = pointerStartedOnModel;
      pointerDown = false;
      pointerStartedOnModel = false;
      dragged = false;
      hitArea.style.cursor = 'default';

      if (hitArea.releasePointerCapture && hitArea.hasPointerCapture && hitArea.hasPointerCapture(event.pointerId)) {
        hitArea.releasePointerCapture(event.pointerId);
      }

      if (!shouldTap || wasDragged || !hadStrictHit) return;

      const point = getCanvasPointerPosition(event, canvas);
      if (!isModelMeshHit(model, point.x, point.y)) return;

      if (typeof model.tap === 'function') {
        model.tap(point.x, point.y);
      }

      // Every Nth tap plays voice; the other taps only show a matching text/emotion pair.
      tapCount += 1;

      if (tapCount % widgetConfig.tapVoiceEvery === 0) {
        triggerReaction('tap', { withVoice: true, textMode: 'neutral' });
        return;
      }

      triggerReaction('tap');
    }

    function focusPointer(point) {
      if (typeof model.focus !== 'function') return;
      model.focus(point.x, point.y);
    }

    function updateContainerLeft(nextLeft) {
      const clampedLeft = clamp(nextLeft, -container.offsetWidth * 0.35, window.innerWidth - container.offsetWidth * 0.65);
      container.style.left = clampedLeft + 'px';
      saveWidgetState({ left: clampedLeft });
    }

    function syncInteractionRegion(frameTime) {
      if (!container.isConnected) return;
      if (!lastInteractionRegionSyncAt || frameTime - lastInteractionRegionSyncAt >= HIT_AREA_SYNC_INTERVAL_MS) {
        updateInteractionRegion(model, view);
        lastInteractionRegionSyncAt = frameTime;
      }
      interactionRegionFrame = window.requestAnimationFrame(syncInteractionRegion);
    }

    function triggerReaction(type, options) {
      const profile = getDayPeriodProfile();
      const tune = Object.assign({ withVoice: false, textMode: 'default', bubbleText: '' }, options || {});
      // Pick one emotion first, then drive both text and expression from it.
      const emotion = tune.emotion || pickReactionEmotion(profile, type);
      const reactionText = tune.bubbleText || (
        tune.textMode === 'default'
          ? pickReactionMessage(type, profile, widgetConfig, emotion)
          : ''
      );
      playMotion(pickMotionEntry(animationCatalog, type));
      playExpression(profile, type, emotion);
      if (tune.withVoice) {
        playVoice(pickVoiceEntry(animationCatalog));
      }
      if (reactionText) {
        showBubble(reactionText);
      } else if (tune.textMode === 'default') {
        showBubble(pickReactionMessage(type, profile, widgetConfig, emotion));
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
        const emotion = pickReactionEmotion(profile, 'greeting');
        playMotion(pickMotionEntry(animationCatalog, 'greeting'));
        playExpression(profile, 'greeting', emotion);
        showBubble(pickReactionMessage('greeting', profile, widgetConfig, emotion));
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

    function playExpression(profile, type, emotion) {
      if (typeof model.expression !== 'function' || animationCatalog.expressionCount <= 0) return;
      // Expressions are chosen through our inferred emotion -> expression index mapping.
      const expressionIndex = pickExpressionIndex(animationCatalog.expressionCount, emotion, profile.key, type);
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

  function updateInteractionRegion(model, view) {
    const hitArea = view && view.hitArea;
    if (!hitArea) return;

    const bounds = getModelCanvasMeshBounds(model);
    if (!bounds) {
      hitArea.style.display = 'none';
      return;
    }

    const containerWidth = view.container.clientWidth || view.size.width || 0;
    const containerHeight = view.container.clientHeight || view.size.height || 0;
    const paddedBounds = padRect(bounds, HIT_AREA_PADDING_PX, containerWidth, containerHeight);
    if (paddedBounds.width <= 0 || paddedBounds.height <= 0) {
      hitArea.style.display = 'none';
      return;
    }

    Object.assign(hitArea.style, {
      display: 'block',
      left: paddedBounds.x + 'px',
      top: paddedBounds.y + 'px',
      width: paddedBounds.width + 'px',
      height: paddedBounds.height + 'px'
    });
  }

  function getCanvasPointerPosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function getModelCanvasMeshBounds(model) {
    const localBounds = getModelLocalMeshBounds(model);
    if (!localBounds) return null;

    const scaleX = Number(model && model.scale ? model.scale.x : 0);
    const scaleY = Number(model && model.scale ? model.scale.y : 0);
    if (!scaleX || !scaleY) return null;

    return {
      x: model.x + localBounds.x * scaleX,
      y: model.y + localBounds.y * scaleY,
      width: localBounds.width * scaleX,
      height: localBounds.height * scaleY
    };
  }

  function getModelLocalMeshBounds(model) {
    const internalModel = model && model.internalModel;
    const coreModel = internalModel && internalModel.coreModel;
    if (!internalModel || !coreModel || typeof coreModel.getDrawableCount !== 'function' || typeof internalModel.getDrawableVertices !== 'function') {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const drawableCount = coreModel.getDrawableCount();

    for (let index = 0; index < drawableCount; index += 1) {
      if (!isDrawableInteractive(coreModel, index)) continue;

      const vertices = internalModel.getDrawableVertices(index);
      if (!vertices || vertices.length < 6) continue;

      for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 2) {
        const x = vertices[vertexIndex];
        const y = vertices[vertexIndex + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function isModelMeshHit(model, canvasX, canvasY) {
    const localPoint = toModelLocalPoint(model, canvasX, canvasY);
    if (!localPoint) return false;

    const internalModel = model && model.internalModel;
    const coreModel = internalModel && internalModel.coreModel;
    if (!internalModel || !coreModel || typeof coreModel.getDrawableCount !== 'function' || typeof internalModel.getDrawableVertices !== 'function') {
      return false;
    }

    const drawableCount = coreModel.getDrawableCount();
    for (let index = 0; index < drawableCount; index += 1) {
      if (!isDrawableInteractive(coreModel, index)) continue;

      const vertices = internalModel.getDrawableVertices(index);
      if (!vertices || vertices.length < 6 || !isPointInVertexBounds(localPoint.x, localPoint.y, vertices)) {
        continue;
      }

      const vertexIndices = typeof coreModel.getDrawableVertexIndices === 'function'
        ? coreModel.getDrawableVertexIndices(index)
        : null;

      if (vertexIndices && vertexIndices.length >= 3) {
        for (let triangleIndex = 0; triangleIndex < vertexIndices.length; triangleIndex += 3) {
          const a = vertexIndices[triangleIndex] * 2;
          const b = vertexIndices[triangleIndex + 1] * 2;
          const c = vertexIndices[triangleIndex + 2] * 2;
          if (
            isPointInTriangle(
              localPoint.x,
              localPoint.y,
              vertices[a], vertices[a + 1],
              vertices[b], vertices[b + 1],
              vertices[c], vertices[c + 1]
            )
          ) {
            return true;
          }
        }
        continue;
      }

      for (let vertexIndex = 4; vertexIndex < vertices.length; vertexIndex += 2) {
        if (
          isPointInTriangle(
            localPoint.x,
            localPoint.y,
            vertices[0], vertices[1],
            vertices[vertexIndex - 2], vertices[vertexIndex - 1],
            vertices[vertexIndex], vertices[vertexIndex + 1]
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function toModelLocalPoint(model, canvasX, canvasY) {
    const scaleX = Number(model && model.scale ? model.scale.x : 0);
    const scaleY = Number(model && model.scale ? model.scale.y : 0);
    if (!scaleX || !scaleY) return null;

    return {
      x: (canvasX - model.x) / scaleX,
      y: (canvasY - model.y) / scaleY
    };
  }

  function isDrawableInteractive(coreModel, index) {
    if (!coreModel) return false;
    if (typeof coreModel.getDrawableOpacity === 'function' && coreModel.getDrawableOpacity(index) <= HIT_AREA_MIN_OPACITY) {
      return false;
    }
    if (typeof coreModel.getDrawableTextureIndices === 'function' && coreModel.getDrawableTextureIndices(index) < 0) {
      return false;
    }
    if (typeof coreModel.getDrawableVertexCount === 'function' && coreModel.getDrawableVertexCount(index) < 3) {
      return false;
    }
    return true;
  }

  function isPointInVertexBounds(x, y, vertices) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < vertices.length; index += 2) {
      minX = Math.min(minX, vertices[index]);
      minY = Math.min(minY, vertices[index + 1]);
      maxX = Math.max(maxX, vertices[index]);
      maxY = Math.max(maxY, vertices[index + 1]);
    }

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  function isPointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const ab = crossProduct(px, py, ax, ay, bx, by);
    const bc = crossProduct(px, py, bx, by, cx, cy);
    const ca = crossProduct(px, py, cx, cy, ax, ay);
    const hasNegative = ab < 0 || bc < 0 || ca < 0;
    const hasPositive = ab > 0 || bc > 0 || ca > 0;
    return !(hasNegative && hasPositive);
  }

  function crossProduct(px, py, ax, ay, bx, by) {
    return (px - bx) * (ay - by) - (ax - bx) * (py - by);
  }

  function padRect(bounds, padding, maxWidth, maxHeight) {
    const safeMaxWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : bounds.x + bounds.width + padding;
    const safeMaxHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : bounds.y + bounds.height + padding;
    const left = clamp(bounds.x - padding, 0, safeMaxWidth);
    const top = clamp(bounds.y - padding, 0, safeMaxHeight);
    const right = clamp(bounds.x + bounds.width + padding, 0, safeMaxWidth);
    const bottom = clamp(bounds.y + bounds.height + padding, 0, safeMaxHeight);

    return {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

  // ---- Model assets -------------------------------------------------------
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

  // ---- Persisted widget state --------------------------------------------
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

  // ---- Runtime config & reaction selection -------------------------------
  function getDayPeriodProfile() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return Object.assign({ key: 'morning' }, DAY_PERIOD_PROFILES.morning);
    if (hour >= 11 && hour < 17) return Object.assign({ key: 'daytime' }, DAY_PERIOD_PROFILES.daytime);
    if (hour >= 17 && hour < 22) return Object.assign({ key: 'evening' }, DAY_PERIOD_PROFILES.evening);
    return Object.assign({ key: 'night' }, DAY_PERIOD_PROFILES.night);
  }

  function getLive2DWidgetConfig() {
    const rawConfig = (
      window.SAVERM_UI_CONFIG?.live2d_widget ||
      window.KEEP?.theme_config?.live2d_widget ||
      {}
    );
    const tapVoiceEvery = Math.max(
      1,
      Math.floor(Number(rawConfig.tap_voice_every) || DEFAULT_WIDGET_CONFIG.tapVoiceEvery)
    );
    const tapTextPool = normalizeMessagePool(Array.isArray(rawConfig.tap_text_pool) ? rawConfig.tap_text_pool : []);
    const tapTextPoolByEmotion = normalizeMessagePoolMap(rawConfig.tap_text_pool);

    return {
      tapVoiceEvery,
      tapTextPool: tapTextPool.length ? tapTextPool : DEFAULT_WIDGET_CONFIG.tapTextPool.slice(),
      tapTextPoolByEmotion: hasMessagePoolMap(tapTextPoolByEmotion)
        ? tapTextPoolByEmotion
        : cloneMessagePoolMap(DEFAULT_WIDGET_CONFIG.tapTextPoolByEmotion)
    };
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

  function pickExpressionIndex(expressionCount, emotion, periodKey, type) {
    if (!expressionCount) return null;
    const fallbackPool = [];
    for (let index = 0; index < expressionCount; index += 1) {
      fallbackPool.push(index);
    }
    // Prefer the explicit emotion mapping; fall back to the old time-of-day pool
    // so the widget still works even if a new emotion label has no mapping yet.
    const emotionPool = (EXPRESSION_POOLS_BY_EMOTION[emotion] || [])
      .filter((index) => index >= 0 && index < expressionCount);
    const scopedPool = (emotionPool.length
      ? emotionPool
      : (((LEGACY_EXPRESSION_POOLS[periodKey] || {})[type]) || fallbackPool))
      .filter((index) => index >= 0 && index < expressionCount);
    const source = scopedPool.length ? scopedPool : fallbackPool;
    return source[Math.floor(Math.random() * source.length)] || 0;
  }

  function pickMessage(messages) {
    if (!Array.isArray(messages) || !messages.length) return '';
    return messages[Math.floor(Math.random() * messages.length)];
  }

  function pickReactionEmotion(profile, type) {
    const source = profile && profile.emotions ? profile.emotions[type] : [];
    return pickRandomItem(Array.isArray(source) && source.length ? source : ['gentle']) || 'gentle';
  }

  function pickReactionMessage(type, profile, widgetConfig, emotion) {
    if (type === 'tap') {
      const configuredByEmotion = widgetConfig && widgetConfig.tapTextPoolByEmotion
        ? widgetConfig.tapTextPoolByEmotion
        : {};
      const configuredDirect = widgetConfig && Array.isArray(widgetConfig.tapTextPool)
        ? widgetConfig.tapTextPool
        : [];
      // Tap text can be configured by emotion in ui.yml; that config overrides
      // the built-in period-based defaults.
      const directConfiguredPool = normalizeMessagePool(configuredByEmotion[emotion]);
      if (directConfiguredPool.length) return pickMessage(directConfiguredPool);
      if (configuredDirect.length) return pickMessage(configuredDirect);
    }

    const messageSource = profile && profile.messages ? profile.messages[type] : [];
    if (Array.isArray(messageSource)) {
      return pickMessage(messageSource);
    }

    return pickMessageFromMap(messageSource, emotion);
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

  // ---- Config normalization helpers --------------------------------------
  function normalizeMessagePool(pool) {
    if (!Array.isArray(pool)) return [];

    return pool
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean);
  }

  function normalizeMessagePoolMap(poolMap) {
    if (!poolMap || Array.isArray(poolMap) || typeof poolMap !== 'object') return {};

    const result = {};
    Object.keys(poolMap).forEach((key) => {
      const normalizedPool = normalizeMessagePool(poolMap[key]);
      if (normalizedPool.length) {
        result[key] = normalizedPool;
      }
    });
    return result;
  }

  function pickMessageFromMap(poolMap, emotion) {
    if (!poolMap || typeof poolMap !== 'object') return '';
    const directPool = normalizeMessagePool(poolMap[emotion]);
    if (directPool.length) {
      return pickMessage(directPool);
    }

    const mergedPool = flattenMessagePoolMap(poolMap);
    return pickMessage(mergedPool);
  }

  function flattenMessagePoolMap(poolMap) {
    if (!poolMap || typeof poolMap !== 'object') return [];

    const mergedPool = [];
    Object.keys(poolMap).forEach((key) => {
      const normalizedPool = normalizeMessagePool(poolMap[key]);
      normalizedPool.forEach((message) => mergedPool.push(message));
    });
    return mergedPool;
  }

  function hasMessagePoolMap(poolMap) {
    return flattenMessagePoolMap(poolMap).length > 0;
  }

  function cloneMessagePoolMap(poolMap) {
    const clone = {};
    Object.keys(poolMap || {}).forEach((key) => {
      clone[key] = normalizeMessagePool(poolMap[key]);
    });
    return clone;
  }

  function pickRandomItem(items) {
    if (!Array.isArray(items) || !items.length) return null;
    return items[Math.floor(Math.random() * items.length)] || null;
  }
})();
