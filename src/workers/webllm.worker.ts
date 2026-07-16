import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// A simple Web Worker that exposes the MLCEngine via message passing.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
