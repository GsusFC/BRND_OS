---
description: Create a detailed implementation plan for a new feature or improvement using Compound Engineering principles.
---

# Compound Engineering: Plan

This workflow helps you turn a feature idea into a structured implementation plan.
Goal: "Measure twice, cut once." - Research and Plan before coding.

## 1. Input Analysis
- [ ] **User Request**: What is the feature or improvement?
- [ ] **Context**: What is the business value? What are the constraints?

## 2. Research & Pattern Discovery
- [ ] **Search**: Use `grep_search` or `code_search` to find similar features in the codebase.
    - *Principle: Prefer duplication over complexity. Use existing patterns.*
- [ ] **Read**: Read the found files to understand how it's done currently.
- [ ] **Documentation**: Check `package.json` for available tools/libraries. Check `docs/` or `*.md` files.

## 3. Plan Generation
- [ ] **Create Plan File**: Create a new markdown file in `plans/` (e.g., `plans/feature-name.md`).
- [ ] **Structure**:
    - **Summary**: Brief description.
    - **Context**: Links to relevant files/docs.
    - **Goals**: What success looks like.
    - **Implementation Steps**:
        - Step 1: [Action] (Verify: [How to verify])
        - Step 2: ...
    - **Verification**: How to test the whole feature.
    - **Documentation**: What docs need updating?

## 4. Review Plan
- [ ] **Sanity Check**: Does this use existing patterns? Is it simple?
- [ ] **Approval**: Ask the user to review the plan.
