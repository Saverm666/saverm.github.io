// 动态加载 Live2D 看板娘脚本
// 使用 stevenjoezhang/live2d-widget
(function() {
  // 仅在宽屏设备（非移动端）加载，避免遮挡内容和消耗过多资源
  if (window.innerWidth >= 768) {
    var script = document.createElement('script');
    // 使用 jsDelivr 加速 CDN
    script.src = 'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js';
    script.async = true;
    
    // 配置项（如果需要自定义，可以在 autoload.js 加载前定义 live2d_settings）
    // 这里我们保持默认，它会自动处理左下角显示、拖拽等
    
    document.body.appendChild(script);
  }
})();
