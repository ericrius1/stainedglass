import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import { defaultParams, UI_VISIBLE_ON_START } from "./config.js"

// Core modules
import { createRenderer, resizeRenderer, initRenderer } from "./core/renderer.js"
import {
  createScene,
  createCamera,
  createControls,
  resizeCamera,
  updateControls,
  setOrbitControlsEnabled,
  setOrbitTarget
} from "./core/scene.js"
import { createPostProcessing, renderPostProcessing } from "./core/postProcessing.js"

// Texture management
import {
  loadInitialTextures,
  loadAllTextureSets,
  getStainedGlassTexture,
  getNormalMapTexture,
  getMetallicRoughnessTexture,
  getCausticMap
} from "./textures/textureManager.js"

// Materials
import { createGlassMaterial, getGlassMaterial } from "./materials/glassMaterial.js"
import { createAllWindowMaterials, getWindowMaterials, updateAllWindowMaterials } from "./materials/glassMaterialFactory.js"

// Scene objects
import { createPanelGeometry, updatePanelLayout } from "./scene/panelLayout.js"
import { createGround } from "./scene/ground.js"
import { createSpotLight } from "./scene/lighting.js"
import { createFogVolume, getVolumetricMaterial } from "./scene/fogVolume.js"
import { generateCastle, castleParams, getCastleGroup } from "./scene/castleGenerator.js"

// Glass parameters
import { glassParams, glassUniforms } from "./glassParams.js"

// Hand tracking
import { HandTrackingController } from "./utils/HandTrackingController.js"
import { ParameterMapper } from "./utils/ParameterMapper.js"

// Player controller
import { PlayerController } from "./controls/PlayerController.js"

// UI
import { createStats, updateStats } from "./ui/stats.js"
import { createTweakpane } from "./ui/tweakpane.js"
import { initUIToggle, onUIToggle, isUIVisible } from "./ui/uiToggle.js"

// Local state
let renderer, scene, camera, controls
let handController = null
let parameterMapper = null
let smokeAmountUniform, volumetricLightingIntensity
let playerController = null
let clock = new THREE.Clock()
let debugMode = UI_VISIBLE_ON_START

// Clone params so we can mutate locally
const params = { ...defaultParams }

init()

async function init() {
  // Create core Three.js objects
  scene = createScene()
  camera = createCamera()
  renderer = createRenderer()

  // Initialize WebGPU renderer (required before rendering)
  await initRenderer()

  // Create controls
  controls = createControls(renderer.domElement)

  // Create uniforms for dynamic control
  smokeAmountUniform = uniform(params.smokeAmount)
  volumetricLightingIntensity = uniform(params.bloomIntensity)

  // Load textures based on mode
  let glassMaterial = null
  let castleRegenerateCallback = null

  if (params.useCastle) {
    // Castle mode: load all texture sets and create multiple materials
    await loadAllTextureSets()
    // Also load initial textures for caustic map
    await loadInitialTextures()

    // Create materials for all windows
    const windowMaterials = createAllWindowMaterials(smokeAmountUniform)

    // Generate the castle with stained glass windows
    generateCastle(scene, windowMaterials, castleParams)

    // Callback to regenerate castle when params change
    castleRegenerateCallback = () => {
      generateCastle(scene, getWindowMaterials(), castleParams)
    }

    // Use first material as reference for tweakpane glass controls
    glassMaterial = windowMaterials[0] || null
  } else {
    // Legacy mode: single texture, flat panels
    await loadInitialTextures()

    glassMaterial = createGlassMaterial(
      getStainedGlassTexture(),
      getNormalMapTexture(),
      getMetallicRoughnessTexture(),
      getCausticMap(),
      smokeAmountUniform
    )

    // Create panel geometry and initial layout
    createPanelGeometry(params.panelWidth)
    updatePanelLayout(scene, glassMaterial, params)
  }

  // Create scene objects
  createGround(scene)
  createSpotLight(scene)
  // createArtInstallation(scene) // Disabled - was causing white artifact

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

  // Create player controller for FPS mode
  playerController = new PlayerController(camera, renderer.domElement, scene)

  // Build collision after a short delay to ensure castle is fully created
  setTimeout(() => {
    if (playerController) {
      playerController.buildCollisionFromScene()
    }
  }, 100)

  // Create UI
  createStats()
  const pane = createTweakpane(
    params,
    scene,
    glassMaterial,
    smokeAmountUniform,
    volumetricLightingIntensity,
    handController,
    parameterMapper,
    castleRegenerateCallback
  )

  // Initialize UI toggle with "/" key
  initUIToggle(pane)

  // Handle camera mode switching based on UI visibility
  onUIToggle((uiVisible) => {
    debugMode = uiVisible
    if (uiVisible) {
      // Debug mode: use orbit controls, exit pointer lock
      if (playerController.isLocked()) {
        // Save player position as orbit target
        const playerPos = playerController.getPosition()
        setOrbitTarget(playerPos)
      }
      playerController.unlock()
      setOrbitControlsEnabled(true)
    } else {
      // FPS mode: use pointer lock controls
      setOrbitControlsEnabled(false)
      playerController.lock()
    }
  })

  // Click to enter FPS mode (when not in debug mode)
  renderer.domElement.addEventListener("click", () => {
    if (!debugMode && !playerController.isLocked()) {
      playerController.lock()
    }
  })

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
  const deltaTime = clock.getDelta()

  // Update player controller in FPS mode
  if (playerController && !debugMode) {
    playerController.update(deltaTime)
  }

  // Update orbit controls in debug mode
  if (debugMode) {
    updateControls()
  }

  updateStats()
  renderPostProcessing()
}
