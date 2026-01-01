---
description: Execute a plan systematically, ensuring quality and documentation at each step.
---

# Compound Engineering: Work

This workflow guides you through executing a plan created with `compound-plan`.
Goal: "Slow is smooth, smooth is fast." - systematic execution.

## 1. Preparation
- [ ] **Read Plan**: Read the `plans/*.md` file provided by the user.
- [ ] **Context**: Read the files mentioned in the plan to load context.

## 2. Execution Loop (Repeat for each step)
- [ ] **Step**: Pick the next unchecked step from the plan.
- [ ] **Implement**: Write the code.
    - *Rule: Write immediately runnable code. Add imports.*
    - *Rule: Follow strict typing (TypeScript).*
    - *Rule: Use TailwindCSS for styling.*
- [ ] **Verify**:
    - Run the relevant build/test command (e.g., `npm run build` or `npm run lint`).
    - Verify functionality (e.g., check if the API returns 200).
- [ ] **Document**: Update the plan file to mark the step as done. Add notes if something changed.

## 3. Completion
- [ ] **Final Verification**: Run full suite verification.
- [ ] **Cleanup**: Remove temporary logs/comments.
- [ ] **Compound**:
    - Did we create a new pattern? Document it.
    - Update `DATABASE_SCHEMA.md` or other docs if models changed.
