# React 外壳多设备适配：交付说明（apps/web/src，不含 public/legacy）

## 审计数字（17 个视口 × 8 个页面 = 136 页，`node apps/web/scripts/responsive-audit.cjs`）
| 项目 | 修改前 | 修改后 |
|---|---|---|
| 横向溢出 | 0 | 0 |
| JS 报错 | 0 | 0 |
| 触控视口下 <40px 的可点元素（全部页面） | 969（/lab 520、/pc 202、/terms 117、/privacy 130） | 0 |
| <12px 文字 | 544（全部在 /lab） | 173（全部在 /lab 的旧版内容，归另一个代理） |
| /pc 横屏手机 852×393 3D 场景未被遮挡的高度 | 48% | 61%（目标 ≥55%） |
| 首页内容宽度占比 1920 / 2560 | 58% / 44% | 75% / 66% |
| 根字号 1920 / 2560 | 16 / 16 | 17 / 18 |
| 协议页正文行长（汉字/行，≥768） | ≈45（720px 固定） | 41–42（max-width 42em） |

/lab 的数字也受另一个代理同时修改旧版样式的影响。
基线：/workspace/work/rwd-react/before.json；最终：/workspace/work/rwd-react/after.json、after-report.md。
