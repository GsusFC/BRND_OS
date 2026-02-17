import { execSync } from "node:child_process"

const isNetlify = process.env.NETLIFY === "true"

const commands = isNetlify
  ? ["npm run prisma:generate", "npm run prisma:generate:indexer"]
  : [
      "npm run prisma:generate",
      "npm run prisma:generate:write",
      "npm run prisma:generate:indexer",
      "npm run prisma:generate:admin",
    ]

for (const command of commands) {
  execSync(command, { stdio: "inherit" })
}
