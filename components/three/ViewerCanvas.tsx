'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas, invalidate, useLoader, useThree } from '@react-three/fiber'
import * as React from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { configureLoader } from './loader'
import {
  type EnvironmentPreset,
  type LightSpec,
  type LightingPreset,
  resolveTokenColour,
} from './presets'
import { selectVariant, variantNames } from './variants'
import type { ResolvedViewerSettings } from '@/lib/media/viewer-settings'

/**
 * The WebGL half of the viewer: the canvas, the model, the lights, the ground and the camera rig.
 *
 * THE ONLY FILE THAT MOUNTS A `<Canvas>`. Everything above it is HTML — controls, panels, the
 * poster — so the engine stays inside one boundary and the chrome stays testable without WebGL.
 *
 * `frameloop="demand"` UNLESS SOMETHING MOVES. A model that nobody is turning does not need sixty
 * renders a second; the controls invalidate on change and the rig invalidates after every
 * programmatic move. Auto-rotate is the one continuous case and is off under reduced motion.
 *
 * CAMERA FIT USES THE BOUNDS FOR FRAMING AND NOTHING ELSE. The bounding box decides where the
 * camera starts and how close it may come; it is never read out as a measurement (D10 —
 * `DimensionOverlay` takes `products.dimensions` and cannot see this file).
 */

export type ViewerCanvasHandle = {
  /** Radians. Positive theta turns the model left; positive phi looks from higher up. */
  orbit(deltaTheta: number, deltaPhi: number): void
  /** Fractions of the current distance along the camera's right and up axes. */
  pan(dx: number, dy: number): void
  /** Multiplies the distance to the target; > 1 moves away. */
  zoom(factor: number): void
  /** Back to the stored `viewer_settings.camera`, or the fitted default. */
  reset(): void
  /** Close in on the finish, and back out again. */
  inspect(on: boolean): void
}

export type ViewerCanvasProps = {
  readonly modelUrl: string
  readonly settings: ResolvedViewerSettings
  readonly lighting: LightingPreset
  readonly environment: EnvironmentPreset
  /** A `KHR_materials_variants` name, or null for the file's own materials. */
  readonly variantKey: string | null
  readonly reducedMotion: boolean
  readonly ariaLabel: string
  readonly ariaDescribedBy: string
  readonly onReady: (variants: readonly string[]) => void
  readonly onError: () => void
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>

type Fit = { readonly radius: number; readonly floorY: number; readonly center: THREE.Vector3 }

const MIN_POLAR = 0.05
const MAX_POLAR = Math.PI - 0.05

// --- Lights ------------------------------------------------------------------------------------------

function Light({ spec, radius }: { spec: LightSpec; radius: number }): React.ReactElement {
  switch (spec.kind) {
    case 'ambient':
      return (
        <ambientLight
          color={resolveTokenColour(spec.colour) ?? undefined}
          intensity={spec.intensity}
        />
      )
    case 'hemisphere':
      return (
        <hemisphereLight
          args={[
            resolveTokenColour(spec.sky) ?? undefined,
            resolveTokenColour(spec.ground) ?? undefined,
            spec.intensity,
          ]}
        />
      )
    case 'directional':
      return (
        <directionalLight
          color={resolveTokenColour(spec.colour) ?? undefined}
          intensity={spec.intensity}
          position={[
            spec.position[0] * radius,
            spec.position[1] * radius,
            spec.position[2] * radius,
          ]}
        />
      )
  }
}

// --- Environment ---------------------------------------------------------------------------------

function backgroundColour(environment: EnvironmentPreset): THREE.Color {
  const colour = new THREE.Color(resolveTokenColour(environment.background) ?? undefined)
  if (environment.tint !== null) {
    colour.lerp(
      new THREE.Color(resolveTokenColour(environment.tint.colour) ?? undefined),
      environment.tint.amount,
    )
  }
  return colour
}

function Environment({
  preset,
  fit,
}: {
  preset: EnvironmentPreset
  fit: Fit | null
}): React.ReactElement {
  const background = React.useMemo(() => backgroundColour(preset), [preset])
  const ground = React.useMemo(
    () => new THREE.Color(resolveTokenColour(preset.ground) ?? undefined),
    [preset],
  )

  // Declarative, so a preset change is a prop change: the reconciler attaches the colour and the
  // fog to the scene and detaches them when the element goes, and nothing here mutates the scene.
  return (
    <>
      <color attach="background" args={[background]} />
      {preset.fog !== null && fit !== null ? (
        <fog
          attach="fog"
          args={[background, preset.fog.near * fit.radius, preset.fog.far * fit.radius]}
        />
      ) : null}
      {fit === null ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fit.center.x, fit.floorY, fit.center.z]}>
          <circleGeometry args={[fit.radius * 8, 64]} />
          <meshStandardMaterial color={ground} roughness={1} metalness={0} />
        </mesh>
      )}
    </>
  )
}

