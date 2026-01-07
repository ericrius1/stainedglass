import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"

// Glass style parameters - all the knobs for exploring different glass aesthetics
export const glassParams = {
  // === Caustic Projection ===
  causticIntensity: 50,
  causticScale: 0.6,
  chromaticAberration: 0.004,
  causticOcclusion: 1.0,
  refractionStrength: 0.6,

  // === Caustic IOR (for shadow projection) ===
  causticIOR: 1.5,

  // === Glass Panel Emissive ===
  glassEmissive: 0.15,
  normalStrength: 1.0,

  // === Physical Glass Properties ===
  transmission: 0.9,
  thickness: 0.05,
  ior: 1.5,
  roughness: 0.05,
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

// Uniforms for TSL shaders
export const glassUniforms = {
  causticIntensity: uniform(glassParams.causticIntensity),
  causticScale: uniform(glassParams.causticScale),
  chromaticAberration: uniform(glassParams.chromaticAberration),
  causticOcclusion: uniform(glassParams.causticOcclusion),
  refractionStrength: uniform(glassParams.refractionStrength),
  causticIOR: uniform(glassParams.causticIOR),
  glassEmissive: uniform(glassParams.glassEmissive)
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
      if (glassMaterial.normalMap) {
        glassMaterial.normalScale.set(ev.value, ev.value)
      }
    })

  surfaceFolder
    .addBinding(glassParams, "roughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => { glassMaterial.roughness = ev.value })

  surfaceFolder
    .addBinding(glassParams, "metalness", { min: 0, max: 1, step: 0.01, label: "Metalness" })
    .on("change", (ev) => { glassMaterial.metalness = ev.value })

  // === TRANSMISSION FOLDER ===
  const transmissionFolder = pane.addFolder({ title: "Transmission", expanded: false })

  transmissionFolder
    .addBinding(glassParams, "transmission", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => { glassMaterial.transmission = ev.value })

  transmissionFolder
    .addBinding(glassParams, "thickness", { min: 0, max: 2, step: 0.01, label: "Thickness" })
    .on("change", (ev) => { glassMaterial.thickness = ev.value })

  transmissionFolder
    .addBinding(glassParams, "ior", { min: 1.0, max: 3.0, step: 0.01, label: "Material IOR" })
    .on("change", (ev) => { glassMaterial.ior = ev.value })

  transmissionFolder
    .addBinding(glassParams, "attenuationColor", { label: "Tint Color" })
    .on("change", (ev) => { glassMaterial.attenuationColor.set(ev.value) })

  transmissionFolder
    .addBinding(glassParams, "attenuationDistance", { min: 0.01, max: 5, step: 0.01, label: "Tint Distance" })
    .on("change", (ev) => { glassMaterial.attenuationDistance = ev.value })

  transmissionFolder
    .addBinding(glassParams, "dispersion", { min: 0, max: 1, step: 0.01, label: "Dispersion" })
    .on("change", (ev) => { glassMaterial.dispersion = ev.value })

  // === CLEARCOAT FOLDER ===
  const clearcoatFolder = pane.addFolder({ title: "Clearcoat", expanded: false })

  clearcoatFolder
    .addBinding(glassParams, "clearcoat", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => { glassMaterial.clearcoat = ev.value })

  clearcoatFolder
    .addBinding(glassParams, "clearcoatRoughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => { glassMaterial.clearcoatRoughness = ev.value })

  // === IRIDESCENCE FOLDER ===
  const iridescenceFolder = pane.addFolder({ title: "Iridescence", expanded: false })

  iridescenceFolder
    .addBinding(glassParams, "iridescence", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => { glassMaterial.iridescence = ev.value })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceIOR", { min: 1.0, max: 2.5, step: 0.01, label: "IOR" })
    .on("change", (ev) => { glassMaterial.iridescenceIOR = ev.value })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceThicknessMin", { min: 0, max: 500, step: 10, label: "Thickness Min" })
    .on("change", (ev) => {
      glassMaterial.iridescenceThicknessRange = [ev.value, glassParams.iridescenceThicknessMax]
    })

  iridescenceFolder
    .addBinding(glassParams, "iridescenceThicknessMax", { min: 100, max: 1000, step: 10, label: "Thickness Max" })
    .on("change", (ev) => {
      glassMaterial.iridescenceThicknessRange = [glassParams.iridescenceThicknessMin, ev.value]
    })

  // === SHEEN FOLDER ===
  const sheenFolder = pane.addFolder({ title: "Sheen", expanded: false })

  sheenFolder
    .addBinding(glassParams, "sheen", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => { glassMaterial.sheen = ev.value })

  sheenFolder
    .addBinding(glassParams, "sheenRoughness", { min: 0, max: 1, step: 0.01, label: "Roughness" })
    .on("change", (ev) => { glassMaterial.sheenRoughness = ev.value })

  sheenFolder
    .addBinding(glassParams, "sheenColor", { label: "Color" })
    .on("change", (ev) => { glassMaterial.sheenColor.set(ev.value) })

  // === SPECULAR FOLDER ===
  const specularFolder = pane.addFolder({ title: "Specular", expanded: false })

  specularFolder
    .addBinding(glassParams, "specularIntensity", { min: 0, max: 2, step: 0.01, label: "Intensity" })
    .on("change", (ev) => { glassMaterial.specularIntensity = ev.value })

  specularFolder
    .addBinding(glassParams, "specularColor", { label: "Color" })
    .on("change", (ev) => { glassMaterial.specularColor.set(ev.value) })

  // === ANISOTROPY FOLDER ===
  const anisotropyFolder = pane.addFolder({ title: "Anisotropy", expanded: false })

  anisotropyFolder
    .addBinding(glassParams, "anisotropy", { min: 0, max: 1, step: 0.01, label: "Amount" })
    .on("change", (ev) => { glassMaterial.anisotropy = ev.value })

  anisotropyFolder
    .addBinding(glassParams, "anisotropyRotation", { min: 0, max: Math.PI * 2, step: 0.01, label: "Rotation" })
    .on("change", (ev) => { glassMaterial.anisotropyRotation = ev.value })

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
