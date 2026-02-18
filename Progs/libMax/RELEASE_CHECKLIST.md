# Release Checklist (`v0.2.0`)

## Preconditions

- `maxbot-go`: `go test ./...` passes.
- `maxbot-js`: `npm run typecheck` and `npm run build` pass.
- Changelogs reviewed:
  - `Progs/maxbot-go/CHANGELOG.md`
  - `Progs/maxbot-js/CHANGELOG.md`

## Suggested tags

Use independent tags for each package:

```bash
git tag -a maxbot-go/v0.2.0 -m "maxbot-go v0.2.0"
git tag -a maxbot-js/v0.2.0 -m "maxbot-js v0.2.0"
```

Push tags:

```bash
git push origin maxbot-go/v0.2.0
git push origin maxbot-js/v0.2.0
```

## Suggested release notes summary

- `maxbot-go v0.2.0`: webhook runtime, context helpers, media endpoints, logger interface, reliability defaults, stability docs.
- `maxbot-js v0.2.0`: TS-first MVP+v0.2 features, ESM/CJS build, adapters for Express/Fastify, retry/rate-limit policy, testkit, cookbook.
