import * as THREE from "three/webgpu"
import { pass, screenUV } from "three/tsl"
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js"
import { LAYER_VOLUMETRIC_LIGHTING } from "../config.js"

let postProcessing = null

// Create post-processing pipeline
export function createPostProcessing(renderer, scene, camera, volumetricMaterial, volumetricLightingIntensity) {
  postProcessing = new THREE.PostProcessing(renderer)

  const volumetricLayer = new THREE.Layers()
  volumetricLayer.disableAll()
  volumetricLayer.enable(LAYER_VOLUMETRIC_LIGHTING)

  // Scene Pass
  const scenePass = pass(scene, camera)
  const sceneDepth = scenePass.getTextureNode("depth")

  // Apply depth occlusion to volumetric material
  volumetricMaterial.depthNode = sceneDepth.sample(screenUV)

  // Volumetric Lighting Pass
  const volumetricPass = pass(scene, camera, { depthBuffer: false, samples: 0 })
  volumetricPass.setLayers(volumetricLayer)
  volumetricPass.setResolutionScale(0.75)

  // Bloom on volumetric pass - lower threshold to capture more light
  const bloomPass = bloom(volumetricPass, 0.3, 0.6, 0)

  // Compose final output
  const scenePassColor = scenePass.add(
    bloomPass.mul(volumetricLightingIntensity)
  )
  postProcessing.outputNode = scenePassColor

  return postProcessing
}

export function getPostProcessing() {
  return postProcessing
}

export function renderPostProcessing() {
  if (postProcessing) {
    postProcessing.render()
  }
}
