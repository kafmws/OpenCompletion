# OpenCompletion

AI-powered code completion for VS Code using Ollama or OpenAI-compatible APIs.

## Features

- **Inline Code Completion**: Copilot-style inline suggestions as you type
- **Auto-Continue Writing**: Automatically continues writing when you stop typing (configurable)
- **Code Rewriting**: Rewrite selected code with custom instructions
- **Continue Writing**: Manually trigger continuation from current position
- **Flexible Backend**: Works with Ollama, OpenAI API, or any compatible service
- **Configurable Context**: Choose between file-level or project-level context
- **Smart Debouncing**: Optimized request handling to reduce API calls
- **File Type Management**: Configure which file types enable auto-continue
- **Smart Prompts**: Adapts prompts for code vs. document files

## Requirements

- VS Code 1.75.0 or higher
- A running LLM service compatible with OpenAI API format:
  - [Ollama](https://ollama.ai/) (recommended for local usage)
  - OpenAI API
  - Any other OpenAI-compatible endpoint

## Installation

### From VSIX (Development)

1. Build the extension:
   ```bash
   npm install
   npm run compile
   ```

2. Install in VS Code:
   - Open VS Code
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Run "Extensions: Install from VSIX..."
   - Select the built `.vsix` file

## Quick Start

### Using with Ollama (Local)

1. Install and start Ollama:
   ```bash
   ollama serve
   ```

2. Pull a code model:
   ```bash
   ollama pull codellama
   ```

3. Configure OpenCompletion:
   - Click the OpenCompletion icon in the status bar
   - Or open Settings (`Ctrl+,`) and search for "opencompletion"
   - Set:
     - API URL: `http://localhost:11434/v1`
     - Model Name: `codellama`
     - API Key: (leave empty)

### Using with OpenAI API

1. Configure OpenCompletion:
   - API URL: `https://api.openai.com/v1`
   - Model Name: `gpt-4` or `gpt-3.5-turbo`
   - API Key: Your OpenAI API key

## Configuration

All settings are available under `opencompletion.*`:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable/disable the extension |
| `apiUrl` | `http://localhost:11434/v1` | API base URL |
| `apiKey` | `""` | API authentication key |
| `modelName` | `codellama` | Model name to use |
| `context.scope` | `currentFile` | Context scope: `currentFile` or `project` |
| `context.maxLines` | `200` | Maximum context lines |
| `context.maxTokens` | `2048` | Maximum completion tokens |
| `debounceMs` | `300` | Debounce delay (ms) |
| `temperature` | `0.2` | Model temperature |
| `timeout` | `10000` | Request timeout (ms) |
| `autoContinue.enabled` | `false` | Enable auto-continue writing |
| `autoContinue.delayMs` | `2000` | Auto-continue trigger delay (ms) |
| `autoContinue.languages` | `["markdown", "plaintext"]` | File types for auto-continue |

## Usage

### Inline Completion

The extension provides **ghost text** (grayed-out) completions as you type:

1. **Automatic Trigger**: Completions appear automatically when you pause typing
2. **Press `Tab`** to accept the suggestion
3. **Press `Esc`** to dismiss the suggestion

**How it works:**
- As you type, OpenCompletion waits for a brief pause (default: 300ms)
- Then requests a completion from your configured LLM
- The completion appears as ghost text at your cursor
- You can continue typing to dismiss it, or press Tab to accept

### Auto-Continue Writing

When enabled, OpenCompletion will **automatically trigger completions** after you stop typing:

1. Enable auto-continue in settings or via status bar menu
2. Configure file types (default: markdown, plaintext)
3. Start writing in a supported file type
4. Stop typing for the configured delay (default: 2 seconds)
5. **Ghost text completion** appears automatically
6. Press `Tab` to accept or `Esc` to dismiss

**Key difference from inline completion:**
- Inline completion: Waits 300ms (short pause while typing)
- Auto-continue: Waits 2000ms (clear pause indicating you're thinking)

**Adding Current File Type:**
- Click status bar icon → "Manage Auto-Continue File Types"
- Click "Add [current-type] to Auto-Continue"

**Managing File Types:**
- Click status bar icon → "Manage Auto-Continue File Types"
- Edit the comma-separated list of language IDs

### Commands

Access via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **OpenCompletion: Rewrite Selection** - Rewrite selected code with custom instructions
- **OpenCompletion: Continue Writing** - Continue writing from current position
- **OpenCompletion: Toggle Enable/Disable** - Toggle the extension on/off
- **OpenCompletion: Open Settings** - Open extension settings

### Status Bar

The status bar icon shows the extension status:
- ⚡ [model-name] - Enabled and showing current model
- 🚫 OpenCompletion - Disabled

Click the icon to open the model switcher with options to:
- **Switch Models**: Choose from preset models or enter custom model name
- **Toggle OpenCompletion**: Enable/disable the extension
- **Toggle Auto-Continue**: Enable/disable auto-continue writing
- **Manage File Types**: Add/remove current file type for auto-continue
- **Open Settings**: Access full configuration

## Architecture

```
src/
├── config/
│   └── settings.ts          # Configuration management
├── api/
│   ├── llmClient.ts          # LLM API client
│   └── promptBuilder.ts      # Prompt templates
├── completion/
│   ├── contextCollector.ts   # Context gathering
│   └── inlineProvider.ts     # Inline completion provider
├── edit/
│   └── docCommand.ts         # Edit commands
├── utils/
│   ├── logger.ts             # Logging utility
│   └── debounce.ts           # Debounce utilities
└── extension.ts              # Extension entry point
```

## Performance Tips

1. **Use Local Models**: Ollama provides lower latency than cloud APIs
2. **Adjust Debounce**: Increase `debounceMs` to reduce API calls
3. **Limit Context**: Use `currentFile` scope for faster responses
4. **Reduce Max Lines**: Lower `context.maxLines` for quicker processing

## Troubleshooting

### Viewing Logs

OpenCompletion outputs detailed logs to help diagnose issues. **Logs are NOT saved to files** - they appear in VS Code's Output panel.

**How to view logs:**

1. **Quick Method**: 
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Run command: "OpenCompletion: Show Status & Debug Info"
   - Click "View Logs" button

2. **Direct Method**:
   - Open Output panel: `Ctrl+Shift+U` (Windows/Linux) or `Cmd+Shift+U` (Mac)
   - Or: Menu → View → Output
   - Select **"OpenCompletion"** from the dropdown in the upper-right corner

3. **When Errors Occur**:
   - Error notifications have a "View Logs" button
   - Click it to jump directly to the logs

**What logs show:**
- 🔍 When completions are triggered
- 📡 API requests and responses
- ✅ Successful completions
- ❌ Errors with detailed messages
- ⏱️ Performance timing information

See [DEBUG_GUIDE.md](DEBUG_GUIDE.md) for detailed debugging instructions.

### No Completions Appearing

**Step 1: Check Status**
- Run command: "OpenCompletion: Show Status & Debug Info"
- Verify: Enabled = true, Model and API URL are correct

**Step 2: Check VS Code Settings**
1. Open Settings (`Ctrl+,`)
2. Search: `editor.inlineSuggest.enabled`
3. Ensure it's set to `true`

**Step 3: View Logs**
1. Open Output panel → Select "OpenCompletion"
2. Try triggering a completion
3. Look for 🔍 and ❌ symbols in the logs

**Common causes:**
1. OpenCompletion is disabled
2. VS Code inline suggestions are disabled
3. API service not running (Ollama)
4. Model not downloaded
5. Network/firewall blocking connection
6. Conflicting AI extension (GitHub Copilot, etc.)

### Slow Completions

**Check performance:**
1. Open logs and check timing between 📤 and 📥 messages
2. If taking >5 seconds, the model is too slow

**Solutions:**
1. Increase `debounceMs` to 500-1000ms (reduce API calls)
2. Reduce `context.maxLines` to 100 (less context)
3. Use a smaller/faster model
4. Switch to local Ollama instead of cloud API
5. Use `currentFile` scope instead of `project`

### Network/API Errors

**Error notifications will show:**
- "Request timeout" → Increase `timeout` setting or use faster model
- "Network error" → Check if Ollama is running (`ollama serve`)
- "HTTP 404/500" → Verify model name and API URL

**Test your API connection:**

```bash
# For Ollama
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "your-model", "messages": [{"role": "user", "content": "test"}]}'
```

If curl fails, fix your API setup before troubleshooting the extension.

### Detailed Debugging

For comprehensive troubleshooting steps, log interpretation, and advanced debugging:

**→ See [DEBUG_GUIDE.md](DEBUG_GUIDE.md)**

The debug guide includes:
- Complete log location instructions
- Step-by-step diagnostic procedures
- Log symbol meanings (🔍 📡 ✅ ❌)
- Common error patterns and solutions
- Testing procedures
- How to report issues with proper logs

## Development

### Build

```bash
npm install
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new window

## License

MIT

## Credits

Built following best practices for VS Code extensions and inspired by GitHub Copilot's UX.
