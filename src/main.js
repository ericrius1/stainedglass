import * as THREE from "three/webgpu"
import {
  uniform,
  frameId,
  pass,
  texture3D,
  time,
  screenCoordinate,
  texture,
  Fn,
  vec3,
  vec2,
  uv,
  normalView,
  positionViewDirection,
  refract,
  div
} from "three/tsl"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js"
import { bayer16 } from "three/examples/jsm/tsl/math/Bayer.js"
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js"
import { Pane } from "tweakpane"
import { HandTrackingController } from "./utils/HandTrackingController.js"
import { ParameterMapper } from "./utils/ParameterMapper.js"
import {
  glassParams,
  glassUniforms,
  setupGlassPane,
  getParamConfigs
} from "./glassParams.js"
import {
  createArtInstallation,
  setupInstallationPane
} from "./artInstallation.js"

let camera, scene, renderer, controls
let pane = null
let handController = null
let parameterMapper = null
let postProcessing
let glassPanel, glassMaterial
let spotLight
let volumetricMesh

const LAYER_VOLUMETRIC_LIGHTING = 10

// Texture set configuration
// Each set can have: diffuse, normal, roughness, metallic, ao, height, emissive
// Add new texture sets here - system auto-detects available maps
const textureSets = {
  "Solar Windmill": {
    diffuse: "/textures/stainedglass/solarwindmill2.png"
  },
  Tree: {
    diffuse: "/textures/stainedglass/tree.png"
  },
  Waterfalls: {
    diffuse: "/textures/stainedglass/waterfalls.jpg"
  },
  Eagle: {
    diffuse: "/textures/stainedglass/eagle/eagle_diffuse.jpg",
    normal: "/textures/stainedglass/eagle/eagle_normal.jpg"
  }
}

// Get initial texture from URL or default
const urlParams = new URLSearchParams(window.location.search)
const initialTexture = urlParams.get("texture") || "Solar Windmill"

const params = {
  texture: initialTexture,
  // Fog & Bloom
  smokeAmount: 4,
  bloomIntensity: 0.3,
  fogBoundsX: 4,
  fogBoundsY: 1.5,
  fogBoundsZ: 4
}

let smokeAmountUniform, volumetricLightingIntensity
let stainedGlassTexture, normalMapTexture
let textureLoader

init()

