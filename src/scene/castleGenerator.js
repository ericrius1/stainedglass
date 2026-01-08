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
    color: 0x5a5a5a,
    roughness: 0.85,
    metalness: 0.05
  })
  return stoneMaterial
}

// Create a corner pillar/buttress
function createPillar(height, radius = 0.08) {
  const group = new THREE.Group()

  // Main pillar body
  const pillarGeometry = new THREE.CylinderGeometry(radius, radius * 1.1, height, 8)
  const pillar = new THREE.Mesh(pillarGeometry, createStoneMaterial())
  pillar.position.y = height / 2
  pillar.castShadow = true
  pillar.receiveShadow = true
  group.add(pillar)

  // Decorative cap
  const capGeometry = new THREE.ConeGeometry(radius * 1.3, radius * 2, 8)
  const cap = new THREE.Mesh(capGeometry, createStoneMaterial())
  cap.position.y = height + radius
  cap.castShadow = true
  group.add(cap)

  return group
}

// Create a wall section with an embedded window opening
function createWallWithWindow(windowWidth, windowHeight, wallHeight, wallThickness, windowYOffset) {
  const group = new THREE.Group()

  // Calculate wall segment widths around the window
  const margin = 0.06 // Stone margin around window
  const totalWidth = windowWidth + margin * 2

  // Stone frame around the window (archway style)
  const frameThickness = 0.03

  // Bottom section (below window)
  const bottomHeight = windowYOffset - windowHeight / 2
  if (bottomHeight > 0.01) {
    const bottomGeometry = new THREE.BoxGeometry(totalWidth, bottomHeight, wallThickness)
    const bottom = new THREE.Mesh(bottomGeometry, createStoneMaterial())
    bottom.position.y = bottomHeight / 2
    bottom.castShadow = true
    bottom.receiveShadow = true
    group.add(bottom)
  }

  // Top section (above window)
  const topStart = windowYOffset + windowHeight / 2
  const topHeight = wallHeight - topStart
  if (topHeight > 0.01) {
    const topGeometry = new THREE.BoxGeometry(totalWidth, topHeight, wallThickness)
    const top = new THREE.Mesh(topGeometry, createStoneMaterial())
    top.position.y = topStart + topHeight / 2
    top.castShadow = true
    top.receiveShadow = true
    group.add(top)
  }

  // Left pillar section
  const leftGeometry = new THREE.BoxGeometry(margin, windowHeight, wallThickness)
  const left = new THREE.Mesh(leftGeometry, createStoneMaterial())
  left.position.set(-windowWidth / 2 - margin / 2, windowYOffset, 0)
  left.castShadow = true
  left.receiveShadow = true
  group.add(left)

  // Right pillar section
  const rightGeometry = new THREE.BoxGeometry(margin, windowHeight, wallThickness)
  const right = new THREE.Mesh(rightGeometry, createStoneMaterial())
  right.position.set(windowWidth / 2 + margin / 2, windowYOffset, 0)
  right.castShadow = true
  right.receiveShadow = true
  group.add(right)

  // Decorative arch above window
  const archHeight = 0.04
  const archGeometry = new THREE.BoxGeometry(windowWidth + frameThickness * 2, archHeight, wallThickness + 0.01)
  const arch = new THREE.Mesh(archGeometry, createStoneMaterial())
  arch.position.set(0, windowYOffset + windowHeight / 2 + archHeight / 2, 0)
  arch.castShadow = true
  group.add(arch)

  // Window sill
  const sillGeometry = new THREE.BoxGeometry(windowWidth + frameThickness * 2, 0.02, wallThickness + 0.02)
  const sill = new THREE.Mesh(sillGeometry, createStoneMaterial())
  sill.position.set(0, windowYOffset - windowHeight / 2 - 0.01, 0)
  sill.castShadow = true
  group.add(sill)

  return { group, totalWidth }
}

