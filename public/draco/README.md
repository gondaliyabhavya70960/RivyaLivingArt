# Draco decoder — vendored

Self-hosted `KHR_draco_mesh_compression` decoder for the Phase 21 model viewer (`components/three/**`).
`DRACOLoader.setDecoderPath('/draco/')` reads `draco_wasm_wrapper.js` and `draco_decoder.wasm` from
this folder; `draco_decoder.js` is the asm.js fallback for a browser without WebAssembly. Nothing
here is fetched from a CDN, so the viewer works under the site's CSP and with no third-party origin.

| File | Source | Version |
|---|---|---|
| `draco_wasm_wrapper.js`, `draco_decoder.wasm`, `draco_decoder.js` | `three/examples/jsm/libs/draco/gltf/` (the glTF-branch build) | `three@0.186.0` |

Licence: Apache License 2.0 — <https://github.com/google/draco/blob/master/LICENSE>.
Registered in `docs/design/COMPONENT_REGISTRY.md` (RC-905).

Do not edit these files. To update them, bump `three` in `package.json` and copy the same three
files from the same path; the version column above and the registry row change in the same commit.