async function init() {
  // Camera - position to see the scene nicely
  camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    20
  )
  camera.position.set(-1.5, 1.0, 1.5)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)

  // Load textures
  textureLoader = new THREE.TextureLoader()

  // Load initial texture set
  const initialSet = textureSets[params.texture]

  // Stained glass diffuse texture for colors
  stainedGlassTexture = await textureLoader.loadAsync(initialSet.diffuse)
  stainedGlassTexture.colorSpace = THREE.SRGBColorSpace
  stainedGlassTexture.wrapS = stainedGlassTexture.wrapT =
    THREE.ClampToEdgeWrapping

  // Load normal map if available
  if (initialSet.normal) {
    normalMapTexture = await textureLoader.loadAsync(initialSet.normal)
    normalMapTexture.wrapS = normalMapTexture.wrapT = THREE.ClampToEdgeWrapping
  }

  // Caustic pattern texture for light refraction pattern
  const causticMap = await textureLoader.loadAsync("/textures/caustic.jpg")
  causticMap.wrapS = causticMap.wrapT = THREE.RepeatWrapping
  causticMap.colorSpace = THREE.SRGBColorSpace

  // Spot Light - positioned above, shining down through the glass
  spotLight = new THREE.SpotLight(0xffffff, 3)
  spotLight.position.set(0, 1.8, 0)
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.angle = Math.PI / 4
  spotLight.penumbra = 1
  spotLight.decay = 1
  spotLight.distance = 5
  spotLight.shadow.mapType = THREE.HalfFloatType
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.1
  spotLight.shadow.camera.far = 3
  spotLight.shadow.bias = -0.001
  spotLight.shadow.intensity = 1
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)

  // Uniforms for dynamic control
  smokeAmountUniform = uniform(params.smokeAmount)

  // TSL Caustic shader - projects stained glass colors onto shadows
  // Uses caustic map + refraction + chromatic aberration like official example
  const causticEffect = Fn(() => {
    // Calculate refraction vector based on view direction and surface normal
    const refractionVector = refract(
      positionViewDirection.negate(),
      normalView,
      div(1.0, glassUniforms.causticIOR)
    ).normalize()

    // Edge falloff based on UV distance from center (works for flat surfaces)
    // Creates vignette-like effect where caustics fade toward edges
    const uvCentered = uv().sub(0.5).mul(2.0) // -1 to 1
    const distFromCenter = uvCentered.length() // 0 at center, ~1.4 at corners
    const edgeFalloff = distFromCenter
      .mul(glassUniforms.causticOcclusion.mul(0.1))
      .clamp(0, 1)
    const viewZ = edgeFalloff.oneMinus() // 1 at center, falls off toward edges

    // UV for caustic pattern - use refraction to create wavy projection
    const causticUV = refractionVector.xy.mul(glassUniforms.causticScale)

    // Chromatic aberration offset for rainbow edges
    const chromaticOffset = normalView.z
      .abs()
      .pow(-0.9)
      .mul(glassUniforms.chromaticAberration)

    // Sample caustic map with chromatic aberration (like official example)
    const causticPattern = vec3(
      texture(causticMap, causticUV.add(vec2(chromaticOffset.negate(), 0))).r,
      texture(causticMap, causticUV.add(vec2(0, chromaticOffset.negate()))).g,
      texture(causticMap, causticUV.add(vec2(chromaticOffset, chromaticOffset)))
        .b
    )

    // Sample stained glass texture for color tinting
    const glassColor = texture(stainedGlassTexture, uv()).rgb

    // Attenuate based on fog density
    const fogAttenuation = smokeAmountUniform.mul(0.12).add(1.0).reciprocal()

    // Combine: caustic pattern * glass color * intensity + base glow
    return causticPattern
      .mul(viewZ.mul(glassUniforms.causticIntensity))
      .add(viewZ)
      .mul(glassColor)
      .mul(fogAttenuation)
  })().toVar()

  // Stained glass panel material
  glassMaterial = new THREE.MeshPhysicalNodeMaterial()
  glassMaterial.side = THREE.DoubleSide
  glassMaterial.transparent = true
  glassMaterial.transmission = glassParams.transmission
  glassMaterial.thickness = glassParams.thickness
  glassMaterial.ior = glassParams.ior
  glassMaterial.metalness = glassParams.metalness
  glassMaterial.roughness = glassParams.roughness
  glassMaterial.map = stainedGlassTexture

  // Physical material extras
  glassMaterial.clearcoat = glassParams.clearcoat
  glassMaterial.clearcoatRoughness = glassParams.clearcoatRoughness
  glassMaterial.sheen = glassParams.sheen
  glassMaterial.sheenRoughness = glassParams.sheenRoughness
  glassMaterial.sheenColor = new THREE.Color(glassParams.sheenColor)
  glassMaterial.iridescence = glassParams.iridescence
  glassMaterial.iridescenceIOR = glassParams.iridescenceIOR
  glassMaterial.iridescenceThicknessRange = [
    glassParams.iridescenceThicknessMin,
    glassParams.iridescenceThicknessMax
  ]
  glassMaterial.specularIntensity = glassParams.specularIntensity
  glassMaterial.specularColor = new THREE.Color(glassParams.specularColor)
  glassMaterial.attenuationColor = new THREE.Color(glassParams.attenuationColor)
  glassMaterial.attenuationDistance = glassParams.attenuationDistance
  glassMaterial.dispersion = glassParams.dispersion
  glassMaterial.anisotropy = glassParams.anisotropy
  glassMaterial.anisotropyRotation = glassParams.anisotropyRotation

  // Apply normal map if available
  if (normalMapTexture) {
    glassMaterial.normalMap = normalMapTexture
    glassMaterial.normalScale = new THREE.Vector2(
      glassParams.normalStrength,
      glassParams.normalStrength
    )
  }

  // This is the key - castShadowNode projects the colors through the shadow
  glassMaterial.castShadowNode = causticEffect

  // Emissive glow to see the texture on the panel itself
  glassMaterial.emissiveNode = Fn(() => {
    return texture(stainedGlassTexture, uv()).rgb.mul(
      glassUniforms.glassEmissive
    )
  })()

  // Glass panel - horizontal, between light and ground
  const panelGeometry = new THREE.PlaneGeometry(0.8, 0.8)
  glassPanel = new THREE.Mesh(panelGeometry, glassMaterial)
  glassPanel.position.set(0, 1.0, 0)
  glassPanel.rotation.x = -Math.PI / 2 // Horizontal, facing up
  glassPanel.castShadow = true
  scene.add(glassPanel)

  // Ground plane to receive the colored caustic shadows
  const groundGeometry = new THREE.PlaneGeometry(4, 4)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.0
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  // Art installation screen
  createArtInstallation(scene)

  // Renderer
  renderer = new THREE.WebGPURenderer({ antialias: true })
  renderer.shadowMap.enabled = true
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setAnimationLoop(animate)
  document.body.appendChild(renderer.domElement)

  // Post-Processing
  postProcessing = new THREE.PostProcessing(renderer)

  volumetricLightingIntensity = uniform(params.bloomIntensity)

  const volumetricLayer = new THREE.Layers()
  volumetricLayer.disableAll()
  volumetricLayer.enable(LAYER_VOLUMETRIC_LIGHTING)

  // 3D Noise Texture for Volumetric Fog
  function createTexture3D() {
    let i = 0
    const size = 128
    const data = new Uint8Array(size * size * size)
    const scale = 8
    const perlin = new ImprovedNoise()
    const repeatFactor = 4.0

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x / size) * repeatFactor
          const ny = (y / size) * repeatFactor
          const nz = (z / size) * repeatFactor
          const noiseValue = perlin.noise(nx * scale, ny * scale, nz * scale)
          data[i] = 128 + 128 * noiseValue
          i++
        }
      }
    }

    const tex = new THREE.Data3DTexture(data, size, size, size)
    tex.format = THREE.RedFormat
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.unpackAlignment = 1
    tex.needsUpdate = true
    return tex
  }

  const noiseTexture3D = createTexture3D()

  // Volumetric material for fog
  const volumetricMaterial = new THREE.VolumeNodeMaterial()
  volumetricMaterial.steps = 25
  volumetricMaterial.offsetNode = bayer16(screenCoordinate.add(frameId))
  volumetricMaterial.scatteringNode = Fn(({ positionRay }) => {
    const timeScaled = vec3(time.mul(0.015), time.mul(0.005), time.mul(0.02))

    const sampleGrain = (scale, timeScale = 1) =>
      texture3D(
        noiseTexture3D,
        positionRay.add(timeScaled.mul(timeScale)).mul(scale).mod(1),
        0
      ).r.add(0.5)

    let density = sampleGrain(1)
    density = density.mul(sampleGrain(0.5, 0.8))
    density = density.mul(sampleGrain(0.25, 1.5))

    return smokeAmountUniform.mix(1, density)
  })

  // Volumetric fog box - covers the space between glass and ground
  volumetricMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      params.fogBoundsX,
      params.fogBoundsY,
      params.fogBoundsZ
    ),
    volumetricMaterial
  )
  volumetricMesh.receiveShadow = false
  volumetricMesh.position.y = params.fogBoundsY / 2 // Centered above ground
  volumetricMesh.layers.disableAll()
  volumetricMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(volumetricMesh)

  // Scene Pass
  const scenePass = pass(scene, camera)
  const sceneDepth = scenePass.getTextureNode("depth")

  // Apply depth occlusion to volumetric material
  volumetricMaterial.depthNode = sceneDepth.sample(THREE.screenUV)

  // Volumetric Lighting Pass
  const volumetricPass = pass(scene, camera, { depthBuffer: false, samples: 0 })
  volumetricPass.setLayers(volumetricLayer)
  volumetricPass.setResolutionScale(0.5)

  // Bloom on volumetric pass - keep it subtle
  const bloomPass = bloom(volumetricPass, 0.8, 0.5, 0)

  // Compose final output
  const scenePassColor = scenePass.add(
    bloomPass.mul(volumetricLightingIntensity)
  )
  postProcessing.outputNode = scenePassColor

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.5, 0)
  controls.maxDistance = 5
  controls.minDistance = 0.5
  controls.update()

  // Tweakpane
  setupTweakpane()

  // Initialize hand tracking
  await initHandTracking()

  window.addEventListener("resize", onWindowResize)
}

