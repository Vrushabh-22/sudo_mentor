import { useEffect } from "react";

export function useCandidatePWAManifest() {
  useEffect(() => {
    const created: Element[] = [];
    const ensure = (selector: string, build: () => HTMLElement) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = build();
        document.head.appendChild(el);
        created.push(el);
      }
      return el;
    };

    ensure('meta[name="theme-color"][data-candidate]', () => {
      const m = document.createElement("meta");
      m.name = "theme-color";
      m.content = "#7246e5";
      m.dataset.candidate = "1";
      return m;
    });
    ensure('meta[name="apple-mobile-web-app-capable"]', () => {
      const m = document.createElement("meta");
      m.name = "apple-mobile-web-app-capable";
      m.content = "yes";
      m.dataset.candidate = "1";
      return m;
    });
    ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () => {
      const m = document.createElement("meta");
      m.name = "apple-mobile-web-app-status-bar-style";
      m.content = "default";
      m.dataset.candidate = "1";
      return m;
    });
    ensure('meta[name="apple-mobile-web-app-title"]', () => {
      const m = document.createElement("meta");
      m.name = "apple-mobile-web-app-title";
      m.content = "Recrewt";
      m.dataset.candidate = "1";
      return m;
    });

    return () => {
      created.forEach((el) => el.parentElement?.removeChild(el));
    };
  }, []);
}
