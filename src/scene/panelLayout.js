import * as THREE from "three/webgpu"

let glassPanels = []
let panelGeometry = null

// Create shared panel geometry
export function createPanelGeometry(panelWidth) {
  panelGeometry = new THREE.PlaneGeometry(panelWidth, panelWidth)
  return panelGeometry
}

// Update panel layout - creates/removes panels based on count
export function updatePanelLayout(scene, glassMaterial, params) {
  const { numPanels, panelWidth, panelGap } = params

  // Remove existing panels from scene
  glassPanels.forEach((panel) => {
    scene.remove(panel)
  })
  glassPanels = []

  // Don't create panels if count is 0
  if (numPanels === 0) return

  // Calculate layout: panels arranged in a row with gaps
  const totalWidth = numPanels * panelWidth + (numPanels - 1) * panelGap
  const startX = -totalWidth / 2 + panelWidth / 2

  for (let i = 0; i < numPanels; i++) {
    const panel = new THREE.Mesh(panelGeometry, glassMaterial)
    panel.position.set(startX + i * (panelWidth + panelGap), 1.0, 0)
    panel.rotation.x = -Math.PI / 2 // Horizontal, facing up
    panel.castShadow = true
    scene.add(panel)
    glassPanels.push(panel)
  }
}

export function getGlassPanels() {
  return glassPanels
}

export function getPanelGeometry() {
  return panelGeometry
}
