(function () {
  if (window.__savermMathJaxBound) return
  window.__savermMathJaxBound = true

  const SELECTORS = ['.post-content', '.article-content', '.page-container']

  function collectTargets() {
    const targets = SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    return targets.length ? targets : [document.body]
  }

  function typesetWhenReady(retries = 40) {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      const targets = collectTargets()
      if (typeof window.MathJax.typesetClear === 'function') {
        window.MathJax.typesetClear(targets)
      }
      window.MathJax.typesetPromise(targets).catch((error) => {
        console.error('MathJax render failed:', error)
      })
      return
    }

    if (retries > 0) {
      window.setTimeout(() => typesetWhenReady(retries - 1), 250)
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    typesetWhenReady()
  })

  document.addEventListener('pjax:complete', () => {
    typesetWhenReady()
  })
})()
