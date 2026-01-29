explicame esimport { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getRequiredPermissions } from "../src/lib/auth/permissions";

const DASHBOARD_ROOT = path.join(process.cwd(), "src", "app", "dashboard");
const PAGE_FILES = new Set(["page.tsx", "page.ts"]);
const IGNORE_FILES = new Set(["layout.tsx", "loading.tsx", "not-found.tsx"]);
const ALLOWED_DEFAULT_DASHBOARD = new Set(["/dashboard", "/dashboard/design-system"]);

type RouteInfo = {
  route: string;
  file: string;
  permissions: string[];
  isDefaultDashboard: boolean;
};

const toRoutePath = (segments: string[]) => {
  const parts = segments.map((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return `:${segment.slice(1, -1)}`;
    }
    return segment;
  });
  return `/dashboard${parts.length ? `/${parts.join("/")}` : ""}`;
};

const collectRoutes = (dir: string, segments: string[] = []): RouteInfo[] => {
  const entries = readdirSync(dir);
  const routes: RouteInfo[] = [];

  for (const entry of entries) {
    if (IGNORE_FILES.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      routes.push(...collectRoutes(fullPath, [...segments, entry]));
      continue;
    }

    if (!PAGE_FILES.has(entry)) continue;

    const route = toRoutePath(segments);
    const permissions = getRequiredPermissions(route);
    const isDefaultDashboard =
      permissions.length === 1 &&
      permissions[0] === "dashboard" &&
      !ALLOWED_DEFAULT_DASHBOARD.has(route);

    routes.push({
      route,
      file: path.relative(process.cwd(), fullPath),
      permissions,
      isDefaultDashboard,
    });
  }

  return routes;
};

const routes = collectRoutes(DASHBOARD_ROOT).sort((a, b) =>
  a.route.localeCompare(b.route)
);

const issues = routes.filter((route) => route.isDefaultDashboard);

console.log("Dashboard routes and permissions:");
for (const entry of routes) {
  const flag = entry.isDefaultDashboard ? "⚠️" : " ";
  console.log(
    `${flag} ${entry.route} -> [${entry.permissions.join(", ")}] (${entry.file})`
  );
}

if (issues.length > 0) {
  console.log("\nRoutes using default dashboard permission (not explicitly mapped):");
  for (const entry of issues) {
    console.log(`- ${entry.route} (${entry.file})`);
  }
  process.exit(1);
}
