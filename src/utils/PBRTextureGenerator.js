/**
 * PBRTextureGenerator - Generate PBR texture maps from a diffuse/albedo image
 *
 * Generates normal and combined metallic-roughness maps using Canvas 2D processing.
 * The metallic-roughness map follows glTF convention: G=roughness, B=metallic.
 * Works with any Three.js setup (WebGL, WebGPU) or standalone.
 * Inspired by GenPBR.com
 *
 * @example
 * // With Three.js
 * import { PBRTextureGenerator } from './utils/PBRTextureGenerator.js'
 *
 * const generator = new PBRTextureGenerator()
 * const maps = await generator.generateFromURL('/textures/diffuse.jpg')
 *
 * material.map = maps.diffuse
 * material.normalMap = maps.normal
 * // Combined metallic-roughness: G=roughness, B=metallic
 * material.roughnessMap = maps.metallicRoughness
 * material.metalnessMap = maps.metallicRoughness
 *
 * @example
 * // Standalone (no Three.js)
 * import { generatePBRMaps } from './utils/PBRTextureGenerator.js'
 *
 * const image = document.getElementById('myImage')
 * const canvasMaps = generatePBRMaps(image)
 * // Returns { normal: Canvas, metallicRoughness: Canvas, height: Canvas, ao: Canvas }
 */

import * as THREE from 'three'

/**
 * Configuration options for PBR map generation
 */
export const defaultOptions = {
  normal: {
    strength: 2.0,      // Normal map intensity (0-10)
    blur: 0,            // Pre-blur radius in pixels (0-10)
    invertR: false,     // Invert red channel (X direction)
    invertG: false,     // Invert green channel (Y direction)
  },
  roughness: {
    contrast: 1.0,      // Contrast adjustment (0-3)
    brightness: 0.0,    // Brightness offset (-1 to 1)
    invert: true,       // Invert (dark = smooth by default)
    blur: 0,            // Blur radius in pixels (0-10)
  },
  metallic: {
    threshold: 0.5,     // Metallic threshold (0-1)
    contrast: 1.5,      // Contrast adjustment (0-3)
    brightness: 0.0,    // Brightness offset (-1 to 1)
    invert: false,      // Invert result
    blur: 1,            // Blur radius in pixels (0-10)
  },
  height: {
    contrast: 1.0,      // Contrast adjustment (0-3)
    brightness: 0.0,    // Brightness offset (-1 to 1)
    invert: false,      // Invert result
    blur: 1,            // Blur radius in pixels (0-10)
  },
  ao: {
    strength: 3.0,      // AO strength (0-10)
    radius: 8,          // Sample radius in pixels (1-30)
  }
}

// Helper: Get luminance from RGB
function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Helper: Get saturation from RGB
function getSaturation(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max > 0 ? (max - min) / max : 0
}

// Helper: Clamp value between min and max
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Helper: Apply box blur to image data
function applyBlur(imageData, radius) {
  if (radius <= 0) return imageData

  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(data.length)
  const size = radius * 2 + 1
  const area = size * size

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0
      let count = 0

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = clamp(x + kx, 0, width - 1)
          const ny = clamp(y + ky, 0, height - 1)
          const idx = (ny * width + nx) * 4

          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          a += data[idx + 3]
          count++
        }
      }

      const outIdx = (y * width + x) * 4
      output[outIdx] = r / count
      output[outIdx + 1] = g / count
      output[outIdx + 2] = b / count
      output[outIdx + 3] = a / count
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Generate a normal map from an image using Sobel operator
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} source - Source image
 * @param {Object} options - Generation options
 * @returns {HTMLCanvasElement} Generated normal map as canvas
 */
