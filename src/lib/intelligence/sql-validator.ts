export function isQuerySafe(sql: string): { safe: boolean; reason?: string } {
    const upperSQL = sql.toUpperCase().trim();

    // Forbidden keywords regex (whole words only)
    const forbiddenPattern = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|CALL|DECLARE|SET)\b/i;

    // Check for CREATE separately to allow TEMPORARY
    const createPattern = /\bCREATE\b/i;
    const tempTablePattern = /\bCREATE\s+TEMPORARY\s+TABLE\b/i;

    if (createPattern.test(sql) && !tempTablePattern.test(sql)) {
        return {
            safe: false,
            reason: 'Only CREATE TEMPORARY TABLE is allowed, not permanent tables.'
        };
    }

    const forbiddenMatch = sql.match(forbiddenPattern);
    if (forbiddenMatch) {
        return {
            safe: false,
            reason: `Forbidden keyword detected: ${forbiddenMatch[0].toUpperCase()}`
        };
    }

    // Check for multiple statements (semicolon not at the end)
    const statements = sql.split(';').filter(s => s.trim());
    if (statements.length > 1) {
        return {
            safe: false,
            reason: 'Multiple statements not allowed'
        };
    }

    return { safe: true };
}

export function sanitizeSQL(sql: string): string {
    // Remove trailing semicolon if present
    return sql.trim().replace(/;$/, '');
}
