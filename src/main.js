import { uniform } from "three/tsl"
import { defaultParams } from "./config.js"

// Core modules
import { createRenderer, resizeRenderer } from "./core/renderer.js"
import {
  createScene,
  createCamera,
  createControls,
  resizeCamera,
  updateControls
} from "./core/scene.js"
import { createPostProcessing, renderPostProcessing } from "./core/postProcessing.js"

// Texture management
import {
  loadInitialTextures,
  getStainedGlassTexture,
  getNormalMapTexture,
  getMetallicRoughnessTexture,
  getCausticMap
} from "./textures/textureManager.js"

// Materials
import { createGlassMaterial, getGlassMaterial } from "./materials/glassMaterial.js"

// Scene objects
import { createPanelGeometry, updatePanelLayout } from "./scene/panelLayout.js"
import { createGround } from "./scene/ground.js"
import { createSpotLight } from "./scene/lighting.js"
import { createFogVolume, getVolumetricMaterial } from "./scene/fogVolume.js"

// Art installation
import { createArtInstallation } from "./artInstallation.js"
import { glassParams, glassUniforms } from "./glassParams.js"

// Hand tracking
import { HandTrackingController } from "./utils/HandTrackingController.js"
import { ParameterMapper } from "./utils/ParameterMapper.js"

// UI
import { createStats, updateStats } from "./ui/stats.js"
import { createTweakpane } from "./ui/tweakpane.js"
import { initUIToggle } from "./ui/uiToggle.js"

// Local state
let renderer, scene, camera, controls
let handController = null
let parameterMapper = null
let smokeAmountUniform, volumetricLightingIntensity

// Clone params so we can mutate locally
const params = { ...defaultParams }

init()

async function init() {
  // Create core Three.js objects
  scene = createScene()
  camera = createCamera()
  renderer = createRenderer()

  // Create controls
  controls = createControls(renderer.domElement)

  // Load textures
  await loadInitialTextures()

  // Create uniforms for dynamic control
  smokeAmountUniform = uniform(params.smokeAmount)
  volumetricLightingIntensity = uniform(params.bloomIntensity)

  // Create glass material
  const glassMaterial = createGlassMaterial(
    getStainedGlassTexture(),
    getNormalMapTexture(),
    getMetallicRoughnessTexture(),
    getCausticMap(),
    smokeAmountUniform
  )

  // Create panel geometry and initial layout
  createPanelGeometry(params.panelWidth)
  updatePanelLayout(scene, glassMaterial, params)

  // Create scene objects
  createGround(scene)
  createSpotLight(scene)
  createArtInstallation(scene)

  // Create volumetric fog
  const { volumetricMaterial } = createFogVolume(scene, params, smokeAmountUniform)

  // Create post-processing
  createPostProcessing(
    renderer,
    scene,
    camera,
    volumetricMaterial,
    volumetricLightingIntensity
  )

  // Initialize hand tracking
  await initHandTracking()

  // Create UI
  createStats()
  const pane = createTweakpane(
    params,
    scene,
    glassMaterial,
    smokeAmountUniform,
    volumetricLightingIntensity,
    handController,
    parameterMapper
  )

  // Initialize UI toggle with "/" key
  initUIToggle(pane)

  // Start animation loop
  renderer.setAnimationLoop(animate)

  // Handle window resize
  window.addEventListener("resize", onWindowResize)
}

async function initHandTracking() {
  try {
    const videoElement = document.getElementById("hand-video")
    const statusElement = document.getElementById("hand-status")

    // Create hand controller
    handController = new HandTrackingController({
      smoothing: 0.25,
      landmark: 9 // Palm center
    })

    // Create parameter mapper
    parameterMapper = new ParameterMapper()
    parameterMapper.init(glassParams, null) // pane will be set later

    // Configure default mappings
    parameterMapper.addMapping("causticScale", {
      axis: "x",
      min: 0.05,
      max: 3.0,
      uniform: glassUniforms.causticScale
    })

    parameterMapper.addMapping("bloomIntensity", {
      axis: "y",
      min: 0,
      max: 1.5,
      uniform: volumetricLightingIntensity
    })

    // Initialize and start camera
    await handController.init(videoElement)
    await handController.startCamera()

    // Subscribe to position changes
    handController.onPositionChange((position, isDetected) => {
      if (statusElement) {
        statusElement.textContent = `Hand: ${
          isDetected ? "Detected" : "Not Detected"
        }`
        statusElement.className = isDetected ? "detected" : "not-detected"
      }

      if (isDetected) {
        parameterMapper.update(position)
      }
    })

    // Don't start by default - user enables via UI
    parameterMapper.setEnabled(false)

    console.log("Hand tracking initialized successfully")
  } catch (error) {
    console.warn("Hand tracking initialization failed:", error)
  }
}

function onWindowResize() {
  resizeCamera()
  resizeRenderer()
}

function animate() {
  updateControls()
  updateStats()
  renderPostProcessing()
}