export function generateNormalMapCanvas(source, options = {}) {
  const opts = { ...defaultOptions.normal, ...options }

  // Get source image data
  const canvas = document.createElement('canvas')
  let width, height, ctx

  if (source instanceof ImageData) {
    width = source.width
    height = source.height
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.putImageData(source, 0, 0)
  } else {
    width = source.width || source.naturalWidth
    height = source.height || source.naturalHeight
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0)
  }

  let imageData = ctx.getImageData(0, 0, width, height)

  // Apply blur if specified
  if (opts.blur > 0) {
    imageData = applyBlur(imageData, Math.round(opts.blur))
  }

  const data = imageData.data

  // Create luminance array for Sobel calculation
  const luminance = new Float32Array(width * height)
  for (let i = 0; i < luminance.length; i++) {
    const idx = i * 4
    luminance[i] = getLuminance(data[idx], data[idx + 1], data[idx + 2]) / 255
  }

  // Create output canvas
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')
  const outputData = outputCtx.createImageData(width, height)
  const output = outputData.data

  // Sobel operator for normal generation
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample 3x3 neighborhood with edge clamping
      const getL = (ox, oy) => {
        const nx = clamp(x + ox, 0, width - 1)
        const ny = clamp(y + oy, 0, height - 1)
        return luminance[ny * width + nx]
      }

      const tl = getL(-1, -1), t = getL(0, -1), tr = getL(1, -1)
      const l = getL(-1, 0), r = getL(1, 0)
      const bl = getL(-1, 1), b = getL(0, 1), br = getL(1, 1)

      // Sobel kernels
      let dX = (tr + 2 * r + br) - (tl + 2 * l + bl)
      let dY = (bl + 2 * b + br) - (tl + 2 * t + tr)

      // Apply strength and inversion
      dX *= opts.strength * (opts.invertR ? -1 : 1)
      dY *= opts.strength * (opts.invertG ? -1 : 1)

      // Normalize
      const len = Math.sqrt(dX * dX + dY * dY + 1)
      const nx = dX / len
      const ny = dY / len
      const nz = 1 / len

      // Convert to RGB [0, 255]
      const idx = (y * width + x) * 4
      output[idx] = Math.round((nx * 0.5 + 0.5) * 255)
      output[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      output[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      output[idx + 3] = 255
    }
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

/**
 * Generate a roughness map from an image
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} source - Source image
 * @param {Object} options - Generation options
 * @returns {HTMLCanvasElement} Generated roughness map as canvas
 */
export function generateRoughnessMapCanvas(source, options = {}) {
  const opts = { ...defaultOptions.roughness, ...options }

  const canvas = document.createElement('canvas')
  let width, height, ctx

  if (source instanceof ImageData) {
    width = source.width
    height = source.height
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.putImageData(source, 0, 0)
  } else {
    width = source.width || source.naturalWidth
    height = source.height || source.naturalHeight
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0)
  }

  let imageData = ctx.getImageData(0, 0, width, height)

  if (opts.blur > 0) {
    imageData = applyBlur(imageData, Math.round(opts.blur))
  }

  const data = imageData.data
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')
  const outputData = outputCtx.createImageData(width, height)
  const output = outputData.data

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    let rough = getLuminance(data[idx], data[idx + 1], data[idx + 2]) / 255

    // Apply contrast
    rough = (rough - 0.5) * opts.contrast + 0.5

    // Apply brightness
    rough = rough + opts.brightness

    // Invert if needed
    if (opts.invert) {
      rough = 1 - rough
    }

    rough = clamp(rough, 0, 1)
    const value = Math.round(rough * 255)

    output[idx] = value
    output[idx + 1] = value
    output[idx + 2] = value
    output[idx + 3] = 255
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

/**
 * Generate a combined metallic-roughness map from an image
 * Follows glTF convention: G = roughness, B = metallic
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} source - Source image
 * @param {Object} options - Generation options with roughness and metallic sub-options
 * @returns {HTMLCanvasElement} Generated metallic-roughness map as canvas
 */
export function generateMetallicRoughnessMapCanvas(source, options = {}) {
  const roughnessOpts = { ...defaultOptions.roughness, ...options.roughness }
  const metallicOpts = { ...defaultOptions.metallic, ...options.metallic }

  const canvas = document.createElement('canvas')
  let width, height, ctx

  if (source instanceof ImageData) {
    width = source.width
    height = source.height
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.putImageData(source, 0, 0)
  } else {
    width = source.width || source.naturalWidth
    height = source.height || source.naturalHeight
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0)
  }

  const baseImageData = ctx.getImageData(0, 0, width, height)

  // Apply blur separately for roughness and metallic if needed
  let roughnessData = baseImageData
  let metallicData = baseImageData

  if (roughnessOpts.blur > 0) {
    roughnessData = applyBlur(baseImageData, Math.round(roughnessOpts.blur))
  }
  if (metallicOpts.blur > 0) {
    metallicData = applyBlur(baseImageData, Math.round(metallicOpts.blur))
  }

  const roughnessPixels = roughnessData.data
  const metallicPixels = metallicData.data

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')
  const outputData = outputCtx.createImageData(width, height)
  const output = outputData.data

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4

    // Calculate roughness from roughness-blurred data
    let rough = getLuminance(roughnessPixels[idx], roughnessPixels[idx + 1], roughnessPixels[idx + 2]) / 255
    rough = (rough - 0.5) * roughnessOpts.contrast + 0.5
    rough = rough + roughnessOpts.brightness
    if (roughnessOpts.invert) {
      rough = 1 - rough
    }
    rough = clamp(rough, 0, 1)

    // Calculate metallic from metallic-blurred data
    const r = metallicPixels[idx] / 255
    const g = metallicPixels[idx + 1] / 255
    const b = metallicPixels[idx + 2] / 255
    const lum = getLuminance(r, g, b)
    const sat = getSaturation(r, g, b)
    let metallic = lum * (1 - sat)
    const edge0 = metallicOpts.threshold - 0.1
    const edge1 = metallicOpts.threshold + 0.1
    const t = clamp((metallic - edge0) / (edge1 - edge0), 0, 1)
    metallic = t * t * (3 - 2 * t)
    metallic = (metallic - 0.5) * metallicOpts.contrast + 0.5
    metallic = metallic + metallicOpts.brightness
    if (metallicOpts.invert) {
      metallic = 1 - metallic
    }
    metallic = clamp(metallic, 0, 1)

    // Pack into glTF format: R=unused(0), G=roughness, B=metallic
    output[idx] = 0                              // R - unused
    output[idx + 1] = Math.round(rough * 255)    // G - roughness
    output[idx + 2] = Math.round(metallic * 255) // B - metallic
    output[idx + 3] = 255
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

/**
 * Generate a height/displacement map from an image
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} source - Source image
 * @param {Object} options - Generation options
 * @returns {HTMLCanvasElement} Generated height map as canvas
 */
export function generateHeightMapCanvas(source, options = {}) {
  const opts = { ...defaultOptions.height, ...options }

  const canvas = document.createElement('canvas')
  let width, height, ctx

  if (source instanceof ImageData) {
    width = source.width
    height = source.height
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.putImageData(source, 0, 0)
  } else {
    width = source.width || source.naturalWidth
    height = source.height || source.naturalHeight
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0)
  }

  let imageData = ctx.getImageData(0, 0, width, height)

  if (opts.blur > 0) {
    imageData = applyBlur(imageData, Math.round(opts.blur))
  }

  const data = imageData.data
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')
  const outputData = outputCtx.createImageData(width, height)
  const output = outputData.data

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    let height = getLuminance(data[idx], data[idx + 1], data[idx + 2]) / 255

    // Apply contrast
    height = (height - 0.5) * opts.contrast + 0.5

    // Apply brightness
    height = height + opts.brightness

    // Invert if needed
    if (opts.invert) {
      height = 1 - height
    }

    height = clamp(height, 0, 1)
    const value = Math.round(height * 255)

    output[idx] = value
    output[idx + 1] = value
    output[idx + 2] = value
    output[idx + 3] = 255
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

/**
 * Generate an ambient occlusion map from an image
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} source - Source image
 * @param {Object} options - Generation options
 * @returns {HTMLCanvasElement} Generated AO map as canvas
 */
export function generateAOMapCanvas(source, options = {}) {
  const opts = { ...defaultOptions.ao, ...options }

  const canvas = document.createElement('canvas')
  let width, height, ctx

  if (source instanceof ImageData) {
    width = source.width
    height = source.height
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.putImageData(source, 0, 0)
  } else {
    width = source.width || source.naturalWidth
    height = source.height || source.naturalHeight
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0)
  }

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Pre-compute luminance
  const luminance = new Float32Array(width * height)
  for (let i = 0; i < luminance.length; i++) {
    const idx = i * 4
    luminance[i] = getLuminance(data[idx], data[idx + 1], data[idx + 2]) / 255
  }

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputCtx = outputCanvas.getContext('2d')
  const outputData = outputCtx.createImageData(width, height)
  const output = outputData.data

  const radius = Math.round(opts.radius)
  const numDirections = 16 // More directions for smoother results
  const angleStep = (Math.PI * 2) / numDirections

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerHeight = luminance[y * width + x]
      let occlusion = 0
      let totalWeight = 0

      // Sample in multiple directions at various radii
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        for (let r = 1; r <= radius; r++) {
          const nx = clamp(Math.round(x + Math.cos(angle) * r), 0, width - 1)
          const ny = clamp(Math.round(y + Math.sin(angle) * r), 0, height - 1)
          const sampleHeight = luminance[ny * width + nx]

          // Weight falls off with distance (but not as aggressively)
          const weight = 1.0 - (r - 1) / radius

          // If surrounding is higher, this pixel is occluded
          const heightDiff = sampleHeight - centerHeight
          if (heightDiff > 0) {
            // Amplify the occlusion effect
            occlusion += heightDiff * weight * 2.0
          }
          totalWeight += weight
        }
      }

      // Normalize and apply strength
      occlusion = (occlusion / totalWeight) * opts.strength

      // Apply a curve for more dramatic effect
      occlusion = Math.pow(occlusion, 0.7)

      let ao = 1 - clamp(occlusion, 0, 1)
      const value = Math.round(ao * 255)

      const idx = (y * width + x) * 4
      output[idx] = value
      output[idx + 1] = value
      output[idx + 2] = value
      output[idx + 3] = 255
    }
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

