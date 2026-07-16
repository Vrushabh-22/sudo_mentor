import { AIMessage, AIResponse, AIServiceInterface, EngineStatus, EngineSource } from "./types";
import { getModelEngine } from "./modelManager";
import { WebWorkerMLCEngine } from "@mlc-ai/web-llm";

export class LocalAIService implements AIServiceInterface {
  private currentAborter: AbortController | null = null;
  private engine: WebWorkerMLCEngine | null = null;
  private status: EngineStatus = {
    source: 'none',
    isReady: false,
    progress: 0,
    progressText: '',
  };
  private listeners: Set<(status: EngineStatus) => void> = new Set();

  subscribe(callback: (status: EngineStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private updateStatus(updates: Partial<EngineStatus>) {
    this.status = { ...this.status, ...updates };
    this.listeners.forEach(l => l(this.status));
  }

  async initialize(): Promise<void> {
    if (this.engine) return;
    
    this.updateStatus({ source: 'initializing', progress: 0, progressText: 'Loading WebLLM...' });
    
    try {
      this.engine = await getModelEngine((report) => {
        this.updateStatus({
          progress: report.progress,
          progressText: report.text,
        });
      });
      this.updateStatus({ source: 'local', isReady: true, progress: 1, progressText: 'Ready' });
    } catch (e) {
      this.updateStatus({ source: 'none', isReady: false, progress: 0, progressText: 'Failed to initialize' });
      throw e;
    }
  }

  async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: EngineStatus) => void,
    signal?: AbortSignal,
    context?: { sessionId?: string; [key: string]: any }
  ): Promise<AIResponse> {
    this.cancel(); // Cancel any existing generation
    
    if (onStatus) {
      onStatus(this.status);
    }

    if (!this.engine) {
      await this.initialize();
    }

    this.currentAborter = new AbortController();
    const abortSignal = signal || this.currentAborter.signal;

    const stream = await this.engine!.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
      // Pass max_tokens or other params if needed
    });

    let acc = '';

    for await (const chunk of stream) {
      if (abortSignal.aborted) {
        break; // Stop generation if aborted
      }
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        acc += text;
        onChunk(text);
      }
    }

    return {
      message: acc,
      source: 'local',
      sessionId: context?.sessionId // Retain the same session ID
    };
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  cancel(): void {
    if (this.currentAborter) {
      this.currentAborter.abort();
      this.currentAborter = null;
    }
    // Note: WebLLM supports aborting via engine.interruptGenerate() but the simplest way 
    // for a stream is to just stop processing the chunks in the generator loop.
    // Let's also interrupt the engine explicitly.
    if (this.engine) {
      this.engine.interruptGenerate();
    }
  }

  clear(): void {
    this.engine = null;
    this.updateStatus({ source: 'none', isReady: false, progress: 0, progressText: '' });
  }
}
