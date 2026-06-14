---
name: Vimeo cinema embeds (solar-punk-party Midnight Cinema)
description: Why some Midnight Cinema Vimeo videos 401/403 and how to fix them
---

The Midnight Cinema films on `public/solar-punk-party.html` come from an "unlisted"
Vimeo account (account_type: starter). For these unlisted videos the embed ONLY works
when the player URL carries the privacy key: `player.vimeo.com/video/{id}?h={hash}&...`.

**Why:** Confirmed by control tests — a working film returns 200 WITH its `?h=` hash and
403 WITHOUT it; a known fully-public Vimeo video returns 200 from a bare URL. So the hash
is mandatory for these videos, not optional.

**IMPORTANT — curl gives false negatives.** A `curl` test of `player.vimeo.com` can NOT
reproduce a real browser's trusted handshake. For videos protected by DOMAIN WHITELISTING
(owner allows only e.g. thecurrentsee.org to embed), Vimeo returns 401 to curl but 200 to a
real browser on the approved domain. So a curl 401 does NOT prove the embed is broken —
the live production site in a real browser is the source of truth. Owner confirmed the
cinema films play in production even though curl reported 401 for them. Verify on the live
domain (real browser), not via curl, before concluding an embed is broken.

**How to apply:**
- A cinema iframe returning 401/403 via curl may simply be domain-whitelisted (works in the
  real browser on the live domain) OR missing its `?h=` key. Confirm in a real browser on the
  production domain before telling the user it's broken. It is NOT a code/iframe-format bug.
- The embed-format is already correct (`player.vimeo.com/video/{id}?...&app_id=58479`).
- Toggling Vimeo's "Where can this be embedded?" to Anywhere does NOT substitute for the
  hash on an unlisted video. The two real fixes: (a) owner sets the video fully Public, then
  a bare URL works with no key; or (b) owner sends the Share → Embed code which contains the
  `?h=...` key, and we paste that key into the iframe src.
- oEmbed (`vimeo.com/api/oembed.json?url=...`) called with only the bare ID returns a
  hash-less URL that itself 401s — it cannot recover the key for an unlisted video.
- QA sweep: extract iframe srcs and curl each with a browser UA + referer; 200 = plays inline.
