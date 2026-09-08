# Release contract

The standalone package is published only from an exact stable tag whose name
is `v<package.json version>` and whose commit is the workflow commit. Tags with
pre-release syntax, leading-zero components, or a different package version are
rejected.

The release workflow grants `id-token: write` and publishes with npm trusted
publishing and `--provenance`. It does not use a classic npm token. The gate
fails if token environment variables or any `_authToken`, `_auth`, or
`_auth-token` setting is present in the project, user, or global npmrc. It also
checks npm config environment variables without including credential values in
diagnostics. After the gate, release commands use an empty temporary user and
global npmrc so ambient credentials cannot affect the publish.

Before publish, the registry lookup must return HTTP 404 for this exact package
and version. Every other response, including an existing version or an auth,
rate-limit, or server error, stops the release. The package is built, type
checked, tested, packed, and inspected from the actual tarball. The inspection
checks package identity, version, export map, dependency ranges, package file
metadata, every main/export/types target, and an exact seven-file allowlist.
An isolated temporary npm consumer installs that same tarball with the normal
npm resolver, then imports the public export and exercises the unknown-language
fallback.

The repository development graph cannot currently resolve with npm's strict
peer resolver: the published `@kindly-note/emitters-html@0.1.0` declares
`@kindly-note/core@^0.1.0`, while the published markdown stack and this package
use `@kindly-note/core@^0.2.0`. No compatible upstream emitters-html release is
published, so CI records this constraint and uses `--legacy-peer-deps` only for
the repository's development install. The consumer proof intentionally uses a
normal install of the packed package and does not use that flag.
