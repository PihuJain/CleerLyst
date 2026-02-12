import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail, createWelcomeEmail } from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Check authentication — use user.id, not email (email is not in session)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userName, userEmail } = body;

    // Validate required fields
    if (!userName || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields: userName, userEmail" },
        { status: 400 },
      );
    }

    // Create and send welcome email
    const emailData = createWelcomeEmail(userName, userEmail);
    const result = await sendEmail(emailData);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Welcome email sent successfully",
        data: result.data,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send email", details: result.error },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Welcome email API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
