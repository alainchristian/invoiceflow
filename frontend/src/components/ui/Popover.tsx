import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, ...props }: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        className={cn(
          "z-50 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg",
          className
        )}
        sideOffset={4}
        align="end"
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
