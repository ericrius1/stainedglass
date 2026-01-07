/**
 * ParameterMapper - Configurable mapping between hand position and parameters
 *
 * Provides flexible axis-to-parameter mapping with range normalization
 * and bidirectional Tweakpane synchronization.
 */

export class ParameterMapper {
  constructor() {
    this.mappings = new Map() // paramKey -> { axis, min, max, uniform }
    this.params = null // Reference to params object
    this.pane = null // Reference to Tweakpane instance
    this.enabled = true
  }

  /**
   * Initialize with params object and Tweakpane instance
   */
  init(params, pane) {
    this.params = params
    this.pane = pane
    return this
  }

  /**
   * Add a parameter mapping
   * @param {string} paramKey - Key in params object (e.g., 'causticScale')
   * @param {Object} config - Mapping configuration
   * @param {string} config.axis - 'x' or 'y'
   * @param {number} config.min - Minimum value
   * @param {number} config.max - Maximum value
   * @param {Object} config.uniform - TSL uniform reference (optional)
   */
  addMapping(paramKey, config) {
    this.mappings.set(paramKey, {
      axis: config.axis,
      min: config.min,
      max: config.max,
      uniform: config.uniform || null,
    })
    return this
  }

  /**
   * Remove a parameter mapping
   */
  removeMapping(paramKey) {
    this.mappings.delete(paramKey)
    return this
  }

  /**
   * Remove all mappings for a specific axis
   */
  removeMappingsForAxis(axis) {
    for (const [key, mapping] of this.mappings) {
      if (mapping.axis === axis) {
        this.mappings.delete(key)
      }
    }
    return this
  }

  /**
   * Update parameters based on hand position
   * @param {Object} position - { x: 0-1, y: 0-1 }
   */
  update(position) {
    if (!this.enabled || !this.params) return

    for (const [paramKey, mapping] of this.mappings) {
      const axisValue = position[mapping.axis]
      const mappedValue = this._mapRange(axisValue, 0, 1, mapping.min, mapping.max)

      // Update params object
      this.params[paramKey] = mappedValue

      // Update TSL uniform if provided
      if (mapping.uniform) {
        mapping.uniform.value = mappedValue
      }
    }

    // Refresh Tweakpane to sync sliders
    if (this.pane) {
      this.pane.refresh()
    }
  }

  /**
   * Map a value from one range to another
   */
  _mapRange(value, inMin, inMax, outMin, outMax) {
    const clamped = Math.max(inMin, Math.min(inMax, value))
    return outMin + (clamped - inMin) * (outMax - outMin) / (inMax - inMin)
  }

  /**
   * Get current mapping configuration
   */
  getMappings() {
    return Object.fromEntries(this.mappings)
  }

  /**
   * Enable/disable mapping updates
   */
  setEnabled(enabled) {
    this.enabled = enabled
    return this
  }
}

export function createParameterMapper() {
  return new ParameterMapper()
}
