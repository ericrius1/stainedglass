/**
 * PBRTextureGeneratorUI - Tweakpane integration for PBRTextureGenerator
 *
 * Provides a ready-to-use UI for controlling PBR map generation parameters
 * with real-time preview updates.
 *
 * @example
 * import { PBRTextureGenerator } from './utils/PBRTextureGenerator.js'
 * import { createPBRGeneratorUI } from './utils/PBRTextureGeneratorUI.js'
 *
 * const generator = new PBRTextureGenerator()
 * const ui = createPBRGeneratorUI(pane, generator, diffuseTexture, material, {
 *   onUpdate: (maps) => { console.log('Maps updated:', maps) }
 * })
 */

import { defaultOptions } from './PBRTextureGenerator.js'

/**
 * Create a Tweakpane folder with controls for the PBR generator
 * @param {Pane} pane - Tweakpane instance
 * @param {PBRTextureGenerator} generator - PBR generator instance
 * @param {THREE.Texture} diffuseTexture - Source diffuse texture
 * @param {THREE.Material} material - Material to apply maps to (optional)
 * @param {Object} options - Configuration options
 * @param {Function} options.onUpdate - Callback when maps are regenerated
 * @param {string} options.folderTitle - Title for the UI folder
 * @param {boolean} options.expanded - Whether folder starts expanded
 * @returns {Object} UI state and controls
 */
