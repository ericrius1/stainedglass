import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import { getWindowMaterials } from "./materials/glassMaterialFactory.js"

// Helper to update property on all window materials
function updateAllMaterials(property, value) {
  const materials = getWindowMaterials()
  materials.forEach(mat => {
    if (mat && mat[property] !== undefined) {
      mat[property] = value
    }
  })
}

// Helper to update color property on all window materials
function updateAllMaterialsColor(property, value) {
  const materials = getWindowMaterials()
  materials.forEach(mat => {
    if (mat && mat[property]) {
      mat[property].set(value)
    }
  })
}

// Helper to update normal scale on all window materials
function updateAllNormalScales(value) {
  const materials = getWindowMaterials()
  materials.forEach(mat => {
    if (mat && mat.normalMap) {
      mat.normalScale.set(value, value)
    }
  })
}

// Helper to update iridescence thickness on all window materials
function updateAllIridescenceThickness(min, max) {
  const materials = getWindowMaterials()
  materials.forEach(mat => {
    if (mat) {
      mat.iridescenceThicknessRange = [min, max]
    }
  })
}

// Glass style parameters - all the knobs for exploring different glass aesthetics
export const glassParams = {
  // === Caustic Projection ===
  causticIntensity: 80,
  causticScale: 0.8,
  chromaticAberration: 0.006,
  causticOcclusion: 2.0,
  refractionStrength: 0.6,

  // === Caustic IOR (for shadow projection) ===
  causticIOR: 1.5,

  // === Glass Panel Emissive ===
  glassEmissive: 1.2,
  normalStrength: 1.0,

  // === Physical Glass Properties ===
  transmission: 0.6,
  thickness: 0.1,
  ior: 1.5,
  roughness: 0.02,
  metalness: 0.0,

  // === Clearcoat (glossy layer on top) ===
  clearcoat: 0.0,
  clearcoatRoughness: 0.0,

  // === Sheen (soft glow at grazing angles) ===
  sheen: 0.0,
  sheenRoughness: 0.5,
  sheenColor: "#ffffff",

  // === Iridescence (rainbow oil-slick effect) ===
  iridescence: 0.0,
  iridescenceIOR: 1.3,
  iridescenceThicknessMin: 100,
  iridescenceThicknessMax: 400,

  // === Specular ===
  specularIntensity: 1.0,
  specularColor: "#ffffff",

  // === Attenuation (colored shadows inside thick glass) ===
  attenuationColor: "#ffffff",
  attenuationDistance: 0.5,

  // === Dispersion (rainbow splitting at edges) ===
  dispersion: 0.0,

  // === Anisotropy (directional reflections) ===
  anisotropy: 0.0,
  anisotropyRotation: 0.0
}

// Uniforms for TSL shaders - initialize from glassParams
export const glassUniforms = {
  causticIntensity: uniform(80),
  causticScale: uniform(0.8),
  chromaticAberration: uniform(0.006),
  causticOcclusion: uniform(2.0),
  refractionStrength: uniform(0.6),
  causticIOR: uniform(1.5),
  glassEmissive: uniform(1.2)
}

