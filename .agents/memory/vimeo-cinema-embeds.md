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

**How to apply:**
- A cinema iframe returning 401/403 is almost always a video missing its `?h=` key (or a
  stale/wrong key). It is NOT a code/iframe-format bug and NOT fixable from our side.
- The embed-format is already correct (`player.vimeo.com/video/{id}?...&app_id=58479`).
- Toggling Vimeo's "Where can this be embedded?" to Anywhere does NOT substitute for the
  hash on an unlisted video. The two real fixes: (a) owner sets the video fully Public, then
  a bare URL works with no key; or (b) owner sends the Share → Embed code which contains the
  `?h=...` key, and we paste that key into the iframe src.
- oEmbed (`vimeo.com/api/oembed.json?url=...`) called with only the bare ID returns a
  hash-less URL that itself 401s — it cannot recover the key for an unlisted video.
- QA sweep: extract iframe srcs and curl each with a browser UA + referer; 200 = plays inline.
