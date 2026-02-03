import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('OpenCompletion');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  public error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      if (error instanceof Error) {
        this.log('ERROR', `${message}: ${error.message}`, error.stack, ...args);
      } else {
        this.log('ERROR', message, error, ...args);
      }
    }
  }

  public show(): void {
    this.outputChannel.show();
  }

  public clear(): void {
    this.outputChannel.clear();
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}${formattedArgs}`);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
