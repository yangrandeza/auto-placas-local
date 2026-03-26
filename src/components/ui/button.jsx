import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_20px_50px_rgba(13,148,136,0.2)] hover:scale-[1.01] hover:bg-[color:var(--primary)]/90",
        secondary:
          "border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/8",
        ghost: "text-[color:var(--muted-foreground)] hover:bg-white/6 hover:text-white",
        outline:
          "border border-[color:var(--border)] bg-transparent text-white hover:bg-white/5 hover:text-white",
        danger:
          "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button
    className={cn(buttonVariants({ variant, size, className }))}
    ref={ref}
    {...props}
  />
));

Button.displayName = "Button";

export { Button, buttonVariants };
