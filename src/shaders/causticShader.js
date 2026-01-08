import {
  Fn,
  vec3,
  vec2,
  float,
  uv,
  normalView,
  positionViewDirection,
  refract,
  div,
  texture,
  time,
  sin,
  mix,
  clamp
} from "three/tsl"
import { glassUniforms } from "../glassParams.js"

// Creates the TSL caustic shader node
// Based on Three.js webgpu_volume_caustics example
export function createCausticShader(causticMap, stainedGlassTexture, smokeAmountUniform) {
  const causticEffect = Fn(() => {
    // Calculate refraction vector based on view direction and surface normal
    const refractionVector = refract(
      positionViewDirection.negate(),
      normalView,
      div(1.0, glassUniforms.causticIOR)
    ).normalize()

    // UV for caustic pattern - use refraction to create wavy projection
    const textureUV = refractionVector.xy.mul(glassUniforms.causticScale)

    // Chromatic aberration offset for rainbow edges (from official example)
    const chromaticAberrationOffset = normalView.z.abs().pow(-0.9).mul(glassUniforms.chromaticAberration)

    // viewZ - depth-based falloff from center (approximating the official example)
    const uvCentered = uv().sub(0.5).mul(2.0)
    const distFromCenter = uvCentered.length()
    const viewZ = clamp(
      float(1.0).sub(distFromCenter.mul(glassUniforms.causticOcclusion.mul(0.3))),
      float(0.0),
      float(1.0)
    )

    // Sample caustic map with chromatic aberration (matching official example pattern)
    const causticProjection = vec3(
      texture(causticMap, textureUV.add(vec2(chromaticAberrationOffset.negate(), 0))).r,
      texture(causticMap, textureUV.add(vec2(0, chromaticAberrationOffset.negate()))).g,
      texture(causticMap, textureUV.add(vec2(chromaticAberrationOffset, chromaticAberrationOffset))).b
    )

    // Sample stained glass texture for color tinting
    const glassColor = texture(stainedGlassTexture, uv()).rgb

    // Attenuate based on fog density
    const fogAttenuation = smokeAmountUniform.mul(0.1).add(1.0).reciprocal()

    // Final caustic effect - HIGH INTENSITY like official example (60)
    // causticProjection * viewZ * intensity + viewZ (base glow)
    return causticProjection
      .mul(viewZ.mul(glassUniforms.causticIntensity))
      .add(viewZ)
      .mul(glassColor)
      .mul(fogAttenuation)
  })().toVar()

  return causticEffect
}

// Creates the emissive glow shader for the glass panel itself
export function createGlassEmissiveShader(stainedGlassTexture) {
  return Fn(() => {
    const baseColor = texture(stainedGlassTexture, uv()).rgb

    // Subtle animation
    const pulse = sin(time.mul(0.4)).mul(0.08).add(1.0)

    // Base emissive glow
    return baseColor.mul(glassUniforms.glassEmissive).mul(pulse)
  })()
}
