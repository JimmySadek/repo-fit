# Board

The only place status lives. One row per task, job, question or idea. IDs never change. Do not use the pipe character inside a cell.

- **Statuses:** inbox · clarified · active · parked · blocked · done
- **Kinds:** task · job · question · idea
- **Evidence:** repo paths separated by `;`. Required for active and blocked rows.
- **Verified:** the date someone last checked the row against its evidence. A row is stale when its evidence changed after this date.
- **Trigger:** what wakes a parked row, or what a blocked row waits for.

| ID | Kind | Item | Status | Owner | Next step | Trigger | Evidence | Verified | Updated |
|---|---|---|---|---|---|---|---|---|---|
| B-001 | task | Fill in the README, people page and current view | active | {{owner}} | Write the one-sentence purpose in README.md | | docs/00-home/current.md | {{date}} | {{date}} |
