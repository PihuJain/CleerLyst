"use server"

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/lib/auth"

export async function signInAction() {
  await nextAuthSignIn("google", { redirectTo: "/dashboard/feed" })
}

export async function signOutAction() {
  await nextAuthSignOut({ redirectTo: "/" })
}
