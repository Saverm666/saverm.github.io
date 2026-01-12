// 动态加载 Live2D 看板娘脚本
(function() {
  if (window.innerWidth >= 768) {
    // 1. 定义 CDN 基础路径 (jsDelivr)
    const repo = 'Saverm666/Live2d4Blog';
    const branch = 'master';
    const modelName = '美树沙耶香(バレンタイン18)';
    // 注意：URL 必须进行 URI 编码，特别是包含中文和括号的部分
    const modelPath = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${encodeURIComponent(modelName)}/${encodeURIComponent(modelName)}.model3.json`;

    // 2. 配置 Live2D
    // 由于 stevenjoezhang/live2d-widget 主要支持 Cubism 2，
    // 对于 Cubism 3/4 (.model3.json)，我们需要使用支持该格式的加载器。
    // 这里我们使用一个支持 Cubism 4 的轻量级加载方案 (基于 PIO 或其他兼容实现)
    
    // 为了简化集成，我们直接注入一个支持 Cubism 4 的 Live2D 挂件
    // 这里使用 guansss/pixi-live2d-display 的简易封装或类似的现代加载器
    // 鉴于现有的 live2d-widget 插件对 Cubism 3 支持有限，我们改用一种通用的加载方式：
    // 引入 Cubism 4 SDK 和 PixiJS (目前最流行的 Live2D Web 渲染方案)

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // 串行加载依赖库
    loadScript('https://cdn.jsdelivr.net/npm/pixi.js@6.5.2/dist/browser/pixi.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js'))
      .then(() => {
        // 创建画布容器
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.style.position = 'fixed';
        canvas.style.left = '0px'; // 调整位置
        canvas.style.bottom = '0px';
        canvas.style.width = '300px'; // 可调整大小
        canvas.style.height = '350px';
        canvas.style.zIndex = '999';
        canvas.style.pointerEvents = 'none'; // 让鼠标事件穿透画布（如果需要交互则设为 auto）
        document.body.appendChild(canvas);

        // 初始化 Pixi 应用
        const app = new PIXI.Application({
          view: canvas,
          autoStart: true,
          resizeTo: canvas,
          transparent: true,
          backgroundAlpha: 0
        });

        // 加载模型
        PIXI.live2d.Live2DModel.from(modelPath).then((model) => {
          app.stage.addChild(model);
          
          // 调整模型缩放和位置
          // 需要根据模型的实际大小进行微调
          const scaleX = canvas.width / model.width;
          const scaleY = canvas.height / model.height;
          // 取较小的缩放比例以适应容器
          const scale = Math.min(scaleX, scaleY) * 2; // 放大一点
          
          model.scale.set(scale);
          model.x = (canvas.width - model.width * scale) / 2; // 水平居中
          model.y = canvas.height - model.height * scale + 50; // 底部对齐，微调偏移
          
          // 启用交互 (可选)
          model.interactive = true;
          model.on('pointertap', () => {
             model.motion('TapBody'); // 播放点击动作，具体动作名需参考 model3.json
          });
        });
      })
      .catch(err => console.error('Live2D load failed:', err));
  }
})();