// Setup Tweakpane bindings for glass parameters
export function setupGlassPane(pane, glassMaterial) {
  // === CAUSTICS FOLDER ===
  const causticsFolder = pane.addFolder({ title: "Caustics", expanded: true })

  causticsFolder
    .addBinding(glassParams, "causticIntensity", { min: 1, max: 200, step: 1, label: "Intensity" })
    .on("change", (ev) => { glassUniforms.causticIntensity.value = ev.value })

  causticsFolder
    .addBinding(glassParams, "causticScale", { min: 0.05, max: 3.0, step: 0.05, label: "Pattern Scale" })
    .on("change", (ev) => { glassUniforms.causticScale.value = ev.value })

  causticsFolder
    .addBinding(glassParams, "chromaticAberration", { min: 0, max: 0.05, step: 0.001, label: "Chromatic" })
    .on("change", (ev) => { glassUniforms.chromaticAberration.value = ev.value })

  causticsFolder
    .addBinding(glassParams, "causticOcclusion", { min: 0, max: 30, step: 0.5, label: "Edge Falloff" })
    .on("change", (ev) => { glassUniforms.causticOcclusion.value = ev.value })

  causticsFolder
    .addBinding(glassParams, "causticIOR", { min: 0.5, max: 3.0, step: 0.05, label: "Refraction IOR" })
    .on("change", (ev) => { glassUniforms.causticIOR.value = ev.value })

  // === GLASS SURFACE FOLDER ===
  const surfaceFolder = pane.addFolder({ title: "Glass Surface", expanded: true })

  surfaceFolder
    .addBinding(glassParams, "glassEmissive", { min: 0, max: 2, step: 0.05, label: "Glow" })
    .on("change", (ev) => { glassUniforms.glassEmissive.value = ev.value })

  surfaceFolder
    .addBinding(glassParams, "normalStrength", { min: 0, max: 5, step: 0.1, label: "Normal Strength" })
    .on("change", (ev) => {
      if (glassMaterial && glassMaterial.normalMap) {
        glassMaterial.normalScale.set(ev.value, ev.value)
      }
      updateAllNormalScales(ev.value)
    })

  surfaceFolder
    .addBinding(glassParams, "roughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.roughness = ev.value
      updateAllMaterials("roughness", ev.value)
    })

  surfaceFolder
    .addBinding(glassParams, "metalness", { min: 0, max: 1, step: 0.01, label: "Metalness" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.metalness = ev.value
      updateAllMaterials("metalness", ev.value)
    })

  // === TRANSMISSION FOLDER ===
  const transmissionFolder = pane.addFolder({ title: "Transmission", expanded: false })

  transmissionFolder
    .addBinding(glassParams, "transmission", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.transmission = ev.value
      updateAllMaterials("transmission", ev.value)
    })

  transmissionFolder
    .addBinding(glassParams, "thickness", { min: 0, max: 2, step: 0.01, label: "Thickness" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.thickness = ev.value
      updateAllMaterials("thickness", ev.value)
    })

  transmissionFolder
    .addBinding(glassParams, "ior", { min: 1.0, max: 3.0, step: 0.01, label: "Material IOR" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.ior = ev.value
      updateAllMaterials("ior", ev.value)
    })

  transmissionFolder
    .addBinding(glassParams, "attenuationColor", { label: "Tint Color" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.attenuationColor.set(ev.value)
      updateAllMaterialsColor("attenuationColor", ev.value)
    })

  transmissionFolder
    .addBinding(glassParams, "attenuationDistance", { min: 0.01, max: 5, step: 0.01, label: "Tint Distance" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.attenuationDistance = ev.value
      updateAllMaterials("attenuationDistance", ev.value)
    })

  transmissionFolder
    .addBinding(glassParams, "dispersion", { min: 0, max: 1, step: 0.01, label: "Dispersion" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.dispersion = ev.value
      updateAllMaterials("dispersion", ev.value)
    })

  // === CLEARCOAT FOLDER ===
  const clearcoatFolder = pane.addFolder({ title: "Clearcoat", expanded: false })

  clearcoatFolder
    .addBinding(glassParams, "clearcoat", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.clearcoat = ev.value
      updateAllMaterials("clearcoat", ev.value)
    })

  clearcoatFolder
    .addBinding(glassParams, "clearcoatRoughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.clearcoatRoughness = ev.value
      updateAllMaterials("clearcoatRoughness", ev.value)
    })

  // === IRIDESCENCE FOLDER ===
  const iridescenceFolder = pane.addFolder({ title: "Iridescence", expanded: false })

  iridescenceFolder
    .addBinding(glassParams, "iridescence", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.iridescence = ev.value
      updateAllMaterials("iridescence", ev.value)
    })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceIOR", { min: 1.0, max: 2.5, step: 0.01, label: "IOR" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.iridescenceIOR = ev.value
      updateAllMaterials("iridescenceIOR", ev.value)
    })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceThicknessMin", { min: 0, max: 500, step: 10, label: "Thickness Min" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.iridescenceThicknessRange = [ev.value, glassParams.iridescenceThicknessMax]
      updateAllIridescenceThickness(ev.value, glassParams.iridescenceThicknessMax)
    })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceThicknessMax", { min: 100, max: 1000, step: 10, label: "Thickness Max" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.iridescenceThicknessRange = [glassParams.iridescenceThicknessMin, ev.value]
      updateAllIridescenceThickness(glassParams.iridescenceThicknessMin, ev.value)
    })

  // === SHEEN FOLDER ===
  const sheenFolder = pane.addFolder({ title: "Sheen", expanded: false })

  sheenFolder
    .addBinding(glassParams, "sheen", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.sheen = ev.value
      updateAllMaterials("sheen", ev.value)
    })

  sheenFolder
    .addBinding(glassParams, "sheenRoughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.sheenRoughness = ev.value
      updateAllMaterials("sheenRoughness", ev.value)
    })

  sheenFolder
    .addBinding(glassParams, "sheenColor", { label: "Color" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.sheenColor.set(ev.value)
      updateAllMaterialsColor("sheenColor", ev.value)
    })

  // === SPECULAR FOLDER ===
  const specularFolder = pane.addFolder({ title: "Specular", expanded: false })

  specularFolder
    .addBinding(glassParams, "specularIntensity", { min: 0, max: 2, step: 0.01, label: "Intensity" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.specularIntensity = ev.value
      updateAllMaterials("specularIntensity", ev.value)
    })

  specularFolder
    .addBinding(glassParams, "specularColor", { label: "Color" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.specularColor.set(ev.value)
      updateAllMaterialsColor("specularColor", ev.value)
    })

  // === ANISOTROPY FOLDER ===
  const anisotropyFolder = pane.addFolder({ title: "Anisotropy", expanded: false })

  anisotropyFolder
    .addBinding(glassParams, "anisotropy", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.anisotropy = ev.value
      updateAllMaterials("anisotropy", ev.value)
    })

  anisotropyFolder
    .addBinding(glassParams, "anisotropyRotation", { min: 0, max: Math.PI * 2, step: 0.01, label: "Rotation" })
    .on("change", (ev) => {
      if (glassMaterial) glassMaterial.anisotropyRotation = ev.value
      updateAllMaterials("anisotropyRotation", ev.value)
    })

  return {
    causticsFolder,
    surfaceFolder,
    transmissionFolder,
    clearcoatFolder,
    iridescenceFolder,
    sheenFolder,
    specularFolder,
    anisotropyFolder
  }
}

// Get param configs for hand tracking axis mapping
export function getParamConfigs() {
  return {
    causticScale: { min: 0.05, max: 3.0, uniform: glassUniforms.causticScale },
    chromaticAberration: { min: 0, max: 0.05, uniform: glassUniforms.chromaticAberration },
    causticIOR: { min: 0.5, max: 3.0, uniform: glassUniforms.causticIOR },
    causticIntensity: { min: 1, max: 200, uniform: glassUniforms.causticIntensity },
    glassEmissive: { min: 0, max: 2, uniform: glassUniforms.glassEmissive }
  }
}
