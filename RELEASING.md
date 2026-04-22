# Releasing @socios-ai/auth

This package is distributed as a Git URL dependency, not via npm registry.
Consumers install via `github:Socios-AI/socios-ai-auth#vX.Y.Z` and a `prepare`
script in `package.json` builds the package locally on install.

## Versioning

Pre-1.0. Minor bumps may include breaking changes. Pin to a specific tag
in consumer `package.json` for stability:

```json
"dependencies": {
  "@socios-ai/auth": "github:Socios-AI/socios-ai-auth#v0.1.0"
}
```

## Release steps

1. Make sure `main` is green (CI passing, all tests).
2. Bump `version` in `package.json` (manual edit).
3. Update `CHANGELOG.md` with the changes since the last tag (manual entry).
4. Commit: `git commit -am "chore: release vX.Y.Z"`.
5. Tag: `git tag vX.Y.Z`.
6. Push: `git push origin main --tags`.
7. Notify consumers (identity-web, identity backend) to bump their dep ref.

## Verifying a release

After pushing the tag:

```bash
gh release view vX.Y.Z   # confirm tag exists
```

In a consumer repo, test the install:

```bash
npm install github:Socios-AI/socios-ai-auth#vX.Y.Z
node -e "console.log(require('@socios-ai/auth'))"
```

The `prepare` script (`tsup`) runs automatically on install and produces `dist/`.

## What if I need to fix a tagged release?

Move the tag to a new commit (force push). Consumers re-run `npm install`
to pick up the fix. Avoid moving tags unless absolutely necessary; prefer
bumping a patch version.