/**
 * Generate all PBR maps from an image (standalone, returns Canvas elements)
 * @param {HTMLImageElement|HTMLCanvasElement} source - Source image
 * @param {Object} options - Generation options
 * @returns {Object} Object with canvas elements for each map type
 */
export function generatePBRMaps(source, options = {}) {
  return {
    normal: generateNormalMapCanvas(source, options.normal),
    metallicRoughness: generateMetallicRoughnessMapCanvas(source, options),
    height: generateHeightMapCanvas(source, options.height),
    ao: generateAOMapCanvas(source, options.ao),
  }
}

/**
 * Convert a canvas to a Three.js texture
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {string} colorSpace - Color space for the texture
 * @returns {THREE.CanvasTexture} Three.js texture
 */
function canvasToTexture(canvas, colorSpace = THREE.LinearSRGBColorSpace) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * PBR Texture Generator Class
 * Generates normal, roughness, metallic, height, and AO maps from a diffuse texture
 * Returns Three.js textures ready for material assignment
 */
export class PBRTextureGenerator {
  constructor() {
    this.textureLoader = new THREE.TextureLoader()
  }

  /**
   * Generate all PBR maps from a diffuse texture
   * @param {THREE.Texture} diffuseTexture - The input diffuse/albedo texture
   * @param {Object} options - Generation options (see defaultOptions)
   * @returns {Object} Object containing all generated Three.js textures
   */
  generate(diffuseTexture, options = {}) {
    const image = diffuseTexture.image

    const canvasMaps = generatePBRMaps(image, options)

    return {
      diffuse: diffuseTexture,
      normal: canvasToTexture(canvasMaps.normal),
      metallicRoughness: canvasToTexture(canvasMaps.metallicRoughness),
      height: canvasToTexture(canvasMaps.height),
      ao: canvasToTexture(canvasMaps.ao),
    }
  }

