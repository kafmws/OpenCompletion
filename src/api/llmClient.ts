import { SettingsManager } from '../config/settings';
import { Logger } from '../utils/logger';

export interface CompletionContext {
  language: string;
  filePath: string;
  prefixCode: string;
  suffixCode: string;
}

export interface EditContext {
  language: string;
  filePath: string;
  selectedText: string;
  instruction: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  max_tokens: number;
  stream?: boolean;
}

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content?: string | Array<{
        type?: string;
        text?: string;
      }> | null;
      refusal?: string | null;
      tool_calls?: unknown[];
    };
    text?: string | null;
    finish_reason?: string | null;
  }>;
}

export class LLMClient {
  private settings = SettingsManager.getInstance();
  private logger = Logger.getInstance();

  public async completeCode(context: CompletionContext): Promise<string> {
    const config = this.settings.getConfig();
    
    if (!config.enabled) {
      return '';
    }

    const isCodeFile = this.isCodeLanguage(context.language);
    const systemPrompt = isCodeFile
      ? 'You are an expert code completion assistant. Complete the code naturally and concisely. Only return the completion, no explanations or markdown code blocks.'
      : 'You are an expert writing assistant. Continue the text naturally and coherently. Only return the continuation, no explanations or formatting.';
    
    const userPrompt = isCodeFile
      ? `Language: ${context.language}\nFile: ${context.filePath}\n\nCode before cursor:\n${context.prefixCode}\n\nCode after cursor:\n${context.suffixCode}\n\nComplete the code at the cursor position.`
      : `File type: ${context.language}\nFile: ${context.filePath}\n\nText before cursor:\n${context.prefixCode}\n\nText after cursor:\n${context.suffixCode}\n\nContinue writing naturally from the cursor position.`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    return await this.makeRequest(messages, config.contextMaxTokens);
  }

  public async rewriteDocument(context: EditContext): Promise<string> {
    const config = this.settings.getConfig();
    
    if (!config.enabled) {
      throw new Error('OpenCompletion is disabled');
    }

    try {
      const isCodeFile = this.isCodeLanguage(context.language);
      const systemPrompt = isCodeFile
        ? 'You are an expert code editing assistant. Follow the user\'s instructions precisely to modify the code.'
        : 'You are an expert text editing assistant. Follow the user\'s instructions precisely to modify the content.';
      
      const contentLabel = isCodeFile ? 'code' : 'text';

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `File type: ${context.language}\nFile: ${context.filePath}\n\nOriginal ${contentLabel}:\n${context.selectedText}\n\nInstruction: ${context.instruction}\n\nProvide the modified ${contentLabel} only, without explanations or markdown formatting.`
        }
      ];

      return await this.makeRequest(messages, config.contextMaxTokens);
    } catch (error) {
      this.logger.error('Document rewrite failed', error);
      throw error;
    }
  }

  private isCodeLanguage(language: string): boolean {
    const documentLanguages = ['markdown', 'plaintext', 'text', 'log', 'txt'];
    return !documentLanguages.includes(language.toLowerCase());
  }

  private async makeRequest(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
    const config = this.settings.getConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const requestBody: OpenAIRequest = {
        model: config.modelName,
        messages,
        temperature: config.temperature,
        max_tokens: maxTokens,
        stream: false
      };

      this.logger.debug('LLM request', { url: config.apiUrl, model: config.modelName });

      const response = await fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No completion choices returned');
      }

      const completion = this.extractCompletionText(data);
      this.logger.debug('LLM response received', {
        length: completion.length,
        finishReason: data.choices[0]?.finish_reason ?? null
      });
      
      return completion;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  private extractCompletionText(data: OpenAIResponse): string {
    const choice = data.choices[0];

    if (!choice) {
      throw new Error('No completion choice available');
    }

    const messageContent = choice.message?.content;
    if (typeof messageContent === 'string') {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      const text = messageContent
        .map(part => this.extractTextPart(part))
        .filter((part): part is string => Boolean(part))
        .join('');

      if (text) {
        return text;
      }
    }

    if (typeof choice.text === 'string') {
      return choice.text;
    }

    const refusal = choice.message?.refusal;
    if (refusal) {
      throw new Error(`Model refused completion: ${refusal}`);
    }

    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
      throw new Error('Model returned tool calls instead of plain completion text');
    }

    const finishReason = choice.finish_reason ?? 'unknown';
    throw new Error(`Completion response did not contain text content (finish_reason=${finishReason})`);
  }

  private extractTextPart(part: { type?: string; text?: string } | null | undefined): string | null {
    if (!part || typeof part.text !== 'string') {
      return null;
    }

    if (!part.type || part.type === 'text' || part.type === 'output_text') {
      return part.text;
    }

    return null;
  }
}
