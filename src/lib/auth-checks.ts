import { auth } from "@/auth"
import { redirect } from "next/navigation"

export type AuthSession = {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
    fid?: number
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const session = await auth()
  return session as AuthSession | null
}

export async function requireAuth() {
  const session = await getSession()
  if (!session?.user) {
    redirect("/login")
  }
  return session
}

export async function requireAdmin() {
  const session = await getSession()
  
  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    // Determine where to redirect unauthorized users. 
    // For now, redirect to dashboard root or a 403 page if it existed.
    // Throwing an error is also an option for Server Actions to be caught by the UI.
    throw new Error("Unauthorized: Admin access required")
  }

  return session
}
