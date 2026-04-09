---
name: implement
description: Execute tasks from docs/tasks/todo/ by researching, implementing, building, testing, and moving tasks to done autonomously. Use when asked to implement a task, build code, or execute pending work.
---

# Implement

## Instructions
1. List files in `docs/tasks/todo/` sorted by creation date (oldest first)
2. Read the first task file and parse its scope, steps, and acceptance criteria
3. Read any referenced design documents (`docs/ARCHITECT.md`, `docs/PRD.md`, `docs/API.md`, `docs/DATABASE.md`) and check `docs/PROGRESS.md` for current implementation state
4. Use `grep_search` and `glob` to find relevant existing code patterns, dependencies, and conventions
5. Follow the task's **Steps** section in order, creating/modifying source code files as required
6. Adhere strictly to existing project conventions (naming, structure, typing, patterns)
7. Never introduce new libraries/frameworks without verifying they are listed as dependencies or the task explicitly requires them
8. Run the build using `run_shell_command` and fix any compile/type errors until it passes
9. Run tests and project-specific linting/type-checking commands (e.g., `tsc --noEmit`, `npm run lint`)
10. After successful build and test, update the task file status to `completed`, check off acceptance criteria, and move it from `docs/tasks/todo/` to `docs/tasks/done/`
11. **Update `docs/PROGRESS.md`** to reflect the newly implemented feature:
    - Mark the feature as ✅ Done in the appropriate phase table (Implemented Features or Planned Features)
    - Add the new source file and test file entries if applicable
    - Update the test file count and test case count in the Overall Status table
    - Update the Functional/Non-Functional Requirements tables if the task fulfills a requirement
    - If a new dependency was installed, add it to the Dependencies table
12. If build or test fails after reasonable attempts, report the issue to the user and pause

## Examples
**User Request:** "Implement the first pending task"
**Action:** Read `docs/tasks/todo/TODO-2026-04-09-001.md`, research referenced design docs, implement the changes following the task steps, run build and tests, then move the task to done if everything passes.

**User Request:** "Build the TypeORM entities"
**Action:** Research existing entity patterns in the codebase, create/modify entity files following the architecture spec, run `pnpm -r build` and `pnpm -r typecheck`, verify no errors, then update task status.
