import { WebWorkerMLCEngineHandler, MLCEngine } from "@mlc-ai/web-llm";

const engine = new MLCEngine();
const handler = new WebWorkerMLCEngineHandler(engine);

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
