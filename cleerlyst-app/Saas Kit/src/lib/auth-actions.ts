"use server"

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/lib/auth"

export async function signInAction() {
  await nextAuthSignIn("google", { redirectTo: "/dashboard" })
}

export async function signOutAction() {
  await nextAuthSignOut({ redirectTo: "/" })
}
