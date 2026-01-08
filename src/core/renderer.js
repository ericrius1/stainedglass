import * as THREE from "three/webgpu"

let renderer = null

export function createRenderer() {
  renderer = new THREE.WebGPURenderer({ antialias: true })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap for performance
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  document.body.appendChild(renderer.domElement)
  return renderer
}

export async function initRenderer() {
  if (renderer) {
    await renderer.init()
  }
}

export function getRenderer() {
  return renderer
}

export function resizeRenderer() {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
