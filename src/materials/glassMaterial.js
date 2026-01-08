import * as THREE from "three/webgpu"
import { glassParams } from "../glassParams.js"
import { createCausticShader, createGlassEmissiveShader } from "../shaders/causticShader.js"

let glassMaterial = null

// Creates the stained glass panel material
export function createGlassMaterial(
  stainedGlassTexture,
  normalMapTexture,
  metallicRoughnessTexture,
  causticMap,
  smokeAmountUniform
) {
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

  // Apply metallicRoughness map if available
  if (metallicRoughnessTexture) {
    glassMaterial.roughnessMap = metallicRoughnessTexture
    glassMaterial.metalnessMap = metallicRoughnessTexture
  }

  // Caustic shadow projection
  const causticEffect = createCausticShader(causticMap, stainedGlassTexture, smokeAmountUniform)
  glassMaterial.castShadowNode = causticEffect

  // Emissive glow on the panel itself
  glassMaterial.emissiveNode = createGlassEmissiveShader(stainedGlassTexture)

  return glassMaterial
}

export function getGlassMaterial() {
  return glassMaterial
}
