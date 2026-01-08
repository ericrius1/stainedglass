import { castleParams, regenerateCastle } from "../scene/castleGenerator.js"
import { getWindowMaterials } from "../materials/glassMaterialFactory.js"

let onRegenerateCallback = null

// Set the callback for regeneration
export function setRegenerateCallback(callback) {
  onRegenerateCallback = callback
}

// Trigger castle regeneration
function triggerRegenerate() {
  if (onRegenerateCallback) {
    onRegenerateCallback()
  } else {
    regenerateCastle(getWindowMaterials())
  }
}

// Setup castle controls in tweakpane
export function setupCastlePane(pane) {
  const castleFolder = pane.addFolder({ title: "Castle Generator", expanded: true })

  // Seed for reproducible random generation
  castleFolder
    .addBinding(castleParams, "seed", {
      min: 0,
      max: 99999,
      step: 1,
      label: "Seed"
    })
    .on("change", triggerRegenerate)

  // Button to randomize seed
  castleFolder
    .addButton({ title: "Randomize" })
    .on("click", () => {
      castleParams.seed = Math.floor(Math.random() * 100000)
      pane.refresh()
      triggerRegenerate()
    })

  // Structure subfolder
  const structureFolder = castleFolder.addFolder({ title: "Structure", expanded: false })

  structureFolder
    .addBinding(castleParams, "towerCount", {
      min: 3,
      max: 8,
      step: 1,
      label: "Tower Count"
    })
    .on("change", triggerRegenerate)

  structureFolder
    .addBinding(castleParams, "baseRadius", {
      min: 0.4,
      max: 2.0,
      step: 0.05,
      label: "Base Radius"
    })
    .on("change", triggerRegenerate)

  // Towers subfolder
  const towersFolder = castleFolder.addFolder({ title: "Towers", expanded: false })

  towersFolder
    .addBinding(castleParams, "towerRadius", {
      min: 0.05,
      max: 0.4,
      step: 0.01,
      label: "Radius"
    })
    .on("change", triggerRegenerate)

  towersFolder
    .addBinding(castleParams, "towerHeight", {
      min: 0.5,
      max: 2.5,
      step: 0.05,
      label: "Height"
    })
    .on("change", triggerRegenerate)

  // Walls subfolder
  const wallsFolder = castleFolder.addFolder({ title: "Walls", expanded: false })

  wallsFolder
    .addBinding(castleParams, "wallHeight", {
      min: 0.2,
      max: 1.5,
      step: 0.05,
      label: "Height"
    })
    .on("change", triggerRegenerate)

  wallsFolder
    .addBinding(castleParams, "wallThickness", {
      min: 0.02,
      max: 0.2,
      step: 0.01,
      label: "Thickness"
    })
    .on("change", triggerRegenerate)

  wallsFolder
    .addBinding(castleParams, "crenelationHeight", {
      min: 0.02,
      max: 0.3,
      step: 0.01,
      label: "Crenel Height"
    })
    .on("change", triggerRegenerate)

  wallsFolder
    .addBinding(castleParams, "crenelationCount", {
      min: 4,
      max: 16,
      step: 1,
      label: "Crenel Count"
    })
    .on("change", triggerRegenerate)

  // Windows subfolder
  const windowsFolder = castleFolder.addFolder({ title: "Windows", expanded: false })

  windowsFolder
    .addBinding(castleParams, "windowWidth", {
      min: 0.1,
      max: 0.6,
      step: 0.02,
      label: "Width"
    })
    .on("change", triggerRegenerate)

  windowsFolder
    .addBinding(castleParams, "windowHeight", {
      min: 0.15,
      max: 0.8,
      step: 0.02,
      label: "Height"
    })
    .on("change", triggerRegenerate)

  return castleFolder
}
