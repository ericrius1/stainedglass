import * as THREE from "three/webgpu"
import {
  Fn,
  vec3,
  float,
  time,
  frameId,
  screenCoordinate,
  texture3D
} from "three/tsl"
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js"
import { bayer16 } from "three/examples/jsm/tsl/math/Bayer.js"

// Creates a 3D noise texture for volumetric fog
export function createNoise3DTexture() {
  let i = 0
  const size = 128
  const data = new Uint8Array(size * size * size)
  const scale = 8
  const perlin = new ImprovedNoise()
  const repeatFactor = 4.0

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * repeatFactor
        const ny = (y / size) * repeatFactor
        const nz = (z / size) * repeatFactor
        const noiseValue = perlin.noise(nx * scale, ny * scale, nz * scale)
        data[i] = 128 + 128 * noiseValue
        i++
        
      }
    }
  }

  const tex = new THREE.Data3DTexture(data, size, size, size)
  tex.format = THREE.RedFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

// Creates volumetric material for fog - matching official Three.js example
export function createVolumetricMaterial(noiseTexture3D, smokeAmountUniform) {
  const volumetricMaterial = new THREE.VolumeNodeMaterial()
  volumetricMaterial.steps = 20 // Match official example
  volumetricMaterial.offsetNode = bayer16(screenCoordinate.add(frameId))

  volumetricMaterial.scatteringNode = Fn(({ positionRay }) => {
    // Time-based animation for fog movement (from official example)
    const timeScaled = vec3(time.mul(0.01), float(0), time.mul(0.03))

    const sampleGrain = (scale, timeScale = 1) =>
      texture3D(
        noiseTexture3D,
        positionRay.add(timeScaled.mul(timeScale)).mul(scale).mod(1),
        0
      ).r.add(0.5)

    // Multi-octave noise for organic fog (matching official example)
    let density = sampleGrain(1)
    density = density.mul(sampleGrain(0.5, 1))
    density = density.mul(sampleGrain(0.2, 2))

    // smokeAmount controls fog density blend
    return smokeAmountUniform.mix(1, density)
  })

  return volumetricMaterial
}
