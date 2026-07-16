export type EngineSource = 'local' | 'cloud' | 'initializing' | 'none';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  message: string;
  source: 'local' | 'cloud';
  sessionId?: string; // For cloud fallback
}

export interface EngineStatus {
  source: EngineSource;
  isReady: boolean;
  progress: number; // 0 to 1
  progressText: string;
}

export interface AIServiceInterface {
  initialize(): Promise<void>;
  subscribe(callback: (status: EngineStatus) => void): () => void;
  generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: EngineStatus) => void,
    signal?: AbortSignal,
    context?: { sessionId?: string; [key: string]: any }
  ): Promise<AIResponse>;
  getStatus(): EngineStatus;
  cancel(): void;
}
