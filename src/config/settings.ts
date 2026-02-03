import * as vscode from 'vscode';

export interface OpenCompletionConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  contextScope: 'currentFile' | 'project';
  contextMaxLines: number;
  contextMaxTokens: number;
  debounceMs: number;
  temperature: number;
  timeout: number;
  autoContinueEnabled: boolean;
  autoContinueDelayMs: number;
  autoContinueLanguages: string[];
}

export class SettingsManager {
  private static instance: SettingsManager;
  private configChangeListeners: ((config: OpenCompletionConfig) => void)[] = [];

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('opencompletion')) {
        const config = this.getConfig();
        this.configChangeListeners.forEach(listener => listener(config));
      }
    });
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public getConfig(): OpenCompletionConfig {
    const config = vscode.workspace.getConfiguration('opencompletion');
    
    return {
      enabled: config.get<boolean>('enabled', true),
      apiUrl: config.get<string>('apiUrl', 'http://localhost:11434/v1'),
      apiKey: config.get<string>('apiKey', ''),
      modelName: config.get<string>('modelName', 'codellama'),
      contextScope: config.get<'currentFile' | 'project'>('context.scope', 'currentFile'),
      contextMaxLines: config.get<number>('context.maxLines', 200),
      contextMaxTokens: config.get<number>('context.maxTokens', 2048),
      debounceMs: config.get<number>('debounceMs', 300),
      temperature: config.get<number>('temperature', 0.2),
      timeout: config.get<number>('timeout', 10000),
      autoContinueEnabled: config.get<boolean>('autoContinue.enabled', false),
      autoContinueDelayMs: config.get<number>('autoContinue.delayMs', 2000),
      autoContinueLanguages: config.get<string[]>('autoContinue.languages', ['markdown', 'plaintext'])
    };
  }

  public onConfigChange(listener: (config: OpenCompletionConfig) => void): vscode.Disposable {
    this.configChangeListeners.push(listener);
    return new vscode.Disposable(() => {
      const index = this.configChangeListeners.indexOf(listener);
      if (index > -1) {
        this.configChangeListeners.splice(index, 1);
      }
    });
  }

  public async updateConfig(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration('opencompletion');
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }
}
