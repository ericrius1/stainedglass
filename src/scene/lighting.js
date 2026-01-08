import * as THREE from "three/webgpu"
import { LAYER_VOLUMETRIC_LIGHTING } from "../config.js"

let spotLight = null

// Create the spotlight positioned above, shining down through the glass
export function createSpotLight(scene) {
  spotLight = new THREE.SpotLight(0xffffff, 3)
  spotLight.position.set(0, 1.8, 0)
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.angle = Math.PI / 4
  spotLight.penumbra = 1
  spotLight.decay = 1
  spotLight.distance = 5
  spotLight.shadow.mapType = THREE.HalfFloatType
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.1
  spotLight.shadow.camera.far = 3
  spotLight.shadow.bias = -0.001
  spotLight.shadow.intensity = 1
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)
  return spotLight
}

export function getSpotLight() {
  return spotLight
}
