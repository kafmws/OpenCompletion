# 错误通知改进总结

## ✅ 已完成的改进

### 1. 移除限流机制
**之前**: 每60秒最多显示一次错误通知
**现在**: 每10秒最多显示一次（减少骚扰同时确保重要错误不被忽略）

### 2. 增强的错误消息

所有错误现在都有清晰的图标和具体说明：

| 错误类型 | 消息 | 原因 |
|---------|------|------|
| 超时 | ⏱️ Request timeout - Model is too slow or not responding | API 响应时间超过配置的 timeout |
| 网络错误 | 🔌 Network error - Cannot connect to API service | 无法连接到 API（Ollama 未运行等） |
| 404 错误 | ❓ API not found - Check your API URL | API URL 不正确 |
| 401/403 | 🔒 Authentication failed - Check your API key | API 密钥错误或缺失 |
| 其他 HTTP | ⚠️ API error - [详细错误] | 其他 API 错误 |
| 其他错误 | ❌ OpenCompletion: [错误消息] | 其他未分类错误 |

### 3. 快捷操作按钮

每个错误通知现在提供3个快捷按钮：

1. **View Logs** - 打开 Output 面板查看详细日志
2. **Open Settings** - 直接打开 OpenCompletion 设置
3. **Disable Extension** - 临时禁用插件（可从状态栏重新启用）

### 4. 用户体验优化

#### 超时错误示例：
```
⏱️ OpenCompletion: Request timeout - Model is too slow or not responding
[View Logs] [Open Settings] [Disable Extension]
```

用户可以：
- 点击 "View Logs" 查看具体哪个 API 调用超时
- 点击 "Open Settings" 立即调整 timeout 或更换模型
- 点击 "Disable Extension" 暂时禁用以避免持续错误

#### 网络错误示例：
```
🔌 OpenCompletion: Network error - Cannot connect to API service
[View Logs] [Open Settings] [Disable Extension]
```

用户可以：
- 检查 Ollama 是否在运行
- 验证 API URL 配置
- 暂时禁用直到服务恢复

## 使用场景

### 场景 1: 模型响应慢导致超时

**问题**: 使用的模型太大或服务器负载高

**通知**: 
```
⏱️ Request timeout - Model is too slow or not responding
```

**解决方案**:
1. 点击 "Open Settings"
2. 增加 `timeout` 值（如从 10000 改为 30000）
3. 或更换为更快的模型

### 场景 2: Ollama 未启动

**问题**: 忘记运行 `ollama serve`

**通知**:
```
🔌 Network error - Cannot connect to API service
```

**解决方案**:
1. 点击 "View Logs" 确认错误
2. 启动 Ollama: `ollama serve`
3. 或点击 "Disable Extension" 暂时禁用

### 场景 3: API URL 配置错误

**问题**: API URL 不正确（如端口错误）

**通知**:
```
❓ API not found - Check your API URL
```

**解决方案**:
1. 点击 "Open Settings"
2. 检查 `apiUrl` 配置
3. 确保格式正确（如 `http://localhost:11434/v1`）

### 场景 4: 模型名称错误

**问题**: 配置的模型未下载或名称拼写错误

**通知**:
```
⚠️ API error - HTTP 404: model not found
```

**解决方案**:
1. 点击 "View Logs" 查看详细错误
2. 运行 `ollama list` 检查已安装的模型
3. 点击 "Open Settings" 更正模型名称

## 技术实现

### 错误分类逻辑

```typescript
if (error.message.includes('timeout')) {
  // 超时错误 - 明确指出是模型响应问题
  errorMessage = '⏱️ Request timeout - Model is too slow or not responding';
  
} else if (error.message.includes('Network')) {
  // 网络错误 - 无法连接到 API
  errorMessage = '🔌 Network error - Cannot connect to API service';
  
} else if (error.message.includes('HTTP 404')) {
  // 404 错误 - API 路径或模型不存在
  errorMessage = '❓ API not found - Check your API URL';
  
} else if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403')) {
  // 认证错误 - API 密钥问题
  errorMessage = '🔒 Authentication failed - Check your API key';
}
```

### 限流策略

```typescript
const shouldNotify = now - this.lastErrorTime > 10000; // 10秒间隔
```

避免在短时间内显示过多通知，同时确保用户能及时看到重要错误。

### 操作按钮处理

```typescript
vscode.window.showErrorMessage(
  errorMessage,
  'View Logs',
  'Open Settings', 
  'Disable Extension'
).then(async selection => {
  // 根据用户选择执行相应操作
});
```

## 对比改进

### 之前
- ❌ 60秒才能看到一次错误
- ❌ 只有 "View Logs" 按钮
- ❌ 错误消息不够清晰
- ❌ 没有快速解决方案

### 现在
- ✅ 10秒即可再次通知（减少等待）
- ✅ 3个快捷操作按钮
- ✅ 清晰的错误分类和说明
- ✅ 一键打开设置或禁用插件
- ✅ 表情符号快速识别错误类型

## 调试建议

### 当看到超时错误时：

1. **检查日志**:
   ```
   📡 Requesting completion from LLM...
   [等待很久]
   ❌ Request timeout
   ```

2. **可能的原因**:
   - 模型太大（如 70B 模型）
   - 服务器资源不足
   - 网络延迟高

3. **解决方案**:
   - 增加 timeout 设置
   - 使用更小的模型
   - 检查系统资源使用情况

### 当看到网络错误时：

1. **检查服务是否运行**:
   ```bash
   # 检查 Ollama 是否运行
   curl http://localhost:11434/v1/models
   ```

2. **检查配置**:
   - API URL 是否正确
   - 端口是否匹配
   - 是否有防火墙阻止

3. **测试连接**:
   ```bash
   curl http://localhost:11434/v1/chat/completions \
     -d '{"model":"你的模型","messages":[{"role":"user","content":"test"}]}'
   ```

## 未来可能的改进

- [ ] 添加"重试"按钮
- [ ] 自动检测常见问题并提供解决方案
- [ ] 错误统计和报告
- [ ] 智能建议（如检测到超时自动建议增加 timeout）
