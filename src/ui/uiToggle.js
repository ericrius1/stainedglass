import { UI_VISIBLE_ON_START } from "../config.js"
import { setStatsVisible } from "./stats.js"

let uiVisible = UI_VISIBLE_ON_START
let pane = null
let toggleCallbacks = []

// Initialize UI toggle with "/" key
export function initUIToggle(tweakpane) {
  pane = tweakpane

  // Set initial visibility
  setUIVisible(uiVisible)

  // Listen for "/" key
  window.addEventListener("keydown", (event) => {
    if (event.key === "/") {
      event.preventDefault()
      toggleUI()
    }
  })
}

// Register callback for UI toggle events
export function onUIToggle(callback) {
  toggleCallbacks.push(callback)
  return () => {
    toggleCallbacks = toggleCallbacks.filter(cb => cb !== callback)
  }
}

// Toggle UI visibility
export function toggleUI() {
  uiVisible = !uiVisible
  setUIVisible(uiVisible)
}

// Set UI visibility
export function setUIVisible(visible) {
  uiVisible = visible

  // Toggle stats panel
  setStatsVisible(visible)

  // Toggle tweakpane
  if (pane) {
    pane.element.style.display = visible ? "block" : "none"
  }

  // Notify callbacks
  toggleCallbacks.forEach(cb => cb(visible))
}

export function isUIVisible() {
  return uiVisible
}
