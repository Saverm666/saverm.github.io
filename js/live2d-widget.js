// 动态加载 Live2D 看板娘脚本 (Cubism 4 支持版)
(function() {
  if (window.innerWidth >= 768) {
    console.log('[Live2D] Initializing...');

    // 改用本地路径加载模型，彻底避免 CDN 网络问题
    // 注意：Hexo 会将 source 目录下的文件夹原样发布到根目录
    const modelName = '美树沙耶香(バレンタイン18)';
    const modelPath = `/${encodeURIComponent(modelName)}/${encodeURIComponent(modelName)}.model3.json`;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`[Live2D] Loaded: ${src}`);
            resolve();
        };
        script.onerror = (e) => {
            console.error(`[Live2D] Failed to load: ${src}`, e);
            reject(e);
        };
        document.head.appendChild(script);
      });
    };

    // 1. 加载 Cubism 4 Core SDK (必须!)
    loadScript('/js/live2dcubismcore.min.js?v=1.0.1')
      .then(() => {
          // 核心修正：确保 Cubism 4 Core 挂载到全局，供插件识别
          if (window.Live2DCubismCore) {
              console.log('[Live2D] Cubism 4 Core detected.');
          }
      })
      // 2. 加载 PixiJS
      .then(() => loadScript('/js/pixi.min.js?v=6.5.2'))
      // 3. 加载 Pixi Live2D Display (Cubism 4 专用版)
      .then(() => loadScript('/js/pixi-live2d-display-c4.min.js?v=0.4.0'))
      .then(() => {
        console.log('[Live2D] All libraries loaded. Checking environment...');
        
        // 核心修正：手动注册 Cubism 4 核心（如果插件没有自动识别）
        if (window.PIXI && window.PIXI.live2d) {
            // 某些版本的插件需要手动指定核心库
            // window.PIXI.live2d.Live2DModel.registerTicker(window.PIXI.Ticker); // PixiJS 5/6 自动处理，可省略
            console.log('[Live2D] PIXI.live2d is ready.');
        } else {
            throw new Error('PIXI.live2d is missing. Plugin load failed.');
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        Object.assign(canvas.style, {
            position: 'fixed',
            left: '0',
            bottom: '0',
            width: '300px',
            height: '400px',
            zIndex: '99999', // 提高层级
            pointerEvents: 'none' 
        });
        document.body.appendChild(canvas);

        const app = new PIXI.Application({
          view: canvas,
          autoStart: true,
          resizeTo: canvas,
          transparent: true,
          backgroundAlpha: 0
        });

        console.log(`[Live2D] Loading model from: ${modelPath}`);

        PIXI.live2d.Live2DModel.from(modelPath).then((model) => {
          console.log('[Live2D] Model loaded successfully!');
          app.stage.addChild(model);
          
          // 适配缩放
          const scaleX = canvas.width / model.width;
          const scaleY = canvas.height / model.height;
          const scale = Math.min(scaleX, scaleY);
          
          model.scale.set(scale);
          model.x = (canvas.width - model.width * scale) / 2;
          model.y = canvas.height - model.height * scale; // 底部对齐
          
          // 启用交互
          model.interactive = true;
          // 这里的 buttonMode 在 Pixi v7+ 已弃用，但 v6 可用
          model.buttonMode = true; 
          
          model.on('pointertap', () => {
             console.log('[Live2D] Touched!');
             // 随机播放一个动作
             model.motion('TapBody'); 
          });
        }).catch(err => {
            console.error('[Live2D] Model load error:', err);
        });
      })
      .catch(err => console.error('[Live2D] Dependency load failed:', err));
  } else {
      console.log('[Live2D] Skipped on mobile device.');
  }
})();
