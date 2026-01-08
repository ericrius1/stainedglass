import * as THREE from "three/webgpu"
import { numTextureSets, defaultCastleParams, LAYER_VOLUMETRIC_LIGHTING } from "../config.js"
import { getAllTextureSets } from "../textures/textureManager.js"

// Castle generator state
let castleGroup = null
let windowMeshes = []
let scene = null

// Seeded random for reproducible generation
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  range(min, max) {
    return min + this.next() * (max - min)
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1))
  }
}

// Castle parameters - initialized from config defaults
export const castleParams = { ...defaultCastleParams }

// Stone material for castle walls
let stoneMaterial = null

function createStoneMaterial() {
  if (stoneMaterial) return stoneMaterial

  stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b6b6b,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  })
  return stoneMaterial
}

// Create a low-poly cylindrical tower
function createTower(rng, params, index, totalTowers) {
  const group = new THREE.Group()

  // Tower body - octagonal prism for low-poly look
  const segments = 8
  const bodyGeometry = new THREE.CylinderGeometry(
    params.towerRadius,
    params.towerRadius * 1.1, // Slight taper
    params.towerHeight,
    segments
  )
  const body = new THREE.Mesh(bodyGeometry, createStoneMaterial())
  body.position.y = params.towerHeight / 2
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Tower top platform
  const platformGeometry = new THREE.CylinderGeometry(
    params.towerRadius * 1.2,
    params.towerRadius * 1.2,
    params.crenelationHeight,
    segments
  )
  const platform = new THREE.Mesh(platformGeometry, createStoneMaterial())
  platform.position.y = params.towerHeight + params.crenelationHeight / 2
  platform.castShadow = true
  platform.receiveShadow = true
  group.add(platform)

  // Crenelations (battlements) on top
  const crenelCount = Math.max(4, segments)
  for (let i = 0; i < crenelCount; i++) {
    if (i % 2 === 0) {
      // Only add every other one for gaps
      const angle = (i / crenelCount) * Math.PI * 2
      const crenelGeometry = new THREE.BoxGeometry(
        params.towerRadius * 0.4,
        params.crenelationHeight * 1.5,
        params.towerRadius * 0.25
      )
      const crenel = new THREE.Mesh(crenelGeometry, createStoneMaterial())
      crenel.position.set(
        Math.cos(angle) * params.towerRadius * 1.1,
        params.towerHeight + params.crenelationHeight * 1.5,
        Math.sin(angle) * params.towerRadius * 1.1
      )
      crenel.rotation.y = angle
      crenel.castShadow = true
      group.add(crenel)
    }
  }

  // Conical roof with random height variation
  const roofHeight = params.towerRadius * rng.range(1.5, 2.5)
  const roofGeometry = new THREE.ConeGeometry(
    params.towerRadius * 1.3,
    roofHeight,
    segments
  )
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: true
  })
  const roof = new THREE.Mesh(roofGeometry, roofMaterial)
  roof.position.y =
    params.towerHeight + params.crenelationHeight * 2 + roofHeight / 2
  roof.castShadow = true
  group.add(roof)

  return group
}

// Create a wall segment between two points
function createWall(params, start, end, addCrenelations = true) {
  const group = new THREE.Group()

  const dx = end.x - start.x
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dz, dx)

  // Main wall
  const wallGeometry = new THREE.BoxGeometry(
    length,
    params.wallHeight,
    params.wallThickness
  )
  const wall = new THREE.Mesh(wallGeometry, createStoneMaterial())
  wall.position.set(
    (start.x + end.x) / 2,
    params.wallHeight / 2,
    (start.z + end.z) / 2
  )
  wall.rotation.y = -angle
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)

  // Add crenelations along the wall
  if (addCrenelations) {
    const crenelSpacing = length / params.crenelationCount
    for (let i = 0; i < params.crenelationCount; i++) {
      if (i % 2 === 0) {
        const t = (i + 0.5) / params.crenelationCount
        const crenelGeometry = new THREE.BoxGeometry(
          crenelSpacing * 0.6,
          params.crenelationHeight,
          params.wallThickness * 1.2
        )
        const crenel = new THREE.Mesh(crenelGeometry, createStoneMaterial())
        crenel.position.set(
          start.x + dx * t,
          params.wallHeight + params.crenelationHeight / 2,
          start.z + dz * t
        )
        crenel.rotation.y = -angle
        crenel.castShadow = true
        group.add(crenel)
      }
    }
  }

  return group
}

