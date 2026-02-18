# Release Checklist

Current release line: `v0.2.0`

## Preconditions

- `maxbot-go`: `go test ./...`
- `maxbot-js`: `npm run typecheck` and `npm run build`

## Tags

```bash
git tag -a maxbot-go/v0.2.0 -m "maxbot-go v0.2.0"
git tag -a maxbot-js/v0.2.0 -m "maxbot-js v0.2.0"
```

## Push

```bash
git push origin maxbot-go/v0.2.0
git push origin maxbot-js/v0.2.0
```
