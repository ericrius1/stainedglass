import * as THREE from "three/webgpu"

let ground = null

// Create the ground plane to receive shadows and caustic light
export function createGround(scene) {
  // Larger ground for better scene coverage
  const groundGeometry = new THREE.PlaneGeometry(10, 10)

  // Slightly lighter material so shadows and light are more visible
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.9,
    metalness: 0.0
  })

  ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01 // Slightly below origin to avoid z-fighting
  ground.receiveShadow = true
  scene.add(ground)

  return ground
}

export function getGround() {
  return ground
}
