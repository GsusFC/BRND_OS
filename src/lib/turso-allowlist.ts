import { createClient, type Client, type InStatement } from '@libsql/client'

let tursoAllowlistClient: Client | null = null

function getTursoAllowlist(): Client {
    if (!tursoAllowlistClient) {
        const url = process.env.TURSO_ALLOWLIST_DATABASE_URL
        const token = process.env.TURSO_ALLOWLIST_AUTH_TOKEN

        if (!url) {
            throw new Error('TURSO_ALLOWLIST_DATABASE_URL is not defined')
        }
        if (!token) {
            throw new Error('TURSO_ALLOWLIST_AUTH_TOKEN is not defined')
        }

        tursoAllowlistClient = createClient({
            url,
            authToken: token,
        })
    }

    return tursoAllowlistClient
}

const tursoAllowlist = {
    execute: (stmt: InStatement) => getTursoAllowlist().execute(stmt),
}

export default tursoAllowlist
