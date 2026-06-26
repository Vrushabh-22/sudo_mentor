import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export type DeviceType = "mobile" | "tablet" | "desktop";

const detectDevice = (): DeviceType => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < MOBILE_BREAKPOINT) return "mobile";
  if (width < TABLET_BREAKPOINT) return "tablet";
  return "desktop";
};

const detectMobile = (): boolean => detectDevice() === "mobile";

function readOverrides() {
  if (typeof window === "undefined") return { forceMobile: false, forceDesktop: false, forceTablet: false };
  const params = new URLSearchParams(window.location.search);
  return {
    forceMobile: params.get("forceMobile") === "true",
    forceDesktop: params.get("forceDesktop") === "true",
    forceTablet: params.get("forceTablet") === "true",
  };
}

export function useIsMobile() {
  const { forceMobile, forceDesktop } = React.useMemo(readOverrides, []);
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (forceDesktop) return false;
    if (forceMobile) return true;
    return detectMobile();
  });
  React.useEffect(() => {
    if (forceDesktop) { setIsMobile(false); return; }
    if (forceMobile) { setIsMobile(true); return; }
    setIsMobile(detectMobile());
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(detectMobile());
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [forceMobile, forceDesktop]);
  return isMobile;
}

export function useDeviceType(): DeviceType {
  const { forceMobile, forceDesktop, forceTablet } = React.useMemo(readOverrides, []);
  const compute = React.useCallback((): DeviceType => {
    if (forceDesktop) return "desktop";
    if (forceMobile) return "mobile";
    if (forceTablet) return "tablet";
    return detectDevice();
  }, [forceMobile, forceDesktop, forceTablet]);
  const [device, setDevice] = React.useState<DeviceType>(compute);
  React.useEffect(() => {
    setDevice(compute());
    const onChange = () => setDevice(compute());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [compute]);
  return device;
}
