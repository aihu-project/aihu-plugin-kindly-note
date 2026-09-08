# Release contract

The standalone package is published only from an exact stable tag whose name
is `v<package.json version>` and whose commit is the workflow commit. Tags with
pre-release syntax, leading-zero components, or a different package version are
rejected.

The release workflow grants `id-token: write` and publishes with npm trusted
publishing and `--provenance`. It does not use a classic npm token. The gate
fails if token environment variables or a literal npm auth token are present;
the setup-node `${NODE_AUTH_TOKEN}` placeholder is allowed because npm resolves
it through the OIDC trusted-publisher exchange.

Before publish, the registry lookup must return HTTP 404 for this exact package
and version. Every other response, including an existing version or an auth,
rate-limit, or server error, stops the release. The package is built, type
checked, tested, packed, and inspected from the actual tarball. The inspection
checks package identity, version, export map, dependency ranges, required files,
and absence of source, tests, release scripts, and workspace ranges. An isolated
temporary npm consumer then imports the tarball and exercises the public export
and unknown-language fallback.

The development graph has an intentional peer range overlap between the
published kindly-note engine packages. CI installs it with npm's
`--legacy-peer-deps` resolver while the package's published peer contract stays
unchanged; this keeps the tests on the engine versions used by the monorepo.
