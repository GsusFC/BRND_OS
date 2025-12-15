import { createClient, type Client, type InStatement } from '@libsql/client'

let tursoClient: Client | null = null

function getTurso(): Client {
    if (!tursoClient) {
        const url = process.env.TURSO_DATABASE_URL
        const token = process.env.TURSO_AUTH_TOKEN

        if (!url) {
            throw new Error('TURSO_DATABASE_URL is not defined')
        }
        if (!token) {
            throw new Error('TURSO_AUTH_TOKEN is not defined')
        }
        
        tursoClient = createClient({
            url,
            authToken: token,
        })
    }
    return tursoClient
}

const turso = {
    execute: (stmt: InStatement) => getTurso().execute(stmt),
}

export default turso

// Initialize the database schema
export async function initTursoSchema() {
    await turso.execute(`
        CREATE TABLE IF NOT EXISTS allowed_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL UNIQUE,
            label TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `)
}
