import { useEffect, useRef, useState } from 'react'
import type { Site, ViabilityKPI } from '../ephemeris/types.ts'

interface RocketVectorPlaygroundProps {
  site: Site
  viability: ViabilityKPI
  lang?: 'es' | 'en'
  hideTopVerdict?: boolean
}

type FlightMode = 'journey' | 'orbit' | 'launch'

interface SmokeParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  maxRadius: number
  alpha: number
  decay: number
  layer: 'back' | 'mid' | 'core' | 'spark'
  color: string
}

interface Point2D {
  x: number
  y: number
  angle: number
}

/**
 * Evaluates a cubic Bézier curve and its tangent angle at parameter t in [0, 1].
 */
function evalCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): Point2D {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y

  const dx =
    3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x)
  const dy =
    3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y)

  return { x, y, angle: Math.atan2(dy, dx) }
}

/**
 * Multi-segment S-curve trajectory inspired by `ejemplo de nave.jpeg`
 * (Start o ---> o 1. ---> o 2. ---> o 3. ---> o 4. Lunar Target).
 */
function sampleMissionPath(mode: FlightMode, progress: number, W: number, H: number): Point2D {
  const t = Math.max(0, Math.min(1, progress))

  if (mode === 'launch') {
    // Diagonal boost trajectory like the right screen of `ejemplo de nave.jpeg` ("Полетели! / ¡Despegamos!")
    return evalCubicBezier(
      { x: W * 0.14, y: H * 0.84 },
      { x: W * 0.34, y: H * 0.68 },
      { x: W * 0.56, y: H * 0.44 },
      { x: W * 0.78, y: H * 0.22 },
      t,
    )
  }

  if (mode === 'orbit') {
    // Smooth orbital loop around the Moon
    return evalCubicBezier(
      { x: W * 0.14, y: H * 0.28 },
      { x: W * 0.48, y: H * 0.08 },
      { x: W * 0.86, y: H * 0.28 },
      { x: W * 0.68, y: H * 0.72 },
      t,
    )
  }

  // Default 'journey': winding S-path through checkpoints 1 -> 2 -> 3 -> 4 (like left screen of `ejemplo de nave.jpeg`)
  if (t < 0.33) {
    const localT = t / 0.33
    return evalCubicBezier(
      { x: W * 0.13, y: H * 0.24 },
      { x: W * 0.28, y: H * 0.12 },
      { x: W * 0.44, y: H * 0.16 },
      { x: W * 0.48, y: H * 0.32 },
      localT,
    )
  }
  if (t < 0.67) {
    const localT = (t - 0.33) / 0.34
    return evalCubicBezier(
      { x: W * 0.48, y: H * 0.32 },
      { x: W * 0.52, y: H * 0.46 },
      { x: W * 0.24, y: H * 0.42 },
      { x: W * 0.28, y: H * 0.58 },
      localT,
    )
  }
  const localT = (t - 0.67) / 0.33
  return evalCubicBezier(
    { x: W * 0.28, y: H * 0.58 },
    { x: W * 0.34, y: H * 0.74 },
    { x: W * 0.56, y: H * 0.62 },
    { x: W * 0.68, y: H * 0.77 },
    localT,
  )
}

/**
 * Interactive 3D Spacecraft & Billowing Smoke-Trail Simulator inspired by `ejemplo de nave.jpeg`.
 * Replaces vector arrows and flat polygons with the real 3D spacecraft (`/spacecraft-real.jpg`),
 * real photographic Moon (`/moon-real.jpg`), interactive waypoint flight, draggable ship, and
 * real-time billowing cloud/particle animation.
 */
