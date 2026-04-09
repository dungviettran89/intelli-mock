---
name: plan
description: Analyze code state against design docs, propose focused 20-30 minute tasks, and create task documents in docs/tasks/todo/. Use when asked to plan work, create tasks, or identify next steps.
---

# Plan

## Instructions
1. Read `docs/ARCHITECT.md` and `docs/PRD.md` to understand the design
2. Scan the actual codebase using `grep_search` and `glob` to identify what's implemented vs what's planned
3. Compare against the Implementation Plan in ARCHITECT.md to see which phases are complete/incomplete
4. Scan both `docs/tasks/todo/` and `docs/tasks/done/` folders to determine the correct sequential number for the new task file
   - List all existing TODO files in `docs/tasks/todo/` to find the highest sequential number
   - List all completed task files in `docs/tasks/done/` to account for all previously created tasks
   - Use the next sequential number based on the total count from both folders
5. Propose ONE feature that: can be completed in 20-30 minutes, aligns with the phased plan, addresses a gap, follows dependency order, and has clear testable acceptance criteria
6. Create a task file in `docs/tasks/todo/TODO-{YYYY-MM-DD}-{sequential}.md` with the format specified below
7. Summarize the task for the user and optionally spawn an agent to implement it

### Task Document Format
```markdown
# Task: {Feature Name}

**Status:** pending
**Created:** {date}
**Priority:** {high|medium|low}
**Estimated Time:** 20-30 mins

## Context
Brief description of why this task matters and how it fits into the overall plan.

## Scope
### In Scope
- [ ] Specific deliverable 1
- [ ] Specific deliverable 2

### Out of Scope
- What's explicitly NOT included

## Steps
1. Step 1 - what to do first
2. Step 2 - what to do next
3. Step 3 - what to validate

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## References
- Related design: docs/ARCHITECT.md (section)
- Related PRD: docs/PRD.md (section)
```

## Examples
**User Request:** "What should we work on next?"
**Action:** Analyze ARCHITECT.md implementation plan phases, scan codebase for gaps, propose the highest-priority incomplete phase as a focused 20-30 minute task, create the task document, and summarize it.

**User Request:** "Plan the next task"
**Action:** Read design docs, scan current code state, identify the next incomplete phase or feature, write a TODO file with clear steps and acceptance criteria, then present the summary.