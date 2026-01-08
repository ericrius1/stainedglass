import * as THREE from "three/webgpu"
import { LAYER_VOLUMETRIC_LIGHTING } from "../config.js"

let spotLight = null
let ambientLight = null

// Create lighting for the scene - matching official example setup
export function createSpotLight(scene) {
  // Main spotlight for volumetric lighting and caustics
  // Positioned directly above to shine through skylight onto floor
  spotLight = new THREE.SpotLight(0xffffff, 1)
  spotLight.position.set(0, 3, 0) // Directly above center
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.shadow.mapType = THREE.HalfFloatType // HDR caustics like official example
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.5
  spotLight.shadow.camera.far = 6
  spotLight.shadow.camera.fov = 60
  spotLight.shadow.bias = -0.0001
  spotLight.angle = Math.PI / 4 // Narrower for focused caustics
  spotLight.penumbra = 0.3
  spotLight.decay = 1.5
  spotLight.distance = 10
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)

  // Soft ambient light
  ambientLight = new THREE.AmbientLight(0x404050, 0.4)
  scene.add(ambientLight)

  return spotLight
}

export function getSpotLight() {
  return spotLight
}
