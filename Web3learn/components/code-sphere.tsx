"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

interface CodeSphereProps {
  className?: string
}

export default function CodeSphere({ className = "" }: CodeSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    // Camera position
    camera.position.z = 5

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const pointLight1 = new THREE.PointLight(0x3b82f6, 1, 100)
    pointLight1.position.set(10, 10, 10)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0x14b8a6, 1, 100)
    pointLight2.position.set(-10, -10, -10)
    scene.add(pointLight2)

    // Create sphere with code-like particles
    const sphereRadius = 2
    const particleCount = 1500
    const particlesGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)

    // Create texture for code particles (simple approach - using canvas)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    // Draw code-like pattern
    ctx.fillStyle = '#3b82f6'
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('{}', 128, 128)
    
    const texture = new THREE.CanvasTexture(canvas)

    // Distribute particles on sphere surface
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      // Spherical coordinates
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      
      positions[i3] = sphereRadius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = sphereRadius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = sphereRadius * Math.cos(phi)
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Material for particles - using PointsMaterial for better compatibility
    const particlesMaterial = new THREE.PointsMaterial({
      size: 2.5,
      map: texture,
      transparent: true,
      opacity: 0.9,
      color: 0x3b82f6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particlesMesh)

    // Create wireframe sphere for structure
    const wireframeGeometry = new THREE.IcosahedronGeometry(sphereRadius * 1.05, 1)
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    })
    const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial)
    scene.add(wireframeMesh)

    // Mouse movement handler
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Animation
    const clock = new THREE.Clock()
    let animationFrameId: number

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const elapsedTime = clock.getElapsedTime()

      // Rotate sphere
      particlesMesh.rotation.y = elapsedTime * 0.2
      wireframeMesh.rotation.y = elapsedTime * 0.15
      wireframeMesh.rotation.x = elapsedTime * 0.1

      // React to mouse movement
      const targetRotationX = mouseRef.current.y * 0.3
      const targetRotationY = mouseRef.current.x * 0.3

      particlesMesh.rotation.x += (targetRotationX - particlesMesh.rotation.x) * 0.05
      particlesMesh.rotation.y += (targetRotationY - particlesMesh.rotation.y) * 0.05

      // Pulse effect
      const pulse = Math.sin(elapsedTime * 2) * 0.1 + 1
      particlesMesh.scale.set(pulse, pulse, pulse)
      
      // Animate material color
      const colorIntensity = (Math.sin(elapsedTime * 0.5) + 1) / 2
      particlesMaterial.color.lerpColors(
        new THREE.Color(0x3b82f6),
        new THREE.Color(0x14b8a6),
        colorIntensity
      )

      // Update camera based on mouse
      camera.position.x += (mouseRef.current.x * 2 - camera.position.x) * 0.05
      camera.position.y += (-mouseRef.current.y * 2 - camera.position.y) * 0.05
      camera.lookAt(scene.position)

      renderer.render(scene, camera)
    }

    animate()

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      particlesGeometry.dispose()
      particlesMaterial.dispose()
      wireframeGeometry.dispose()
      wireframeMaterial.dispose()
      texture.dispose()
    }
  }, [])

  return <div ref={containerRef} className={`absolute inset-0 ${className}`} />
}

