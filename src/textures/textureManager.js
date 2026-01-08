import * as THREE from "three/webgpu"
import { textureSets, initialTexture } from "../config.js"

let textureLoader = null
let stainedGlassTexture = null
let normalMapTexture = null
let metallicRoughnessTexture = null
let causticMap = null

export function getTextureLoader() {
  if (!textureLoader) {
    textureLoader = new THREE.TextureLoader()
  }
  return textureLoader
}

export async function loadInitialTextures() {
  const loader = getTextureLoader()
  const initialSet = textureSets[initialTexture]

  // Stained glass diffuse texture for colors
  stainedGlassTexture = await loader.loadAsync(initialSet.diffuse)
  stainedGlassTexture.colorSpace = THREE.SRGBColorSpace
  stainedGlassTexture.wrapS = stainedGlassTexture.wrapT = THREE.ClampToEdgeWrapping

  // Load normal map if available
  if (initialSet.normal) {
    normalMapTexture = await loader.loadAsync(initialSet.normal)
    normalMapTexture.wrapS = normalMapTexture.wrapT = THREE.ClampToEdgeWrapping
  }

  // Load metallicRoughness map if available
  if (initialSet.metallicRoughness) {
    metallicRoughnessTexture = await loader.loadAsync(initialSet.metallicRoughness)
    metallicRoughnessTexture.wrapS = metallicRoughnessTexture.wrapT = THREE.ClampToEdgeWrapping
  }

  // Caustic pattern texture for light refraction pattern
  causticMap = await loader.loadAsync("/textures/caustic.jpg")
  causticMap.wrapS = causticMap.wrapT = THREE.RepeatWrapping
  causticMap.colorSpace = THREE.SRGBColorSpace

  return {
    stainedGlassTexture,
    normalMapTexture,
    metallicRoughnessTexture,
    causticMap
  }
}

export async function swapTextureSet(setName, glassMaterial, glassParams) {
  const loader = getTextureLoader()
  const set = textureSets[setName]

  // Load new diffuse texture
  const newDiffuse = await loader.loadAsync(set.diffuse)
  newDiffuse.colorSpace = THREE.SRGBColorSpace
  newDiffuse.wrapS = newDiffuse.wrapT = THREE.ClampToEdgeWrapping

  // Update the existing texture's source
  stainedGlassTexture.source = newDiffuse.source
  stainedGlassTexture.needsUpdate = true

  // Also update material map reference
  glassMaterial.map = stainedGlassTexture
  glassMaterial.needsUpdate = true

  // Handle normal map
  if (set.normal) {
    const newNormal = await loader.loadAsync(set.normal)
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
    glassMaterial.normalMap = null
    normalMapTexture = null
  }

  // Handle metallicRoughness map
  if (set.metallicRoughness) {
    const newMetallicRoughness = await loader.loadAsync(set.metallicRoughness)
    newMetallicRoughness.wrapS = newMetallicRoughness.wrapT = THREE.ClampToEdgeWrapping

    if (metallicRoughnessTexture) {
      metallicRoughnessTexture.source = newMetallicRoughness.source
      metallicRoughnessTexture.needsUpdate = true
    } else {
      metallicRoughnessTexture = newMetallicRoughness
    }
    glassMaterial.roughnessMap = metallicRoughnessTexture
    glassMaterial.metalnessMap = metallicRoughnessTexture
  } else {
    glassMaterial.roughnessMap = null
    glassMaterial.metalnessMap = null
    metallicRoughnessTexture = null
  }

  glassMaterial.needsUpdate = true
}

export function getStainedGlassTexture() {
  return stainedGlassTexture
}

export function getNormalMapTexture() {
  return normalMapTexture
}

export function getMetallicRoughnessTexture() {
  return metallicRoughnessTexture
}

export function getCausticMap() {
  return causticMap
}
