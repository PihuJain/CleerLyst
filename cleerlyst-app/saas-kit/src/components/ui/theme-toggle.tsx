"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9">
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const getIcon = () => {
    if (theme === "light") {
      return <Sun className="h-4 w-4" />
    } else if (theme === "dark") {
      return <Moon className="h-4 w-4" />
    } else {
      // System theme - show based on current preference
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      return isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
    }
  }

  const getTooltip = () => {
    if (theme === "light") {
      return "Switch to dark mode"
    } else if (theme === "dark") {
      return "Switch to system theme"
    } else {
      return "Switch to light mode"
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="w-9 h-9 hover:bg-muted/50 transition-colors"
      title={getTooltip()}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
