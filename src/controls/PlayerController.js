import * as THREE from "three/webgpu"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"
import { MeshBVH, MeshBVHHelper } from "three-mesh-bvh"

// Player controller with FPS movement and BVH collision detection
export class PlayerController {
  constructor(camera, domElement, scene) {
    this.camera = camera
    this.domElement = domElement
    this.scene = scene

    // Player settings
    this.playerHeight = 0.8
    this.playerRadius = 0.15
    this.moveSpeed = 2.0
    this.gravity = 9.8
    this.jumpSpeed = 4.0

    // Player state
    this.velocity = new THREE.Vector3()
    this.position = new THREE.Vector3(0, this.playerHeight, 2)
    this.onGround = false
    this.enabled = false

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false
    }

    // Movement vectors
    this.direction = new THREE.Vector3()
    this.frontVector = new THREE.Vector3()
    this.sideVector = new THREE.Vector3()

    // Collision
    this.colliders = []
    this.bvhMeshes = []
    this.tempVector = new THREE.Vector3()
    this.tempVector2 = new THREE.Vector3()
    this.tempBox = new THREE.Box3()
    this.tempMat = new THREE.Matrix4()
    this.tempSegment = new THREE.Line3()

    // Capsule for collision (simplified as sphere at feet and head)
    this.capsuleInfo = {
      radius: this.playerRadius,
      segment: new THREE.Line3(
        new THREE.Vector3(),
        new THREE.Vector3(0, this.playerHeight - this.playerRadius * 2, 0)
      )
    }

    // Create PointerLockControls
    this.pointerLockControls = new PointerLockControls(camera, domElement)

    // Set initial camera position
    this.camera.position.copy(this.position)

    // Bind event handlers
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    this.onPointerLockChange = this.onPointerLockChange.bind(this)

