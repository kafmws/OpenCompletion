import * as vscode from 'vscode';
import { SettingsManager } from '../config/settings';

export interface CodeContext {
  language: string;
  filePath: string;
  prefixCode: string;
  suffixCode: string;
  relatedSnippets: string[];
}

export class ContextCollector {
  private settings = SettingsManager.getInstance();

  public async collectContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CodeContext> {
    const config = this.settings.getConfig();
    const language = document.languageId;
    const filePath = document.uri.fsPath;

    const prefixCode = this.getPrefixCode(document, position, config.contextMaxLines);
    const suffixCode = this.getSuffixCode(document, position);
    
    const relatedSnippets = config.contextScope === 'project'
      ? await this.collectProjectContext(document)
      : [];

    return {
      language,
      filePath,
      prefixCode,
      suffixCode,
      relatedSnippets
    };
  }

  private getPrefixCode(
    document: vscode.TextDocument,
    position: vscode.Position,
    maxLines: number
  ): string {
    const startLine = Math.max(0, position.line - maxLines);
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      position
    );
    
    return document.getText(range);
  }

  private getSuffixCode(
    document: vscode.TextDocument,
    position: vscode.Position,
    maxLines: number = 50
  ): string {
    const endLine = Math.min(document.lineCount - 1, position.line + maxLines);
    const range = new vscode.Range(
      position,
      new vscode.Position(endLine, 0)
    );
    
    return document.getText(range);
  }

  private async collectProjectContext(document: vscode.TextDocument): Promise<string[]> {
    const snippets: string[] = [];
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
      return snippets;
    }

    const imports = this.extractImports(document);
    const maxSnippetSize = 1000;
    const maxTotalSize = 5000;
    let totalSize = 0;

    for (const importPath of imports) {
      if (totalSize >= maxTotalSize) {
        break;
      }

      try {
        const resolvedUri = await this.resolveImportPath(
          document.uri,
          importPath,
          workspaceFolder
        );
        
        if (resolvedUri) {
          const importedDoc = await vscode.workspace.openTextDocument(resolvedUri);
          const snippet = importedDoc.getText().slice(0, maxSnippetSize);
          snippets.push(snippet);
          totalSize += snippet.length;
        }
      } catch (error) {
        continue;
      }
    }

    return snippets;
  }

  private extractImports(document: vscode.TextDocument): string[] {
    const imports: string[] = [];
    const text = document.getText();
    
    const importRegexes = [
      /import\s+.*\s+from\s+['"](.+)['"]/g,
      /require\s*\(\s*['"](.+)['"]\s*\)/g,
      /from\s+['"](.+)['"]\s+import/g,
    ];

    for (const regex of importRegexes) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          imports.push(importPath);
        }
      }
    }

    return imports;
  }

  private async resolveImportPath(
    currentFileUri: vscode.Uri,
    importPath: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<vscode.Uri | null> {
    const currentDir = vscode.Uri.joinPath(currentFileUri, '..');
    const possibleExtensions = ['', '.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs'];

    for (const ext of possibleExtensions) {
      try {
        const resolvedUri = vscode.Uri.joinPath(currentDir, importPath + ext);
        await vscode.workspace.fs.stat(resolvedUri);
        return resolvedUri;
      } catch {
        continue;
      }
    }

    try {
      const indexUri = vscode.Uri.joinPath(currentDir, importPath, 'index.ts');
      await vscode.workspace.fs.stat(indexUri);
      return indexUri;
    } catch {
      return null;
    }
  }
}
