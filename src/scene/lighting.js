import * as THREE from "three/webgpu"
import { LAYER_VOLUMETRIC_LIGHTING, numTextureSets } from "../config.js"

let spotLight = null
let ambientLight = null
let windowLights = []

// Create lighting for the scene
export function createSpotLight(scene) {
  // Main spotlight for volumetric lighting and caustics (skylight)
  // Positioned directly above to shine through skylight onto floor
  spotLight = new THREE.SpotLight(0xffffff, 1)
  spotLight.position.set(0, 3, 0) // Directly above center
  spotLight.target.position.set(0, 0, 0)
  spotLight.castShadow = true
  spotLight.shadow.mapType = THREE.HalfFloatType // HDR caustics
  spotLight.shadow.mapSize.width = 2048
  spotLight.shadow.mapSize.height = 2048
  spotLight.shadow.camera.near = 0.5
  spotLight.shadow.camera.far = 6
  spotLight.shadow.camera.fov = 60
  spotLight.shadow.bias = -0.0001
  spotLight.angle = Math.PI / 4
  spotLight.penumbra = 0.3
  spotLight.decay = 1.5
  spotLight.distance = 10
  spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(spotLight)
  scene.add(spotLight.target)

  // Add external lights for each side window
  // These shine from outside through the windows into the castle
  const numWindows = numTextureSets
  const lightRadius = 2.5 // Distance from center (outside castle walls)
  const lightHeight = 0.6 // Window height level

  for (let i = 0; i < numWindows; i++) {
    const angle = (i / numWindows) * Math.PI * 2

    // Position light outside the castle, pointing inward through window
    const lightX = Math.cos(angle) * lightRadius
    const lightZ = Math.sin(angle) * lightRadius

    // Target is the center of the castle (where light should project to)
    const targetX = Math.cos(angle) * 0.3
    const targetZ = Math.sin(angle) * 0.3

    const windowLight = new THREE.SpotLight(0xffffff, 0.8)
    windowLight.position.set(lightX, lightHeight, lightZ)
    windowLight.target.position.set(targetX, 0, targetZ)
    windowLight.castShadow = true
    windowLight.shadow.mapType = THREE.HalfFloatType
    windowLight.shadow.mapSize.width = 1024
    windowLight.shadow.mapSize.height = 1024
    windowLight.shadow.camera.near = 0.3
    windowLight.shadow.camera.far = 4
    windowLight.shadow.bias = -0.0002
    windowLight.angle = Math.PI / 6 // Narrow beam through window
    windowLight.penumbra = 0.4
    windowLight.decay = 1.5
    windowLight.distance = 6
    windowLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)

    scene.add(windowLight)
    scene.add(windowLight.target)
    windowLights.push(windowLight)
  }

  // Soft ambient light
  ambientLight = new THREE.AmbientLight(0x404050, 0.4)
  scene.add(ambientLight)

  return spotLight
}

export function getSpotLight() {
  return spotLight
}

export function getWindowLights() {
  return windowLights
}
