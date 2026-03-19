/* global document, window */

(function () {
  function getAboutConfig() {
    const about = window.SAVERM_UI_CONFIG?.about || {}
    const egg = about.easter_egg || {}

    return {
      profile: {
        name: about.name || "Saverm",
        avatar: about.avatar || "/images/avatar.jpg",
        bio: about.bio || "",
        intro: about.intro || "这里还没有填写简介。",
        skills: Array.isArray(about.skills) ? about.skills : [],
        recentDoings: Array.isArray(about.recent_doings) ? about.recent_doings : [],
        profileLinks: Array.isArray(about.profile_links) ? about.profile_links : []
      },
      egg: {
        enable: egg.enable !== false,
        clickThreshold: egg.click_threshold || 5,
        triggerText: egg.trigger_text || "",
        newBioText: egg.witch_bio || "Hexe",
        newNameText: egg.witch_name || "OktaviavonSeckendorff",
        themeColor: egg.theme_color || "#e74c3c",
        newAvatarPath: egg.witch_avatar || "/images/avatar_witch.png",
        fadeDuration: egg.fade_duration || 200,
        bgmPath: egg.bgm || "/audio/majo_bgm.m4a",
        voicePath: egg.voice || "/audio/sayaka_baka.mp3",
        bgmVolume: egg.bgm_volume ?? 0.2,
        voiceVolume: egg.voice_volume ?? 0.8,
        typewriterText: egg.overlay_text || "我，真是个笨蛋",
        typeRhythm:
          Array.isArray(egg.type_rhythm) && egg.type_rhythm.length
            ? egg.type_rhythm
            : [800, 1200, 250, 250, 550, 250, 250],
        shatterDelay: egg.shatter_delay || 2000,
        shatterDistance: egg.shatter_distance || 150
      }
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("Failed to load image: " + src))
      image.src = src
    })
  }

  function preloadAudio(src, options) {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const tune = Object.assign({ loop: false, volume: 1 }, options || {})

      function cleanup() {
        audio.removeEventListener("canplaythrough", handleReady)
        audio.removeEventListener("error", handleError)
      }

      function handleReady() {
        cleanup()
        resolve(audio)
      }

      function handleError() {
        cleanup()
        reject(new Error("Failed to load audio: " + src))
      }

      audio.preload = "auto"
      audio.loop = tune.loop
      audio.volume = tune.volume
      audio.addEventListener("canplaythrough", handleReady)
      audio.addEventListener("error", handleError)
      audio.src = src
      audio.load()

      if (audio.readyState >= 4) {
        handleReady()
      }
    })
  }

  function preloadWitchFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") {
      return Promise.resolve()
    }

    return Promise.all([
      document.fonts.load("1em WitchRunes"),
      document.fonts.load("700 1em Songti SC")
    ])
  }

  function renderAboutProfile(profile, egg) {
    const avatarImg = document.getElementById("about-avatar")
    const nameLabel = document.getElementById("about-name")
    const bioLabel = document.getElementById("about-bio")
    const introLabel = document.getElementById("about-intro")
    const linksContainer = document.getElementById("about-links")
    const skillsContainer = document.getElementById("about-skills")
    const recentContainer = document.getElementById("about-recent")
    const prefetch = document.querySelector(".about-page__prefetch")

    if (avatarImg) {
      avatarImg.src = profile.avatar
      avatarImg.alt = profile.name
    }

    if (nameLabel) {
      nameLabel.textContent = profile.name
    }

    if (prefetch) {
      prefetch.textContent = (egg.newBioText || "Hexe") + " " + (egg.newNameText || "OktaviavonSeckendorff")
    }

    if (bioLabel) {
      const triggerText = egg.enable ? egg.triggerText : ""
      const triggerIndex = triggerText ? profile.bio.indexOf(triggerText) : -1
      const bioPrefix = triggerIndex >= 0 ? profile.bio.slice(0, triggerIndex) : profile.bio
      const bioHighlight = triggerIndex >= 0 ? triggerText : ""
      const bioSuffix =
        triggerIndex >= 0 ? profile.bio.slice(triggerIndex + triggerText.length) : ""

      bioLabel.textContent = ""
      bioLabel.appendChild(document.createTextNode(bioPrefix))

      if (bioHighlight) {
        const trigger = document.createElement("span")
        trigger.id = "easter-egg-btn"
        trigger.className = "about-bio-trigger"
        trigger.textContent = bioHighlight
        bioLabel.appendChild(trigger)
      }

      bioLabel.appendChild(document.createTextNode(bioSuffix))
    }

    if (introLabel) {
      introLabel.textContent = profile.intro
    }

    if (linksContainer) {
      linksContainer.innerHTML = ""
      profile.profileLinks.forEach((link) => {
        const href = link && link.url ? link.url : "#"
        const hoverText = href.startsWith("mailto:") ? href.replace(/^mailto:/, "") : href
        const anchor = document.createElement("a")
        const label = document.createElement("span")
        const icon = document.createElement("i")

        anchor.className = "about-btn"
        anchor.href = href
        anchor.dataset.hoverDetail = hoverText
        anchor.title = hoverText
        anchor.setAttribute("aria-label", hoverText)
        if (/^https?:\/\//.test(href)) {
          anchor.target = "_blank"
          anchor.rel = "noopener noreferrer"
        }

        label.textContent = link && link.name ? link.name : "Link"
        icon.className = "fas fa-external-link-alt about-btn-icon"
        icon.setAttribute("aria-hidden", "true")

        anchor.appendChild(label)
        anchor.appendChild(icon)
        linksContainer.appendChild(anchor)
      })
    }

    if (skillsContainer) {
      skillsContainer.innerHTML = ""
      const skills = profile.skills.length ? profile.skills : ["待补充"]
      skills.forEach((skill) => {
        const tag = document.createElement("span")
        tag.className = "about-tag"
        tag.textContent = skill
        skillsContainer.appendChild(tag)
      })
    }

    if (recentContainer) {
      recentContainer.innerHTML = ""
      const items = profile.recentDoings.length ? profile.recentDoings : ["暂无动态"]
      items.forEach((item) => {
        const li = document.createElement("li")
        li.textContent = item
        recentContainer.appendChild(li)
      })
    }
  }

  function initAboutPage() {
    const pageRoot = document.querySelector(".about-page")
    if (!pageRoot) {
      return
    }

    const aboutConfig = getAboutConfig()
    const profile = aboutConfig.profile
    const config = aboutConfig.egg

    renderAboutProfile(profile, config)

    const elements = {
      pageRoot,
      triggerBtn: document.getElementById("easter-egg-btn"),
      nameLabel: document.getElementById("about-name"),
      bioLabel: document.getElementById("about-bio"),
      avatarImg: document.getElementById("about-avatar"),
      overlay: document.getElementById("typewriter-overlay"),
      textContainer: document.getElementById("typewriter-text")
    }

    if (
      !elements.triggerBtn ||
      !elements.nameLabel ||
      !elements.bioLabel ||
      !elements.avatarImg ||
      !elements.overlay ||
      !elements.textContainer
    ) {
      return
    }

    if (elements.overlay.parentElement !== document.body) {
      document.body.appendChild(elements.overlay)
    }

    let clickCount = 0
    let isEggActivating = false
    let isEvilModeActive = false
    let preloadedAssetsPromise = null
    let bgmInstance = null
    let voiceInstance = null

    elements.triggerBtn.addEventListener("click", handleEggClick)

    function handleEggClick() {
      if (isEggActivating || isEvilModeActive || clickCount >= config.clickThreshold) {
        return
      }

      clickCount += 1
      if (clickCount === config.clickThreshold) {
        triggerEvilMode()
      }
    }

    async function triggerEvilMode() {
      if (isEggActivating || isEvilModeActive) {
        return
      }

      isEggActivating = true
      elements.triggerBtn.classList.add("is-loading")

      let assets
      try {
        assets = await prepareEvilModeAssets()
      } catch (error) {
        console.warn("[About Page] Failed to preload easter egg assets:", error)
        isEggActivating = false
        clickCount = Math.max(0, config.clickThreshold - 1)
        elements.triggerBtn.classList.remove("is-loading")
        return
      }

      elements.pageRoot.classList.add("about-evil-mode")
      elements.nameLabel.textContent = config.newNameText
      elements.nameLabel.classList.add("witch-mode-text")
      elements.bioLabel.textContent = config.newBioText
      elements.bioLabel.classList.add("witch-mode-text")
      document.documentElement.style.setProperty("--about-primary-color", config.themeColor)

      await fadeAvatar(assets.avatarImage)
      playAudio(assets)

      isEggActivating = false
      isEvilModeActive = true
      elements.triggerBtn.classList.remove("is-loading")

      startTypewriterEffect()
    }

    function prepareEvilModeAssets() {
      if (preloadedAssetsPromise) {
        return preloadedAssetsPromise
      }

      preloadedAssetsPromise = Promise.all([
        preloadImage(config.newAvatarPath),
        preloadAudio(config.bgmPath, {
          volume: config.bgmVolume,
          loop: true
        }),
        preloadAudio(config.voicePath, {
          volume: config.voiceVolume,
          loop: false
        }),
        preloadWitchFonts()
      ])
        .then(([avatarImage, bgmAudio, voiceAudio]) => ({
          avatarImage,
          bgmAudio,
          voiceAudio
        }))
        .catch((error) => {
          preloadedAssetsPromise = null
          throw error
        })

      return preloadedAssetsPromise
    }

    function fadeAvatar(avatarImage) {
      return new Promise((resolve) => {
        elements.avatarImg.style.opacity = "0"
        window.setTimeout(() => {
          elements.avatarImg.src =
            avatarImage && avatarImage.src ? avatarImage.src : config.newAvatarPath
          window.requestAnimationFrame(() => {
            elements.avatarImg.style.opacity = "1"
            resolve()
          })
        }, config.fadeDuration)
      })
    }

    function playAudio(assets) {
      if (bgmInstance) {
        bgmInstance.pause()
      }
      if (voiceInstance) {
        voiceInstance.pause()
      }

      bgmInstance = assets.bgmAudio
      voiceInstance = assets.voiceAudio
      bgmInstance.currentTime = 0
      voiceInstance.currentTime = 0

      Promise.allSettled([bgmInstance.play(), voiceInstance.play()]).catch(() => {})
    }

    async function startTypewriterEffect() {
      const text = config.typewriterText || ""
      const rhythm = Array.isArray(config.typeRhythm) ? config.typeRhythm : []

      elements.textContainer.style.opacity = "1"
      elements.textContainer.innerHTML = ""

      for (let index = 0; index < text.length; index += 1) {
        elements.textContainer.innerHTML =
          text.slice(0, index + 1) + '<span class="cursor-blink"></span>'
        await sleep(rhythm[index] || 500)
      }

      elements.textContainer.textContent = text
      await sleep(config.shatterDelay || 2000)
      shatterText(text)
    }

    function shatterText(text) {
      const chars = text.split("")
      elements.textContainer.innerHTML = chars
        .map((char) => '<span class="char-shard">' + char + "</span>")
        .join("")

      elements.textContainer.querySelectorAll(".char-shard").forEach((shard) => {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * (config.shatterDistance || 150)
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const rotate = (Math.random() - 0.5) * 720

        window.requestAnimationFrame(() => {
          shard.style.transform = "translate(" + x + "px, " + y + "px) rotate(" + rotate + "deg)"
          shard.style.opacity = "0"
          shard.style.filter = "blur(4px)"
        })
      })
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAboutPage, { once: true })
  } else {
    initAboutPage()
  }
})()
