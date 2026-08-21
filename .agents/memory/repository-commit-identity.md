---
name: Repository commit identity
description: How to complete normal Git commits when this checkout lacks an author identity.
---

Use a repository-local Replit Agent Git identity when the checkout has no configured author, rather than changing global Git settings or asking for personal credentials. If a cherry-pick already staged its clean change before failing on identity, configure the local identity and continue that operation instead of retrying or discarding it.

**Why:** The hosted checkout can omit Git author configuration. Keeping the identity local makes the commit explicit and avoids modifying unrelated repositories or losing a valid staged change.

**How to apply:** Check Git status after an identity-related commit failure. If a cherry-pick is in progress and its staged diff is expected, set the local identity and use the operation's continue command; otherwise configure it before beginning the commit.