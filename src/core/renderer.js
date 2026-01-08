import * as THREE from "three/webgpu"

let renderer = null

export function createRenderer() {
  renderer = new THREE.WebGPURenderer({ antialias: true })
  renderer.shadowMap.enabled = true
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)
  return renderer
}

export function getRenderer() {
  return renderer
}

export function resizeRenderer() {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
