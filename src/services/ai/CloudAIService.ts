import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { AIMessage, AIResponse, AIServiceInterface, EngineStatus, EngineSource } from "./types";

export class CloudAIService implements AIServiceInterface {
  private currentAborter: AbortController | null = null;
  private status: EngineStatus = {
    source: 'cloud',
    isReady: true,
    progress: 1,
    progressText: 'Ready',
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
    // Cloud is always ready
    return Promise.resolve();
  }

  async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: EngineStatus) => void,
    signal?: AbortSignal,
    context?: { sessionId?: string; [key: string]: any }
  ): Promise<AIResponse> {
    this.cancel(); // Cancel any existing run
    this.currentAborter = new AbortController();
    const abortSignal = signal || this.currentAborter.signal;

    if (onStatus) {
      onStatus(this.status);
    }

    let acc = '';
    let returnedSessionId = context?.sessionId;

    const { data: { session } } = await supabase.auth.getSession();
    
    // We match the payload that the existing edge function expects
    const reqBody = {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      sessionId: context?.sessionId
    };

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${session?.access_token || ''}` 
      },
      body: JSON.stringify(reqBody),
      signal: abortSignal
    });

    if (!resp.ok || !resp.body) {
      throw new Error(`Cloud API failed with status ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (line.startsWith('event: session')) continue;
          if (!line.startsWith('data: ')) continue;
          const j = line.slice(6).trim();
          if (!j || j === '[DONE]') continue;
          try {
            const p = JSON.parse(j);
            if (p.sessionId) {
              returnedSessionId = p.sessionId;
              continue;
            }
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              onChunk(c);
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      message: acc,
      source: 'cloud',
      sessionId: returnedSessionId
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
  }
}
