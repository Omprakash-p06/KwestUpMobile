# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## global-standards — Missing Global Processing Standards
- **Date:** 2026-05-17
- **Error patterns:** missing, standards, map, test, lint, GEMINI.md
- **Root cause:** Global standards for codebase mapping and pre-commit testing are not documented in the project's memory or workspace instructions.
- **Fix:** Create a workspace-specific GEMINI.md in the root directory to document these global standards and ensure they are followed by all agents.
- **Files changed:** GEMINI.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/TESTING.md
---

## sonar-server-not-reached — SonarQube Scanner Missing Host URL
- **Date:** 2026-05-26
- **Error patterns:** SonarQube, server, not reached, host, url, colon, empty
- **Root cause:** When required secrets (`SONAR_HOST_URL` or `SONAR_TOKEN`) are not configured (e.g. on fork PR builds), they pass as empty strings to the environment variables, causing the SonarQube scanner to crash.
- **Fix:** Add a conditional `if` check to the workflow step so it only runs if both secrets are non-empty.
- **Files changed:** .github/workflows/sonarqube.yml
---
