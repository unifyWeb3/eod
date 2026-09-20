import * as React from "react";
import { cn } from "../../lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[10px] border border-[#E8E6E1] bg-white p-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold", className)} {...props} />
  );
}

function CardText({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-relaxed text-[#5B6068]", className)} {...props} />
  );
}

export { Card, CardTitle, CardText };
