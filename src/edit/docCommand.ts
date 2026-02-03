import * as vscode from 'vscode';
import { LLMClient } from '../api/llmClient';
import { Logger } from '../utils/logger';

export class DocumentCommands {
  private llmClient = new LLMClient();
  private logger = Logger.getInstance();

  public async rewriteSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage('No text selected');
      return;
    }

    const instruction = await vscode.window.showInputBox({
      prompt: 'Enter instruction for rewriting (e.g., "make it more formal", "add comments")',
      placeHolder: 'Instruction...'
    });

    if (!instruction) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Rewriting selection...',
          cancellable: false
        },
        async () => {
          const rewrittenText = await this.llmClient.rewriteDocument({
            language: editor.document.languageId,
            filePath: editor.document.uri.fsPath,
            selectedText,
            instruction
          });

          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, rewrittenText);
          });

          this.logger.info('Selection rewritten', { instruction });
        }
      );
    } catch (error) {
      this.logger.error('Failed to rewrite selection', error);
      vscode.window.showErrorMessage('Failed to rewrite selection. Check output for details.');
    }
  }

  public async continueWriting(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const position = editor.selection.active;
    const prefixRange = new vscode.Range(
      new vscode.Position(0, 0),
      position
    );
    const prefixCode = editor.document.getText(prefixRange);

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Continuing writing...',
          cancellable: false
        },
        async () => {
          const continuation = await this.llmClient.completeCode({
            language: editor.document.languageId,
            filePath: editor.document.uri.fsPath,
            prefixCode,
            suffixCode: ''
          });

          await editor.edit((editBuilder) => {
            editBuilder.insert(position, continuation);
          });

          this.logger.info('Continued writing', { 
            file: editor.document.uri.fsPath,
            length: continuation.length 
          });
        }
      );
    } catch (error) {
      this.logger.error('Failed to continue writing', error);
      vscode.window.showErrorMessage('Failed to continue writing. Check output for details.');
    }
  }
}
