/**
 * HandTrackingController - MediaPipe Hands wrapper for coordinate tracking
 *
 * Provides normalized hand position (0-1) from webcam feed.
 * Uses MediaPipe Tasks Vision API for hand landmark detection.
 */

const DEFAULT_CONFIG = {
  numHands: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  modelAssetPath: "/hand_landmarker.task",
  wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  landmark: 9, // Palm center (MIDDLE_FINGER_MCP)
  smoothing: 0.25 // Exponential smoothing factor (lower = smoother)
}

// Landmark indices reference:
// 0: WRIST, 5: INDEX_FINGER_MCP, 9: MIDDLE_FINGER_MCP (palm center),
// 13: RING_FINGER_MCP, 17: PINKY_MCP

export class HandTrackingController {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options }
    this.handLandmarker = null
    this.video = null
    this.isRunning = false
    this.smoothedPosition = { x: 0.5, y: 0.5 }
    this.callbacks = new Set()
    this.isHandDetected = false
    this.lastTimestamp = 0
  }

  async init(videoElement) {
    // Dynamic import of MediaPipe Tasks Vision
    const vision = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest"
    )
    const { FilesetResolver, HandLandmarker } = vision

    // Initialize vision WASM
    const wasmFileset = await FilesetResolver.forVisionTasks(
      this.config.wasmPath
    )

    // Create Hand Landmarker
    this.handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath: this.config.modelAssetPath,
        delegate: "GPU"
      },
      numHands: this.config.numHands,
      runningMode: "VIDEO",
      minHandDetectionConfidence: this.config.minDetectionConfidence,
      minHandPresenceConfidence: this.config.minTrackingConfidence
    })

    this.video = videoElement
    return this
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 }
    })
    this.video.srcObject = stream
    await new Promise((resolve) => {
      this.video.onloadedmetadata = resolve
    })
    await this.video.play()
    return this
  }

  start() {
    this.isRunning = true
    this._processFrame()
    return this
  }

  stop() {
    this.isRunning = false
    return this
  }

  onPositionChange(callback) {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  _processFrame() {
    if (!this.isRunning) return

    const timestamp = performance.now()

    // Avoid processing same frame twice
    if (timestamp === this.lastTimestamp) {
      requestAnimationFrame(() => this._processFrame())
      return
    }
    this.lastTimestamp = timestamp

    try {
      const results = this.handLandmarker.detectForVideo(this.video, timestamp)

      if (results.landmarks && results.landmarks.length > 0) {
        const landmark = results.landmarks[0][this.config.landmark]

        // MediaPipe returns x: 0-1 (left-right), y: 0-1 (top-bottom)
        // Flip X so moving hand right increases value (video is mirrored)
        const rawX = 1 - landmark.x
        const rawY = landmark.y

        // Apply exponential smoothing
        const alpha = this.config.smoothing
        this.smoothedPosition.x =
          alpha * rawX + (1 - alpha) * this.smoothedPosition.x
        this.smoothedPosition.y =
          alpha * rawY + (1 - alpha) * this.smoothedPosition.y

        this.isHandDetected = true
        this._notifyCallbacks()
      } else {
        this.isHandDetected = false
        this._notifyCallbacks()
      }
    } catch (error) {
      console.warn("Hand detection error:", error)
    }

    requestAnimationFrame(() => this._processFrame())
  }

  _notifyCallbacks() {
    const position = this.getPosition()
    this.callbacks.forEach((cb) => cb(position, this.isHandDetected))
  }

  getPosition() {
    return { ...this.smoothedPosition }
  }

  dispose() {
    this.stop()
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach((track) => track.stop())
    }
    if (this.handLandmarker) {
      this.handLandmarker.close()
    }
  }
}

export function createHandTrackingController(options) {
  return new HandTrackingController(options)
}
