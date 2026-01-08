import * as THREE from "three/webgpu"

let ground = null

// Create the ground plane to receive caustic shadows
export function createGround(scene) {
  const groundGeometry = new THREE.PlaneGeometry(4, 4)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.0
  })
  ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)
  return ground
}

export function getGround() {
  return ground
}