// Generate the complete castle - windows embedded in walls facing outward
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

  // Get texture sets for aspect ratio information
  const textureSets = getAllTextureSets()
  const numWindows = Math.min(numTextureSets, textureSets.length)

  // Calculate window dimensions for each texture
  const windowDimensions = []
  for (let i = 0; i < numWindows; i++) {
    const textureAspect = textureSets[i]?.aspectRatio || 1
    let width, height

    // Base size - larger windows for better visibility
    const baseSize = 0.4

    if (textureAspect >= 1) {
      // Wide texture
      width = Math.min(baseSize * textureAspect, 0.7)
      height = width / textureAspect
    } else {
      // Tall texture
      height = Math.min(baseSize / textureAspect, 0.8)
      width = height * textureAspect
    }

    windowDimensions.push({ width, height })
  }

  // Arrange windows in a circular/polygonal layout
  // Each window is in its own wall section facing outward
  const radius = params.baseRadius * 1.2
  const wallHeight = params.wallHeight * 1.5
  const wallThickness = params.wallThickness * 1.2

  // Create wall sections with windows
  for (let i = 0; i < numWindows; i++) {
    const angle = (i / numWindows) * Math.PI * 2
    const nextAngle = ((i + 1) / numWindows) * Math.PI * 2

    const dim = windowDimensions[i]
    const windowYOffset = wallHeight * 0.5 // Center windows vertically

    // Create wall section with window
    const { group: wallSection, totalWidth } = createWallWithWindow(
      dim.width,
      dim.height,
      wallHeight,
      wallThickness,
      windowYOffset
    )

    // Position wall section
    const wallX = Math.cos(angle) * radius
    const wallZ = Math.sin(angle) * radius
    wallSection.position.set(wallX, 0, wallZ)
    // Rotate to face outward (perpendicular to radius)
    wallSection.rotation.y = -angle + Math.PI / 2
    castleGroup.add(wallSection)

    // Create glass panel
    if (materials && materials[i]) {
      const glassGeometry = new THREE.PlaneGeometry(dim.width, dim.height)
      const glassMesh = new THREE.Mesh(glassGeometry, materials[i])

      // Position glass in the window opening, slightly inset
      const glassOffset = wallThickness / 2 + 0.001
      glassMesh.position.set(
        wallX + Math.cos(angle) * glassOffset,
        windowYOffset,
        wallZ + Math.sin(angle) * glassOffset
      )
      // Glass faces outward
      glassMesh.rotation.y = -angle + Math.PI / 2

      glassMesh.castShadow = true
      glassMesh.receiveShadow = true
      glassMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING)

      castleGroup.add(glassMesh)
      windowMeshes.push(glassMesh)
    }

    // Add corner pillars between wall sections
    const pillarAngle = (angle + nextAngle) / 2
    const pillarRadius = radius + wallThickness / 2
    const pillar = createPillar(wallHeight * 1.1)
    pillar.position.set(
      Math.cos(pillarAngle) * pillarRadius,
      0,
      Math.sin(pillarAngle) * pillarRadius
    )
    castleGroup.add(pillar)
  }

  // Add a simple circular base/foundation
  const baseGeometry = new THREE.CylinderGeometry(
    radius + wallThickness,
    radius + wallThickness + 0.1,
    0.1,
    numWindows * 2
  )
  const base = new THREE.Mesh(baseGeometry, createStoneMaterial())
  base.position.y = -0.05
  base.receiveShadow = true
  castleGroup.add(base)

  // Add inner floor that will receive the caustic projections
  const floorGeometry = new THREE.CircleGeometry(radius - 0.1, 32)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.6,
    metalness: 0.1
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.01
  floor.receiveShadow = true
  castleGroup.add(floor)

  // Add central skylight - horizontal glass panel that light passes through
  // This creates caustics on the floor below
  if (materials && materials.length > 0) {
    const skylightSize = 0.6
    const skylightGeometry = new THREE.PlaneGeometry(skylightSize, skylightSize)
    const skylightMaterial = materials[0] // Use first texture for skylight

    const skylight = new THREE.Mesh(skylightGeometry, skylightMaterial)
    skylight.rotation.x = -Math.PI / 2 // Face down/up
    skylight.position.y = wallHeight * 0.8 // Above floor
    skylight.castShadow = true
    skylight.receiveShadow = false
    skylight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
    castleGroup.add(skylight)
    windowMeshes.push(skylight)

    // Add frame around skylight
    const frameThickness = 0.02
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.6,
      metalness: 0.4
    })
    const frameGeometry = new THREE.BoxGeometry(skylightSize + frameThickness * 2, frameThickness, frameThickness)

    // Four frame bars
    const frameY = wallHeight * 0.8
    const halfSize = skylightSize / 2 + frameThickness / 2

    const frame1 = new THREE.Mesh(frameGeometry, frameMaterial)
    frame1.position.set(0, frameY, halfSize)
    castleGroup.add(frame1)

    const frame2 = new THREE.Mesh(frameGeometry, frameMaterial)
    frame2.position.set(0, frameY, -halfSize)
    castleGroup.add(frame2)

    const frameGeometry2 = new THREE.BoxGeometry(frameThickness, frameThickness, skylightSize + frameThickness * 2)
    const frame3 = new THREE.Mesh(frameGeometry2, frameMaterial)
    frame3.position.set(halfSize, frameY, 0)
    castleGroup.add(frame3)

    const frame4 = new THREE.Mesh(frameGeometry2, frameMaterial)
    frame4.position.set(-halfSize, frameY, 0)
    castleGroup.add(frame4)
  }

  scene.add(castleGroup)

  return {
    group: castleGroup,
    windowMeshes: windowMeshes,
    windowCount: numWindows
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
