import * as THREE from "three/webgpu"
import { LAYER_VOLUMETRIC_LIGHTING } from "../config.js"
import { createNoise3DTexture, createVolumetricMaterial } from "../shaders/volumetricShader.js"

let volumetricMesh = null
let volumetricMaterial = null
let noiseTexture3D = null

// Create the volumetric fog box
export function createFogVolume(scene, params, smokeAmountUniform) {
  noiseTexture3D = createNoise3DTexture()
  volumetricMaterial = createVolumetricMaterial(noiseTexture3D, smokeAmountUniform)

  volumetricMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      params.fogBoundsX,
      params.fogBoundsY,
      params.fogBoundsZ
    ),
    volumetricMaterial
  )
  volumetricMesh.receiveShadow = false
  volumetricMesh.position.y = params.fogBoundsY / 2
  volumetricMesh.layers.disableAll()
  volumetricMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  scene.add(volumetricMesh)

  return { volumetricMesh, volumetricMaterial }
}

// Update fog bounds geometry
export function updateFogBounds(params) {
  if (volumetricMesh) {
    volumetricMesh.geometry.dispose()
    volumetricMesh.geometry = new THREE.BoxGeometry(
      params.fogBoundsX,
      params.fogBoundsY,
      params.fogBoundsZ
    )
    volumetricMesh.position.y = params.fogBoundsY / 2
  }
}

export function getVolumetricMesh() {
  return volumetricMesh
}

export function getVolumetricMaterial() {
  return volumetricMaterial
}
