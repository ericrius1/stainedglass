import * as THREE from "three/webgpu"

// Art installation parameters
export const installationParams = {
  roughness: 0.8,
  metalness: 0.2,
  rotationY: 0, // degrees
  color: "#111111"
}

let installationMesh = null
let installationMaterial = null

export function createArtInstallation(scene) {
  // Screen geometry - similar proportions to floor but smaller
  const screenGeometry = new THREE.PlaneGeometry(1.0, 0.6)
  screenGeometry.rotateX(-Math.PI / 2)

  // Material similar to floor with adjustable properties
  installationMaterial = new THREE.MeshStandardMaterial({
    // color: new THREE.Color(installationParams.color),
    // roughness: installationParams.roughness,
    // metalness: installationParams.metalness,

    emissive: new THREE.Color("#ffffff"), // side: THREE.DoubleSide
    emissiveIntensity: 2
  })

  installationMesh = new THREE.Mesh(screenGeometry, installationMaterial)

  // Position 0.5m above floor, vertical orientation
  installationMesh.position.set(0, 0.5, -0.8)
  installationMesh.rotation.y = THREE.MathUtils.degToRad(
    installationParams.rotationY
  )

  // Enable shadows
  installationMesh.receiveShadow = true
  installationMesh.castShadow = true

  scene.add(installationMesh)

  return installationMesh
}

export function setupInstallationPane(pane) {
  const folder = pane.addFolder({ title: "Art Installation", expanded: true })

  folder
    .addBinding(installationParams, "rotationY", {
      min: -180,
      max: 180,
      step: 1,
      label: "Rotation Y"
    })
    .on("change", (ev) => {
      if (installationMesh) {
        installationMesh.rotation.y = THREE.MathUtils.degToRad(ev.value)
      }
    })

  folder
    .addBinding(installationParams, "roughness", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Roughness"
    })
    .on("change", (ev) => {
      if (installationMaterial) {
        installationMaterial.roughness = ev.value
      }
    })

  folder
    .addBinding(installationParams, "metalness", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Metalness"
    })
    .on("change", (ev) => {
      if (installationMaterial) {
        installationMaterial.metalness = ev.value
      }
    })

  folder
    .addBinding(installationParams, "color", {
      label: "Color"
    })
    .on("change", (ev) => {
      if (installationMaterial) {
        installationMaterial.color.set(ev.value)
      }
    })
}
