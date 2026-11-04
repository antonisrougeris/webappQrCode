# SKANARE homepage Reels — local MP4 setup

The homepage has three Instagram Reel slots. **No Instagram media is downloaded by the build.**
Only upload videos you own or are licensed to use, including their soundtrack.

## Local file layout

Put these **six files** inside `3220089_3220172/partb/client/public/assets/social-proof/`:

| Instagram Reel | MP4 | Poster |
|---|---|---|
| https://www.instagram.com/reel/Deuk7KftZ0U/ | `reel-deuk7kftz0u.mp4` | `reel-deuk7kftz0u.webp` |
| https://www.instagram.com/reel/DfQFmantGtg/ | `reel-dfqfmantgtg.mp4` | `reel-dfqfmantgtg.webp` |
| https://www.instagram.com/reel/DfSS309tnze/ | `reel-dfss309tnze.mp4` | `reel-dfss309tnze.webp` |

Use the original source videos (not Instagram links). Aim for 1080×1920, H.264
MP4 with faststart and no audio or a licensed audio track. Posters should be
9:16 WebP. Examples (requires ffmpeg):

```bash
ffmpeg -i input.mp4 -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" -c:v libx264 -crf 24 -preset medium -pix_fmt yuv420p -an -movflags +faststart reel-deuk7kftz0u.mp4
ffmpeg -ss 00:00:01 -i input.mp4 -frames:v 1 -vf "scale=450:800:force_original_aspect_ratio=increase,crop=450:800" -quality 85 reel-deuk7kftz0u.webp
```

Repeat with the other file names. Verify the exported video/poster and right
before publishing. **Do not commit videos that you cannot legally publish.**

## Publishing

After adding the six files, commit them to the GitHub repo so Vite copies
`public/assets/social-proof/*` to the static production build. A local copy
on your personal PC does **not** make the server serve them. Let the normal
`main` GitHub Actions deployment complete. Alternatively upload to the
matching production public directory as part of an authorized deployment
process, but using Git is more reproducible.

The UI checks that both the MP4 and poster are available on the same origin
before showing each card. Missing files cause that card to remain hidden,
not a fake demo or broken player.

Videos play muted/inline, lazy-load as the user scrolls and pause off-screen.
Selecting a card opens its Instagram Reel in a new tab. Browser preferences
(reduced motion, save data, autoplay restrictions) are respected.

Config: `client/src/config/socialProof.ts`.
