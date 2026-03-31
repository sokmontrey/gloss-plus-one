## why-graph memory

At the start of every session:
- Call `get_project_context` from why-graph for a project summary.

After editing or creating a file:
- Call `index_file` from why-graph with the modified file's path.

When making a significant decision (architecture, library choice, approach):
- Call `add_why_entry` from why-graph to record it.

When asked to explain why something was built a certain way:
- Call `search_context` or `get_decision_history` from why-graph first.
