# Theme

> WeBot 页面映射：`/`（介绍首页）、`/login`（魔法链接登录）、`/console`（扫码 + 绑定 + 消息）。顶栏左边动画 SVG logo（`LogoMark`）+ `WeBot`，右边「登录」或「控制台」（当前页高亮）+ `ThemeSwitch`。退出与清空聊天放在控制台页内。本文件自 [yuler/k41 DESIGN.md](https://github.com/yuler/k41/blob/main/DESIGN.md) 拷贝，类型角色按控制台体量裁剪（不用 SmokeStat 等大号数字）。生产站点：https://webot.yuler.cc/

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

默认是黑。顶栏右上始终挂 `ThemeSwitch`；选择记在这台浏览器的 `localStorage`（键名 `theme`）。

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

`ButtonGhost`：透明底，1px `line` 边框，直角，内边距 8px 12px。悬停边框变 `ink`，按下 `wash` 底。选中态改为 `solid` 底、`solid-ink` 字。

### `TextField`

无底，只有底边 1px `line`，直角。上下内边距 8px。

### `AppBar`

顶栏极简。左是 `LogoMark`（描边动画 SVG：大气泡是带天线和眼睛的机器人头，右上角叠微信小气泡，直角）+ `WeBot` 字标（首页为 `<span>`，其它页链到 `/`）；右是按登录态的入口（未登录「登录」→ `/login`，已登录「控制台」→ `/console`，当前路由高亮）以及右上角 `ThemeSwitch`。不放扫码或退出。链接字色 `gray`，激活为 `ink` 底边高亮，距下面内容 18px。

### `Timeline`

消息列表。每行上边框 1px `line`，上下内边距 10px。角色写中文（`微信` / `WeBot` / `系统`），时间当天只显示 `HH:mm`，跨天带日期。用户消息左侧加 1px `line` 竖线区分。

### `Notice`

一行状态或错误。`wash` 底、1px `line` 边，左侧小号 `gray` 标签（如「已发送」）。错误把边换成 `ink`、标签写「出错」，不引入红色。

### `Segmented`

手机端控制台的视图切换（「扫码与绑定」/「消息」）。两枚等宽 `ButtonGhost`，选中态即 `ButtonGhost` 选中态。吸在顶栏下方。≥1024px 隐藏，两栏同时显示。

## Layout

移动优先。断点：`md` 768px、`lg` 1024px。

| | 手机 (<768) | 平板 (768–1023) | 电脑 (≥1024) |
| --- | --- | --- | --- |
| 页边距 | 16px | 24px | 32px |
| 顶栏高 | 56px | 64px | 64px |
| `Panel` | 通栏，只留上下 1px `line` | 四边 1px `line` 的方块 | 同左 |
| 表单主按钮 | 通栏 | 自然宽度 | 自然宽度 |
| 控制台 | `Segmented` 切换 | `Segmented` 切换 | 左 5 / 右 7 两栏 |

内容最大宽：首页、控制台 1080px，登录 440px。顶栏通栏，内容与内容区对齐。尊重 `safe-area-inset-*`。

## Interaction

- 点击区至少 44px（电脑端 40px）。
- 悬停效果只在 `(hover: hover)` 设备上出现；触屏用 `:active` 给按下反馈。
- 键盘焦点统一 1px `ink` 描边、外偏 2px。
- 有异步动作的按钮进入 `is-loading`：方形转圈 + 「…中」文案，并禁用。
- 不可逆操作（断开绑定、清空聊天记录）先 `confirm`。
- 输入框按语义设 `inputMode` / `enterKeyHint` / `autoComplete`；手机端字号 ≥16px，防 iOS 缩放。
- 系统 `theme-color` 跟随 `ground`，手机浏览器栏与页面同色。
- `prefers-reduced-motion` 时关掉 logo 描边、转圈和过渡。
