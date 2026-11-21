# Zoom Into Section Peng

Open and navigate editable sections of an Obsidian note, while the outline tab keeps its own fold state, cursor, and scroll position. The zoom tab only auto-expands the node it is currently showing.

从大纲标签打开笔记中的一个 Section，在 Zoom 标签里直接编辑同一份源笔记。大纲标签保留自己的折叠、光标和滚动位置，Zoom 标签的自动展开只作用于当前标签。

## Requirements

| | |
| :--- | :--- |
| Obsidian | **1.15.1** or newer |
| Platform | **Desktop only** (verified on macOS; Windows and Linux are untested) |
| Mode | **Live Preview** for the `⌘`-click entry point |

## Install with BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs the plugin directly from this repository and keeps it updated from GitHub Releases.

1. Install and enable **BRAT** from Obsidian's Community plugins.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter `TheodorePeng/obsidian-zoom-into-section-peng`.
4. Enable **Zoom Into Section Peng** in Settings → Community plugins.

**Manual install**: download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/TheodorePeng/obsidian-zoom-into-section-peng/releases/latest) into `<vault>/.obsidian/plugins/zoom-into-section-peng/`, then reload Obsidian.

## 通过 BRAT 安装

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 可以直接从这个仓库安装插件，并通过 GitHub Release 保持更新。

1. 在 Obsidian 的社区插件中安装并启用 **BRAT**。
2. 打开命令面板，运行 **BRAT: Add a beta plugin for testing**。
3. 输入 `TheodorePeng/obsidian-zoom-into-section-peng`。
4. 在「设置 → 社区插件」中启用 **Zoom Into Section Peng**。

**手动安装**：从[最新发布](https://github.com/TheodorePeng/obsidian-zoom-into-section-peng/releases/latest)下载 `main.js`、`manifest.json`、`styles.css`，放入 `<vault>/.obsidian/plugins/zoom-into-section-peng/`，然后重新加载 Obsidian。

> BRAT 的行为可能随版本变化。若上述步骤与实际界面不一致，请以官方 [BRAT 仓库](https://github.com/TfTHacker/obsidian42-brat) 和 [开发者指南](https://tfthacker.com/brat-developers) 为准。

## Update

In BRAT, run **Check for updates to all beta plugins**, or enable auto-update. Each update is fetched from the release assets of the newest GitHub Release. Version and `minAppVersion` come from the released `manifest.json`.

## 更新

在 BRAT 中运行 **Check for updates to all beta plugins**，或开启自动更新。每次更新都取自最新 GitHub Release 的发布资产，版本号与 `minAppVersion` 以发布版 `manifest.json` 为准。

## Usage

- **Open a zoom tab**: in Live Preview, hold `⌘` and click a bullet's or heading's fold arrow. You can also place the cursor inside a node and run **Open section in zoom tab**.
- **Tab location**: set **Default Zoom Tab location** in the plugin settings to open in the same tab group or in a right split. The commands **Open section in current tab group** and **Open section in right split** override it once. Opening the same section again in the same group switches to the existing tab.
- **Navigate**: the breadcrumb at the top of the zoom tab shows the note name, the parent chain, and the current node. Click a parent to widen the editable range in place, or click the note name to restore the whole note in the current tab. Same-named nodes are distinguished by line number.
- **Edit**: `⌘A` selects the whole section, and the entry node itself stays editable. If the entry node is deleted or the structure shifts so the range cannot be located reliably, the tab falls back to showing the full note.
- **State**: zoom state is per session. After a restart Obsidian may restore open zoom tabs as ordinary Markdown tabs.

## 使用

- **打开 Zoom 标签**：在 Live Preview 中按住 `⌘` 点击无序列表标记或标题的折叠箭头；也可以将光标放在 node 内，运行 **Open section in zoom tab**。
- **标签位置**：在插件设置的 **Default Zoom Tab location** 中选择与大纲标签同组或右侧分栏。**Open section in current tab group** 和 **Open section in right split** 可单次指定位置。同一标签组重复打开同一个 Section 时，会切换到已有标签。
- **切换 Section**：Zoom 标签顶部的面包屑显示笔记名、父层和当前 node。点击父层可以原地扩大编辑范围，点击笔记名则在当前标签恢复整篇笔记。同名 node 用行号区分。
- **编辑**：`⌘A` 选择整个 Section，入口 node 本身也可编辑。若入口被删除或结构变化导致范围无法可靠定位，标签会回退为显示完整笔记。
- **状态**：Zoom 状态按本次会话管理。重启后 Obsidian 有可能把已打开的标签恢复为普通 Markdown 标签。

## Development

```sh
npm ci
npm run lint
npm test
npm run build
```

Artifacts are `main.js`, `manifest.json`, and `styles.css`. The scaffold comes from the official Sample Plugin at commit `07ceb81d1fb3384af611ebf665a1ec42a7e5926d`. Section range parsing uses Lezer Markdown; see [third-party notices](THIRD-PARTY-NOTICES.md).

## 本地开发

```sh
npm ci
npm run lint
npm test
npm run build
```

产物为 `main.js`、`manifest.json` 和 `styles.css`。开发脚手架来自官方 Sample Plugin 的提交 `07ceb81d1fb3384af611ebf665a1ec42a7e5926d`。范围解析使用 Lezer Markdown，许可见[第三方声明](THIRD-PARTY-NOTICES.md)。

## Testing record

Acceptance evidence, tested environments, and re-run steps are in the [acceptance record](docs/acceptance.md).

验收证据、测试环境与重跑步骤见[验收记录](docs/acceptance.md)。

## License

0BSD. Third-party attributions are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
