import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [,, inp, out, sizeArg, normSizeArg] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inp);
const size = +sizeArg || 2048, nsize = +normSizeArg || size;
await doc.transform(
  dedup(), prune(), weld(),
  // 只量化 UV：旧版 three r128 下 16 位 vec3 位置/法线会导致部分 GPU（如 SwiftShader）丢失 WebGL 上下文
  quantize({ pattern: /^TEXCOORD/ }),
  reorder({ encoder: MeshoptEncoder }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, slots: /^(baseColor|metallicRoughness)/, resize: [size, size] }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90, slots: /^normal/, resize: [nsize, nsize] }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
