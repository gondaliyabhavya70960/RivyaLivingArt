import type { Material, Mesh, Object3D } from 'three'
import type {
  GLTF,
  GLTFLoaderPlugin,
  GLTFParser,
  GLTFReference,
} from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * `KHR_materials_variants`, read from the file and applied on request.
 *
 * NOT IN THREE'S CORE LOADER. `GLTFLoader` lists the extension as external, so this is the small
 * plugin the three.js variants example carries, written once here rather than pulled from a
 * package that would bring its own copy of the loader. It does two things: at `afterRoot`, it
 * records the variant NAMES the file declares on `gltf.userData.variants`; and it exposes
 * `selectVariant(scene, name)` which swaps each primitive's material to the one its mapping names
 * for that variant, or back to the original for `null`.
 *
 * NAMES ARE KEYS, NOT LABELS. `walnut_01` is what the file calls a variant; what the visitor reads
 * is `model_variant_labels.label`, matched on this key by `VariantSwitcher`. The viewer never
 * shows a key as if it were a finish, and it never derives a material name from a mesh.
 */

export const VARIANTS_EXTENSION = 'KHR_materials_variants'

type VariantMapping = { readonly material: number; readonly variants: readonly number[] }

export type VariantSelector = (scene: Object3D, name: string | null) => Promise<void>

export type VariantsUserData = {
  variants?: readonly string[]
  selectVariant?: VariantSelector
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true
}

export function variantsPlugin(parser: GLTFParser): GLTFLoaderPlugin {
  const json = parser.json as {
    extensions?: Record<string, { variants?: readonly { name?: string }[] }>
    meshes?: readonly {
      primitives?: readonly {
        extensions?: Record<string, { mappings?: readonly VariantMapping[] }>
      }[]
    }[]
  }
  const originals = new WeakMap<Mesh, Material | Material[]>()

  return {
    name: VARIANTS_EXTENSION,
    afterRoot: async (gltf: GLTF): Promise<void> => {
      const declared = json.extensions?.[VARIANTS_EXTENSION]?.variants ?? []
      const names = declared.map((variant, index) => variant.name ?? `variant_${index}`)
      const userData = gltf.userData as VariantsUserData
      userData.variants = names

      userData.selectVariant = async (scene, name) => {
        const variantIndex = name === null ? -1 : names.indexOf(name)
        const meshes: Mesh[] = []
        scene.traverse((object) => {
          if (isMesh(object)) meshes.push(object)
        })

        await Promise.all(
          meshes.map(async (mesh) => {
            // three records `{ meshes, primitives }` for a mesh; the typings stop at `meshes`.
            const reference = parser.associations.get(mesh) as
              (GLTFReference & { primitives?: number }) | undefined
            if (reference?.meshes === undefined || reference.primitives === undefined) return
            const primitive = json.meshes?.[reference.meshes]?.primitives?.[reference.primitives]
            const mappings = primitive?.extensions?.[VARIANTS_EXTENSION]?.mappings
            if (mappings === undefined) return

            if (!originals.has(mesh)) originals.set(mesh, mesh.material)

            const mapping =
              variantIndex === -1
                ? undefined
                : mappings.find((candidate) => candidate.variants.includes(variantIndex))

            if (mapping === undefined) {
              const original = originals.get(mesh)
              if (original !== undefined) mesh.material = original
              return
            }

            mesh.material = (await parser.getDependency('material', mapping.material)) as Material
            // Vertex colours, flat shading and the like are applied per mesh by the parser after
            // the material is chosen; a swapped material needs the same pass.
            parser.assignFinalMaterial(mesh)
          }),
        )
      }
    },
  }
}

/** The names a loaded file declares, or none. */
export function variantNames(gltf: GLTF): readonly string[] {
  return (gltf.userData as VariantsUserData).variants ?? []
}

/** Apply a variant by name, or the file's original materials for `null`. No-op without the plugin. */
export async function selectVariant(gltf: GLTF, name: string | null): Promise<void> {
  const select = (gltf.userData as VariantsUserData).selectVariant
  if (select !== undefined) await select(gltf.scene, name)
}
