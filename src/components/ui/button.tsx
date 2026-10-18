import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]";
const variants: Record<Variant, string> = {
  primary: "bg-title text-bg hover:bg-text-strong",
  secondary: "border border-border text-title hover:border-text hover:bg-surface",
  ghost: "text-text-strong hover:bg-surface",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-5 text-base",
};

type Props = {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}
