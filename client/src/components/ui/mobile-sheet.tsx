import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface MobileSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
  className?: string
}

function MobileSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  className,
}: MobileSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className={cn("max-h-[85vh]", className)}>
        {(title || description || showCloseButton) && (
          <DrawerHeader className="relative">
            {showCloseButton && (
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4"
                  data-testid="mobile-sheet-close"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            )}
            {title && <DrawerTitle>{title}</DrawerTitle>}
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
        )}
        <div className="px-4 pb-4 overflow-y-auto">{children}</div>
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  )
}

function MobileSheetActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="mobile-sheet-actions"
    >
      {children}
    </div>
  )
}

function MobileSheetAction({
  children,
  onClick,
  variant = "default",
  destructive = false,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "default" | "outline" | "ghost"
  destructive?: boolean
  className?: string
}) {
  return (
    <Button
      variant={destructive ? "destructive" : variant}
      className={cn("w-full justify-start", className)}
      onClick={onClick}
      data-testid="mobile-sheet-action"
    >
      {children}
    </Button>
  )
}

export {
  MobileSheet,
  MobileSheetActions,
  MobileSheetAction,
  Drawer as MobileSheetPrimitive,
  DrawerTrigger as MobileSheetTrigger,
  DrawerClose as MobileSheetClose,
  DrawerContent as MobileSheetContent,
  DrawerHeader as MobileSheetHeader,
  DrawerFooter as MobileSheetFooter,
  DrawerTitle as MobileSheetTitle,
  DrawerDescription as MobileSheetDescription,
}
export type { MobileSheetProps }