    // Setup event listeners
    this.setupEventListeners()
  }

  setupEventListeners() {
    document.addEventListener("keydown", this.onKeyDown)
    document.addEventListener("keyup", this.onKeyUp)
    document.addEventListener("pointerlockchange", this.onPointerLockChange)
  }

  onKeyDown(event) {
    if (!this.enabled) return

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = true
        break
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = true
        break
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = true
        break
      case "KeyD":
      case "ArrowRight":
        this.keys.right = true
        break
      case "Space":
        if (this.onGround) {
          this.velocity.y = this.jumpSpeed
          this.onGround = false
        }
        break
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = false
        break
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = false
        break
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = false
        break
      case "KeyD":
      case "ArrowRight":
        this.keys.right = false
        break
    }
  }

  onPointerLockChange() {
    this.enabled = document.pointerLockElement === this.domElement
  }

  // Lock pointer and enable FPS controls
  lock() {
    this.pointerLockControls.lock()
  }

  // Unlock pointer and disable FPS controls
  unlock() {
    this.pointerLockControls.unlock()
    this.enabled = false
    // Reset keys
    this.keys.forward = false
    this.keys.backward = false
    this.keys.left = false
    this.keys.right = false
  }

  isLocked() {
    return this.pointerLockControls.isLocked
  }

  // Get current player position
  getPosition() {
    return this.position.clone()
  }

  // Add mesh for collision detection
  addCollider(mesh) {
    if (mesh.geometry) {
      // Generate BVH for this mesh
      const geometry = mesh.geometry.clone()

      // Apply mesh transformations to geometry
      geometry.applyMatrix4(mesh.matrixWorld)

      // Create BVH
      geometry.boundsTree = new MeshBVH(geometry)

      this.colliders.push({
        mesh: mesh,
        geometry: geometry
      })
    }
  }

  // Build collision from scene
  buildCollisionFromScene() {
    // Clear existing colliders
    this.colliders = []

    // Find all meshes in scene that should be solid
    this.scene.traverse((object) => {
      if (object.isMesh && object.geometry) {
        // Skip glass/transparent meshes
        if (object.material && (object.material.transparent || object.material.transmission)) {
          return
        }

        // Skip tiny meshes
        const box = new THREE.Box3().setFromObject(object)
        const size = new THREE.Vector3()
        box.getSize(size)
        if (size.length() < 0.05) return

        // Clone geometry and apply world transform
        const geometry = object.geometry.clone()
        object.updateWorldMatrix(true, false)
        geometry.applyMatrix4(object.matrixWorld)

        // Generate BVH
        try {
          geometry.boundsTree = new MeshBVH(geometry)
          this.colliders.push({
            mesh: object,
            geometry: geometry
          })
        } catch (e) {
          // Some geometries may fail, skip them
          console.warn("BVH generation failed for:", object.name, e)
        }
      }
    })

    console.log(`Built collision for ${this.colliders.length} meshes`)
  }

  // Check collisions and resolve
  checkCollisions() {
    const capsuleRadius = this.capsuleInfo.radius

    // Create capsule segment in world space
    const segment = this.tempSegment
    segment.start.copy(this.capsuleInfo.segment.start).add(this.position)
    segment.end.copy(this.capsuleInfo.segment.end).add(this.position)

    // Check against all colliders
    for (const collider of this.colliders) {
      const { geometry } = collider
      if (!geometry.boundsTree) continue

      // Get closest point on BVH to capsule
      const result = geometry.boundsTree.shapecast({
        intersectsBounds: (box) => {
          return box.distanceToPoint(segment.start) < capsuleRadius ||
                 box.distanceToPoint(segment.end) < capsuleRadius
        },
        intersectsTriangle: (tri) => {
          // Get closest point on triangle to segment
          const triPoint = this.tempVector
          const capsulePoint = this.tempVector2

          tri.closestPointToSegment(segment, triPoint, capsulePoint)

          const distance = triPoint.distanceTo(capsulePoint)

          if (distance < capsuleRadius) {
            // Push player out
            const depth = capsuleRadius - distance
            const direction = capsulePoint.sub(triPoint).normalize()

            segment.start.addScaledVector(direction, depth)
            segment.end.addScaledVector(direction, depth)

            return true
          }

          return false
        }
      })
    }

    // Update position from adjusted segment
    const newPosition = this.tempVector
    newPosition.copy(segment.start).sub(this.capsuleInfo.segment.start)
    this.position.copy(newPosition)

    // Check if on ground (simple y check)
    if (this.position.y < this.playerHeight + 0.01) {
      this.position.y = this.playerHeight
      if (this.velocity.y < 0) {
        this.velocity.y = 0
        this.onGround = true
      }
    }
  }

  update(deltaTime) {
    if (!this.enabled) return

    // Apply gravity
    this.velocity.y -= this.gravity * deltaTime

    // Calculate movement direction
    this.direction.set(0, 0, 0)

    // Get camera direction (excluding y component for horizontal movement)
    this.camera.getWorldDirection(this.frontVector)
    this.frontVector.y = 0
    this.frontVector.normalize()

    // Calculate side vector
    this.sideVector.crossVectors(this.camera.up, this.frontVector).normalize()

    // Apply movement based on keys
    if (this.keys.forward) {
      this.direction.add(this.frontVector)
    }
    if (this.keys.backward) {
      this.direction.sub(this.frontVector)
    }
    if (this.keys.left) {
      this.direction.add(this.sideVector)
    }
    if (this.keys.right) {
      this.direction.sub(this.sideVector)
    }

    // Normalize and apply speed
    if (this.direction.length() > 0) {
      this.direction.normalize()
      this.position.addScaledVector(this.direction, this.moveSpeed * deltaTime)
    }

    // Apply vertical velocity
    this.position.y += this.velocity.y * deltaTime

    // Check collisions
    this.checkCollisions()

    // Update camera position
    this.camera.position.copy(this.position)
  }

  dispose() {
    document.removeEventListener("keydown", this.onKeyDown)
    document.removeEventListener("keyup", this.onKeyUp)
    document.removeEventListener("pointerlockchange", this.onPointerLockChange)

    // Dispose BVH geometries
    for (const collider of this.colliders) {
      if (collider.geometry) {
        collider.geometry.dispose()
      }
    }
    this.colliders = []

    this.pointerLockControls.dispose()
  }
}
