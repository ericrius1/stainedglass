import { UI_VISIBLE_ON_START } from "../config.js"
import { setStatsVisible } from "./stats.js"

let uiVisible = UI_VISIBLE_ON_START
let pane = null

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
}

export function isUIVisible() {
  return uiVisible
}
