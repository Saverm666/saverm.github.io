;(function () {
  function updateTooltip(item, text) {
    if (!item || !text) {
      return
    }

    item.dataset.tooltipContent = text
    item.setAttribute('title', text)
    item.setAttribute('aria-label', text)

    const anchor = item.querySelector('a')
    if (anchor) {
      anchor.setAttribute('title', text)
      anchor.setAttribute('aria-label', text)
    }

    const tooltipContent = item.querySelector('.tooltip-content')
    if (tooltipContent) {
      tooltipContent.textContent = text
    }
  }

  function enhanceHomeSocialTooltips() {
    if (!document.querySelector('.page-main-content.is-home')) {
      return
    }

    document
      .querySelectorAll('.first-screen-content .sc-icon-list .sc-icon-item')
      .forEach((item) => {
        const anchor = item.querySelector('a')
        const href = anchor?.getAttribute('href') || ''

        if (!href) {
          return
        }

        if (href.startsWith('mailto:')) {
          updateTooltip(item, href.replace(/^mailto:/, ''))
          return
        }

        if (href.includes('github.com/')) {
          updateTooltip(item, href)
        }
      })
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', enhanceHomeSocialTooltips)
  } else {
    enhanceHomeSocialTooltips()
  }
})()
