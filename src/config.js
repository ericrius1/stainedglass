// ===========================================
// CONFIGURATION - Change these flags as needed
// ===========================================

// UI visibility on startup (toggle with "/" key)
export const UI_VISIBLE_ON_START = true

// ===========================================
// Scene configuration
// ===========================================

export const LAYER_VOLUMETRIC_LIGHTING = 10

// Texture set configuration
// Each set can have: diffuse, normal, roughness, metallic, ao, height, emissive
// Add new texture sets here - system auto-detects available maps
export const textureSets = {
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
    normal: "/textures/stainedglass/eagle/eagle_normal.jpg",
    metallicRoughness:
      "/textures/stainedglass/eagle/eagle_metallicRoughness.jpg"
  }
}

// Get initial texture from URL or default
const urlParams = new URLSearchParams(window.location.search)
export const initialTexture = urlParams.get("texture") || "Solar Windmill"

// Count available texture sets
export const numTextureSets = Object.keys(textureSets).length

// Default scene parameters
export const defaultParams = {
  texture: initialTexture,
  // Panel layout (legacy - kept for compatibility)
  numPanels: 1,
  panelGap: 0.1,
  panelWidth: 0.8,
  // Fog & Bloom
  smokeAmount: 4,
  bloomIntensity: 1.2,
  fogBoundsX: 5,
  fogBoundsY: 3,
  fogBoundsZ: 5,
  // Castle mode
  useCastle: true
}

// Castle generator defaults
export const defaultCastleParams = {
  seed: 42, // Fixed seed for reproducible generation
  towerCount: 4,
  towerRadius: 0.12,
  towerHeight: 1.0,
  wallHeight: 0.8,
  wallThickness: 0.1,
  baseRadius: 1.0,
  windowHeight: 0.5,
  windowWidth: 0.35,
  crenelationHeight: 0.08,
  crenelationCount: 6
}
