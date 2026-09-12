# Working notes for Claude

- **Check for `history.md` in this repo root first.** It's gitignored (this
  repo is public; that file holds deployment/infra specifics that shouldn't
  be published), so it only exists on machines where deployment/ops work has
  happened. If it's there, read it before doing anything else — it has
  context that isn't in the code: current production state, decisions made
  and why, and pending items. If it's not there, you're on a machine with no
  local ops history; don't assume anything about deployment state, ask.
- If you do anything non-trivial (a real bug fix, a feature, a deploy, a
  decision worth remembering), append a dated entry to `history.md`'s
  Session Log and keep its "Current State" / "Pending" sections accurate —
  don't let them drift out of date.
- See `README.md` for stack, local setup, and project layout.
