import * as THREE from "three/webgpu"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

let scene = null
let camera = null
let controls = null

export function createScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  return scene
}

export function createCamera() {
  camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    20
  )
  camera.position.set(-1.5, 1.0, 1.5)
  return camera
}

export function createControls(domElement) {
  controls = new OrbitControls(camera, domElement)
  controls.target.set(0, 0.5, 0)
  controls.maxDistance = 50
  controls.minDistance = 0.5
  controls.update()
  return controls
}

export function getScene() {
  return scene
}

export function getCamera() {
  return camera
}

export function getControls() {
  return controls
}

export function resizeCamera() {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
}

export function updateControls() {
  if (controls) {
    controls.update()
  }
}
