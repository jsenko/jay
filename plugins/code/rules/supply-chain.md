# Supply chain

Patterns that may mean a malicious or compromised change. Read when
reviewing a contribution from someone new, or any change to dependencies,
the build or CI; and when making such a change. Cite a rule by its ID.

## Text and encoding

| ID | Look for |
|---|---|
| SC1 | **Invisible or lookalike characters:** direction overrides (U+202A–U+202E, U+2066–U+2069, U+200E, U+200F), zero-width characters (U+200B–U+200D, U+FEFF), homoglyphs such as Cyrillic `А` for Latin `A`. |
| SC2 | **Obfuscated strings:** Base64 URLs, hex-encoded commands, concatenation that hides a URL or a shell command, process execution with constructed arguments. |

## Code

| ID | Look for |
|---|---|
| SC3 | **Credentials** that look real: keys, passwords or tokens in source or fixtures, with high entropy or a standard format. |
| SC4 | **Network calls** unrelated to the change's purpose: exfiltration, phoning home, dependency confusion. |
| SC5 | **Unrestricted deserialization:** `ObjectInputStream`, `XMLDecoder`, YAML without a safe constructor, polymorphic JSON typing. |
| SC6 | **Weakened security:** TLS verification off, weaker algorithms, removed auth checks, CORS or RBAC widened beyond what the change claims. |
| SC7 | **Path traversal:** user input in file paths without sanitising, `..`, following symlinks. |
| SC8 | **Injection:** SQL or shell built by concatenation instead of parameters or argument arrays. |

## Build and CI

| ID | Look for |
|---|---|
| SC9 | **New or changed dependencies and build plugins,** especially from unknown groups, or snapshots from outside repositories. |
| SC10 | **CI workflow changes** that add secrets access, permissions, external actions, or uploads to destinations outside the project. |
| SC11 | **Build hooks** that run arbitrary commands, such as exec or antrun plugins. |