// Create a window opening with frame
// windowWidth and windowHeight can be overridden based on texture aspect ratio
function createWindow(params, position, rotation, index, customWidth = null, customHeight = null) {
  const group = new THREE.Group()

  // Use custom dimensions if provided, otherwise use params
  const windowWidth = customWidth !== null ? customWidth : params.windowWidth
  const windowHeight = customHeight !== null ? customHeight : params.windowHeight

  const frameWidth = 0.015 // Width of the frame border
  const frameDepth = 0.02

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.6,
    metalness: 0.4,
    flatShading: true
  })

  // Create frame as 4 separate bars instead of solid box
  // Top bar
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(windowWidth + frameWidth * 2, frameWidth, frameDepth),
    frameMaterial
  )
  topBar.position.y = windowHeight / 2 + frameWidth / 2
  topBar.castShadow = true
  group.add(topBar)

  // Bottom bar
  const bottomBar = new THREE.Mesh(
    new THREE.BoxGeometry(windowWidth + frameWidth * 2, frameWidth, frameDepth),
    frameMaterial
  )
  bottomBar.position.y = -windowHeight / 2 - frameWidth / 2
  bottomBar.castShadow = true
  group.add(bottomBar)

  // Left bar
  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth, windowHeight, frameDepth),
    frameMaterial
  )
  leftBar.position.x = -windowWidth / 2 - frameWidth / 2
  leftBar.castShadow = true
  group.add(leftBar)

  // Right bar
  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth, windowHeight, frameDepth),
    frameMaterial
  )
  rightBar.position.x = windowWidth / 2 + frameWidth / 2
  rightBar.castShadow = true
  group.add(rightBar)

  // Glass panel geometry sized to texture aspect ratio
  const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight)

  // Store geometry and transform info for later material assignment
  const windowData = {
    geometry: glassGeometry,
    position: position.clone(),
    rotation: rotation,
    index: index,
    width: windowWidth,
    height: windowHeight,
    mesh: null
  }

  group.position.copy(position)
  group.rotation.y = rotation

  return { group, windowData }
}

// Calculate window positions around the castle
function calculateWindowPositions(rng, params) {
  const positions = []
  const numWindows = numTextureSets

  // Distribute windows across towers and walls
  // Prefer tower windows for best visibility
  const towerPositions = []
  for (let i = 0; i < params.towerCount; i++) {
    const angle = (i / params.towerCount) * Math.PI * 2
    towerPositions.push({
      x: Math.cos(angle) * params.baseRadius,
      z: Math.sin(angle) * params.baseRadius,
      angle: angle
    })
  }

  // Place windows on towers first, facing outward
  for (let i = 0; i < numWindows; i++) {
    const towerIndex = i % params.towerCount
    const tower = towerPositions[towerIndex]

    // Window faces outward from castle center
    const outwardAngle = tower.angle
    // Position window on outer surface of tower
    const windowOffset = params.towerRadius + 0.01

    // Vary height for visual interest
    const heightVariation = rng.range(0.4, 0.7)

    positions.push({
      position: new THREE.Vector3(
        tower.x + Math.cos(outwardAngle) * windowOffset,
        params.towerHeight * heightVariation,
        tower.z + Math.sin(outwardAngle) * windowOffset
      ),
      // PlaneGeometry faces +Z by default
      // To face outward direction (cos(α), 0, sin(α)), rotate by (π/2 - α)
      // This makes the plane's +Z axis align with the outward direction
      rotation: Math.PI / 2 - outwardAngle
    })
  }

  return positions
}

