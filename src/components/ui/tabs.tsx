"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Simple state-based Tabs — matches the shadcn/ui Tabs API surface.
// No external primitive needed; Radix @radix-ui/react-tabs is not installed.

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
})

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
}

function Tabs({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  function handleValueChange(next: string) {
    if (!isControlled) setUncontrolledValue(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div data-slot="tabs" className={cn("flex flex-col gap-2", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps extends React.ComponentProps<"button"> {
  value: string
}

function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx.value === value

  return (
    <button
      data-slot="tabs-trigger"
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors",
        "hover:text-stone-900",
        "data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends React.ComponentProps<"div"> {
  value: string
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null

  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      className={cn("mt-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
