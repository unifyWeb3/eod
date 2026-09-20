import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "border-[#E8E6E1] bg-white text-[#5B6068]",
        accept: "border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]",
        reject: "border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]",
        undetermined: "border-[#B45309]/30 bg-[#FFFBEB] text-[#B45309]",
        info: "border-[#3B5BFD]/30 bg-[#3B5BFD]/5 text-[#1E40AF]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
