import * as vscode from 'vscode';
import { InlineCompletionProvider } from './completion/inlineProvider';
import { AutoContinueManager } from './completion/autoContinueManager';
import { DocumentCommands } from './edit/docCommand';
import { Logger } from './utils/logger';
import { SettingsManager } from './config/settings';

let statusBarItem: vscode.StatusBarItem;
let autoContinueManager: AutoContinueManager;

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  const settings = SettingsManager.getInstance();
  
  logger.info('OpenCompletion is activating...');

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'opencompletion.openSettings';
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  settings.onConfigChange(() => {
    updateStatusBar();
  });

  const inlineProvider = new InlineCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  );

  autoContinueManager = new AutoContinueManager(inlineProvider);
  autoContinueManager.setupListeners(context);

  const docCommands = new DocumentCommands();
  
  context.subscriptions.push(
    vscode.commands.registerCommand('opencompletion.rewriteSelection', () => {
      docCommands.rewriteSelection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencompletion.continueWriting', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      try {
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      } catch (error) {
        const logger = Logger.getInstance();
        logger.error('Failed to trigger inline suggestion', error);
        vscode.window.showErrorMessage('Failed to trigger completion');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencompletion.toggle', async () => {
      const config = settings.getConfig();
      await settings.updateConfig('enabled', !config.enabled);
      
      const status = config.enabled ? 'disabled' : 'enabled';
      vscode.window.showInformationMessage(`OpenCompletion ${status}`);
      logger.info(`OpenCompletion ${status}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencompletion.showStatus', () => {
      const config = settings.getConfig();
      const status = `
OpenCompletion Status:
• Enabled: ${config.enabled}
• Model: ${config.modelName}
• API URL: ${config.apiUrl}
• Auto-Continue: ${config.autoContinueEnabled}
• Languages: ${config.autoContinueLanguages.join(', ')}

View detailed logs in Output panel (View → Output → OpenCompletion)
      `.trim();
      
      vscode.window.showInformationMessage(status, 'View Logs', 'Open Settings').then(selection => {
        if (selection === 'View Logs') {
          logger.show();
        } else if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'opencompletion');
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencompletion.openSettings', async () => {
      await showModelSwitcher();
    })
  );

  logger.info('OpenCompletion activated successfully');
}

export function deactivate(): void {
  const logger = Logger.getInstance();
  logger.info('OpenCompletion is deactivating...');
  
  if (autoContinueManager) {
    autoContinueManager.dispose();
  }
  
  logger.dispose();
}

function updateStatusBar(): void {
  const settings = SettingsManager.getInstance();
  const config = settings.getConfig();
  
  if (config.enabled) {
    statusBarItem.text = `$(zap) ${config.modelName}`;
    statusBarItem.tooltip = `OpenCompletion: ${config.modelName}\nClick to switch model`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(circle-slash) OpenCompletion';
    statusBarItem.tooltip = 'OpenCompletion is disabled. Click to configure.';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}

async function showModelSwitcher(): Promise<void> {
  const settings = SettingsManager.getInstance();
  const config = settings.getConfig();

  interface ModelOption extends vscode.QuickPickItem {
    value: string;
    action?: 'toggle' | 'settings' | 'model';
  }

  const commonModels: ModelOption[] = [
    {
      label: '$(rocket) qwen2.5-coder',
      description: 'Qwen 2.5 Coder - Latest Alibaba model',
      value: 'qwen2.5-coder:7b',
      action: 'model'
    },
    {
      label: '$(rocket) glm-4.7-flash',
      description: 'Zhipu model',
      value: 'glm-4.7-flash',
      action: 'model'
    },
    {
      label: '$(edit) Custom Model...',
      description: 'Enter custom model name',
      value: 'custom',
      action: 'model'
    }
  ];

  const separatorAndActions: ModelOption[] = [
    {
      label: '',
      kind: vscode.QuickPickItemKind.Separator,
      value: '',
    },
    {
      label: config.enabled ? '$(circle-slash) Disable OpenCompletion' : '$(zap) Enable OpenCompletion',
      description: config.enabled ? 'Turn off code completion' : 'Turn on code completion',
      value: 'toggle',
      action: 'toggle'
    },
    {
      label: config.autoContinueEnabled ? '$(debug-pause) Disable Auto-Continue' : '$(debug-continue) Enable Auto-Continue',
      description: config.autoContinueEnabled ? 'Turn off auto-continue writing' : 'Turn on auto-continue writing',
      value: 'toggle-auto',
      action: 'toggle'
    },
    {
      label: '$(file-code) Manage Auto-Continue File Types',
      description: `Current: ${config.autoContinueLanguages.join(', ')}`,
      value: 'manage-languages',
      action: 'settings'
    },
    {
      label: '$(gear) Open Settings',
      description: 'Configure API URL, timeout, etc.',
      value: 'settings',
      action: 'settings'
    }
  ];

  const allOptions = [...commonModels, ...separatorAndActions];

  const currentModelIndex = commonModels.findIndex(m => m.value === config.modelName);
  if (currentModelIndex >= 0) {
    allOptions[currentModelIndex].description = `$(check) ${allOptions[currentModelIndex].description}`;
  }

  const selected = await vscode.window.showQuickPick(allOptions, {
    placeHolder: `Current: ${config.modelName}`,
    title: 'OpenCompletion Model Switcher'
  });

  if (!selected) {
    return;
  }

  if (selected.action === 'toggle') {
    if (selected.value === 'toggle') {
      await settings.updateConfig('enabled', !config.enabled);
      const status = config.enabled ? 'disabled' : 'enabled';
      vscode.window.showInformationMessage(`OpenCompletion ${status}`);
    } else if (selected.value === 'toggle-auto') {
      await settings.updateConfig('autoContinue.enabled', !config.autoContinueEnabled);
      const status = config.autoContinueEnabled ? 'disabled' : 'enabled';
      vscode.window.showInformationMessage(`Auto-Continue ${status}`);
    }
  } else if (selected.action === 'settings') {
    if (selected.value === 'manage-languages') {
      await manageAutoContinueLanguages();
    } else {
      vscode.commands.executeCommand('workbench.action.openSettings', 'opencompletion');
    }
  } else if (selected.action === 'model') {
    let modelName = selected.value;
    
    if (modelName === 'custom') {
      const customModel = await vscode.window.showInputBox({
        prompt: 'Enter model name',
        value: config.modelName,
        placeHolder: 'e.g., codellama:13b, custom-model'
      });
      
      if (!customModel) {
        return;
      }
      
      modelName = customModel;
    }
    
    await settings.updateConfig('modelName', modelName);
    vscode.window.showInformationMessage(`Switched to model: ${modelName}`);
  }
}

async function manageAutoContinueLanguages(): Promise<void> {
  const settings = SettingsManager.getInstance();
  const config = settings.getConfig();
  const editor = vscode.window.activeTextEditor;

  interface LanguageOption extends vscode.QuickPickItem {
    value: string;
    action: 'add-current' | 'manage';
  }

  const options: LanguageOption[] = [];

  if (editor) {
    const currentLanguage = editor.document.languageId;
    const isEnabled = config.autoContinueLanguages.includes(currentLanguage);

    options.push({
      label: isEnabled 
        ? `$(remove) Remove "${currentLanguage}" from Auto-Continue`
        : `$(add) Add "${currentLanguage}" to Auto-Continue`,
      description: `Current file type`,
      value: currentLanguage,
      action: 'add-current'
    });

    options.push({
      label: '',
      kind: vscode.QuickPickItemKind.Separator,
      value: '',
      action: 'manage'
    });
  }

  options.push({
    label: '$(edit) Edit Language List...',
    description: `Current: ${config.autoContinueLanguages.join(', ')}`,
    value: 'edit',
    action: 'manage'
  });

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: 'Manage auto-continue file types',
    title: 'Auto-Continue File Types'
  });

  if (!selected) {
    return;
  }

  if (selected.action === 'add-current') {
    const currentLanguages = config.autoContinueLanguages;
    const isEnabled = currentLanguages.includes(selected.value);

    let newLanguages: string[];
    if (isEnabled) {
      newLanguages = currentLanguages.filter(lang => lang !== selected.value);
      vscode.window.showInformationMessage(`Removed "${selected.value}" from auto-continue`);
    } else {
      newLanguages = [...currentLanguages, selected.value];
      vscode.window.showInformationMessage(`Added "${selected.value}" to auto-continue`);
    }

    await settings.updateConfig('autoContinue.languages', newLanguages);
  } else if (selected.value === 'edit') {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter language IDs separated by commas (e.g., markdown, plaintext, typescript)',
      value: config.autoContinueLanguages.join(', '),
      placeHolder: 'markdown, plaintext, typescript'
    });

    if (input) {
      const newLanguages = input.split(',').map(lang => lang.trim()).filter(lang => lang);
      await settings.updateConfig('autoContinue.languages', newLanguages);
      vscode.window.showInformationMessage(`Updated auto-continue languages: ${newLanguages.join(', ')}`);
    }
  }
}
