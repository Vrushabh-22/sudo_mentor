import { useState, useEffect, useCallback, useRef } from "react";
import { aiService } from "@/services/ai/AIService";
import { EngineStatus, AIMessage, AIResponse } from "@/services/ai/types";

export function useAI() {
  const [status, setStatus] = useState<EngineStatus>(aiService.getStatus());
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(isGenerating);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Load the model immediately when hook mounts (e.g. on /portal open)
  useEffect(() => {
    aiService.initialize().catch(e => {
      console.warn("AI Service initialization threw an error in useAI hook:", e);
    });
    
    let lastUpdate = 0;
    const unsubscribe = aiService.subscribe((newStatus) => {
      const now = performance.now();
      // Throttle updates to at most once per 200ms, unless it's a final ready/offline state
      if (now - lastUpdate > 200 || newStatus.isReady || newStatus.source === 'none') {
        setStatus({ ...newStatus });
        lastUpdate = now;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const generate = useCallback(async (
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    context?: { sessionId?: string; [key: string]: any }
  ): Promise<AIResponse> => {
    setIsGenerating(true);
    try {
      const response = await aiService.generateStream(
        messages,
        onChunk,
        (newStatus) => {
          setStatus({ ...newStatus });
        },
        undefined,
        context
      );
      return response;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const cancel = useCallback(() => {
    aiService.cancel();
    setIsGenerating(false);
  }, []);

  return {
    status,
    generate,
    cancel,
    isGenerating,
    isLocalAIOptedIn: aiService.isLocalAIOptedIn(),
    enableLocalAI: () => aiService.enableLocalAI(),
    disableLocalAI: () => aiService.disableLocalAI(),
  };
}
