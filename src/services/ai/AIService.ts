import { AIMessage, AIResponse, AIServiceInterface, EngineStatus } from "./types";
import { LocalAIService } from "./LocalAIService";
import { CloudAIService } from "./CloudAIService";

export class AIService implements AIServiceInterface {
  private localService: LocalAIService;
  private cloudService: CloudAIService;
  private isLocalSupported: boolean = true;
  private localInitialized: boolean = false;
  private statusCallback?: (status: EngineStatus) => void;

  private listeners: Set<(status: EngineStatus) => void> = new Set();
  
  isLocalAIOptedIn(): boolean {
    return localStorage.getItem('mentor_use_local_ai') === 'true';
  }

  constructor() {
    this.localService = new LocalAIService();
    this.cloudService = new CloudAIService();
    
    this.localService.subscribe(this.handleStatusUpdate);
    this.cloudService.subscribe(this.handleStatusUpdate);
  }

  subscribe(callback: (status: EngineStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private handleStatusUpdate = (status: EngineStatus) => {
    this.listeners.forEach(l => l(status));
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  async initialize(): Promise<void> {
    if (!this.isLocalSupported || this.localInitialized) return;
    
    // Check WebGPU support
    if (!(navigator as any).gpu) {
      console.warn("WebGPU not supported on this browser. Falling back to Cloud AI.");
      this.isLocalSupported = false;
      return;
    }

    if (!this.isLocalAIOptedIn()) {
      return; // Do not initialize local AI unless opted in
    }

    try {
      this.handleStatusUpdate(this.localService.getStatus());
      await this.localService.initialize();
      this.localInitialized = true;
    } catch (error) {
      console.error("Local AI Initialization failed:", error);
      this.isLocalSupported = false;
    }
  }

  async enableLocalAI(): Promise<void> {
    localStorage.setItem('mentor_use_local_ai', 'true');
    this.isLocalSupported = true; // Reset support check
    this.localInitialized = false;
    await this.initialize();
  }

  async disableLocalAI(): Promise<void> {
    localStorage.setItem('mentor_use_local_ai', 'false');
    
    // We update status to indicate we are back to cloud
    this.handleStatusUpdate({ source: 'none', isReady: false, progress: 0, progressText: '' });
    
    // Delete the WebLLM model cache from IndexedDB
    try {
      if (window.indexedDB) {
        indexedDB.deleteDatabase('webllm/model');
      }
    } catch (e) {
      console.warn("Failed to delete WebLLM cache:", e);
    }
  }

  async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: EngineStatus) => void,
    signal?: AbortSignal,
    context?: { sessionId?: string; [key: string]: any }
  ): Promise<AIResponse> {
    if (onStatus) {
      this.statusCallback = onStatus;
    }

    this.cancel(); // Cancel any existing runs in both services
    
    // Fallback logic
    // Only use local if opted in and initialized/supported
    if (this.isLocalSupported && this.isLocalAIOptedIn()) {
      // Retry logic: try local once, if fails, retry once, if fails, fallback to cloud
      let attempts = 0;
      const MAX_LOCAL_ATTEMPTS = 2; // initial + 1 retry

      while (attempts < MAX_LOCAL_ATTEMPTS) {
        attempts++;
        const startTime = performance.now();
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Local AI generation timeout (45s)")), 45000);
          });

          // Race between generation and timeout
          const response = await Promise.race([
            this.localService.generateStream(messages, onChunk, this.handleStatusUpdate, signal, context),
            timeoutPromise
          ]);
          
          const inferenceTime = performance.now() - startTime;
          console.log(`[AIService] Local AI inference completed in ${inferenceTime.toFixed(0)}ms`);
          return response;
          
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.warn(`[AIService] Local AI attempt ${attempts} failed: ${errorMsg}`);
          
          if (signal?.aborted) {
            throw new Error("Generation aborted");
          }

          if (attempts >= MAX_LOCAL_ATTEMPTS) {
            console.warn(`[AIService] Local AI failed after ${attempts} attempts. Falling back to Cloud AI. Reason: ${errorMsg}`);
            this.isLocalSupported = false; // permanent fallback for this session?
            // The requirement says "Automatically fall back to existing cloud API... retry local once before falling back."
          } else {
            // Cancel any residual state before retry
            this.localService.cancel();
          }
        }
      }
    }

    // Fallback to Cloud
    const startTime = performance.now();
    try {
      const response = await this.cloudService.generateStream(messages, onChunk, this.handleStatusUpdate, signal, context);
      const inferenceTime = performance.now() - startTime;
      console.log(`[AIService] Cloud AI inference completed in ${inferenceTime.toFixed(0)}ms`);
      return response;
    } catch (e) {
      console.error(`[AIService] Cloud AI fallback also failed:`, e);
      throw e;
    }
  }

  getStatus(): EngineStatus {
    if (this.isLocalSupported && this.localService.getStatus().source !== 'none') {
      return this.localService.getStatus();
    }
    return this.cloudService.getStatus();
  }

  cancel(): void {
    this.localService.cancel();
    this.cloudService.cancel();
  }
}

// Export a singleton instance for use across the application
export const aiService = new AIService();
