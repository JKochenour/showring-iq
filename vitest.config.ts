import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Agent worktrees live inside the repo (.claude/worktrees/...) and
    // carry their own copies of test files — scanning them makes `npm
    // test` flaky while a background task edits its worktree. Same
    // class of noise as the documented `npm run lint` worktree gotcha.
    exclude: ["**/node_modules/**", ".claude/**"],
  },
});