// Generate the complete castle
export function generateCastle(sceneRef, materials, params = castleParams) {
  scene = sceneRef

  // Clean up existing castle
  if (castleGroup) {
    scene.remove(castleGroup)
    windowMeshes.forEach((mesh) => {
      if (mesh.geometry) mesh.geometry.dispose()
    })
    windowMeshes = []
  }

  castleGroup = new THREE.Group()
  const rng = new SeededRandom(params.seed)

  // Generate tower positions
  const towerPositions = []
  for (let i = 0; i < params.towerCount; i++) {
    const angle = (i / params.towerCount) * Math.PI * 2 + rng.range(-0.1, 0.1)
    const radiusVariation = params.baseRadius * rng.range(0.9, 1.1)
    towerPositions.push({
      x: Math.cos(angle) * radiusVariation,
      z: Math.sin(angle) * radiusVariation,
      angle: angle
    })
  }

  // Create towers
  towerPositions.forEach((pos, i) => {
    const tower = createTower(rng, params, i, params.towerCount)
    tower.position.set(pos.x, 0, pos.z)
    castleGroup.add(tower)
  })

  // Create walls between towers
  for (let i = 0; i < params.towerCount; i++) {
    const start = towerPositions[i]
    const end = towerPositions[(i + 1) % params.towerCount]
    const wall = createWall(params, start, end)
    castleGroup.add(wall)
  }

  // Create central keep (larger tower in center)
  const keepParams = {
    ...params,
    towerRadius: params.towerRadius * 1.5,
    towerHeight: params.towerHeight * 1.3
  }
  const keep = createTower(rng, keepParams, 0, 1)
  keep.position.set(0, 0, 0)
  castleGroup.add(keep)

  // Calculate window positions
  const windowPositions = calculateWindowPositions(rng, params)

  // Get texture sets for aspect ratio information
  const textureSets = getAllTextureSets()

  // Create windows with glass panels
  windowPositions.forEach((winPos, index) => {
    // Calculate window dimensions based on texture aspect ratio
    let windowWidth = params.windowWidth
    let windowHeight = params.windowHeight

    // If we have texture info, use its aspect ratio
    if (textureSets && textureSets[index]) {
      const textureAspect = textureSets[index].aspectRatio || 1
      // Keep the base window area roughly constant but adjust for aspect ratio
      const baseArea = params.windowWidth * params.windowHeight
      // For tall textures (aspect < 1), make window taller
      // For wide textures (aspect > 1), make window wider
      if (textureAspect >= 1) {
        // Wide texture: scale width up, keep height
        windowWidth = params.windowHeight * textureAspect
        windowHeight = params.windowHeight
      } else {
        // Tall texture: keep width, scale height up
        windowWidth = params.windowWidth
        windowHeight = params.windowWidth / textureAspect
      }
      // Clamp to reasonable bounds
      windowWidth = Math.min(windowWidth, 0.5)
      windowHeight = Math.min(windowHeight, 0.6)
    }

    const { group: windowGroup, windowData } = createWindow(
      params,
      winPos.position,
      winPos.rotation,
      index,
      windowWidth,
      windowHeight
    )
    castleGroup.add(windowGroup)

    // Create glass mesh if materials provided
    if (materials && materials[index]) {
      const glassMesh = new THREE.Mesh(windowData.geometry, materials[index])
      // Position glass at window location
      glassMesh.position.copy(winPos.position)
      glassMesh.rotation.y = winPos.rotation
      glassMesh.castShadow = true
      glassMesh.receiveShadow = true
      // Enable volumetric lighting layer so glass glow contributes to bloom
      glassMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
      castleGroup.add(glassMesh)
      windowMeshes.push(glassMesh)
    }
  })

  // Add base platform
  const baseGeometry = new THREE.CylinderGeometry(
    params.baseRadius * 1.4,
    params.baseRadius * 1.5,
    0.15,
    params.towerCount * 2
  )
  const base = new THREE.Mesh(baseGeometry, createStoneMaterial())
  base.position.y = -0.075
  base.receiveShadow = true
  castleGroup.add(base)

  scene.add(castleGroup)

  return {
    group: castleGroup,
    windowMeshes: windowMeshes,
    windowCount: numTextureSets
  }
}

// Regenerate castle with new params
export function regenerateCastle(materials) {
  if (scene) {
    return generateCastle(scene, materials, castleParams)
  }
  return null
}

// Get window meshes for material updates
export function getWindowMeshes() {
  return windowMeshes
}

// Get castle group
export function getCastleGroup() {
  return castleGroup
}

// Update window materials
export function updateWindowMaterials(materials) {
  windowMeshes.forEach((mesh, index) => {
    if (materials[index]) {
      mesh.material = materials[index]
    }
  })
}
