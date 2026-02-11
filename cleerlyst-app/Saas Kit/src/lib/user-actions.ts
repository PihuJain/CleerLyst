"use server"

import { auth } from "./auth"
import { upsertUser } from "./database"
import { sendEmail, createWelcomeEmail } from "./resend"

export async function saveUserToDatabase() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    const userData = {
      google_id: session.user.id,
      email: session.user.email!,
      name: session.user.name || undefined,
      image_url: session.user.image || undefined,
    }

    const savedUser = await upsertUser(userData)

    // Check if this is a new user (created_at and updated_at are the same)
    const isNewUser = savedUser.created_at.getTime() === savedUser.updated_at.getTime()

    // Send welcome email for new users
    if (isNewUser && savedUser.email && savedUser.name) {
      try {
        const welcomeEmailData = createWelcomeEmail(savedUser.name, savedUser.email)
        await sendEmail(welcomeEmailData)
        console.log(`Welcome email sent to ${savedUser.email}`)
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError)
        // Don't fail the user creation if email fails
      }
    }

    return {
      success: true,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        created_at: savedUser.created_at,
        last_login: savedUser.last_login
      }
    }
  } catch (error) {
    console.error("Error saving user to database:", error)
    return { success: false, error: "Database error" }
  }
}
