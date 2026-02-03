import * as vscode from 'vscode';
import { SettingsManager } from '../config/settings';
import { Logger } from '../utils/logger';
import { InlineCompletionProvider } from './inlineProvider';

export class AutoContinueManager {
  private settings = SettingsManager.getInstance();
  private logger = Logger.getInstance();
  private typingTimer: NodeJS.Timeout | undefined;
  private lastChangeTime = 0;
  private provider: InlineCompletionProvider;

  constructor(provider: InlineCompletionProvider) {
    this.provider = provider;
  }

  public setupListeners(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.onDocumentChange(event);
      })
    );

    this.logger.info('AutoContinueManager listeners set up');
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const config = this.settings.getConfig();

    if (!config.enabled || !config.autoContinueEnabled) {
      return;
    }

    if (event.contentChanges.length === 0) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document) {
      return;
    }

    const languageId = event.document.languageId;
    if (!config.autoContinueLanguages.includes(languageId)) {
      return;
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.lastChangeTime = Date.now();

    this.typingTimer = setTimeout(() => {
      this.triggerInlineCompletion(editor);
    }, config.autoContinueDelayMs);
  }

  private async triggerInlineCompletion(editor: vscode.TextEditor): Promise<void> {
    const timeSinceLastChange = Date.now() - this.lastChangeTime;
    const config = this.settings.getConfig();

    if (timeSinceLastChange < config.autoContinueDelayMs - 100) {
      return;
    }

    if (this.provider.isRequesting()) {
      this.logger.debug('⏸️ Skipping auto-continue: completion already in progress');
      return;
    }

    try {
      this.logger.info('🚀 Auto-continue triggered - requesting inline completion', {
        language: editor.document.languageId,
        position: editor.selection.active
      });

      await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      
      this.logger.info('✅ Inline completion triggered');
    } catch (error) {
      this.logger.error('Failed to trigger inline completion', error);
    }
  }

  public dispose(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
  }
}
