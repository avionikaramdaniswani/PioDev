import logoSrc from "@/assets/pioo-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  const maskStyle = {
    width: size,
    height: size,
    maskImage: `url(${logoSrc})`,
    WebkitMaskImage: `url(${logoSrc})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as React.CSSProperties;

  return (
    <div
      role="img"
      aria-label="PioCode"
      className={cn("shrink-0 bg-primary", className)}
      style={maskStyle}
    />
  );
}