  /**
   * Generate PBR maps for specific map types only
   * @param {THREE.Texture} diffuseTexture - The input diffuse/albedo texture
   * @param {string[]} mapTypes - Array of map types: 'normal', 'metallicRoughness', 'height', 'ao'
   * @param {Object} options - Generation options
   * @returns {Object} Object containing requested Three.js textures
   */
  generateSelected(diffuseTexture, mapTypes = ['normal', 'metallicRoughness'], options = {}) {
    const image = diffuseTexture.image
    const result = { diffuse: diffuseTexture }

    if (mapTypes.includes('normal')) {
      const canvas = generateNormalMapCanvas(image, options.normal)
      result.normal = canvasToTexture(canvas)
    }

    if (mapTypes.includes('metallicRoughness')) {
      const canvas = generateMetallicRoughnessMapCanvas(image, options)
      result.metallicRoughness = canvasToTexture(canvas)
    }

    if (mapTypes.includes('height')) {
      const canvas = generateHeightMapCanvas(image, options.height)
      result.height = canvasToTexture(canvas)
    }

    if (mapTypes.includes('ao')) {
      const canvas = generateAOMapCanvas(image, options.ao)
      result.ao = canvasToTexture(canvas)
    }

    return result
  }

  /**
   * Load a texture from URL and generate all PBR maps
   * @param {string} url - URL of the diffuse texture
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Promise resolving to object with all Three.js textures
   */
  async generateFromURL(url, options = {}) {
    const diffuseTexture = await this.textureLoader.loadAsync(url)
    diffuseTexture.colorSpace = THREE.SRGBColorSpace
    return this.generate(diffuseTexture, options)
  }

