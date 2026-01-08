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

  // Scene Pass - main render
  const scenePass = pass(scene, camera)
  const sceneDepth = scenePass.getTextureNode("depth")

  // Apply depth occlusion to volumetric material
  volumetricMaterial.depthNode = sceneDepth.sample(screenUV)

  // Volumetric Lighting Pass (official example uses 0.5 resolution)
  const volumetricPass = pass(scene, camera, { depthBuffer: false, samples: 0 })
  volumetricPass.setLayers(volumetricLayer)
  volumetricPass.setResolutionScale(0.5)

  // Bloom on volumetric pass - match official example: bloom(pass, 1, 1, 0)
  const bloomPass = bloom(volumetricPass, 1, 1, 0)

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
