import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva("rounded-[10px] border p-4 text-sm", {
  variants: {
    tone: {
      neutral: "border-[#E8E6E1] bg-white text-[#1A1D21]",
      accept: "border-[#15803D]/30 bg-[#F0FDF4] text-[#14532D]",
      reject: "border-[#DC2626]/30 bg-[#FEF2F2] text-[#7F1D1D]",
      undetermined: "border-[#B45309]/30 bg-[#FFFBEB] text-[#78350F]",
      info: "border-[#3B5BFD]/30 bg-[#3B5BFD]/5 text-[#1E40AF]",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, tone, role = "status", ...props }: AlertProps) {
  return (
    <div role={role} className={cn(alertVariants({ tone }), className)} {...props} />
  );
}

export { Alert, alertVariants };
