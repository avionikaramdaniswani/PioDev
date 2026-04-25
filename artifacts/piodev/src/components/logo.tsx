import logoSrc from "@/assets/pioo-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <img
      src={logoSrc}
      alt="PioCode"
      width={size}
      height={size}
      className={cn("object-contain shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
