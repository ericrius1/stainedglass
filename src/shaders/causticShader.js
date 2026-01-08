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
  cos,
  mix,
  smoothstep,
  pow
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

    // Animate caustic pattern for shimmering light effect
    const timeOffset = time.mul(0.3)
    const shimmer = sin(timeOffset.add(uvCentered.x.mul(3))).mul(0.02)

    // UV for caustic pattern - use refraction to create wavy projection with animation
    const causticUV = refractionVector.xy.mul(glassUniforms.causticScale).add(shimmer)

    // Chromatic aberration offset for rainbow edges - enhanced for more color separation
    const chromaticOffset = normalView.z
      .abs()
      .pow(-0.9)
      .mul(glassUniforms.chromaticAberration)

    // Sample caustic map with chromatic aberration at multiple scales for richness
    const causticPattern1 = vec3(
      texture(causticMap, causticUV.add(vec2(chromaticOffset.negate(), 0))).r,
      texture(causticMap, causticUV.add(vec2(0, chromaticOffset.negate()))).g,
      texture(causticMap, causticUV.add(vec2(chromaticOffset, chromaticOffset))).b
    )

    // Second layer at different scale for more detail
    const causticUV2 = causticUV.mul(2.0).add(timeOffset.mul(0.1))
    const causticPattern2 = vec3(
      texture(causticMap, causticUV2.add(vec2(chromaticOffset.negate().mul(0.5), 0))).r,
      texture(causticMap, causticUV2.add(vec2(0, chromaticOffset.negate().mul(0.5)))).g,
      texture(causticMap, causticUV2.add(vec2(chromaticOffset.mul(0.5), chromaticOffset.mul(0.5)))).b
    )

    // Blend caustic layers
    const causticPattern = mix(causticPattern1, causticPattern2, float(0.3))

    // Sample stained glass texture for color tinting
    const glassColor = texture(stainedGlassTexture, uv()).rgb

    // Enhance saturation of glass color for more vivid light beams
    const colorLuminance = glassColor.r.mul(0.299).add(glassColor.g.mul(0.587)).add(glassColor.b.mul(0.114))
    const saturatedColor = mix(vec3(colorLuminance), glassColor, float(1.3))

    // Attenuate based on fog density
    const fogAttenuation = smokeAmountUniform.mul(0.08).add(1.0).reciprocal()

    // Combine: caustic pattern * glass color * intensity + base glow
    return causticPattern
      .mul(viewZ.mul(glassUniforms.causticIntensity))
      .add(viewZ.mul(0.5))
      .mul(saturatedColor)
      .mul(fogAttenuation)
  })().toVar()

  return causticEffect
}

// Creates the emissive glow shader for the glass panel itself
export function createGlassEmissiveShader(stainedGlassTexture) {
  return Fn(() => {
    const baseColor = texture(stainedGlassTexture, uv()).rgb

    // Subtle pulsing glow animation for living light effect
    const pulse = sin(time.mul(0.5)).mul(0.1).add(1.0)

    // Edge glow - brighter at edges for stained glass rim light effect
    const uvCentered = uv().sub(0.5).mul(2.0)
    const edgeDist = uvCentered.length()
    const edgeGlow = smoothstep(float(0.5), float(1.2), edgeDist).mul(0.3)

    // Combine base emissive with edge glow
    const emissive = baseColor.mul(glassUniforms.glassEmissive).mul(pulse)
    const edgeEmissive = baseColor.mul(edgeGlow)

    return emissive.add(edgeEmissive)
  })()
}
