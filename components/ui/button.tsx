import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[7px] px-5 text-sm font-medium transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-[#3B5BFD] text-white hover:bg-[#2f4de0]",
        secondary:
          "border border-[#E8E6E1] bg-white text-[#1A1D21] hover:bg-[#F4F3F0]",
        ghost: "text-[#1A1D21] hover:bg-[#F4F3F0]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
