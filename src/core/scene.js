import * as THREE from "three/webgpu"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

let scene = null
let camera = null
let orbitControls = null
let orbitControlsEnabled = true

export function createScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  return scene
}

export function createCamera() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    50
  )
  camera.position.set(0, 0.8, 3)
  return camera
}

export function createControls(domElement) {
  orbitControls = new OrbitControls(camera, domElement)
  orbitControls.target.set(0, 0.5, 0)
  orbitControls.maxDistance = 50
  orbitControls.minDistance = 0.5
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.1
  orbitControls.update()
  return orbitControls
}

export function getScene() {
  return scene
}

export function getCamera() {
  return camera
}

export function getControls() {
  return orbitControls
}

export function setOrbitControlsEnabled(enabled) {
  orbitControlsEnabled = enabled
  if (orbitControls) {
    orbitControls.enabled = enabled
  }
}

export function setOrbitTarget(position) {
  if (orbitControls) {
    orbitControls.target.copy(position)
    orbitControls.target.y = 0.5 // Keep target at a reasonable height
  }
}

export function resizeCamera() {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
}

export function updateControls() {
  if (orbitControls && orbitControlsEnabled) {
    orbitControls.update()
  }
}
