import assert from "node:assert/strict"
import { test } from "node:test"
import { NextRequest } from "next/server"
import middleware from "../../src/middleware"
import {
    getRequiredPermissions,
    hasAnyPermission,
    hasPermission,
    PERMISSIONS,
    type AdminUser,
} from "../lib/auth/permissions"

const baseUser: AdminUser = {
    fid: 1,
    username: "viewer",
    avatar: null,
    role: "viewer",
    permissions: [PERMISSIONS.DASHBOARD],
    is_active: true,
}

async function withEnv<T>(values: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
    const previous = new Map<string, string | undefined>()

    for (const [key, value] of Object.entries(values)) {
        previous.set(key, process.env[key])
        if (value === undefined) {
            delete process.env[key]
        } else {
            process.env[key] = value
        }
    }

    try {
        return await run()
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key]
            } else {
                process.env[key] = value
            }
        }
    }
}

test("permission helpers deny null and inactive users independently of client UI guards", () => {
    // Invariant: server-side permission helpers must remain the enforcement source, not dashboard visibility.
    assert.equal(hasPermission(null, PERMISSIONS.DASHBOARD), false)
    assert.equal(hasAnyPermission(null, [PERMISSIONS.DASHBOARD]), false)
    assert.equal(hasPermission({ ...baseUser, is_active: false }, PERMISSIONS.DASHBOARD), false)
    assert.equal(hasAnyPermission({ ...baseUser, is_active: false }, [PERMISSIONS.DASHBOARD]), false)
})

test("admin role and explicit all permission continue to grant every permission", () => {
    // Invariant: the persisted role/permission model treats role=admin and permissions=["all"] as full access.
    assert.equal(hasPermission({ ...baseUser, role: "admin", permissions: [] }, PERMISSIONS.ACCESS_CONTROL), true)
    assert.equal(hasAnyPermission({ ...baseUser, permissions: ["all"] }, [PERMISSIONS.APPLICATIONS]), true)
})

test("route-to-permission mapping protects architecture-critical dashboard areas", () => {
    // Invariant: protected dashboard routes must not silently fall back to broad dashboard access.
    assert.deepEqual(getRequiredPermissions("/dashboard"), [PERMISSIONS.DASHBOARD])
    assert.deepEqual(getRequiredPermissions("/dashboard/applications"), [PERMISSIONS.APPLICATIONS])
    assert.deepEqual(getRequiredPermissions("/dashboard/intelligence/query"), [PERMISSIONS.INTELLIGENCE])
    assert.deepEqual(getRequiredPermissions("/dashboard/admin/access"), [PERMISSIONS.ACCESS_CONTROL])
    assert.deepEqual(getRequiredPermissions("/dashboard/unknown"), [PERMISSIONS.DASHBOARD])
})

test("middleware does not require auth secret outside dashboard routes", async () => {
    // Invariant: auth-secret failures are scoped to protected dashboard paths.
    await withEnv({ AUTH_SECRET: undefined, NEXTAUTH_SECRET: undefined }, async () => {
        const response = await middleware(new NextRequest("http://brnd.test/login"))

        assert.equal(response.status, 200)
    })
})

test("dashboard middleware fails loudly when auth secret is missing", async () => {
    // Invariant: dashboard authorization must not degrade open when AUTH_SECRET/NEXTAUTH_SECRET is absent.
    await withEnv({ AUTH_SECRET: undefined, NEXTAUTH_SECRET: undefined }, async () => {
        await assert.rejects(
            () => middleware(new NextRequest("http://brnd.test/dashboard")),
            /AUTH_SECRET \(or NEXTAUTH_SECRET\) is not set/
        )
    })
})

test("dashboard middleware redirects unauthenticated requests before page code can run", async () => {
    // Invariant: protected dashboard paths reject unauthenticated access server-side.
    await withEnv({ AUTH_SECRET: "test-secret", NEXTAUTH_SECRET: undefined }, async () => {
        const response = await middleware(new NextRequest("http://brnd.test/dashboard/brands"))

        assert.equal(response.status, 307)
        assert.equal(response.headers.get("location"), "http://brnd.test/login")
    })
})
