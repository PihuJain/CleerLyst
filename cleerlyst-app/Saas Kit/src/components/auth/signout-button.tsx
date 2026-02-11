"use client"

import { signOutAction } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

interface SignOutButtonProps {
  children?: React.ReactNode
  className?: string
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="outline"
        className={className}
      >
        {children || "Sign Out"}
      </Button>
    </form>
  )
}
