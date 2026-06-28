import { useState } from "react";
import { Cloud, Zap } from "lucide-react";
import { LlmProviderSettings } from "./LlmProviderSettings";
import { AzureStorageSettings } from "./AzureStorageSettings";

type Section = "llm" | "azure";

const MENU: { id: Section; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "llm", label: "LLM Providers", icon: Zap, desc: "Active provider & key pool" },
  { id: "azure", label: "Azure Storage", icon: Cloud, desc: "Account & container mappings" },
];

export function AdminSettings() {
  const [section, setSection] = useState<Section>("llm");

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <nav className="md:sticky md:top-6 self-start">
        <ul className="space-y-1">
          {MENU.map((m) => {
            const Icon = m.icon;
            const active = section === m.id;
            return (
              <li key={m.id}>
                <button
                  onClick={() => setSection(m.id)}
                  className={`w-full text-left flex items-start gap-3 rounded-lg px-3 py-2.5 transition border-l-2 ${
                    active
                      ? "bg-muted border-primary"
                      : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex-1">
                    <span className={`block text-sm font-medium ${active ? "" : "text-foreground/90"}`}>{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.desc}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        {section === "llm" && <LlmProviderSettings />}
        {section === "azure" && <AzureStorageSettings />}
      </div>
    </div>
  );
}
