import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props} />
  );
}

export { Skeleton }
