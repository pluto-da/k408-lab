# tools/pc-model — 整机拆解模块的模型构建

`/pc` 页面里的整机和每个部件的「打开」状态，都是由这里的脚本**从零程序化建模**、再导出为 glb 网格模型的（`export.py` 导出，`pack.mjs` 用 gltfpack 压缩）。下文的高斯点（splat / SOG）流程是早期方案，`splat.py` 仍保留在目录里，但当前页面不再使用。全部原创，不依赖任何外部素材。

```
textures.py   程序化贴图（主板走线与丝印、CPU die 布局、盘片磁道/扇区、DRAM Bank、标签等）→ build/tex/*.png
lib.py        bpy 建模小工具（倒角方块/圆柱/风扇叶片/线缆、材质注册）
model.py      ATX 中塔机箱 + 9 个部件的外观模型，以及 8 个部件的内部（打开）模型；锚点（标注/连线端点）
splat.py      网格 → 平面各向异性高斯：面积加权 + 每三角形 R2 低差异采样 + 切平面蓝噪声松弛；
              每个采样一个贴着三角形的扁平高斯（切向 σ≈0.72×局部间距，法向极薄），颜色 = 反照率/贴图
              （按采样间距做盒式滤波，避免摩尔纹）× 固定影棚光 + 光线追踪 AO；自遮挡完全看不见的面直接剔除
build.py      Blender 入口：exterior（整机 9 个部件）或 interior <part>；--preview 输出 Cycles 预览图
pack.mjs      PLY → SOG（@playcanvas/splat-transform），并生成 apps/web/src/pc/manifest.json
run.sh        一键全流程（2 核约 4 分钟）
```

输出坐标为 three.js 轴向（Y 向上，单位米），每个部件相对自身原点存储（提高量化精度），原点写在 manifest 里。

## 预算（平板）

| 内容 | splat 数 |
| --- | --- |
| 整机合上（9 个部件） | ≈ 696k |
| 每个部件内部（点击后懒加载） | ≤ 245k |

## 重新生成

```bash
sudo apt-get install -y blender python3-numpy python3-pil python3-scipy   # Debian/Ubuntu
cd tools/pc-model && PYTHON=/usr/bin/python3 ./run.sh
```

只改了 manifest 相关的锚点名时，可以 `node pack.mjs --manifest-only` 跳过重新压缩。
