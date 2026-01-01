import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            fid?: number
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        fid?: number
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: string
        fid?: number
    }
}
