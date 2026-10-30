---
name: tasks
description: Show the table of tasks still to do from docs/tasks/README.md, without finished ones. Use when the user asks for the task list or types /tasks.
---

# Tasks to do

1. Run:

   ```bash
   awk '/^\| #/{t=1} t&&/^$/{exit} t&&!/\[x\] \|$/' docs/tasks/README.md
   ```

   It prints the header of the task table and every row whose status is not `[x]` (`[ ]` to do, `[~]` in progress).

2. Show the result as a markdown table with the columns #, Task, Depends on, Status, keeping task titles as they are (Polish). Drop the links to the task files. For a dependency on a finished task (no longer in the table), add "(done)".

3. If no rows are left, say there are no tasks to do. Add nothing else: no summary, no suggestions.
