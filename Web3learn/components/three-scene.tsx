"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

interface ThreeSceneProps {
  isLandingPage?: boolean
  followMouse?: boolean
}

export default function ThreeScene({ isLandingPage = false, followMouse = true }: ThreeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Create particles for background
    const particlesGeometry = new THREE.BufferGeometry()
    const particlesCount = 1000

    const posArray = new Float32Array(particlesCount * 3)

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 10
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3))

    // Materials
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.6,
    })

    // Mesh
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particlesMesh)

    // Add blockchain-themed objects
    const blockGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    })

    // Create blocks and position them randomly
    const blocks = []
    for (let i = 0; i < 10; i++) {
      const block = new THREE.Mesh(blockGeometry, blockMaterial)
      block.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
      block.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      block.castShadow = true
      block.receiveShadow = true
      scene.add(block)
      blocks.push(block)
    }

    // Add 3D AI guide character
    let aiGuide: THREE.Object3D | null = null
    const loader = new GLTFLoader()

    // Use a robot model as AI guide
    // In a real app, you would replace this URL with your actual model
    const modelUrl = "/placeholder.svg?height=200&width=200" // Placeholder for demo

    // Create a simple robot character since we don't have a real GLTF model
    const robotHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x5eead4 }),
    )

    const robotBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6 }),
    )
    robotBody.position.y = -0.5

    const robotEyeLeft = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    )
    robotEyeLeft.position.set(0.1, 0.1, 0.25)

    const robotEyeRight = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    )
    robotEyeRight.position.set(-0.1, 0.1, 0.25)

    const robotGroup = new THREE.Group()
    robotGroup.add(robotHead)
    robotGroup.add(robotBody)
    robotGroup.add(robotEyeLeft)
    robotGroup.add(robotEyeRight)

    robotGroup.position.set(2, 0, 0)
    robotGroup.scale.set(0.8, 0.8, 0.8)
    robotGroup.castShadow = true
    scene.add(robotGroup)

    aiGuide = robotGroup

    // Position camera
    camera.position.z = 5
    if (isLandingPage) {
      camera.position.y = 1
    }

    // Add orbit controls for landing page
    let controls
    if (isLandingPage) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.enableZoom = false
    }

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener("resize", handleResize)

    // Mouse position for AI guide to follow
    const mouse = new THREE.Vector2()
    const target = new THREE.Vector3()

    const onMouseMove = (event: MouseEvent) => {
      if (!followMouse) return

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

      // Update target position for AI guide
      target.set(mouse.x * 3, mouse.y * 2, 0)

      // Subtle particle movement
      particlesMesh.rotation.x += mouse.y * 0.0002
      particlesMesh.rotation.y += mouse.x * 0.0002
    }

    window.addEventListener("mousemove", onMouseMove)

    // Animation
    const animate = () => {
      requestAnimationFrame(animate)

      // Animate particles
      particlesMesh.rotation.x += 0.0003
      particlesMesh.rotation.y += 0.0003

      // Animate blocks
      blocks.forEach((block, i) => {
        block.rotation.x += 0.002 + i * 0.0001
        block.rotation.y += 0.001 + i * 0.0001
      })

      // Animate AI guide to follow mouse with smooth lerping
      if (aiGuide && followMouse) {
        aiGuide.position.x += (target.x - aiGuide.position.x) * 0.05
        aiGuide.position.y += (target.y - aiGuide.position.y) * 0.05

        // Make AI guide look at the target
        aiGuide.lookAt(target.x * 10, target.y * 10, -10)
      }

      // Update orbit controls if on landing page
      if (isLandingPage && controls) {
        controls.update()
      }

      renderer.render(scene, camera)
    }

    animate()
    setLoaded(true)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", onMouseMove)
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }

      // Dispose resources
      particlesGeometry.dispose()
      particlesMaterial.dispose()
      blockGeometry.dispose()
      blockMaterial.dispose()
      renderer.dispose()
    }
  }, [isLandingPage, followMouse])

  return <div ref={containerRef} className="absolute inset-0" />
}

