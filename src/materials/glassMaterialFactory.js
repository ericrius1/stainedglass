import * as THREE from "three/webgpu"
import { texture, uv, vec4 } from "three/tsl"
import { glassParams } from "../glassParams.js"
import { createCausticShader, createGlassEmissiveShader } from "../shaders/causticShader.js"
import { getAllTextureSets, getCausticMap } from "../textures/textureManager.js"

// Store all created window materials
let windowMaterials = []

// Creates a glass material for a specific texture set
function createWindowMaterial(textureSet, causticMap, smokeAmountUniform) {
  const material = new THREE.MeshPhysicalNodeMaterial()
  material.side = THREE.DoubleSide
  material.transparent = true
  material.transmission = glassParams.transmission
  material.thickness = glassParams.thickness
  material.ior = glassParams.ior
  material.metalness = glassParams.metalness
  material.roughness = glassParams.roughness

  // Use colorNode for better stained glass color display
  const diffuseTex = texture(textureSet.diffuse, uv())
  material.colorNode = vec4(diffuseTex.rgb, diffuseTex.a)

  // Physical material extras
  material.clearcoat = glassParams.clearcoat
  material.clearcoatRoughness = glassParams.clearcoatRoughness
  material.sheen = glassParams.sheen
  material.sheenRoughness = glassParams.sheenRoughness
  material.sheenColor = new THREE.Color(glassParams.sheenColor)
  material.iridescence = glassParams.iridescence
  material.iridescenceIOR = glassParams.iridescenceIOR
  material.iridescenceThicknessRange = [
    glassParams.iridescenceThicknessMin,
    glassParams.iridescenceThicknessMax
  ]
  material.specularIntensity = glassParams.specularIntensity
  material.specularColor = new THREE.Color(glassParams.specularColor)
  material.attenuationColor = new THREE.Color(glassParams.attenuationColor)
  material.attenuationDistance = glassParams.attenuationDistance
  material.dispersion = glassParams.dispersion
  material.anisotropy = glassParams.anisotropy
  material.anisotropyRotation = glassParams.anisotropyRotation

  // Apply normal map if available
  if (textureSet.normal) {
    material.normalMap = textureSet.normal
    material.normalScale = new THREE.Vector2(
      glassParams.normalStrength,
      glassParams.normalStrength
    )
  }

  // Apply metallicRoughness map if available
  if (textureSet.metallicRoughness) {
    material.roughnessMap = textureSet.metallicRoughness
    material.metalnessMap = textureSet.metallicRoughness
  }

  // Caustic shadow projection
  const causticEffect = createCausticShader(causticMap, textureSet.diffuse, smokeAmountUniform)
  material.castShadowNode = causticEffect

  // Emissive glow on the panel itself
  material.emissiveNode = createGlassEmissiveShader(textureSet.diffuse)

  return material
}

// Create materials for all texture sets
export function createAllWindowMaterials(smokeAmountUniform) {
  const textureSets = getAllTextureSets()
  const causticMap = getCausticMap()

  // Dispose existing materials
  windowMaterials.forEach(mat => mat.dispose())
  windowMaterials = []

  // Create a material for each texture set
  windowMaterials = textureSets.map(textureSet =>
    createWindowMaterial(textureSet, causticMap, smokeAmountUniform)
  )

  return windowMaterials
}

// Get all window materials
export function getWindowMaterials() {
  return windowMaterials
}

// Get material by index
export function getWindowMaterial(index) {
  if (index < 0 || index >= windowMaterials.length) {
    return windowMaterials[0] || null
  }
  return windowMaterials[index]
}

// Update all materials with new glass params
export function updateAllWindowMaterials() {
  windowMaterials.forEach(material => {
    material.transmission = glassParams.transmission
    material.thickness = glassParams.thickness
    material.ior = glassParams.ior
    material.metalness = glassParams.metalness
    material.roughness = glassParams.roughness
    material.clearcoat = glassParams.clearcoat
    material.clearcoatRoughness = glassParams.clearcoatRoughness
    material.sheen = glassParams.sheen
    material.sheenRoughness = glassParams.sheenRoughness
    material.sheenColor = new THREE.Color(glassParams.sheenColor)
    material.iridescence = glassParams.iridescence
    material.iridescenceIOR = glassParams.iridescenceIOR
    material.iridescenceThicknessRange = [
      glassParams.iridescenceThicknessMin,
      glassParams.iridescenceThicknessMax
    ]
    material.specularIntensity = glassParams.specularIntensity
    material.specularColor = new THREE.Color(glassParams.specularColor)
    material.attenuationColor = new THREE.Color(glassParams.attenuationColor)
    material.attenuationDistance = glassParams.attenuationDistance
    material.dispersion = glassParams.dispersion
    material.anisotropy = glassParams.anisotropy
    material.anisotropyRotation = glassParams.anisotropyRotation

    if (material.normalMap) {
      material.normalScale.set(
        glassParams.normalStrength,
        glassParams.normalStrength
      )
    }

    material.needsUpdate = true
  })
}

// Dispose all materials
export function disposeWindowMaterials() {
  windowMaterials.forEach(mat => mat.dispose())
  windowMaterials = []
}
