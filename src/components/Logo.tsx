import { useId } from "react";
import { BRAND } from "@/lib/brand";

// Símbolo do DFLAB: gota de amostra com a linha de resultado. É o mesmo desenho de public/logo-mark.svg.
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={BRAND} className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a8f9c" />
          <stop offset="1" stopColor="#005760" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <path d="M32 10c9.4 12.4 15.2 19.2 15.2 27.2a15.2 15.2 0 0 1-30.4 0C16.8 29.2 22.6 22.4 32 10z" fill="#fff" />
      <path d="M21.5 38h6.2l3-7.4 5 13.6 3.3-6.2h5.4" fill="none" stroke="#006c76" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Nome em duas cores: "DF" e "LAB". No fundo escuro (menu lateral) o "LAB" fica mais claro.
export function LogoWordmark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className ?? ""}`}>
      {BRAND.slice(0, 2)}
      <span className={onDark ? "text-[#4fd1dc]" : "text-primary"}>{BRAND.slice(2)}</span>
    </span>
  );
}
