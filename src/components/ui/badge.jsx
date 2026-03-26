import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/6 text-white",
        accent: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
        success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
        warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
