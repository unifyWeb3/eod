import * as React from "react";
import { cn } from "../../lib/utils";

function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr className={cn("border-0 border-t border-[#E8E6E1]", className)} {...props} />
  );
}

export { Separator };
