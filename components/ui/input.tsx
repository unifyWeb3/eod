import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "min-h-[44px] w-full rounded-[7px] border border-[#E8E6E1] bg-white px-3 text-sm text-[#1A1D21] placeholder:text-[#5B6068]/60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
