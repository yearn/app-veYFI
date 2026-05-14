# Repository Guidelines

## Project Structure & Module Organization
The Next.js app lives under `app/`, with domain modules grouped in folders such as `components/`, `hooks/`, `contexts/`, and `icons/`. Shared utilities and contract ABIs sit in `app/utils.ts` and `app/abi/`. Legacy route handlers remain in `pages/` for backwards-compatible paths. Static assets (SVGs, favicons, service worker output) are served from `public/`, while global styles and Tailwind layers are in `style.css` and `tailwind.config.js`. Keep new feature code close to its consumer module and prefer colocated components over sprawling shared directories.

## Build, Test, and Development Commands
Use Yarn for scripting: `yarn dev` launches the local dev server, and `yarn inspect` starts Next.js with the Node inspector enabled. Run type-checking with `yarn dev:ts`, and ship builds through `yarn build` or the production bundle via `yarn start`. For static exports (used for IPFS deployments), run `yarn export`. Lint the project with `yarn lint`, format with `yarn prettier-format`, and enforce style checks with `yarn prettier` before opening a PR.

## Coding Style & Naming Conventions
Prettier rules mandate tabs (width 4), single quotes, semicolons, bracket-same-line JSX, and 120-character line wraps. ESLint extends `@yearn-finance/web-lib`, `next`, and Tailwind plugins—expect warnings for unsorted imports, unused dependencies, and missing hook deps. Prefer PascalCase for components, camelCase for hooks/utilities, and SCREAMING_SNAKE_CASE for constants. Tailwind classes should stay semantically grouped, and all time-sensitive config defaults belong in `app/contexts/`.

## Testing Guidelines
Vitest backs the automated test suite (`yarn test`). Add React-facing tests with `@testing-library/react` and colocate them in `__tests__` directories inside the relevant feature folder (for example, `app/components/LockForm/__tests__/LockForm.spec.tsx`). Write deterministic tests that cover edge cases around veYFI lock durations, API fallbacks, and wallet connectivity flows. Include meaningful names (`should_render_error_on_invalid_amount`) and update snapshots when intentional UI changes occur.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style (`feat:`, `fix:`, `chore:`, etc.) and keep messages imperative and scoped to a single change. Rebase onto `main` before opening a PR, then provide a concise summary, screenshots of UI adjustments, and links to Notion issues or GitHub tickets. Mention any configuration or env variable changes and paste the output of `yarn lint`/`yarn test` for reviewer context. PRs should stay small enough for a quick review and include a checklist of follow-up tasks when necessary.

## Environment & Security Notes
Copy `.env.example` into `.env` and populate required RPC URLs and API keys. Never commit secrets; rely on Vercel project settings for production values. When touching wallet or contract logic, confirm ABI updates in `app/abi/` and run manual smoke tests on a forked network before merging.
