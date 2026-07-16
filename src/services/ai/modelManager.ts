import { CreateWebWorkerMLCEngine, InitProgressCallback, WebWorkerMLCEngine } from "@mlc-ai/web-llm";

export const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

let enginePromise: Promise<WebWorkerMLCEngine> | null = null;
let engineInstance: WebWorkerMLCEngine | null = null;

/**
 * Gets or initializes the WebLLM engine singleton.
 */
export async function getModelEngine(
  onProgress?: InitProgressCallback
): Promise<WebWorkerMLCEngine> {
  if (engineInstance) {
    // Already initialized
    if (onProgress) {
      onProgress({ progress: 1, text: "Model is ready", timeElapsed: 0 });
    }
    return engineInstance;
  }

  if (!enginePromise) {
    // Start initialization
    enginePromise = (async () => {
      // Use standard Vite worker syntax
      const worker = new Worker(new URL("../../workers/webllm.worker.ts", import.meta.url), {
        type: "module",
      });

      const engine = await CreateWebWorkerMLCEngine(worker, MODEL_ID, {
        initProgressCallback: onProgress,
      });

      engineInstance = engine;
      return engine;
    })();
  } else if (onProgress) {
    // If it's already initializing but we called it again, we might not get 
    // the old callbacks immediately unless we hook into the engine creation,
    // but the engine will eventually resolve.
  }

  return enginePromise;
}
