# OpenCompletion 补全机制说明

## 核心改进

### 问题修复

1. ✅ **虚化补全显示** - 所有补全现在都显示为灰色幽灵文本，不再直接插入
2. ✅ **自动触发机制** - 用户停顿时自动触发补全请求
3. ✅ **Tab 接受机制** - 使用 VS Code 原生的 Tab 键接受补全
4. ✅ **Esc 拒绝机制** - 使用 VS Code 原生的 Esc 键拒绝补全

### 补全机制详解

#### 1. InlineCompletionProvider（核心补全引擎）

**工作原理:**
- 实现了 VS Code 的 `InlineCompletionItemProvider` 接口
- VS Code 会在适当时机自动调用 `provideInlineCompletionItems`
- 返回的补全项会显示为虚化的幽灵文本
- 用户按 Tab 接受，Esc 拒绝

**触发时机:**
- 用户输入时（由 VS Code 控制，通常在停顿 300ms 后）
- 手动调用命令触发
- 自动续写机制触发

**防抖控制:**
- 内置时间检查，避免过于频繁的请求
- 追踪最后请求时间，小于 debounceMs 则跳过

#### 2. AutoContinueManager（自动续写管理器）

**工作原理:**
- 监听文档变更事件
- 检测用户停顿（默认 2 秒）
- 调用 VS Code 命令触发 inline completion

**触发条件:**
1. OpenCompletion 已启用
2. 自动续写已启用
3. 当前文件类型在配置的语言列表中
4. 用户停止输入达到配置的延迟时间

**实现方式:**
```typescript
await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
```

这个命令会触发 VS Code 调用我们的 `InlineCompletionProvider`。

#### 3. 手动触发命令

**命令:** `opencompletion.continueWriting`

**实现:**
```typescript
await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
```

直接触发 inline completion，显示虚化文本。

## 用户体验流程

### 场景 1: 正常编码时的补全

1. 用户输入代码
2. 停顿 300ms（VS Code 默认行为）
3. VS Code 调用 `InlineCompletionProvider`
4. 显示灰色补全文本
5. 用户按 Tab 接受 / Esc 拒绝

### 场景 2: 自动续写（markdown/文档）

1. 用户在 markdown 文件中写作
2. 停顿 2 秒
3. `AutoContinueManager` 触发 inline completion
4. 显示灰色补全文本
5. 用户按 Tab 接受 / Esc 拒绝

### 场景 3: 手动触发

1. 用户运行命令 "OpenCompletion: Continue Writing"
2. 立即触发 inline completion
3. 显示灰色补全文本
4. 用户按 Tab 接受 / Esc 拒绝

## 配置项说明

### 补全相关

- `debounceMs: 300` - inline completion 的防抖延迟（毫秒）
  - 避免输入时过于频繁的 API 请求
  - 仅影响内部防抖，不影响 VS Code 的触发时机

### 自动续写相关

- `autoContinue.enabled: false` - 启用自动续写
- `autoContinue.delayMs: 2000` - 停顿多久后触发（毫秒）
- `autoContinue.languages: ["markdown", "plaintext"]` - 支持的文件类型

## 技术实现细节

### 为什么使用 InlineCompletionProvider？

VS Code 的 `InlineCompletionItemProvider` API 提供了：
- ✅ 原生的虚化文本显示
- ✅ 原生的 Tab/Esc 键处理
- ✅ 自动的光标位置处理
- ✅ 与其他补全提供者的协调
- ✅ 性能优化和缓存

### 为什么不直接插入文本？

直接插入文本的问题：
- ❌ 无法预览
- ❌ 需要手动处理撤销
- ❌ 可能干扰用户输入
- ❌ 无法与其他补全提供者协同

### 调试建议

**检查补全是否触发:**
1. 打开 Output 面板 → OpenCompletion
2. 查看日志：
   - "Inline completion requested" - 开始请求
   - "Inline completion provided" - 返回结果

**如果看不到补全:**
1. 检查 VS Code 设置：`editor.inlineSuggest.enabled` 应为 true
2. 检查是否有其他补全插件冲突（如 GitHub Copilot）
3. 检查 API 配置是否正确
4. 查看 Output 面板的错误日志

**调整触发频率:**
- 增加 `debounceMs` 减少 API 调用
- 增加 `autoContinue.delayMs` 延长自动触发时间

## 与 GitHub Copilot 的区别

| 特性 | OpenCompletion | GitHub Copilot |
|-----|----------------|----------------|
| 虚化文本 | ✅ | ✅ |
| Tab 接受 | ✅ | ✅ |
| Esc 拒绝 | ✅ | ✅ |
| 自定义模型 | ✅ | ❌ |
| 本地运行 | ✅ (Ollama) | ❌ |
| 文档续写 | ✅ | 部分支持 |
| 自动续写 | ✅ (可配置) | ❌ |

## 最佳实践

### 代码补全
- 使用默认设置即可
- `debounceMs: 300` 提供良好的响应性
- 所有文件类型自动启用

### 文档写作
1. 启用自动续写：`autoContinue.enabled: true`
2. 添加文件类型：markdown, plaintext, asciidoc 等
3. 调整延迟：`autoContinue.delayMs: 2000-3000`

### 性能优化
- 增加 `debounceMs` 到 500-1000ms 减少 API 调用
- 减少 `context.maxLines` 加快响应
- 使用本地模型（Ollama）降低延迟