export function createPBRGeneratorUI(pane, generator, diffuseTexture, material = null, options = {}) {
  const {
    onUpdate = null,
    folderTitle = 'PBR Generator',
    expanded = true,
  } = options

  // Create state object for Tweakpane bindings
  const state = {
    normal: { ...defaultOptions.normal },
    roughness: { ...defaultOptions.roughness },
    metallic: { ...defaultOptions.metallic },
    height: { ...defaultOptions.height },
    ao: { ...defaultOptions.ao },
    enabled: {
      normal: true,
      roughness: true,
      metallic: true,
      height: false,
      ao: false,
    }
  }

  // Store current maps
  let currentMaps = null

  // Regenerate function
  const regenerate = () => {
    const mapTypes = Object.entries(state.enabled)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type)

    currentMaps = generator.generateSelected(diffuseTexture, mapTypes, state)

    // Apply to material if provided
    if (material) {
      if (currentMaps.normal && state.enabled.normal) {
        material.normalMap = currentMaps.normal
      }
      if (currentMaps.roughness && state.enabled.roughness) {
        material.roughnessMap = currentMaps.roughness
      }
      if (currentMaps.metallic && state.enabled.metallic) {
        material.metalnessMap = currentMaps.metallic
      }
      if (currentMaps.height && state.enabled.height) {
        material.displacementMap = currentMaps.height
      }
      if (currentMaps.ao && state.enabled.ao) {
        material.aoMap = currentMaps.ao
      }
      material.needsUpdate = true
    }

    if (onUpdate) {
      onUpdate(currentMaps)
    }

    return currentMaps
  }

  // Create main folder
  const folder = pane.addFolder({ title: folderTitle, expanded })

  // Add regenerate button
  folder.addButton({ title: 'Regenerate All' }).on('click', regenerate)

  // Normal map controls
  const normalFolder = folder.addFolder({ title: 'Normal Map', expanded: false })
  normalFolder.addBinding(state.enabled, 'normal', { label: 'Enabled' })
  normalFolder.addBinding(state.normal, 'strength', { min: 0, max: 10, step: 0.1, label: 'Strength' })
  normalFolder.addBinding(state.normal, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  normalFolder.addBinding(state.normal, 'invertR', { label: 'Invert R' })
  normalFolder.addBinding(state.normal, 'invertG', { label: 'Invert G' })
  normalFolder.addButton({ title: 'Update Normal' }).on('click', () => {
    if (state.enabled.normal) {
      const normalMap = generator.generateNormalMap(diffuseTexture, state.normal)
      if (material) {
        material.normalMap = normalMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.normal = normalMap
      if (onUpdate) onUpdate(currentMaps)
    }
  })

  // Roughness map controls
  const roughnessFolder = folder.addFolder({ title: 'Roughness Map', expanded: false })
  roughnessFolder.addBinding(state.enabled, 'roughness', { label: 'Enabled' })
  roughnessFolder.addBinding(state.roughness, 'contrast', { min: 0, max: 3, step: 0.1, label: 'Contrast' })
  roughnessFolder.addBinding(state.roughness, 'brightness', { min: -1, max: 1, step: 0.05, label: 'Brightness' })
  roughnessFolder.addBinding(state.roughness, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  roughnessFolder.addBinding(state.roughness, 'invert', { label: 'Invert' })
  roughnessFolder.addButton({ title: 'Update Roughness' }).on('click', () => {
    if (state.enabled.roughness) {
      const roughnessMap = generator.generateRoughnessMap(diffuseTexture, state.roughness)
      if (material) {
        material.roughnessMap = roughnessMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.roughness = roughnessMap
      if (onUpdate) onUpdate(currentMaps)
    }
  })

  // Metallic map controls
  const metallicFolder = folder.addFolder({ title: 'Metallic Map', expanded: false })
  metallicFolder.addBinding(state.enabled, 'metallic', { label: 'Enabled' })
  metallicFolder.addBinding(state.metallic, 'threshold', { min: 0, max: 1, step: 0.05, label: 'Threshold' })
  metallicFolder.addBinding(state.metallic, 'contrast', { min: 0, max: 3, step: 0.1, label: 'Contrast' })
  metallicFolder.addBinding(state.metallic, 'brightness', { min: -1, max: 1, step: 0.05, label: 'Brightness' })
  metallicFolder.addBinding(state.metallic, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  metallicFolder.addBinding(state.metallic, 'invert', { label: 'Invert' })
  metallicFolder.addButton({ title: 'Update Metallic' }).on('click', () => {
    if (state.enabled.metallic) {
      const metallicMap = generator.generateMetallicMap(diffuseTexture, state.metallic)
      if (material) {
        material.metalnessMap = metallicMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.metallic = metallicMap
      if (onUpdate) onUpdate(currentMaps)
    }
  })

  // Height map controls
  const heightFolder = folder.addFolder({ title: 'Height/Displacement Map', expanded: false })
  heightFolder.addBinding(state.enabled, 'height', { label: 'Enabled' })
  heightFolder.addBinding(state.height, 'contrast', { min: 0, max: 3, step: 0.1, label: 'Contrast' })
  heightFolder.addBinding(state.height, 'brightness', { min: -1, max: 1, step: 0.05, label: 'Brightness' })
  heightFolder.addBinding(state.height, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  heightFolder.addBinding(state.height, 'invert', { label: 'Invert' })
  heightFolder.addButton({ title: 'Update Height' }).on('click', () => {
    if (state.enabled.height) {
      const heightMap = generator.generateHeightMap(diffuseTexture, state.height)
      if (material) {
        material.displacementMap = heightMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.height = heightMap
      if (onUpdate) onUpdate(currentMaps)
    }
  })

  // AO map controls
  const aoFolder = folder.addFolder({ title: 'Ambient Occlusion Map', expanded: false })
  aoFolder.addBinding(state.enabled, 'ao', { label: 'Enabled' })
  aoFolder.addBinding(state.ao, 'strength', { min: 0, max: 3, step: 0.1, label: 'Strength' })
  aoFolder.addBinding(state.ao, 'radius', { min: 1, max: 20, step: 1, label: 'Radius' })
  aoFolder.addButton({ title: 'Update AO' }).on('click', () => {
    if (state.enabled.ao) {
      const aoMap = generator.generateAOMap(diffuseTexture, state.ao)
      if (material) {
        material.aoMap = aoMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.ao = aoMap
      if (onUpdate) onUpdate(currentMaps)
    }
  })

  // Initial generation
  currentMaps = regenerate()

  return {
    folder,
    state,
    maps: currentMaps,
    regenerate,
    getMaps: () => currentMaps,
    getState: () => state,
    dispose: () => {
      folder.dispose()
    }
  }
}

/**
 * Simple preset configurations for common material types
 */
export const presets = {
  // Good for stone, concrete, brick
  rough: {
    normal: { strength: 3.0, blur: 1 },
    roughness: { contrast: 1.2, brightness: 0.1, invert: false },
    metallic: { threshold: 0.8, contrast: 2.0 },
  },
  // Good for polished surfaces, plastic
  smooth: {
    normal: { strength: 1.0, blur: 2 },
    roughness: { contrast: 0.8, brightness: -0.2, invert: true },
    metallic: { threshold: 0.7, contrast: 1.5 },
  },
  // Good for metal surfaces
  metallic: {
    normal: { strength: 2.0, blur: 1 },
    roughness: { contrast: 1.5, brightness: -0.1, invert: true },
    metallic: { threshold: 0.3, contrast: 2.0, brightness: 0.2 },
  },
  // Good for fabric, cloth
  fabric: {
    normal: { strength: 1.5, blur: 0 },
    roughness: { contrast: 0.9, brightness: 0.3, invert: false },
    metallic: { threshold: 0.9, contrast: 0.5 },
  },
  // Good for organic materials, wood, leather
  organic: {
    normal: { strength: 2.5, blur: 1 },
    roughness: { contrast: 1.1, brightness: 0.0, invert: true },
    metallic: { threshold: 0.85, contrast: 1.0 },
  },
}

export default createPBRGeneratorUI
