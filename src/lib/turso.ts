import { createClient } from '@libsql/client'

const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

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