export function RocketVectorPlayground({
  site,
  viability,
  lang = 'es',
  hideTopVerdict = false,
}: RocketVectorPlaygroundProps) {
  const [flightMode, setFlightMode] = useState<FlightMode>('journey')
  const [progress, setProgress] = useState<number>(0.42)
  const [targetProgress, setTargetProgress] = useState<number | null>(0.72)
  const [isAutoFlying, setIsAutoFlying] = useState<boolean>(true)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shipCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const moonImgRef = useRef<HTMLImageElement | null>(null)
  const particlesRef = useRef<SmokeParticle[]>([])
  const progressRef = useRef<number>(progress)
  const lastProgressRef = useRef<number>(progress)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  // Load and alpha-key the real 3D spacecraft texture (`/spacecraft-real.jpg`) and Moon (`/moon-real.jpg`)
  useEffect(() => {
    const shipImg = new Image()
    shipImg.crossOrigin = 'anonymous'
    shipImg.src = `${import.meta.env.BASE_URL}spacecraft-real.jpg`
    shipImg.onload = () => {
      const off = document.createElement('canvas')
      off.width = shipImg.width
      off.height = shipImg.height
      const octx = off.getContext('2d')
      if (!octx) return
      octx.drawImage(shipImg, 0, 0)
      const imgData = octx.getImageData(0, 0, off.width, off.height)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        const lum = Math.max(r, g, b)
        // Smoothly key out the pure black background while preserving the cyan/violet thruster & nose glow
        if (lum < 14) {
          d[i + 3] = 0
        } else if (lum < 52) {
          d[i + 3] = Math.round(((lum - 14) / 38) * 255)
        }
      }
      octx.putImageData(imgData, 0, 0)
      shipCanvasRef.current = off
    }

    const moonImg = new Image()
    moonImg.crossOrigin = 'anonymous'
    moonImg.src = `${import.meta.env.BASE_URL}moon-real.jpg`
    moonImg.onload = () => {
      moonImgRef.current = moonImg
    }
  }, [])

  // Smooth auto-flight & target waypoint interpolation
  useEffect(() => {
    if (isDragging) return
    let rafId = 0
    let lastTime = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      if (isAutoFlying) {
        setProgress((prev) => {
          if (targetProgress !== null) {
            const diff = targetProgress - prev
            if (Math.abs(diff) < 0.004) {
              setTargetProgress(null)
              setIsAutoFlying(false)
              return targetProgress
            }
            return prev + Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.22)
          }
          const next = prev + dt * 0.14
          return next > 1 ? 0.04 : next
        })
      }
      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [isAutoFlying, isDragging, targetProgress])

  // Main 60 FPS Canvas Renderer (Stars, Waypoints, Billowing Cloud Trail, Real 3D Spacecraft, Real Moon)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    const W = 860
    const H = 390

    // Pre-seed stars
    const stars = Array.from({ length: 46 }, (_, i) => ({
      x: ((i * 197 + 43) % (W - 40)) + 20,
      y: ((i * 131 + 29) % (H - 70)) + 15,
      r: (i % 3) * 0.65 + 0.8,
      phase: i * 0.7,
    }))

    const spawnExhaust = (shipPt: Point2D, speedFactor: number) => {
      const nozzleDist = 36
      const nx = shipPt.x - Math.cos(shipPt.angle) * nozzleDist
      const ny = shipPt.y - Math.sin(shipPt.angle) * nozzleDist

      const count = speedFactor > 0.001 ? 4 : 2
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.85
        const backwardAngle = shipPt.angle + Math.PI + spread
        const spd = (1.2 + Math.random() * 2.4) * (1 + speedFactor * 18)

        const roll = Math.random()
        let layer: SmokeParticle['layer'] = 'mid'
        let color = '#f3e5f5'
        let radius = 7 + Math.random() * 8
        let maxRadius = 22 + Math.random() * 18
        let alpha = 0.72

        if (roll < 0.32) {
          layer = 'back'
          color = '#9b7ede'
          radius = 12 + Math.random() * 10
          maxRadius = 32 + Math.random() * 22
          alpha = 0.42
        } else if (roll > 0.76) {
          layer = 'core'
          color = '#ffffff'
          radius = 4 + Math.random() * 6
          maxRadius = 12 + Math.random() * 8
          alpha = 0.95
        } else if (roll > 0.65) {
          layer = 'spark'
          color = Math.random() > 0.5 ? '#5ce1e6' : '#ffd98a'
          radius = 2.2 + Math.random() * 2.5
          maxRadius = 3.5
          alpha = 0.95
        }

        particlesRef.current.push({
          x: nx + (Math.random() - 0.5) * 8,
          y: ny + (Math.random() - 0.5) * 8,
          vx: Math.cos(backwardAngle) * spd,
          vy: Math.sin(backwardAngle) * spd,
          radius,
          maxRadius,
          alpha,
          decay: 0.011 + Math.random() * 0.012,
          layer,
          color,
        })
      }

      if (particlesRef.current.length > 210) {
        particlesRef.current.splice(0, particlesRef.current.length - 210)
      }
    }

    const render = (timeMs: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
      }
      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Deep Cosmic Gradient Background (matching `ejemplo de nave.jpeg` & MoonDial dark theme)
      const bgGrad = ctx.createLinearGradient(0, 0, W, H)
      bgGrad.addColorStop(0, '#131524')
      bgGrad.addColorStop(0.52, '#1b1d32')
      bgGrad.addColorStop(1, '#261f3a')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // Subtle cosmic nebula glow
      const nebGrad = ctx.createRadialGradient(W * 0.52, H * 0.42, 10, W * 0.52, H * 0.42, 290)
      nebGrad.addColorStop(0, 'rgba(116, 94, 210, 0.16)')
      nebGrad.addColorStop(0.6, 'rgba(59, 140, 255, 0.06)')
      nebGrad.addColorStop(1, 'rgba(19, 21, 36, 0)')
      ctx.fillStyle = nebGrad
      ctx.fillRect(0, 0, W, H)

      // 2. Twinkling Stars
      for (const st of stars) {
        const twinkle = 0.45 + 0.55 * Math.sin(timeMs * 0.0025 + st.phase)
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle.toFixed(2)})`
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3. Sculpted Cratered Lunar Surface along bottom edge (like bottom of `ejemplo de nave.jpeg`)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, H - 36)
      ctx.quadraticCurveTo(W * 0.25, H - 54, W * 0.52, H - 38)
      ctx.quadraticCurveTo(W * 0.78, H - 24, W, H - 44)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      const surfGrad = ctx.createLinearGradient(0, H - 55, 0, H)
      surfGrad.addColorStop(0, '#3b3c4c')
      surfGrad.addColorStop(1, '#232430')
      ctx.fillStyle = surfGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Surface craters
      const craters = [
        { cx: 110, cy: H - 20, rx: 32, ry: 8 },
        { cx: 260, cy: H - 26, rx: 46, ry: 10 },
        { cx: 470, cy: H - 18, rx: 38, ry: 8 },
      ]
      for (const c of craters) {
        ctx.beginPath()
        ctx.ellipse(c.cx, c.cy, c.rx, c.ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(20, 22, 32, 0.55)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
        ctx.stroke()
      }
      ctx.restore()

      // 4. Draw Curved Dashed Trajectory Path + Trail behind spacecraft
      const curProg = progressRef.current
      const speedDelta = Math.abs(curProg - lastProgressRef.current)
      lastProgressRef.current = curProg

      // Full dashed future path
      ctx.save()
      ctx.beginPath()
      const steps = 90
      for (let i = 0; i <= steps; i++) {
        const pt = sampleMissionPath(flightMode, i / steps, W, H)
        if (i === 0) ctx.moveTo(pt.x, pt.y)
        else ctx.lineTo(pt.x, pt.y)
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)'
      ctx.lineWidth = 2.2
      ctx.setLineDash([7, 7])
      ctx.stroke()
      ctx.restore()

      // Glowing active trajectory segment up to current spacecraft position
      ctx.save()
      ctx.beginPath()
      const activeSteps = Math.max(2, Math.round(curProg * 70))
      for (let i = 0; i <= activeSteps; i++) {
        const pt = sampleMissionPath(flightMode, (i / activeSteps) * curProg, W, H)
        if (i === 0) ctx.moveTo(pt.x, pt.y)
        else ctx.lineTo(pt.x, pt.y)
      }
      ctx.strokeStyle = '#5ce1e6'
      ctx.lineWidth = 3
      ctx.shadowColor = '#5ce1e6'
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.restore()

      // 5. Draw Waypoints & Celestial Spheres (in 'journey' & 'orbit' modes)
      if (flightMode !== 'launch') {
        const wpStart = sampleMissionPath(flightMode, 0.02, W, H)
        const wp1 = sampleMissionPath(flightMode, 0.33, W, H)
        const wp2 = sampleMissionPath(flightMode, 0.67, W, H)
        const wpEnd = sampleMissionPath(flightMode, 0.98, W, H)

        // Start Node
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(wpStart.x, wpStart.y, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '600 11px Inter, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillText(lang === 'es' ? 'Inicio' : 'Start', wpStart.x - 16, wpStart.y - 12)

        // Waypoint 1: Earth Link Sphere
        ctx.save()
        const earthGrad = ctx.createRadialGradient(
          wp1.x + 42,
          wp1.y + 8,
          4,
          wp1.x + 48,
          wp1.y + 14,
          24,
        )
        earthGrad.addColorStop(0, '#8cbbff')
        earthGrad.addColorStop(0.55, '#3b8cff')
        earthGrad.addColorStop(1, '#162c54')
        ctx.fillStyle = earthGrad
        ctx.beginPath()
        ctx.arc(wp1.x + 48, wp1.y + 14, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 11px Inter, sans-serif'
        ctx.fillText(
          lang === 'es' ? '1. Señal Tierra' : '1. Earth Link',
          wp1.x + 16,
          wp1.y + 52,
        )
        ctx.restore()

        // Waypoint 2: Solar Window Sphere
        ctx.save()
        const sunGrad = ctx.createRadialGradient(
          wp2.x - 54,
          wp2.y + 12,
          4,
          wp2.x - 50,
          wp2.y + 16,
          26,
        )
        sunGrad.addColorStop(0, '#fff3c4')
        sunGrad.addColorStop(0.5, '#f7b32b')
        sunGrad.addColorStop(1, 'rgba(247, 179, 43, 0.1)')
        ctx.fillStyle = sunGrad
        ctx.beginPath()
        ctx.arc(wp2.x - 50, wp2.y + 16, 24, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffd98a'
        ctx.font = '600 11px Inter, sans-serif'
        ctx.fillText(
          lang === 'es' ? '2. Energía Solar' : '2. Solar Power',
          wp2.x - 88,
          wp2.y + 54,
        )
        ctx.restore()

        // Waypoint 3/4: Real Photographic Moon Target (`moon-real.jpg`) with Saturn/Orbital Ring like `ejemplo de nave.jpeg`
        const moonX = wpEnd.x + 54
        const moonY = wpEnd.y - 6
        const moonR = 46

        ctx.save()
        // Back orbital ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(moonX, moonY, 68, 16, -0.32, Math.PI, Math.PI * 2)
        ctx.stroke()

        // Real Photographic Moon Clipped Disk
        ctx.save()
        ctx.beginPath()
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
        ctx.clip()
        if (moonImgRef.current) {
          const scale = (moonR * 2) / (493 * 2)
          const drawW = 1200 * scale
          const drawH = 1200 * scale
          const dx = moonX - 626.5 * scale
          const dy = moonY - 586.0 * scale
          ctx.drawImage(moonImgRef.current, dx, dy, drawW, drawH)
        } else {
          ctx.fillStyle = '#c8cbd4'
          ctx.fillRect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2)
        }
        ctx.restore()

        // Front orbital ring
        ctx.strokeStyle = viability.isViable
          ? 'rgba(54, 217, 138, 0.75)'
          : 'rgba(255, 92, 108, 0.75)'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.ellipse(moonX, moonY, 68, 16, -0.32, 0, Math.PI)
        ctx.stroke()

        // Target label
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(site.name.split(' ')[0], moonX, moonY + moonR + 18)
        ctx.restore()
      } else {
        // Launch mode ("¡Despegamos! / Полетели!" right screen of `ejemplo de nave.jpeg`)
        ctx.save()
        ctx.font = '700 28px Barlow, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(
          lang === 'es' ? '¡Despegamos hacia la Luna!' : 'Liftoff to the Moon!',
          W * 0.5,
          62,
        )

        // Billowing launch cloud bank along bottom-left edge (exact match to `ejemplo de nave.jpeg`)
        const cloudPuffs = [
          { x: 35, y: H - 20, r: 68, c: 'rgba(155, 126, 222, 0.35)' },
          { x: 95, y: H - 15, r: 58, c: 'rgba(155, 126, 222, 0.35)' },
          { x: 25, y: H - 95, r: 54, c: 'rgba(235, 215, 248, 0.75)' },
          { x: 75, y: H - 55, r: 52, c: 'rgba(246, 232, 252, 0.88)' },
          { x: 135, y: H - 25, r: 46, c: 'rgba(246, 232, 252, 0.85)' },
          { x: 18, y: H - 165, r: 42, c: 'rgba(246, 232, 252, 0.8)' },
        ]
        for (const p of cloudPuffs) {
          const pulse = Math.sin(timeMs * 0.003 + p.x) * 3.5
          ctx.fillStyle = p.c
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r + pulse, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      // 6. Compute Current Spacecraft Position & Spawn Billowing Smoke Trail
      const shipPt = sampleMissionPath(flightMode, curProg, W, H)
      spawnExhaust(shipPt, speedDelta)

      // Update & Render Smoke/Cloud Particles in 3 layers (back -> mid -> core/spark)
      const layersOrder: SmokeParticle['layer'][] = ['back', 'mid', 'core', 'spark']
      const alive: SmokeParticle[] = []

      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        if (p.layer !== 'spark') {
          p.radius = Math.min(p.maxRadius, p.radius + 0.22)
        }
        p.alpha -= p.decay
        if (p.alpha > 0.02) {
          alive.push(p)
        }
      }
      particlesRef.current = alive

      for (const layerName of layersOrder) {
        for (const p of alive) {
          if (p.layer !== layerName) continue
          ctx.save()
          ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha))
          ctx.fillStyle = p.color
          if (p.layer === 'core' || p.layer === 'spark') {
            ctx.shadowColor = p.color
            ctx.shadowBlur = 8
          }
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // 7. Render the Real 3D Spacecraft (`/spacecraft-real.jpg`) at `shipPt`
      ctx.save()
      ctx.translate(shipPt.x, shipPt.y)
      ctx.rotate(shipPt.angle)

      // Soft cyan/indigo aura glow around the ship (like `ejemplo de nave.jpeg`)
      const auraGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 56)
      auraGrad.addColorStop(0, 'rgba(92, 225, 230, 0.34)')
      auraGrad.addColorStop(0.55, 'rgba(138, 110, 235, 0.14)')
      auraGrad.addColorStop(1, 'rgba(92, 225, 230, 0)')
      ctx.fillStyle = auraGrad
      ctx.beginPath()
      ctx.arc(0, 0, 56, 0, Math.PI * 2)
      ctx.fill()

      // Dynamic thruster flame core right at the rear nozzle
      const flameLen = 18 + Math.sin(timeMs * 0.03) * 5 + speedDelta * 260
      const flameGrad = ctx.createLinearGradient(-26, 0, -26 - flameLen, 0)
      flameGrad.addColorStop(0, '#ffffff')
      flameGrad.addColorStop(0.45, '#5ce1e6')
      flameGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
      ctx.fillStyle = flameGrad
      ctx.beginPath()
      ctx.moveTo(-24, -8)
      ctx.quadraticCurveTo(-28 - flameLen, 0, -24, 8)
      ctx.closePath()
      ctx.fill()

      if (shipCanvasRef.current) {
        const shipW = 96
        const shipH = 96
        ctx.drawImage(shipCanvasRef.current, -shipW / 2, -shipH / 2, shipW, shipH)
      }
      ctx.restore()

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [flightMode, lang, site.name, viability.isViable])

  // Pointer drag interaction on the canvas so user can grab and fly the spacecraft directly
  const updateProgressFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 860
    const y = ((clientY - rect.top) / rect.height) * 390

    // Find closest parameter t along the active curve
    let bestT = progressRef.current
    let minDist = Infinity
    for (let i = 0; i <= 100; i++) {
      const t = i / 100
      const pt = sampleMissionPath(flightMode, t, 860, 390)
      const d = Math.hypot(pt.x - x, pt.y - y)
      if (d < minDist) {
        minDist = d
        bestT = t
      }
    }
    setIsAutoFlying(false)
    setTargetProgress(null)
    setProgress(bestT)
  }

  const pctDisplay = Math.round(progress * 100)

  const getStageMessage = () => {
    if (flightMode === 'launch') {
      return lang === 'es'
        ? '¡Propulsión máxima activada! La nave asciende dejando una estela de vapor y plasma rumbo a la órbita lunar.'
        : 'Maximum propulsion engaged! The spacecraft climbs leaving a billowing vapor and plasma trail toward lunar orbit.'
    }
    if (progress < 0.28) {
      return lang === 'es'
        ? 'Etapa 1 · Salida orbital: La nave inicia su trayectoria curva hacia la Luna verificando sus paneles solares.'
        : 'Stage 1 · Orbital departure: The spacecraft begins its curved trajectory toward the Moon checking its solar arrays.'
    }
    if (progress < 0.62) {
      return lang === 'es'
        ? `Etapa 2 · Enlace con la Tierra y Sol: En ${site.name} tenemos ${viability.subscores.communication}% de señal de radio y energía solar activa.`
        : `Stage 2 · Earth & Sun Link: At ${site.name} we have ${viability.subscores.communication}% radio signal and active solar power.`
    }
    return viability.isViable
      ? lang === 'es'
        ? `Etapa Final · Aproximación a ${site.name}: ¡Zona despejada! La nave puede aterrizar con visión directa a la Tierra.`
        : `Final Stage · Approach to ${site.name}: Clear zone! The spacecraft can land with direct line-of-sight to Earth.`
      : lang === 'es'
        ? `Alerta en ${site.name}: Las montañas del cráter bloquean la señal con la Tierra. ¡Cambia a Modo Órbita o elige Reiner Gamma!`
        : `Alert at ${site.name}: Crater mountains block the signal to Earth. Switch to Orbit Mode or pick Reiner Gamma!`
  }

  return (
    <section
      className="md-spacecraft-sim-card"
      aria-label={
        lang === 'es'
          ? 'Simulador interactivo de vuelo de la nave lunar'
          : 'Interactive lunar spacecraft flight simulator'
      }
    >
      {!hideTopVerdict && (
        <div className={`binary-verdict-banner ${viability.isViable ? 'yes' : 'no'}`}>
          <span className="pill-badge">
            {lang === 'es'
              ? 'VEREDICTO DE MISIÓN PARA EXPLORADORES'
              : 'MISSION VERDICT FOR YOUNG EXPLORERS'}
          </span>
          <div className="binary-badge">
            {viability.isViable
              ? lang === 'es'
                ? '¡SÍ SE PUEDE ATERRIZAR!'
                : 'YES, WE CAN LAND HERE!'
              : lang === 'es'
                ? '¡NO SE PUEDE, PERDEMOS SEÑAL!'
                : 'NO, WE LOSE RADIO SIGNAL!'}
          </div>
        </div>
      )}

      <div className="md-spacecraft-header">
        <div>
          <span className="md-eyebrow">
            {lang === 'es'
              ? 'TRAVESÍA INTERACTIVA · NAVE LUNAR ORYSEL'
              : 'INTERACTIVE JOURNEY · ORYSEL LUNAR SPACECRAFT'}
          </span>
          <h3 className="md-h1">
            {lang === 'es'
              ? `Vuela la nave hacia ${site.name}`
              : `Fly the spacecraft to ${site.name}`}
          </h3>
          <p className="md-caption">
            {lang === 'es'
              ? 'Arrastra la nave por la trayectoria o usa el control de propulsión para ver su estela en tiempo real.'
              : 'Drag the spacecraft along the trajectory or use the propulsion control to watch its live exhaust trail.'}
          </p>
        </div>

        <div className="md-spacecraft-mode-pills">
          <button
            type="button"
            className={flightMode === 'journey' ? 'md-chip selected' : 'md-chip'}
            onClick={() => {
              setFlightMode('journey')
              setTargetProgress(0.88)
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? '1. Ruta de Alunizaje' : '1. Landing Route'}
          </button>
          <button
            type="button"
            className={flightMode === 'orbit' ? 'md-chip selected' : 'md-chip'}
            onClick={() => {
              setFlightMode('orbit')
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? '2. Órbita Lunar' : '2. Lunar Orbit'}
          </button>
          <button
            type="button"
            className={flightMode === 'launch' ? 'md-chip selected' : 'md-chip'}
            onClick={() => {
              setFlightMode('launch')
              setProgress(0.18)
              setTargetProgress(0.82)
              setIsAutoFlying(true)
            }}
          >
            🚀 {lang === 'es' ? '¡Despegar!' : 'Liftoff!'}
          </button>
        </div>
      </div>

      {/* Interactive 60 FPS Spacecraft & Smoke Trail Canvas */}
      <div className="md-spacecraft-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="md-spacecraft-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setIsDragging(true)
            updateProgressFromPointer(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => {
            if (!isDragging) return
            updateProgressFromPointer(e.clientX, e.clientY)
          }}
          onPointerUp={() => setIsDragging(false)}
          onPointerCancel={() => setIsDragging(false)}
        />

        {/* Quick Waypoint Jump Pills overlaid cleanly at top-right of canvas */}
        <div className="md-spacecraft-waypoints-overlay">
          <button
            type="button"
            className="md-wp-btn"
            onClick={() => {
              setFlightMode('journey')
              setTargetProgress(0.05)
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? 'Inicio' : 'Start'}
          </button>
          <button
            type="button"
            className="md-wp-btn"
            onClick={() => {
              setFlightMode('journey')
              setTargetProgress(0.33)
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? '1 · Tierra' : '1 · Earth'}
          </button>
          <button
            type="button"
            className="md-wp-btn"
            onClick={() => {
              setFlightMode('journey')
              setTargetProgress(0.67)
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? '2 · Sol' : '2 · Sun'}
          </button>
          <button
            type="button"
            className="md-wp-btn"
            onClick={() => {
              setFlightMode('journey')
              setTargetProgress(0.95)
              setIsAutoFlying(true)
            }}
          >
            {lang === 'es' ? '3 · Luna' : '3 · Moon'}
          </button>
        </div>
      </div>

      {/* Bottom Fuel / Propulsion Indicator Bar (Matches `Индикатор топлива 50%` from `ejemplo de nave.jpeg`) */}
      <div className="md-spacecraft-footer">
        <div className="md-fuel-indicator-block">
          <div className="md-fuel-indicator-labels">
            <span>
              {lang === 'es'
                ? 'Indicador de propulsión y avance de la nave'
                : 'Spacecraft propulsion & trajectory indicator'}
            </span>
            <strong>{pctDisplay}%</strong>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pctDisplay}
            onChange={(e) => {
              setIsAutoFlying(false)
              setTargetProgress(null)
              setProgress(Number(e.target.value) / 100)
            }}
            className="md-fuel-slider"
          />
        </div>

        <button
          type="button"
          className="md-btn primary"
          onClick={() => {
            if (isAutoFlying) {
              setIsAutoFlying(false)
            } else {
              setTargetProgress(null)
              setIsAutoFlying(true)
            }
          }}
        >
          {isAutoFlying
            ? lang === 'es'
              ? 'Ⅱ Pausar vuelo'
              : 'Ⅱ Pause flight'
            : lang === 'es'
              ? '▶ Volar nave'
              : '▶ Fly spacecraft'}
        </button>
      </div>

      <div className={`md-spacecraft-stage-banner ${viability.isViable ? 'ok' : 'warn'}`}>
        <p>{getStageMessage()}</p>
      </div>
    </section>
  )
}
