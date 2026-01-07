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
      metallicRoughness: true,
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
      if (currentMaps.metallicRoughness && state.enabled.metallicRoughness) {
        // Combined texture: G=roughness, B=metallic
        material.roughnessMap = currentMaps.metallicRoughness
        material.metalnessMap = currentMaps.metallicRoughness
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

  // Combined Metallic-Roughness map controls
  const mrFolder = folder.addFolder({ title: 'Metallic-Roughness Map', expanded: false })
  mrFolder.addBinding(state.enabled, 'metallicRoughness', { label: 'Enabled' })

  // Roughness sub-controls
  const roughnessSubFolder = mrFolder.addFolder({ title: 'Roughness', expanded: false })
  roughnessSubFolder.addBinding(state.roughness, 'contrast', { min: 0, max: 3, step: 0.1, label: 'Contrast' })
  roughnessSubFolder.addBinding(state.roughness, 'brightness', { min: -1, max: 1, step: 0.05, label: 'Brightness' })
  roughnessSubFolder.addBinding(state.roughness, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  roughnessSubFolder.addBinding(state.roughness, 'invert', { label: 'Invert' })

  // Metallic sub-controls
  const metallicSubFolder = mrFolder.addFolder({ title: 'Metallic', expanded: false })
  metallicSubFolder.addBinding(state.metallic, 'threshold', { min: 0, max: 1, step: 0.05, label: 'Threshold' })
  metallicSubFolder.addBinding(state.metallic, 'contrast', { min: 0, max: 3, step: 0.1, label: 'Contrast' })
  metallicSubFolder.addBinding(state.metallic, 'brightness', { min: -1, max: 1, step: 0.05, label: 'Brightness' })
  metallicSubFolder.addBinding(state.metallic, 'blur', { min: 0, max: 10, step: 1, label: 'Blur' })
  metallicSubFolder.addBinding(state.metallic, 'invert', { label: 'Invert' })

  mrFolder.addButton({ title: 'Update Metallic-Roughness' }).on('click', () => {
    if (state.enabled.metallicRoughness) {
      const mrMap = generator.generateMetallicRoughnessMap(diffuseTexture, state)
      if (material) {
        material.roughnessMap = mrMap
        material.metalnessMap = mrMap
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.metallicRoughness = mrMap
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

  const updateAO = () => {
    if (state.enabled.ao) {
      const aoMap = generator.generateAOMap(diffuseTexture, state.ao)
      if (material) {
        material.aoMap = aoMap
        // Ensure geometry has uv2 for AO to work
        if (material.aoMap && material.geometry && !material.geometry.attributes.uv2) {
          console.warn('PBRGeneratorUI: Geometry needs uv2 attribute for aoMap. Copy uv to uv2.')
        }
        material.needsUpdate = true
      }
      if (currentMaps) currentMaps.ao = aoMap
      if (onUpdate) onUpdate(currentMaps)
    }
  }

  aoFolder.addBinding(state.ao, 'strength', { min: 0, max: 10, step: 0.1, label: 'Strength' })
    .on('change', updateAO)
  aoFolder.addBinding(state.ao, 'radius', { min: 1, max: 30, step: 1, label: 'Radius' })
    .on('change', updateAO)
  aoFolder.addButton({ title: 'Update AO' }).on('click', updateAO)

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
