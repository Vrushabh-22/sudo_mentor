import { Link } from "react-router-dom";
import logoAsset from "@/assets/sudomentor-logo.png.asset.json";

interface LogoProps {
  className?: string;
  to?: string | null;
  /** Wrap in a light pill so the dark wordmark stays legible on dark backgrounds */
  onDark?: boolean;
}

/**
 * Sudomentor wordmark. Default height ~3.1rem; pass `className` to override.
 */
export function Logo({ className = "h-[3.1rem]", to = "/", onDark = false }: LogoProps) {
  const img = (
    <img
      src={(logoAsset as { url: string }).url}
      alt="Sudomentor"
      className={`${className} w-auto object-contain shrink-0`}
      draggable={false}
    />
  );

  const wrapped = onDark ? (
    <span className="inline-flex items-center rounded-xl bg-white/95 px-3 py-1.5 shadow-sm">
      {img}
    </span>
  ) : (
    img
  );

  if (!to) return wrapped;
  return (
    <Link to={to} className="inline-flex items-center" aria-label="Sudomentor home">
      {wrapped}
    </Link>
  );
}

export default Logo;
