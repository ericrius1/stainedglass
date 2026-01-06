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

const texturePaths = {
  "Solar Windmill": "/textures/stainedglass/solarwindmill2.png",
  Tree: "/textures/stainedglass/tree.png",
  Waterfalls: "/textures/stainedglass/waterfalls.jpg"
}

// Get initial texture from URL or default
const urlParams = new URLSearchParams(window.location.search)
const initialTexture = urlParams.get("texture") || "Solar Windmill"

const params = {
  texture: initialTexture,
  smokeAmount: 4,
  bloomIntensity: 0.3,
  causticIntensity: 50
}

let smokeAmountUniform, volumetricLightingIntensity, causticIntensityUniform
let stainedGlassTexture

init()

async function init() {
  // Camera - position to see the light rays from the side
  camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.025,
    10
  )
  camera.position.set(-1.0, 0.4, 1.0)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)

  // Load stained glass texture first
  const textureLoader = new THREE.TextureLoader()
  stainedGlassTexture = await textureLoader.loadAsync(
    texturePaths[params.texture]
  )
  stainedGlassTexture.colorSpace = THREE.SRGBColorSpace
  stainedGlassTexture.wrapS = stainedGlassTexture.wrapT =
    THREE.ClampToEdgeWrapping

  // Spot Light - positioned ABOVE the glass panel, shining DOWN
  spotLight = new THREE.SpotLight(0xffffff, 2)
  spotLight.position.set(0, 0.8, 0)
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.angle = Math.PI / 5
  spotLight.penumbra = 0.5
  spotLight.decay = 1
  spotLight.distance = 3
  spotLight.shadow.mapType = THREE.HalfFloatType
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.1
  spotLight.shadow.camera.far = 2
  spotLight.shadow.bias = -0.001
  spotLight.shadow.intensity = 1
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)

  // Uniforms for dynamic control
  causticIntensityUniform = uniform(params.causticIntensity)
  smokeAmountUniform = uniform(params.smokeAmount)
  const causticOcclusion = uniform(1.0)

  // TSL Caustic shader - projects stained glass colors onto shadows
  // Uses refraction and chromatic aberration like the official example
  const causticEffect = Fn(() => {
    // Calculate refraction vector based on view direction and surface normal
    const refractionVector = refract(
      positionViewDirection.negate(),
      normalView,
      div(1.0, 1.5) // IOR of glass
    ).normalize()

    // View-dependent intensity falloff
    const viewZ = normalView.z.pow(causticOcclusion)

    // Base UV from mesh UV, offset by refraction
    const baseUV = uv()
    const textureUV = baseUV.add(refractionVector.xy.mul(0.4))

    // Chromatic aberration - separate RGB channels slightly
    const chromaticOffset = normalView.z.pow(-0.9).mul(0.006)

    // Sample texture with chromatic aberration for rainbow caustic effect
    const causticProjection = vec3(
      texture(
        stainedGlassTexture,
        textureUV.add(vec2(chromaticOffset.negate(), 0))
      ).r,
      texture(
        stainedGlassTexture,
        textureUV.add(vec2(0, chromaticOffset.negate()))
      ).g,
      texture(
        stainedGlassTexture,
        textureUV.add(vec2(chromaticOffset, chromaticOffset))
      ).b
    )

    // Attenuate based on fog density
    const fogAttenuation = smokeAmountUniform.mul(0.12).add(1.0).reciprocal()

    // Combine: caustic pattern * intensity * view falloff + base glow
    return causticProjection
      .mul(viewZ.mul(causticIntensityUniform))
      .add(viewZ.mul(0.5))
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

  // This is the key - castShadowNode projects the colors through the shadow
  glassMaterial.castShadowNode = causticEffect

  // Slight emissive to see the texture on the panel itself
  glassMaterial.emissiveNode = Fn(() => {
    return texture(stainedGlassTexture, uv()).rgb.mul(0.15)
  })()

  // Glass panel - positioned between light and ground
  const panelGeometry = new THREE.PlaneGeometry(0.5, 0.5)
  glassPanel = new THREE.Mesh(panelGeometry, glassMaterial)
  glassPanel.position.set(0, 0.35, 0)
  glassPanel.rotation.x = -Math.PI / 2.5 // Tilted to catch and redirect light
  glassPanel.castShadow = true
  scene.add(glassPanel)

  // Ground plane to receive the colored caustic shadows
  const groundGeometry = new THREE.PlaneGeometry(3, 3)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000, // Dark ground to show caustics clearly
    roughness: 0.9,
    metalness: 0.0
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0.2
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

  // Volumetric fog box - covers the area between light and ground
  const volumetricMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 1.2),
    volumetricMaterial
  )
  volumetricMesh.receiveShadow = true
  volumetricMesh.position.y = 0.2
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
  controls.target.set(0, 0.15, 0)
  controls.maxDistance = 3
  controls.minDistance = 0.3
  controls.update()

  // Tweakpane
  setupTweakpane(textureLoader)

  window.addEventListener("resize", onWindowResize)
}

function setupTweakpane(textureLoader) {
  const pane = new Pane({ title: "Stained Glass" })

  pane
    .addBinding(params, "texture", {
      options: {
        "Solar Windmill": "Solar Windmill",
        Tree: "Tree",
        Waterfalls: "Waterfalls"
      }
    })
    .on("change", (ev) => {
      // Update URL and reload to change texture
      const url = new URL(window.location)
      url.searchParams.set("texture", ev.value)
      window.location.href = url
    })

  pane
    .addBinding(params, "causticIntensity", {
      min: 1,
      max: 100,
      step: 1,
      label: "Caustic Intensity"
    })
    .on("change", (ev) => {
      causticIntensityUniform.value = ev.value
    })

  pane
    .addBinding(params, "smokeAmount", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Fog Density"
    })
    .on("change", (ev) => {
      smokeAmountUniform.value = ev.value
    })

  pane
    .addBinding(params, "bloomIntensity", {
      min: 0,
      max: 1,
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
