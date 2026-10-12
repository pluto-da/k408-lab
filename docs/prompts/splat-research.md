# 3DGS desktop-PC scene: asset & tooling research
Researched 2026-10-08 for a 408 exam learning site. Research only: nothing was bought, no accounts were created, nothing was downloaded except thumbnails.

## TL;DR
- **No usable real-capture splat covers a whole tower with a full set of separable parts.** The best commercially usable base is **"My ITX PC"** (CC BY 4.0, downloadable, 3.36M splats). It is an open-frame small-form-factor build, so the internals are visible.
- **Usable component splats (commercial OK):** GPU (bgets "GPU Card", CC BY), CPU die/package (tmate "CPU die", CC BY), a generic PCB (CC BY), and a Polycam GTX graphics-card splat (CC BY 4.0 under Polycam's Explore policy; quality not verified).
- **Nothing usable exists for** RAM stick, SSD (opened or not), HDD (opened), PSU, network card, standalone CPU cooler, or a downloadable motherboard. These gaps are real, not search misses: SuperSplat search returned nothing for those terms, Sketchfab only has meshes (mostly NC-SA), Polycam only has meshes, and KIRI/Luma have no public, licensed galleries.
- **Strong lead:** the same author as "My ITX PC" and "GPU Card" (SuperSplat user **bgets**) also has a **ROG Strix X570-E motherboard + Ryzen 5900X** splat with downloads switched off. It's worth asking them for a CC BY download.
- **Recommended stack:** **Spark** (three.js) or **PlayCanvas engine**. Both handle many splats with independent transforms and picking. Ship as **SOG** (or SPZ for Spark), cut parts with **SuperSplat Edit → Separate**, and make the cuts reproducible with **splat-transform `--filter-box`**.

---

## 1. Candidate assets

Licence column: ✅ = commercial public use OK (CC0 / CC BY / CC BY-SA). ❌ = NC/ND, or no licence/download.
Splat count = the highest LOD level reported by the SuperSplat API (`lodCounts[0]`). The size is SuperSplat's hosted compressed file (SOG / streamed SOG = "ssog"). The downloaded PLY will be much larger.

### A. Usable now (licence allows commercial public website, download enabled)

| # | Name | Page URL | Author | Licence | Hosted format / size | Splats | Downloadable | Quality note |
|---|---|---|---|---|---|---|---|---|
| 1 | **My ITX PC** | https://superspl.at/scene/b9b8aa2f | bgets | CC BY 4.0 ✅ (shown on page with Download button) | Streamed SOG, 104.6 MB; SH3 | 3.36M (LODs 3.36M / 1.68M / 0.84M) | Yes | 552 photos, Sony A7 IV, COLMAP + LichtFeld. Open-frame SFF chassis with a large GPU and cooling visible. **Best whole-PC hero asset.** It is not a standard ATX tower, so the PSU, RAM and SSD are mostly hidden. |
| 2 | **GPU Card** | https://superspl.at/scene/cc9cc2a7 | bgets | CC BY ✅ | SOG, 53.2 MB; SH3 | 3.55M | Yes | The thumbnail shows the card edge-on with the PCB, VRM capacitors and chokes visible. Possibly the bare board or cooler side; check in the viewer whether the cooler is off. Same capture rig as #1, so it should match visually. |
| 3 | **CPU die** | https://superspl.at/scene/3c728a0c | tmate | CC BY ✅ | SOG, 108.5 MB; SH3 | 7.77M | Yes | Delidded and lapped AMD Phenom II die on its package, with rainbow thin-film interference. Excellent for "inside the CPU", but heavy: decimate it a lot. Has a fabric background to crop out. |
| 4 | **PCB – Circuit Board** ("002 Voltage Controller") | https://superspl.at/scene/e29db4eb | eecorn (from Stephan Buth's CC BY 4.0 photogrammetry) | CC BY 4.0 ✅ (credit both) | SOG, 2.2 MB | 60k | Yes | LM2596 DC-DC buck module: capacitors, inductor, IC. Very clean and tiny. A good **PSU / VRM "power conversion" illustration** or a mobile-friendly generic PCB. |
| 5 | **Flash Unit & Circuit Board of a Disposable Camera** | https://superspl.at/scene/c81baeae | jonas_schramme | CC BY ✅ | Streamed SOG, 44.6 MB | 1.48M | Yes | Bare PCB with a large electrolytic capacitor. At best a loose proxy for PSU internals. |
| 6 | **gtx_graphics_3dgs** (Polycam) | https://poly.cam/explore/capture/3ecf6550-7440-428f-a50b-c5898c1e3594/gtx_graphics_3dgs | LightKinematic | CC BY 4.0 ✅. Polycam: "all savable content is licensed under the Creative Commons 4.0 license" (https://learn.poly.cam/hc/en-us/articles/27646853145748-Usage-Rights-and-Ownership) | Not verified (Polycam exports splats as PLY) | Not verified | Download button shown | GeForce GTX graphics card. Tagged "PC Components / Graphics Card"; the "_3dgs" title points to a splat. The viewer needed WebGPU, so **quality was not checked**. |
| 7 | **ayit39 李清宇 电脑桌** (computer desk) | https://superspl.at/scene/51f3cde0 | ayit39_liqingyu | CC BY ✅ | Streamed SOG, 75.1 MB | 2.19M | Yes | Classroom-style computer desks with towers and monitors and a floor patch. Usable only as a backdrop or environment. |
| 8 | **RE-PC Computer Museum, Seattle WA** | https://superspl.at/scene/04ff1ba2 | tosolini | CC BY ✅ | SOG, 47.2 MB; SH0 | 4.12M | Yes | XGRIDS PortalCam room scan of display cases with vintage PCs. Environment only; individual parts are too small. |
| 9 | **uCO3D "computers_and_peripherals"** (Meta) | https://uco3d.github.io/ · data: https://huggingface.co/datasets/facebook/uco3d · code: https://github.com/facebookresearch/uco3d | Meta AI | CC BY 4.0 ✅ (repo LICENSE / README) | gsplat-compressed splats (SOG-grid + PNG), 21 zips totalling **47.8 GB** for this super-category | Per object (thousands of objects) | Yes (bulk) | Turntable objects from LVIS categories. The relevant classes are only **router**, keyboard, laptop, monitor, mouse and fan, with **no PC internals**. A router could stand in for "network". Quality is consumer-phone grade. Needs conversion from gsplat's compressed format to PLY (repo tools). |

### B. Exists but not usable as-is (no download, NC/ND, or not real capture)

| # | Name | Page URL | Author | Licence / status | Format / size | Splats | Note |
|---|---|---|---|---|---|---|---|
| 10 | **ROG Strix X570-E Gaming WiFi motherboard + 5900X** | https://superspl.at/scene/e8e3583e | bgets | ❌ Downloads disabled | SOG 34.1 MB | 2.18M | Real motherboard with I/O shield. **Ask bgets.** They released #1 and #2 as CC BY, so this is the most likely motherboard source. |
| 11 | Intel Xeon | https://superspl.at/scene/64020c54 | yabemute | ❌ Downloads disabled | SOG 23.7 MB | 1.64M | Server motherboard with a tall tower cooler and RAM slots. Clean, good quality. Would cover motherboard + CPU cooler if licensed. |
| 12 | NVIDIA RTX 4090 | https://superspl.at/scene/c81a684f | saemranian | ❌ Not downloadable; PLY **sold** on Gumroad (https://saemranian.gumroad.com/l/pghol), licence unknown | 33.7 MB | n/a | 951 iPhone photos. Very clean turntable-style GPU. |
| 13 | AMD GPU 7900 XTX | https://superspl.at/scene/93a2516c | kalmarv | ❌ Downloads disabled | compressed.ply 4.4 MB | n/a | Decent GPU, but with a blue floor halo. |
| 14 | RTX6000Ada | https://superspl.at/scene/7a3ee8f7 | hjeij2000 | ❌ Downloads disabled | SOG 24.0 MB | 1.68M | Low quality (7k iterations), mostly floaters. |
| 15 | **Very Hi-Res Micro PC** | https://superspl.at/scene/5c0f892e | williambeck | ❌ PLY offered "for non commercial use" (Google Drive) | SOG 191 MB | 14.1M | 100 MP medium-format capture of an opened mini-PC with motherboard, SO-DIMM and heatsink visible. Superb, but **NC**. |
| 16 | White Gaming Setup | https://superspl.at/scene/873e44b7 | b2mbiczek | ❌ CC BY-NC-ND | SOG 10.8 MB | 615k | White glass tower with internals visible, plus desk. NC-ND, so unusable. |
| 17 | Puter | https://superspl.at/scene/6aa03431 | parkerlreed | ❌ CC BY-NC | SOG 5.9 MB | 319k | Desk PC setup, low detail. |
| 18 | Old motherboard detail test | https://superspl.at/scene/72853868 | dabarti | ❌ Downloads disabled; **synthetic** (trained on renders of a 3D model) | SOG 22.2 MB | 1.44M | High-end motherboard look, but not a real capture. |
| 19 | Tenstorrent Blackhole QuietBox v2 | https://superspl.at/scene/972a9e6e | aero_artem | ❌ Downloads disabled | SOG 5.6 MB | 332k | Liquid-cooled tower seen through glass. Low detail. |
| 20 | Old DEC PC | https://superspl.at/scene/ac881eb3 | xcissors | ❌ Downloads disabled | Streamed SOG 65.2 MB | 2.10M | Vintage desktop on a cluttered bench. |
| 21 | [edit] My PC V1 | https://superspl.at/scene/372dc096 | liprikon | ❌ Downloads disabled | 5.7 MB | n/a | Scaniverse tower; poor quality. |
| 22 | OmniObject3D 3DGS (ShapeSplats) | https://huggingface.co/datasets/ShapeSplats/omniobject_3dgs | ShapeSplats | ❌ CC BY-NC 4.0 | n/a | n/a | Object splats; NC, so unusable. |

### C. Per-part coverage (plain answer)

| Part | Usable real-capture splat? |
|---|---|
| Whole PC / case | **Yes (partial):** #1 My ITX PC (open-frame SFF, not an ATX tower with side panel). There is **no** usable splat of a standard tower with the side panel open (#16 is NC-ND; the Polycam ones are meshes). |
| Motherboard | **No** downloadable commercial one. #10 and #11 exist but are locked. |
| CPU (incl. delidded) | **Yes:** #3 CPU die (delidded/lapped Phenom II). |
| RAM stick | **None found.** |
| SSD (NVMe/SATA, opened) | **None found.** |
| HDD (opened, platters) | **None found.** |
| GPU (incl. cooler removed) | **Yes:** #2 GPU Card (may show the bare board side; verify), #6 Polycam GTX (unverified). |
| PSU | **None.** Only generic PCB proxies (#4, #5). |
| Network card | **None.** uCO3D "router" objects (#9) are the closest stand-in. |
| CPU cooler | **None standalone.** #11 shows one, but it's locked. |

### D. Source-by-source notes
- **SuperSplat / PlayCanvas gallery:** searched through its public explore API (`https://playcanvas.com/api/splats/explore?search=…`, which returns licence and download flags) for ~60 terms (pc, computer, motherboard, gpu, rtx, cpu, ram, ssd, nvme, hdd, hard drive, psu, power supply, pcb, chip, cooler, server, network, intel, amd, itx, 电脑/主板/显卡/硬盘/内存/芯片, etc.). All hits of any value are listed above.
- **Sketchfab:** it has no real splat rendering. "Splats" there are point-cloud vertices (0 faces) or Scaniverse mesh exports. Searching the API for splat/3dgs/scaniverse/luma combined with each PC part found **no splats of PC parts**. Scaniverse PC meshes exist (e.g. psychoticgiraffe's "Motherboard from a socket 7 compaq pc that melts", "Melted motherboard 2", "Performa dual cpu 9500 board"), but they are **meshes and CC BY-NC-SA**, so they are unusable.
- **Polycam Explore:** browser search for 12 terms. PC hardware there is almost all Object-Mode **meshes**, e.g. ezeart's "PC GAMING 2nd try, without panel glass" (https://poly.cam/explore/capture/1476b152-43e2-4bd9-8628-c84943dca773/PC+GAMING+2nd+trywithout+panel+glass), which is CC BY 4.0, downloadable, and a mesh. The only splat found was #6. Browser notes: /workspace/web/notes/6f8cd804-ca18-4dd6-8642-9ffb7072bbd4/polycam-research-tu_iqrtfdii6g6u7j4lfeihhffbmi/polycam_findings.md
- **KIRI Engine:** no public web gallery (/explore and /gallery return 404; "Community" goes to Discord). Not searchable.
- **Luma:** captures.lumalabs.ai has a featured feed but no search and no open licence on captures, so treat it as unusable.
- **Hugging Face:** only uCO3D (#9, CC BY) is relevant. ShapeSplats/OmniObject3D is NC. Searches for splat/3dgs/gsplat datasets found no PC-hardware sets.
- **GitHub:** repository search found no PC-hardware splat releases.
- A related non-splat resource: the "Circular TwAIn WEEE Pilot Dataset" has top-down RGB images and RGB-D point clouds of open PC internals (https://exa.ai/library/publication/hl1gv4ygz17). Its licence wasn't checked. Top-down only, so it isn't trainable into a full splat.

### E. Practical recommendation for the gaps
1. Use **#1 My ITX PC** as the overview scene, with **#2 GPU** and **#3 CPU die** as "opened" detail views. Credit "bgets / tmate, CC BY 4.0, via SuperSplat".
2. Message **bgets** on SuperSplat to ask for a download of the X570-E motherboard (#10) under the same CC BY.
3. **Capture the rest yourselves.** RAM stick, SSD (bare M.2 NVMe and an opened 2.5" SATA), opened HDD (platters and head arm visible), opened PSU, NIC, and a CPU cooler are all small objects that suit turntable capture. A phone or mirrorless camera on a matte background, ~150–300 photos each, trained in Postshot / LichtFeld Studio / Brush / gsplat, gives consistent scale and lighting and full licence control. Old parts are cheap.
4. A fallback for "internal structure" views where no capture exists: synthetic splats trained on renders of CC BY meshes, e.g. Sketchfab "MotherBoard + Components" by Daniel Cardona, CC BY (https://sketchfab.com/3d-models/motherboard-components-3bc94057328243d4b341a55f59160f8a). These are not real capture, so label them as models.

---

## 2. Segmenting / cropping a splat into per-part pieces

**SuperSplat Editor (interactive, best for hand-cut parts).** Source: https://developer.playcanvas.com/user-manual/supersplat/editor/editing-splats/
- Selection tools: Rectangle (R), Brush (B), Polygon (P), Lasso (L), Eyedropper by colour, Flood (O), Sphere Brush (Shift+B, follows the surface), and 3D **Sphere** and **Box** volumes (Set / Add / Remove / Intersect).
- Toggles: **Selection Depth (N)** limits the selection to the visible surface. **Selection Footprint (M)** selects by ellipse footprint rather than centre.
- **Edit → Separate** creates a new splat from the selected Gaussians and removes them from the original. **Edit → Duplicate** copies them instead. The docs say these are "useful for giving one region its own transform or visibility".
- Crop recipe: select the region to keep → Select → Invert → Delete → Export.
- Lock finished areas with H.
- Export formats: .ply, .compressed.ply, .sog, .spz (v4 default, v3 optional), .splat, plus standalone .html or .zip viewer. Source: https://developer.playcanvas.com/user-manual/supersplat/editor/import-export/

**splat-transform CLI (scripted, reproducible).** MIT licence. The web UI at superspl.at/convert runs the same code. Sources: https://developer.playcanvas.com/user-manual/splat-transform and https://developer.playcanvas.com/user-manual/splat-transform/cli-reference/
- `-B/--filter-box x,y,z,X,Y,Z` and `-S/--filter-sphere x,y,z,r` keep only the Gaussians inside the volume. `-V opacity,gt,0.1` filters by value. `--filter-cluster` keeps the connected cluster at `--seed-pos`. `--filter-floaters` removes stray Gaussians. `--filter-harmonics N` strips SH bands.
- `-d/--decimate n|n%` and `--decimate-adaptive` simplify the splat; the output must be .ply, so convert in a second run.
- Translate / rotate / scale and merging of multiple inputs are supported. `--stats` / `--info` report counts.
- Suggested workflow: find each part's box in SuperSplat, then script it, e.g. `splat-transform pc.ply -B x,y,z,X,Y,Z --filter-floaters gpu.ply`, then `splat-transform gpu.ply -d 300000 gpu_lo.ply`, then `splat-transform gpu_lo.ply gpu.sog`.

**Caveat (important for an "open the part" effect).** Cutting a part out of a whole-PC capture leaves holes wherever it was hidden, such as the motherboard behind the GPU or the underside of the cooler. Moved pieces will look hollow. For "internal structure", swap or cross-fade to a separate per-component capture (e.g. #2, #3, or your own captures) when a part is clicked, instead of only exploding the cut pieces.

(Learned-segmentation research methods such as Gaussian Grouping and SAGA exist but were not evaluated here.)

---

## 3. Web viewer for multiple splats with picking and animation

| | **Spark** (`@sparkjsdev/spark`, World Labs, MIT) | **PlayCanvas engine** (GSplat, MIT) | **@mkkellogg/gaussian-splats-3d** (MIT) |
|---|---|---|---|
| Multiple splats, independent transforms | **Yes.** Each `SplatMesh` is a THREE.Object3D (position / quaternion / scale), and multiple splat objects render together with correct sorting. | **Yes.** One entity per splat with its own transform. "Unified rendering" sorts all GSplat components globally, so overlapping parts don't show artifacts. | Partly. `addSplatScenes([...])` with per-scene position / rotation / scale; runtime moves need `dynamicScene: true`. |
| Raycast / picking | **Yes.** `SplatMesh.raycast(raycaster, intersects)` works with the normal three.js Raycaster. Options `raycastable` (default true) and `minRaycastOpacity` (default 0.2). | **Yes.** `Picker.getSelectionAsync()` returns the `GSplatComponent` and, with depth, a world position. Requires `app.scene.gsplat.id = true`. Can run at quarter resolution. | No documented per-scene pick API. It has an internal "mesh cursor" ray intersection (key C). |
| Animation / effects | Dyno shader-graph modifiers (`objectModifiers` / `worldModifiers`), real-time colour editing, displacement, skeletal animation. Fuses with three.js meshes, so you can use `Line2` for the connector lines. | Shader effects and reveal examples, procedural splats, GPU splat processing. Mesh lines draw in the same scene. | Basic. |
| Formats | PLY, compressed PLY, SPZ, SPLAT, KSPLAT, SOG | PLY, compressed PLY, SOG, Streamed SOG (LOD), SPZ | PLY, SPLAT, KSPLAT |
| Mobile | "Renders fast even on low-powered mobile devices"; targets 98%+ WebGL2 | WebGL2 / WebGPU; global splat budget with LOD | Author notes "sub-optimal performance on mobile"; CPU sort; needs COOP/COEP headers for SharedArrayBuffer |
| Status | Active (v2.3.1 on CDN) | Active (engine v2.23 API docs) | **No longer in active development.** The README recommends Spark instead. |

Sources:
- Spark: https://github.com/sparkjsdev/spark and https://sparkjs.dev/docs/splat-mesh/
- PlayCanvas picking: https://developer.playcanvas.com/user-manual/gaussian-splatting/building/picking and https://github.com/playcanvas/engine/pull/8421
- PlayCanvas unified rendering: https://developer.playcanvas.com/user-manual/gaussian-splatting/building/unified-rendering/
- GSplatComponent API (examples: Multi-Splat, Picking, Reveal Effect, Shader Effects): https://api.playcanvas.com/engine/classes/GSplatComponent.html
- GaussianSplats3D: https://github.com/mkkellogg/GaussianSplats3D

**Pick:** use **Spark** if the site is already three.js or React-Three-Fiber, since connector lines, labels and UI are plain three.js. Use the **PlayCanvas engine** if you want SOG / Streamed SOG with an automatic splat budget and the most battle-tested splat picking. Avoid GaussianSplats3D for new work.

---

## 4. File-size and performance tips for mobile / tablet
- **Formats:** SOG is "typically ~15–20× smaller than an equivalent PLY" (PlayCanvas spec). One example scene went from a 1 GB PLY to 42 MB SOG. SPZ is ~10× smaller than PLY. PlayCanvas recommends SOG for web delivery. Sources: https://developer.playcanvas.com/user-manual/gaussian-splatting/formats, https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/spz, and the SOG blog post https://github.com/playcanvas/blog/blob/main/blog/2025-09-17-playcanvas-open-sources-sog-format-for-gaussian-splatting.md
  - With Spark, SPZ is a natural fit; Spark also reads SOG.
- **Splat budget:** SuperSplat's own viewer budgets are desktop 2M (performance mode) to 4M Gaussians, and mobile/XR 1M to 2M. It auto-builds Streamed SOG LODs at ≥1M Gaussians. Source: https://developer.playcanvas.com/user-manual/supersplat/streaming/
  - For this scene, aim for **≤1M Gaussians total visible on tablets**: e.g. a hero PC of ~500–700k plus each opened part at ~100–300k, **lazy-loaded only when clicked**.
- **Decimate** heavy sources with `splat-transform -d` (e.g. CPU die 7.8M → ~300k; My ITX PC → its 840k LOD or lower).
- **Strip SH bands** with `--filter-harmonics 0` or `1`. View-dependent shine matters little for a teaching scene, and SH is most of a PLY's bytes.
- **Crop** backgrounds and floor halos (`--filter-box`, `--filter-floaters`). This saves size and makes picking cleaner.
- **Rendering:** PlayCanvas recommends turning off MSAA/antialias for splats because fragment cost is the bottleneck. Run the picker at reduced resolution (0.25×), and render on demand when nothing is animating.

---

## Files and notes
- This report: /workspace/work/splat-research.md
- Raw SuperSplat API results: /workspace/work/ss_results.json. Sketchfab search results: /workspace/work/sf_results.json. uCO3D archive index: /workspace/work/uco3d_cats.json. Thumbnail contact sheets: /workspace/work/thumbs/grid.jpg and /workspace/work/thumbs/grid2.jpg
- Verified directly: licence and download flags from the SuperSplat API for every SuperSplat row; the "CC BY 4.0 / Download" text on the My ITX PC page; thumbnails for content checks.
- Not verified: the formats offered by each SuperSplat Download button (PLY vs SOG); the real quality and size of Polycam #6; whether #2's cooler is removed.
