import Stats from "three/examples/jsm/libs/stats.module.js"

let stats = null

// Create stats panel in upper left corner
export function createStats() {
  stats = new Stats()
  stats.dom.style.position = "absolute"
  stats.dom.style.top = "0px"
  stats.dom.style.left = "0px"
  document.body.appendChild(stats.dom)
  return stats
}

export function updateStats() {
  if (stats) {
    stats.update()
  }
}

export function getStats() {
  return stats
}

export function setStatsVisible(visible) {
  if (stats) {
    stats.dom.style.display = visible ? "block" : "none"
  }
}
