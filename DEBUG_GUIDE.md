# OpenCompletion 调试指南

## 📍 日志文件位置

OpenCompletion 的日志输出到 **VS Code 的 Output 面板**，而不是文件。

### 查看日志的方法：

#### 方法 1: 使用命令面板
1. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
2. 输入 "OpenCompletion: Show Status"
3. 点击 "View Logs" 按钮

#### 方法 2: 直接打开 Output 面板
1. 菜单栏 → View → Output
2. 或按快捷键 `Ctrl+Shift+U` (Windows/Linux) 或 `Cmd+Shift+U` (Mac)
3. 在右上角下拉菜单中选择 **"OpenCompletion"**

#### 方法 3: 使用状态栏
- 当出现错误时，点击错误通知中的 "View Logs" 按钮

---

## 🔍 诊断虚化补全不显示的问题

### 步骤 1: 检查基础配置

运行命令 **"OpenCompletion: Show Status & Debug Info"**，检查：

```
✅ Enabled: true        （必须是 true）
✅ Model: 你的模型名
✅ API URL: 你的 API 地址
```

### 步骤 2: 检查 VS Code 设置

打开 VS Code 设置 (`Ctrl+,`)，搜索并检查：

```json
{
  "editor.inlineSuggest.enabled": true,  // 必须是 true
  "editor.suggest.preview": true         // 建议设为 true
}
```

### 步骤 3: 查看详细日志

1. 打开 Output 面板 → 选择 "OpenCompletion"
2. 尝试触发补全（停顿输入或运行命令）
3. 查看日志输出

#### 正常的日志流程：

```
[INFO] 🔍 provideInlineCompletionItems called
[INFO] 📡 Requesting completion from LLM...
[INFO] 📦 Collecting context...
[INFO] 📤 Sending to LLM
[INFO] 📥 Raw completion received
[INFO] ✅ Inline completion ready to display
[INFO] 🎯 Returning InlineCompletionItem
```

#### 如果看到这些日志但仍然没有虚化文本：

**可能原因：**
- VS Code 的 inline suggest 被禁用
- 有其他插件冲突（如 GitHub Copilot）
- VS Code 版本过低（需要 1.75.0+）

**解决方法：**
1. 检查 `editor.inlineSuggest.enabled` 设置
2. 临时禁用其他 AI 补全插件
3. 重启 VS Code
4. 更新 VS Code 到最新版本

### 步骤 4: 检查网络错误

#### 如果看到 ❌ 错误日志：

**错误类型 1: Request timeout**
```
❌ OpenCompletion: Request timeout. Check your API service.
```
- **原因**: 模型响应太慢
- **解决**: 
  - 增加 `timeout` 设置（默认 10000ms）
  - 使用更快的模型
  - 检查网络连接

**错误类型 2: Network error**
```
❌ OpenCompletion: Network error. Is your API service running?
```
- **原因**: 无法连接到 API
- **检查**:
  - Ollama 是否正在运行：`ollama serve`
  - API URL 是否正确：默认 `http://localhost:11434/v1`
  - 防火墙是否阻止连接

**错误类型 3: HTTP error**
```
❌ OpenCompletion: API error - HTTP 404/500/...
```
- **原因**: API 返回错误
- **检查**:
  - 模型名称是否正确
  - 模型是否已下载：`ollama list`
  - API 格式是否兼容 OpenAI

### 步骤 5: 测试 API 连接

**使用 curl 测试 Ollama：**

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4.7-flash:latest",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

如果返回错误，说明 API 本身有问题。

---

## 🐛 常见问题排查

### 问题 1: "没有看到 🔍 provideInlineCompletionItems called 日志"

**原因**: InlineCompletionProvider 根本没被调用

**检查**:
1. OpenCompletion 是否启用：`opencompletion.enabled: true`
2. VS Code 是否识别了插件（重启 VS Code）
3. 查看 Output 是否有插件激活日志

### 问题 2: "看到日志但补全是空的"

查找日志中的：
```
⚠️ Empty completion returned from LLM
⚠️ Completion became empty after trimming
```

**原因**: 模型返回了空结果或格式不对

**解决**:
1. 检查模型是否适合代码补全
2. 查看 "📥 Raw completion received" 日志的内容
3. 尝试不同的模型

### 问题 3: "补全速度太慢"

查找日志时间戳，计算耗时。

**优化方法**:
1. 减少 `context.maxLines`（默认 200）
2. 使用本地模型（Ollama）
3. 使用更快的模型
4. 增加 `debounceMs` 减少请求频率

### 问题 4: "自动续写不工作"

**检查**:
1. `autoContinue.enabled: true`
2. 当前文件类型在 `autoContinue.languages` 列表中
3. 查看日志是否有 "Auto-continue triggered" 消息

**测试**:
1. 打开一个 markdown 文件
2. 输入一些文字
3. 停止输入 2 秒
4. 查看日志和通知

---

## 📊 日志符号说明

| 符号 | 含义 |
|-----|------|
| 🔍 | 补全请求开始 |
| 📡 | 向 LLM 发送请求 |
| 📦 | 收集上下文 |
| 📤 | 发送到 API |
| 📥 | 收到 API 响应 |
| ✅ | 补全成功 |
| 🎯 | 返回补全项 |
| ❌ | 错误 |
| ⚠️ | 警告 |
| 🔧 | 处理中 |
| ⏱️ | 时间相关 |

---

## 🔧 高级调试

### 启用详细日志

修改 `src/utils/logger.ts` 的日志级别：

```typescript
this.logLevel = LogLevel.DEBUG;  // 显示所有日志
```

### 检查请求内容

在日志中查找：
```
[INFO] 📤 Sending to LLM {
  language: "typescript",
  prefixLength: 1234,
  suffixLength: 567
}
```

这显示了发送给模型的上下文大小。

### 检查返回内容

查找：
```
[INFO] 📥 Raw completion received {
  length: 123,
  preview: "function example..."
}
```

这显示模型原始返回的内容。

---

## 💡 建议的测试流程

### 测试 1: 手动触发

1. 打开任意代码文件
2. 运行命令: **"OpenCompletion: Continue Writing"**
3. 立即查看 Output 面板
4. 应该看到一系列 🔍 📡 📥 ✅ 日志

### 测试 2: 自动触发

1. 打开一个 Python/Markdown 文件
2. 输入几行代码
3. 停止输入并等待（默认 2 秒）
4. 查看日志是否有 "Auto-continue triggered"

### 测试 3: 正常编码补全

1. 打开代码文件
2. 正常输入代码
3. 停顿一下（300ms）
4. 应该自动出现虚化补全

---

## 🆘 仍然无法解决？

提供以下信息以获得帮助：

1. **完整的 Output 日志** (OpenCompletion 面板的所有内容)
2. **VS Code 版本**: Help → About
3. **操作系统**: Windows/Mac/Linux
4. **API 配置**: 
   - API URL
   - 模型名称
   - 是否使用 Ollama
5. **重现步骤**: 详细描述操作过程
6. **错误消息**: 任何弹出的错误通知

---

## 📝 快速检查清单

- [ ] VS Code 版本 ≥ 1.75.0
- [ ] `opencompletion.enabled: true`
- [ ] `editor.inlineSuggest.enabled: true`
- [ ] API 服务正在运行（Ollama serve）
- [ ] 模型已下载（ollama list）
- [ ] API URL 正确
- [ ] 模型名称正确
- [ ] Output 面板可以看到日志
- [ ] 日志中有 🔍 provideInlineCompletionItems called
- [ ] 没有 ❌ 错误消息
- [ ] 临时禁用了其他 AI 插件
