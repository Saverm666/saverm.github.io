/* global KEEP */

(function () {
  function getQuoteLines(value) {
    if (typeof value !== 'string') {
      return []
    }

    return value
      .split('||')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
  }

  function pickRandomQuote(pool) {
    if (!Array.isArray(pool) || !pool.length) {
      return []
    }

    const normalizedPool = pool
      .map(getQuoteLines)
      .filter((lines) => lines.length > 0)

    if (!normalizedPool.length) {
      return []
    }

    return normalizedPool[Math.floor(Math.random() * normalizedPool.length)]
  }

  function typeLine(descItem, text, delay) {
    const desc = descItem.querySelector('.desc')
    const cursor = descItem.querySelector('.cursor')

    if (!desc || !cursor) {
      return
    }

    desc.textContent = ''

    let charIndex = 0

    const step = () => {
      if (charIndex < text.length) {
        desc.textContent += text.charAt(charIndex)
        charIndex += 1
        window.setTimeout(step, delay)
      } else {
        cursor.style.display = 'none'
      }
    }

    step()
  }

  function renderRandomQuote() {
    const quoteConfig = KEEP.theme_config?.home_random_quote || {}
    const firstScreenConfig = KEEP.theme_config?.first_screen || {}

    if (quoteConfig.enable !== true || firstScreenConfig.enable !== true) {
      return
    }

    if (!document.querySelector('.page-main-content.is-home')) {
      return
    }

    const descBox = document.querySelector('.first-screen-content .description')
    if (!descBox) {
      return
    }

    const lines = pickRandomQuote(quoteConfig.pool)
    if (!lines.length) {
      return
    }

    descBox.innerHTML = ''
    descBox.style.opacity = '0'

    lines.forEach((line) => {
      const item = document.createElement('div')
      const desc = document.createElement('span')
      const cursor = document.createElement('span')

      item.className = 'desc-item border-box'
      desc.className = 'desc'
      cursor.className = 'cursor'
      cursor.textContent = '｜'
      desc.dataset.text = line

      item.appendChild(desc)
      item.appendChild(cursor)
      descBox.appendChild(item)
    })

    window.setTimeout(() => {
      descBox.style.opacity = '1'
      descBox.querySelectorAll('.desc-item').forEach((item) => {
        const text = item.querySelector('.desc')?.dataset.text || ''
        if (text) {
          typeLine(item, text, 100)
        }
      })
    }, 300)
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', renderRandomQuote)
  } else {
    renderRandomQuote()
  }
})()
