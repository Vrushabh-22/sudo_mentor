const SUDOMENTOR_HOSTNAMES = ["sudomentor.com", "www.sudomentor.com"];

export const isSudomentor =
  typeof window !== "undefined" && SUDOMENTOR_HOSTNAMES.includes(window.location.hostname);
