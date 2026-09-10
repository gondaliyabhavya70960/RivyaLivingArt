# Basis Universal transcoder — vendored

Self-hosted transcoder for `KHR_texture_basisu` (KTX2) textures inside a GLB, used by the Phase 21
model viewer (`components/three/**`) through `KTX2Loader.setTranscoderPath('/basis/')`. A model
that carries no KTX2 texture never requests these files. Nothing here is fetched from a CDN.

`EXT_meshopt_compression` does NOT live here: its decoder is a JavaScript module imported from the
`meshoptimizer` package and bundled into the viewer chunk, so it is served from the origin as part
of that chunk rather than as a separate file. Amendment A21 records the distinction.

| File | Source | Version |
|---|---|---|
| `basis_transcoder.js`, `basis_transcoder.wasm` | `three/examples/jsm/libs/basis/` | `three@0.186.0` |

Licence: Apache License 2.0 — <https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE>.
Registered in `docs/design/COMPONENT_REGISTRY.md` (RC-906).

Do not edit these files. To update them, bump `three` in `package.json` and copy the same two files
from the same path; the version column above and the registry row change in the same commit.