// --- Exposure ------------------------------------------------------------------------------------

function Exposure({ value }: { value: number }): null {
  // The renderer is read inside the effect through the store's getter rather than held from a
  // hook at render: it is an imperative object being written, not a value being rendered.
  const get = useThree((state) => state.get)
  React.useEffect(() => {
    get().gl.toneMappingExposure = value
    invalidate()
  }, [get, value])
  return null
}

// --- Model -----------------------------------------------------------------------------------------

function Model({
  url,
  variantKey,
  onLoaded,
}: {
  url: string
  variantKey: string | null
  onLoaded: (gltf: GLTF) => void
}): React.ReactElement {
  const gl = useThree((state) => state.gl)
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    configureLoader(loader, gl)
  })

  React.useEffect(() => {
    onLoaded(gltf)
  }, [gltf, onLoaded])

  React.useEffect(() => {
    let cancelled = false
    void selectVariant(gltf, variantKey).then(() => {
      if (!cancelled) invalidate()
    })
    return () => {
      cancelled = true
    }
  }, [gltf, variantKey])

  return <primitive object={gltf.scene} />
}

// --- Rig -------------------------------------------------------------------------------------------

function Rig({
  fit,
  settings,
  reducedMotion,
  apiRef,
}: {
  fit: Fit | null
  settings: ResolvedViewerSettings
  reducedMotion: boolean
  apiRef: React.MutableRefObject<ViewerCanvasHandle | null>
}): React.ReactElement {
  const get = useThree((state) => state.get)
  const controls = React.useRef<OrbitControlsRef>(null)
  const inspectDistance = React.useRef<number | null>(null)

  const minDistance = fit === null ? 0.01 : (settings.minDistance ?? fit.radius * 0.35)
  const maxDistance = fit === null ? 1000 : (settings.maxDistance ?? fit.radius * 8)

  // Fit once per model: the stored camera when the owner set one, the framed default otherwise.
  React.useEffect(() => {
    const orbit = controls.current
    if (fit === null || orbit === null) return
    const { camera } = get()
    const target =
      settings.camera.target === null
        ? fit.center.clone()
        : new THREE.Vector3(...settings.camera.target)
    const fov = THREE.MathUtils.degToRad(settings.camera.fov)
    const position =
      settings.camera.position === null
        ? new THREE.Vector3(1, 0.55, 1.35)
            .normalize()
            .multiplyScalar((fit.radius / Math.sin(fov / 2)) * 1.15)
            .add(target)
        : new THREE.Vector3(...settings.camera.position)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = settings.camera.fov
      camera.near = Math.max(fit.radius / 200, 0.001)
      camera.far = fit.radius * 200
      camera.updateProjectionMatrix()
    }
    camera.position.copy(position)
    orbit.target.copy(target)
    orbit.update()
    orbit.saveState()
    invalidate()
  }, [get, fit, settings])

  React.useEffect(() => {
    apiRef.current = {
      orbit(deltaTheta, deltaPhi) {
        const orbit = controls.current
        if (orbit === null) return
        const { camera } = get()
        const offset = camera.position.clone().sub(orbit.target)
        const spherical = new THREE.Spherical().setFromVector3(offset)
        spherical.theta += deltaTheta
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + deltaPhi, MIN_POLAR, MAX_POLAR)
        offset.setFromSpherical(spherical)
        camera.position.copy(orbit.target).add(offset)
        orbit.update()
        invalidate()
      },
      pan(dx, dy) {
        const orbit = controls.current
        if (orbit === null) return
        const { camera } = get()
        const distance = camera.position.distanceTo(orbit.target)
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        const move = right.multiplyScalar(dx * distance).add(up.multiplyScalar(dy * distance))
        camera.position.add(move)
        orbit.target.add(move)
        orbit.update()
        invalidate()
      },
      zoom(factor) {
        const orbit = controls.current
        if (orbit === null) return
        const { camera } = get()
        const offset = camera.position.clone().sub(orbit.target)
        const length = THREE.MathUtils.clamp(offset.length() * factor, minDistance, maxDistance)
        offset.setLength(length)
        camera.position.copy(orbit.target).add(offset)
        orbit.update()
        invalidate()
      },
      reset() {
        const orbit = controls.current
        if (orbit === null) return
        inspectDistance.current = null
        orbit.reset()
        invalidate()
      },
      inspect(on) {
        const orbit = controls.current
        if (orbit === null) return
        const { camera } = get()
        const offset = camera.position.clone().sub(orbit.target)
        if (on) {
          if (inspectDistance.current === null) inspectDistance.current = offset.length()
          offset.setLength(Math.max(minDistance, offset.length() * 0.45))
        } else if (inspectDistance.current !== null) {
          offset.setLength(THREE.MathUtils.clamp(inspectDistance.current, minDistance, maxDistance))
          inspectDistance.current = null
        }
        camera.position.copy(orbit.target).add(offset)
        orbit.update()
        invalidate()
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, get, minDistance, maxDistance])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      autoRotate={settings.autoRotate && !reducedMotion}
      autoRotateSpeed={1}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      enablePan
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  )
}