function setupTweakpane() {
  pane = new Pane({ title: "Stained Glass" })

  // Enable scrolling on the pane
  pane.element.style.maxHeight = "90vh"
  pane.element.style.overflowY = "auto"

  // Build texture options from texture sets
  const textureOptions = Object.keys(textureSets).reduce((acc, key) => {
    acc[key] = key
    return acc
  }, {})

  // Texture selection - swap texture without reloading
  pane
    .addBinding(params, "texture", { options: textureOptions })
    .on("change", async (ev) => {
      const set = textureSets[ev.value]

      // Load new diffuse texture using TextureLoader (not ImageLoader!)
      const newDiffuse = await textureLoader.loadAsync(set.diffuse)
      newDiffuse.colorSpace = THREE.SRGBColorSpace
      newDiffuse.wrapS = newDiffuse.wrapT = THREE.ClampToEdgeWrapping

      // Update the existing texture's source (key for WebGPU)
      stainedGlassTexture.source = newDiffuse.source
      stainedGlassTexture.needsUpdate = true

      // Also update material map reference
      glassMaterial.map = stainedGlassTexture
      glassMaterial.needsUpdate = true

      // Handle normal map
      if (set.normal) {
        const newNormal = await textureLoader.loadAsync(set.normal)
        newNormal.wrapS = newNormal.wrapT = THREE.ClampToEdgeWrapping

        if (normalMapTexture) {
          normalMapTexture.source = newNormal.source
          normalMapTexture.needsUpdate = true
        } else {
          normalMapTexture = newNormal
        }
        glassMaterial.normalMap = normalMapTexture
        glassMaterial.normalScale.set(
          glassParams.normalStrength,
          glassParams.normalStrength
        )
      } else {
        // Remove normal map if this set doesn't have one
        glassMaterial.normalMap = null
        normalMapTexture = null
      }

      glassMaterial.needsUpdate = true
    })

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

  // Helper to recreate fog bounds geometry
  const updateFogBounds = () => {
    volumetricMesh.geometry.dispose()
    volumetricMesh.geometry = new THREE.BoxGeometry(
      params.fogBoundsX,
      params.fogBoundsY,
      params.fogBoundsZ
    )
    volumetricMesh.position.y = params.fogBoundsY / 2
  }

  atmosphereFolder
    .addBinding(params, "fogBoundsX", {
      min: 1,
      max: 10,
      step: 0.5,
      label: "Bounds X"
    })
    .on("change", updateFogBounds)

  atmosphereFolder
    .addBinding(params, "fogBoundsY", {
      min: 0.5,
      max: 5,
      step: 0.25,
      label: "Bounds Y"
    })
    .on("change", updateFogBounds)

  atmosphereFolder
    .addBinding(params, "fogBoundsZ", {
      min: 1,
      max: 10,
      step: 0.5,
      label: "Bounds Z"
    })
    .on("change", updateFogBounds)

  // Hand Tracking folder
  const handFolder = pane.addFolder({ title: "Hand Tracking", expanded: false })

  const handState = {
    enabled: false,
    showVideo: false,
    xParam: "causticScale",
    yParam: "bloomIntensity"
  }

  // Parameter configs for axis mapping (combine glass params with local ones)
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
    parameterMapper.init(glassParams, pane)

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
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  controls.update()
  postProcessing.render()
}