  /**
   * Generate only a normal map
   * @param {THREE.Texture} diffuseTexture - The input texture
   * @param {Object} options - Normal map options
   * @returns {THREE.Texture} The generated normal map texture
   */
  generateNormalMap(diffuseTexture, options = {}) {
    const canvas = generateNormalMapCanvas(diffuseTexture.image, options)
    return canvasToTexture(canvas)
  }

  /**
   * Generate only a metallic-roughness map
   * @param {THREE.Texture} diffuseTexture - The input texture
   * @param {Object} options - Options with roughness and metallic sub-options
   * @returns {THREE.Texture} The generated metallic-roughness map texture (G=roughness, B=metallic)
   */
  generateMetallicRoughnessMap(diffuseTexture, options = {}) {
    const canvas = generateMetallicRoughnessMapCanvas(diffuseTexture.image, options)
    return canvasToTexture(canvas)
  }

  /**
   * Generate only a height/displacement map
   * @param {THREE.Texture} diffuseTexture - The input texture
   * @param {Object} options - Height map options
   * @returns {THREE.Texture} The generated height map texture
   */
  generateHeightMap(diffuseTexture, options = {}) {
    const canvas = generateHeightMapCanvas(diffuseTexture.image, options)
    return canvasToTexture(canvas)
  }

  /**
   * Generate only an ambient occlusion map
   * @param {THREE.Texture} diffuseTexture - The input texture
   * @param {Object} options - AO map options
   * @returns {THREE.Texture} The generated AO map texture
   */
  generateAOMap(diffuseTexture, options = {}) {
    const canvas = generateAOMapCanvas(diffuseTexture.image, options)
    return canvasToTexture(canvas)
  }

  /**
   * Dispose - no GPU resources to clean up in canvas mode
   */
  dispose() {
    // No-op for canvas-based implementation
  }
}

/**
 * Standalone function to create a PBR generator
 * @returns {PBRTextureGenerator}
 */
export function createPBRGenerator() {
  return new PBRTextureGenerator()
}

export default PBRTextureGenerator
