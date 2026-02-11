"use client"

import { signInAction } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

interface SignInButtonProps {
  children?: React.ReactNode
  className?: string
}

export function SignInButton({ children, className }: SignInButtonProps) {
  return (
    <form action={signInAction}>
      <Button type="submit" className={className}>
        {children || "Sign In with Google"}
      </Button>
    </form>
  )
}
