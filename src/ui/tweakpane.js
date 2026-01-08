import { Pane } from "tweakpane"
import { textureSets, numTextureSets } from "../config.js"
import { setupGlassPane, glassParams, glassUniforms, getParamConfigs } from "../glassParams.js"
import { setupInstallationPane } from "../artInstallation.js"
import { swapTextureSet } from "../textures/textureManager.js"
import { updatePanelLayout } from "../scene/panelLayout.js"
import { updateFogBounds } from "../scene/fogVolume.js"
import { setupCastlePane, setRegenerateCallback } from "./castlePane.js"

let pane = null

// Create and configure tweakpane
export function createTweakpane(
  params,
  scene,
  glassMaterial,
  smokeAmountUniform,
  volumetricLightingIntensity,
  handController,
  parameterMapper,
  castleRegenerateCallback = null
) {
  pane = new Pane({ title: "Stained Glass" })

  // Enable scrolling on the pane
  pane.element.style.maxHeight = "90vh"
  pane.element.style.overflowY = "auto"

  // Build texture options from texture sets
  const textureOptions = Object.keys(textureSets).reduce((acc, key) => {
    acc[key] = key
    return acc
  }, {})

  // Texture selection - swap texture without reloading (legacy mode only)
  if (!params.useCastle) {
    pane
      .addBinding(params, "texture", { options: textureOptions })
      .on("change", async (ev) => {
        await swapTextureSet(ev.value, glassMaterial, glassParams)
      })
  }

  // Castle Generator folder (if castle mode enabled)
  if (params.useCastle && castleRegenerateCallback) {
    setRegenerateCallback(castleRegenerateCallback)
    setupCastlePane(pane)
  }

  // Panel Layout folder (legacy mode only)
  if (!params.useCastle) {
    const layoutFolder = pane.addFolder({ title: "Panel Layout" })

    layoutFolder
      .addBinding(params, "numPanels", {
        min: 0,
        max: numTextureSets,
        step: 1,
        label: "Number of Panels"
      })
      .on("change", () => {
        updatePanelLayout(scene, glassMaterial, params)
      })

    layoutFolder
      .addBinding(params, "panelGap", {
        min: 0,
        max: 0.5,
        step: 0.01,
        label: "Gap Between"
      })
      .on("change", () => {
        updatePanelLayout(scene, glassMaterial, params)
      })
  }

  // Glass parameters from separate module
  setupGlassPane(pane, glassMaterial)

  // Art installation parameters
  setupInstallationPane(pane)

  // Atmosphere folder
  const atmosphereFolder = pane.addFolder({ title: "Atmosphere" })

  atmosphereFolder
    .addBinding(params, "smokeAmount", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Fog Density"
    })
    .on("change", (ev) => {
      smokeAmountUniform.value = ev.value
    })

  atmosphereFolder
    .addBinding(params, "bloomIntensity", {
      min: 0,
      max: 1.5,
      step: 0.02,
      label: "Bloom"
    })
    .on("change", (ev) => {
      volumetricLightingIntensity.value = ev.value
    })

  atmosphereFolder
    .addBinding(params, "fogBoundsX", {
      min: 1,
      max: 10,
      step: 0.5,
      label: "Bounds X"
    })
    .on("change", () => updateFogBounds(params))

  atmosphereFolder
    .addBinding(params, "fogBoundsY", {
      min: 0.5,
      max: 5,
      step: 0.25,
      label: "Bounds Y"
    })
    .on("change", () => updateFogBounds(params))

  atmosphereFolder
    .addBinding(params, "fogBoundsZ", {
      min: 1,
      max: 10,
      step: 0.5,
      label: "Bounds Z"
    })
    .on("change", () => updateFogBounds(params))

  // Hand Tracking folder
  setupHandTrackingFolder(
    pane,
    handController,
    parameterMapper,
    volumetricLightingIntensity,
    smokeAmountUniform
  )

  return pane
}

// Setup hand tracking folder
function setupHandTrackingFolder(
  pane,
  handController,
  parameterMapper,
  volumetricLightingIntensity,
  smokeAmountUniform
) {
  const handFolder = pane.addFolder({ title: "Hand Tracking", expanded: false })

  const handState = {
    enabled: false,
    showVideo: false,
    xParam: "causticScale",
    yParam: "bloomIntensity"
  }

  // Parameter configs for axis mapping
  const paramConfigs = {
    ...getParamConfigs(),
    bloomIntensity: { min: 0, max: 1.5, uniform: volumetricLightingIntensity },
    smokeAmount: { min: 0, max: 10, uniform: smokeAmountUniform }
  }

  handFolder
    .addBinding(handState, "enabled", { label: "Enable" })
    .on("change", (ev) => {
      if (handController) {
        if (ev.value) {
          handController.start()
          if (parameterMapper) parameterMapper.setEnabled(true)
          document.getElementById("hand-status").style.display = "block"
        } else {
          handController.stop()
          if (parameterMapper) parameterMapper.setEnabled(false)
          document.getElementById("hand-status").style.display = "none"
        }
      }
    })

  handFolder
    .addBinding(handState, "showVideo", { label: "Show Video" })
    .on("change", (ev) => {
      document.getElementById("hand-video").style.display = ev.value
        ? "block"
        : "none"
    })

  handFolder
    .addBinding(handState, "xParam", {
      label: "X-Axis",
      options: {
        "Pattern Scale": "causticScale",
        Chromatic: "chromaticAberration",
        "Caustic IOR": "causticIOR"
      }
    })
    .on("change", (ev) => {
      if (parameterMapper) {
        parameterMapper.removeMappingsForAxis("x")
        const config = paramConfigs[ev.value]
        parameterMapper.addMapping(ev.value, { axis: "x", ...config })
      }
    })

  handFolder
    .addBinding(handState, "yParam", {
      label: "Y-Axis",
      options: {
        Bloom: "bloomIntensity",
        "Fog Density": "smokeAmount",
        "Glass Emissive": "glassEmissive"
      }
    })
    .on("change", (ev) => {
      if (parameterMapper) {
        parameterMapper.removeMappingsForAxis("y")
        const config = paramConfigs[ev.value]
        parameterMapper.addMapping(ev.value, { axis: "y", ...config })
      }
    })
}

export function getPane() {
  return pane
}