// --- Error boundary --------------------------------------------------------------------------------

type BoundaryProps = { readonly onError: () => void; readonly children: React.ReactNode }

/** A failed fetch, a bad file, a decoder that would not start: the boundary reports and empties. */
class LoadBoundary extends React.Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(): void {
    this.props.onError()
  }

  override render(): React.ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

// --- Canvas ----------------------------------------------------------------------------------------

export const ViewerCanvas = React.forwardRef<ViewerCanvasHandle, ViewerCanvasProps>(
  function ViewerCanvas(
    {
      modelUrl,
      settings,
      lighting,
      environment,
      variantKey,
      reducedMotion,
      ariaLabel,
      ariaDescribedBy,
      onReady,
      onError,
      onKeyDown,
    },
    ref,
  ) {
    const apiRef = React.useRef<ViewerCanvasHandle | null>(null)
    const [fit, setFit] = React.useState<Fit | null>(null)

    React.useImperativeHandle(ref, () => ({
      orbit: (t, p) => apiRef.current?.orbit(t, p),
      pan: (x, y) => apiRef.current?.pan(x, y),
      zoom: (f) => apiRef.current?.zoom(f),
      reset: () => apiRef.current?.reset(),
      inspect: (on) => apiRef.current?.inspect(on),
    }))

    const onLoaded = React.useCallback(
      (gltf: GLTF) => {
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const radius = Math.max(size.x, size.y, size.z, 0.001) / 2
        setFit({ radius, floorY: box.min.y, center })
        onReady(variantNames(gltf))
      },
      [onReady],
    )

    const continuous = settings.autoRotate && !reducedMotion

    return (
      <Canvas
        role="img"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-viewer-canvas=""
        frameloop={continuous ? 'always' : 'demand'}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        camera={{ fov: settings.camera.fov, near: 0.01, far: 1000, position: [0, 0, 5] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        className="size-full outline-none focus-visible:ring-2 focus-visible:ring-(--rv-3d-hotspot)"
      >
        <Exposure value={settings.exposure * lighting.exposure} />
        {lighting.lights.map((spec, index) => (
          <Light key={`${lighting.key}-${index}`} spec={spec} radius={fit?.radius ?? 1} />
        ))}
        <Environment preset={environment} fit={fit} />
        <LoadBoundary onError={onError}>
          <React.Suspense fallback={null}>
            <Model url={modelUrl} variantKey={variantKey} onLoaded={onLoaded} />
          </React.Suspense>
        </LoadBoundary>
        <Rig fit={fit} settings={settings} reducedMotion={reducedMotion} apiRef={apiRef} />
      </Canvas>
    )
  },
)
