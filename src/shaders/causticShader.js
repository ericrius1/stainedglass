import {
  Fn,
  vec3,
  vec2,
  uv,
  normalView,
  positionViewDirection,
  refract,
  div,
  texture
} from "three/tsl"
import { glassUniforms } from "../glassParams.js"

// Creates the TSL caustic shader node
// Projects stained glass colors onto shadows using caustic map + refraction + chromatic aberration
export function createCausticShader(causticMap, stainedGlassTexture, smokeAmountUniform) {
  const causticEffect = Fn(() => {
    // Calculate refraction vector based on view direction and surface normal
    const refractionVector = refract(
      positionViewDirection.negate(),
      normalView,
      div(1.0, glassUniforms.causticIOR)
    ).normalize()

    // Edge falloff based on UV distance from center (works for flat surfaces)
    // Creates vignette-like effect where caustics fade toward edges
    const uvCentered = uv().sub(0.5).mul(2.0) // -1 to 1
    const distFromCenter = uvCentered.length() // 0 at center, ~1.4 at corners
    const edgeFalloff = distFromCenter
      .mul(glassUniforms.causticOcclusion.mul(0.1))
      .clamp(0, 1)
    const viewZ = edgeFalloff.oneMinus() // 1 at center, falls off toward edges

    // UV for caustic pattern - use refraction to create wavy projection
    const causticUV = refractionVector.xy.mul(glassUniforms.causticScale)

    // Chromatic aberration offset for rainbow edges
    const chromaticOffset = normalView.z
      .abs()
      .pow(-0.9)
      .mul(glassUniforms.chromaticAberration)

    // Sample caustic map with chromatic aberration
    const causticPattern = vec3(
      texture(causticMap, causticUV.add(vec2(chromaticOffset.negate(), 0))).r,
      texture(causticMap, causticUV.add(vec2(0, chromaticOffset.negate()))).g,
      texture(causticMap, causticUV.add(vec2(chromaticOffset, chromaticOffset))).b
    )

    // Sample stained glass texture for color tinting
    const glassColor = texture(stainedGlassTexture, uv()).rgb

    // Attenuate based on fog density
    const fogAttenuation = smokeAmountUniform.mul(0.12).add(1.0).reciprocal()

    // Combine: caustic pattern * glass color * intensity + base glow
    return causticPattern
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
    return texture(stainedGlassTexture, uv()).rgb.mul(glassUniforms.glassEmissive)
  })()
}
