import * as THREE from "three/webgpu"
import { LAYER_VOLUMETRIC_LIGHTING } from "../config.js"

let spotLight = null
let ambientLight = null

// Create the spotlight positioned above, shining down through the glass
export function createSpotLight(scene) {
  // Main spotlight for volumetric lighting
  spotLight = new THREE.SpotLight(0xfff8e0, 5)
  spotLight.position.set(0, 2.5, 0)
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.angle = Math.PI / 3
  spotLight.penumbra = 0.8
  spotLight.decay = 1.5
  spotLight.distance = 6
  spotLight.shadow.mapType = THREE.HalfFloatType
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.1
  spotLight.shadow.camera.far = 5
  spotLight.shadow.bias = -0.001
  spotLight.shadow.intensity = 1
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)

  // Subtle ambient light to fill shadows
  ambientLight = new THREE.AmbientLight(0x303040, 0.3)
  scene.add(ambientLight)

  return spotLight
}

export function getSpotLight() {
  return spotLight
}
