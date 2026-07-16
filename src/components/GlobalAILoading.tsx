import { useAI } from "@/hooks/useAI";
import { ModelLoading } from "./ModelLoading";

export function GlobalAILoading() {
  const { status } = useAI();
  return <ModelLoading status={status} />;
}
