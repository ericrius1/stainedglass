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

let camera, scene, renderer, controls
let postProcessing
let glassPanel, glassMaterial
let spotLight

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
  // Caustics
  causticIntensity: 50,
  causticScale: 0.6,
  chromaticAberration: 0.004,
  causticOcclusion: 1.0,
  refractionStrength: 0.6,
  // Glass
  glassIOR: 1.5,
  glassEmissive: 0.15
}

let smokeAmountUniform, volumetricLightingIntensity, causticIntensityUniform
let causticScaleUniform, chromaticAberrationUniform, causticOcclusionUniform
let refractionStrengthUniform, glassIORUniform, glassEmissiveUniform
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
  stainedGlassTexture.wrapS = stainedGlassTexture.wrapT = THREE.ClampToEdgeWrapping

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
  spotLight.penumbra = 0.3
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
  causticIntensityUniform = uniform(params.causticIntensity)
  smokeAmountUniform = uniform(params.smokeAmount)
  causticScaleUniform = uniform(params.causticScale)
  chromaticAberrationUniform = uniform(params.chromaticAberration)
  causticOcclusionUniform = uniform(params.causticOcclusion)
  refractionStrengthUniform = uniform(params.refractionStrength)
  glassIORUniform = uniform(params.glassIOR)
  glassEmissiveUniform = uniform(params.glassEmissive)

  // TSL Caustic shader - projects stained glass colors onto shadows
  // Uses caustic map + refraction + chromatic aberration like official example
  const causticEffect = Fn(() => {
    // Calculate refraction vector based on view direction and surface normal
    const refractionVector = refract(
      positionViewDirection.negate(),
      normalView,
      div(1.0, glassIORUniform)
    ).normalize()

    // Edge falloff based on UV distance from center (works for flat surfaces)
    // Creates vignette-like effect where caustics fade toward edges
    const uvCentered = uv().sub(0.5).mul(2.0) // -1 to 1
    const distFromCenter = uvCentered.length() // 0 at center, ~1.4 at corners
    const edgeFalloff = distFromCenter.mul(causticOcclusionUniform.mul(0.1)).clamp(0, 1)
    const viewZ = edgeFalloff.oneMinus() // 1 at center, falls off toward edges

    // UV for caustic pattern - use refraction to create wavy projection
    const causticUV = refractionVector.xy.mul(causticScaleUniform)

    // Chromatic aberration offset for rainbow edges
    const chromaticOffset = normalView.z
      .abs()
      .pow(-0.9)
      .mul(chromaticAberrationUniform)

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
      .mul(viewZ.mul(causticIntensityUniform))
      .add(viewZ)
      .mul(glassColor)
      .mul(fogAttenuation)
  })().toVar()

  // Stained glass panel material
  glassMaterial = new THREE.MeshPhysicalNodeMaterial()
  glassMaterial.side = THREE.DoubleSide
  glassMaterial.transparent = true
  glassMaterial.transmission = 0.9
  glassMaterial.thickness = 0.05
  glassMaterial.ior = 1.5
  glassMaterial.metalness = 0
  glassMaterial.roughness = 0.05
  glassMaterial.map = stainedGlassTexture

  // Apply normal map if available
  if (normalMapTexture) {
    glassMaterial.normalMap = normalMapTexture
    glassMaterial.normalScale = new THREE.Vector2(1, 1)
  }

  // This is the key - castShadowNode projects the colors through the shadow
  glassMaterial.castShadowNode = causticEffect

  // Emissive glow to see the texture on the panel itself
  glassMaterial.emissiveNode = Fn(() => {
    return texture(stainedGlassTexture, uv()).rgb.mul(glassEmissiveUniform)
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
  const volumetricMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 2),
    volumetricMaterial
  )
  volumetricMesh.receiveShadow = true
  volumetricMesh.position.y = 0.5 // Centered between ground (0) and glass (1)
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

  window.addEventListener("resize", onWindowResize)
}

function setupTweakpane() {
  const pane = new Pane({ title: "Stained Glass" })

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
        glassMaterial.normalScale = new THREE.Vector2(1, 1)
      } else {
        // Remove normal map if this set doesn't have one
        glassMaterial.normalMap = null
        normalMapTexture = null
      }

      glassMaterial.needsUpdate = true
    })

  // Caustics folder
  const causticsFolder = pane.addFolder({ title: "Caustics" })

  causticsFolder
    .addBinding(params, "causticIntensity", {
      min: 1,
      max: 150,
      step: 1,
      label: "Intensity"
    })
    .on("change", (ev) => {
      causticIntensityUniform.value = ev.value
    })

  causticsFolder
    .addBinding(params, "causticScale", {
      min: 0.1,
      max: 2.0,
      step: 0.05,
      label: "Pattern Scale"
    })
    .on("change", (ev) => {
      causticScaleUniform.value = ev.value
    })

  causticsFolder
    .addBinding(params, "chromaticAberration", {
      min: 0,
      max: 0.02,
      step: 0.001,
      label: "Chromatic"
    })
    .on("change", (ev) => {
      chromaticAberrationUniform.value = ev.value
    })

  causticsFolder
    .addBinding(params, "causticOcclusion", {
      min: 0,
      max: 20,
      step: 0.1,
      label: "Occlusion"
    })
    .on("change", (ev) => {
      causticOcclusionUniform.value = ev.value
    })

  // Glass folder
  const glassFolder = pane.addFolder({ title: "Glass" })

  glassFolder
    .addBinding(params, "glassIOR", {
      min: 0.05,
      max: 2.5,
      step: 0.01,
      label: "IOR"
    })
    .on("change", (ev) => {
      glassIORUniform.value = ev.value
    })

  glassFolder
    .addBinding(params, "glassEmissive", {
      min: 0,
      max: 1,
      step: 0.05,
      label: "Emissive"
    })
    .on("change", (ev) => {
      glassEmissiveUniform.value = ev.value
    })

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
