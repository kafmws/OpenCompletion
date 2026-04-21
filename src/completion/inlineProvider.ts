import * as vscode from 'vscode';
import { LLMClient } from '../api/llmClient';
import { ContextCollector, CodeContext } from './contextCollector';
import { Logger } from '../utils/logger';
import { SettingsManager } from '../config/settings';

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private llmClient = new LLMClient();
  private contextCollector = new ContextCollector();
  private logger = Logger.getInstance();
  private settings = SettingsManager.getInstance();
  private currentRequest: Promise<string> | null = null;
  private lastRequestTime = 0;
  private lastErrorTime = 0;
  private codeContext: CodeContext | null = null;

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    const config = this.settings.getConfig();
    
    this.logger.info('🔍 provideInlineCompletionItems called', {
      enabled: config.enabled,
      file: document.fileName,
      line: position.line,
      char: position.character,
      triggerKind: context.triggerKind
    });
    
    if (!config.enabled) {
      this.logger.warn('❌ OpenCompletion is disabled');
      return null;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < config.debounceMs) {
      this.logger.debug(`⏱️ Debounce: ${timeSinceLastRequest}ms < ${config.debounceMs}ms`);
      return null;
    }

    this.lastRequestTime = now;

    if (token.isCancellationRequested) {
      this.logger.debug('❌ Token already cancelled');
      return null;
    }

    try {
      this.logger.info('📡 Requesting completion from LLM...', {
        model: config.modelName,
        apiUrl: config.apiUrl
      });

      const completionPromise = this.requestCompletion(document, position);
      this.currentRequest = completionPromise;

      token.onCancellationRequested(() => {
        this.logger.warn('⚠️ Completion cancelled by user');
        this.currentRequest = null;
      });

      const completion = await completionPromise;
      
      if (this.currentRequest !== completionPromise) {
        this.logger.debug('🔄 Request superseded by newer request');
        return null;
      }

      if (token.isCancellationRequested) {
        this.logger.debug('❌ Cancelled during request');
        return null;
      }

      if (!completion) {
        this.logger.warn('⚠️ Empty completion returned from LLM');
        return null;
      }

      this.logger.info('📥 Raw completion received', {
        length: completion.length,
        preview: completion.substring(0, 100).replace(/\n/g, '\\n')
      });

      const trimmedCompletion = this.trimCompletion(completion);
      
      if (!trimmedCompletion) {
        this.logger.warn('⚠️ Completion became empty after trimming');
        return null;
      }

      this.logger.info('✅ Inline completion ready to display', {
        length: trimmedCompletion.length,
        preview: trimmedCompletion.substring(0, 50).replace(/\n/g, '\\n')
      });

      const dedupedCompletion = this.removeDuplicatePrefix(document, position, trimmedCompletion);
      
      if (!dedupedCompletion) {
        this.logger.warn('⚠️ Completion became empty after deduplication');
        return null;
      }

      this.logger.info('🎯 Returning InlineCompletionItem', {
        originalLength: trimmedCompletion.length,
        dedupedLength: dedupedCompletion.length,
        removed: trimmedCompletion.length - dedupedCompletion.length
      });

      const item = new vscode.InlineCompletionItem(
        dedupedCompletion,
        new vscode.Range(position, position)
      );

      return [item];
    } catch (error) {
      this.logger.error('❌ Inline completion failed', error);
      
      let errorMessage = 'OpenCompletion failed';
      let isCriticalError = false;
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
          errorMessage = '⏱️ OpenCompletion: Request timeout - Model is too slow or not responding';
          isCriticalError = true;
        } else if (error.message.includes('fetch') || error.message.includes('Network')) {
          errorMessage = '🔌 OpenCompletion: Network error - Cannot connect to API service';
          isCriticalError = true;
        } else if (error.message.includes('HTTP 404')) {
          errorMessage = '❓ OpenCompletion: API not found - Check your API URL';
          isCriticalError = true;
        } else if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403')) {
          errorMessage = '🔒 OpenCompletion: Authentication failed - Check your API key';
          isCriticalError = true;
        } else if (error.message.includes('HTTP')) {
          errorMessage = `⚠️ OpenCompletion: API error - ${error.message}`;
          isCriticalError = true;
        } else {
          errorMessage = `❌ OpenCompletion: ${error.message}`;
          isCriticalError = true;
        }
      }
      
      if (isCriticalError) {
        const now = Date.now();
        const shouldNotify = now - this.lastErrorTime > 10000;
        
        if (shouldNotify) {
          this.lastErrorTime = now;
          
          vscode.window.showErrorMessage(
            errorMessage,
            'View Logs',
            'Open Settings',
            'Disable Extension'
          ).then(async selection => {
            if (selection === 'View Logs') {
              this.logger.show();
            } else if (selection === 'Open Settings') {
              vscode.commands.executeCommand('workbench.action.openSettings', 'opencompletion');
            } else if (selection === 'Disable Extension') {
              const settings = this.settings;
              await settings.updateConfig('enabled', false);
              vscode.window.showInformationMessage('OpenCompletion disabled. Re-enable from status bar.');
            }
          });
        }
      }
      
      return null;
    } finally {
      this.currentRequest = null;
    }
  }

  private async requestCompletion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    this.logger.info('📦 Collecting context...');
    const codeContext = await this.contextCollector.collectContext(document, position);
    this.codeContext = codeContext;
    
    this.logger.info('📤 Sending to LLM', {
      language: codeContext.language,
      prefixLength: codeContext.prefixCode.length,
      suffixLength: codeContext.suffixCode.length
    });
    
    const completion = await this.llmClient.completeCode({
      language: codeContext.language,
      filePath: codeContext.filePath,
      prefixCode: codeContext.prefixCode,
      suffixCode: codeContext.suffixCode
    });

    return completion;
  }

  private trimCompletion(completion: string): string {
    let trimmed = completion.trim();
    
    if (trimmed.startsWith('```')) {
      this.logger.debug('🔧 Removing markdown code block wrapper');
      const lines = trimmed.split('\n');
      if (lines.length > 2) {
        trimmed = lines.slice(1, -1).join('\n');
      }
    }

    const codeBlockMatch = trimmed.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      this.logger.debug('🔧 Extracting from markdown code block');
      trimmed = codeBlockMatch[1].trim();
    }

    return trimmed;
  }

  private removeDuplicatePrefix(
    document: vscode.TextDocument,
    position: vscode.Position,
    completion: string
  ): string {
    const currentLine = document.lineAt(position.line);
    if (completion.startsWith(currentLine.text)) {
      completion = completion.substring(currentLine.text.length)
    }
    
    var prefixCode = this.codeContext?.prefixCode
    if (prefixCode === undefined) prefixCode = ''
    if (completion.startsWith(prefixCode)) {
      completion = completion.substring(prefixCode.length)
    }

    return completion;
  }

  public resetDebounce(): void {
    this.lastRequestTime = 0;
    this.logger.debug('🔄 Debounce timer reset');
  }

  public isRequesting(): boolean {
    return this.currentRequest !== null;
  }
}
