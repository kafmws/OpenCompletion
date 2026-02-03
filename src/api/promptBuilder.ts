export interface PromptTemplate {
  system: string;
  user: string;
}

export class PromptBuilder {
  public static buildCompletionPrompt(
    language: string,
    filePath: string,
    prefixCode: string,
    suffixCode: string
  ): PromptTemplate {
    return {
      system: 'You are an expert code completion assistant. Complete the code naturally and concisely. Only return the completion, no explanations.',
      user: `Language: ${language}
File: ${filePath}

Code before cursor:
${prefixCode}

Code after cursor:
${suffixCode}

Complete the code at the cursor position.`
    };
  }

  public static buildRewritePrompt(
    language: string,
    filePath: string,
    selectedText: string,
    instruction: string
  ): PromptTemplate {
    return {
      system: 'You are an expert code editing assistant. Follow the user\'s instructions precisely to modify the code.',
      user: `Language: ${language}
File: ${filePath}

Original code:
${selectedText}

Instruction: ${instruction}

Provide the modified code only, without explanations.`
    };
  }

  public static buildContinueWritingPrompt(
    language: string,
    filePath: string,
    prefixCode: string
  ): PromptTemplate {
    return {
      system: 'You are an expert code writing assistant. Continue the code naturally based on the context.',
      user: `Language: ${language}
File: ${filePath}

Existing code:
${prefixCode}

Continue writing the code naturally.`
    };
  }
}
