import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-cta font-semibold text-white shadow-[0_1px_2px_#0062c433,0_6px_16px_#0062c426] hover:bg-cta/90",
  secondary:
    "border border-ink/12 bg-paper font-medium text-ink shadow-[0_1px_2px_#1b24310d] hover:bg-desk",
  ghost: "font-medium text-ink-2 hover:bg-desk",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "h-9 px-3.5 text-[13.5px]",
  lg: "h-11 px-4 text-[15.5px]",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[8px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...props}
    />
  );
}
