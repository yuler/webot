# Theme

> WeBot 页面映射：`/`（介绍首页）、`/login`（魔法链接登录）、`/console`（扫码 + 绑定 + 消息）、`/clawbot`（独立扫码页，也可从控制台进入）。顶栏只留左边 `WEBOT`、右边「登录」或「控制台」。退出放在控制台页内。本文件自 [yuler/k41 DESIGN.md](https://github.com/yuler/k41/blob/main/DESIGN.md) 拷贝，类型角色按控制台体量裁剪（不用 SmokeStat 等大号数字）。生产站点：https://webot.yuler.cc/

界面文案用中文。颜色、字号和组件的名字用英文。

所有边角都是直角，`border-radius: 0`。

分割线是 1px 直线。层次只留少量灰，不展开成一整套灰阶。黑、白两套用同一批名字，只对调底和字。

## Color

| Token | 黑 | 白 | 用在 |
| --- | --- | --- | --- |
| `ground` | `#000000` | `#ffffff` | 所有页面的底 |
| `ink` | `#ffffff` | `#000000` | 主文字 |
| `gray` | `#888888` | `#888888` | Meta、次要说明 |
| `line` | `#333333` | `#e5e5e5` | 分割线、幽灵按钮的边、输入框的底边 |
| `wash` | `#111111` | `#f2f2f2` | 浅底块 |
| `solid` | `#ffffff` | `#000000` | 实心按钮的底 |
| `solid-ink` | `#000000` | `#ffffff` | 实心按钮的字 |

默认是黑。主题切换组件仍保留在代码里，但默认顶栏不再挂 `ThemeSwitch`；选择仍记在这台浏览器的 `localStorage`（键名 `theme`）。

## Type

全站一种无衬线，中文优先：`"Noto Sans CJK SC"`, `"Source Han Sans SC"`, `"Noto Sans SC"`, `sans-serif`。

字重只用两档：正文 400，标题 500。

| Role | Size | Weight | Line height | 用在 |
| --- | --- | --- | --- | --- |
| `Kicker` | 13px | 400 | 1.4 | 导航、App 名。字距 `0.18em` |
| `Title` | 28px | 500 | 1.2 | 页面主标题 |
| `AppTitle` | 22px | 500 | 1.2 | 分区标题 |
| `Meta` | 14px | 400 | 1.45 | 说明文字 |
| `ButtonLabel` | 继承所在表面的正文 | 400 | 1.2 | 按钮字 |

## Components

### `Button`

`ButtonSolid`：底 `solid`，字 `solid-ink`，边框 1px `solid`，直角，内边距 12px 14px。

`ButtonGhost`：透明底，1px `line` 边框，直角，内边距 8px 12px。选中态改为 `solid` 底、`solid-ink` 字。

### `TextField`

无底，只有底边 1px `line`，直角。上下内边距 8px。

### `AppBar`

顶栏极简。左是 `WEBOT` 字标（链到 `/`），右是按登录态的唯一入口：未登录「登录」→ `/login`；已登录「控制台」→ `/console`。不放扫码、主题开关、退出。链接字色 `gray`，基线对齐，距下面内容 18px。

### `Timeline`

消息列表。每行上边框 1px `line`，上下内边距 10px。
