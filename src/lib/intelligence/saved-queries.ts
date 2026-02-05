import turso from "@/lib/turso"

export interface SavedQuery {
    id: number
    fid: number
    name: string
    question: string
    createdAt: string
    usedAt: string
    useCount: number
}

/**
 * Initialize the saved_queries table if not exists
 */
export async function initSavedQueriesTable(): Promise<void> {
    await turso.execute(`
        CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fid INTEGER NOT NULL,
            name TEXT NOT NULL,
            question TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            use_count INTEGER NOT NULL DEFAULT 1
        )
    `)
    await turso.execute(`
        CREATE INDEX IF NOT EXISTS idx_saved_queries_fid ON saved_queries(fid)
    `)
}

/**
 * Save a query for a user
 */
export async function saveQuery(
    fid: number,
    name: string,
    question: string
): Promise<SavedQuery> {
    // Check if query with same question already exists for this user
    const existing = await turso.execute({
        sql: `SELECT id FROM saved_queries WHERE fid = ? AND question = ?`,
        args: [fid, question]
    })

    if (existing.rows.length > 0) {
        // Update existing query name and use count
        const id = existing.rows[0].id as number
        await turso.execute({
            sql: `UPDATE saved_queries
                  SET name = ?, used_at = CURRENT_TIMESTAMP, use_count = use_count + 1
                  WHERE id = ?`,
            args: [name, id]
        })
        const updated = await getQueryById(id)
        if (!updated) throw new Error("Failed to update query")
        return updated
    }

    // Insert new query
    const result = await turso.execute({
        sql: `INSERT INTO saved_queries (fid, name, question) VALUES (?, ?, ?)`,
        args: [fid, name, question]
    })

    const newId = Number(result.lastInsertRowid)
    const created = await getQueryById(newId)
    if (!created) throw new Error("Failed to create query")
    return created
}

/**
 * Get saved queries for a user
 */
export async function getSavedQueries(fid: number): Promise<SavedQuery[]> {
    const result = await turso.execute({
        sql: `SELECT id, fid, name, question, created_at, used_at, use_count
              FROM saved_queries
              WHERE fid = ?
              ORDER BY used_at DESC
              LIMIT 50`,
        args: [fid]
    })

    return result.rows.map(row => ({
        id: row.id as number,
        fid: row.fid as number,
        name: row.name as string,
        question: row.question as string,
        createdAt: row.created_at as string,
        usedAt: row.used_at as string,
        useCount: row.use_count as number
    }))
}

/**
 * Get a query by ID
 */
async function getQueryById(id: number): Promise<SavedQuery | null> {
    const result = await turso.execute({
        sql: `SELECT id, fid, name, question, created_at, used_at, use_count
              FROM saved_queries WHERE id = ?`,
        args: [id]
    })

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
        id: row.id as number,
        fid: row.fid as number,
        name: row.name as string,
        question: row.question as string,
        createdAt: row.created_at as string,
        usedAt: row.used_at as string,
        useCount: row.use_count as number
    }
}

/**
 * Delete a saved query
 */
export async function deleteQuery(id: number, fid: number): Promise<boolean> {
    const result = await turso.execute({
        sql: `DELETE FROM saved_queries WHERE id = ? AND fid = ?`,
        args: [id, fid]
    })
    return result.rowsAffected > 0
}

/**
 * Record query usage (increment use count)
 */
export async function recordQueryUsage(id: number): Promise<void> {
    await turso.execute({
        sql: `UPDATE saved_queries
              SET used_at = CURRENT_TIMESTAMP, use_count = use_count + 1
              WHERE id = ?`,
        args: [id]
    })
}
