import logoSrc from "@/assets/pioo-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 inline-flex items-center justify-center overflow-hidden rounded-[22%]",
        // Light mode: tambahin plat gelap biar logo putih tetep keliatan
        // Dark mode: transparan, polos di atas bg gelap
        "bg-[hsl(238,55%,18%)] dark:bg-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={logoSrc}
        alt="PioCode"
        className="object-contain w-full h-full"
        draggable={false}
      />
    </div>
  );
}
