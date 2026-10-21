# Music

Put audio files in this folder and list them in `tracks.json`. The player reads that list on load.

```json
[
  { "title": "Late Ink", "artist": "Your Name", "src": "late-ink.mp3", "bpm": 78 },
  { "title": "Placeholder", "artist": "Synth", "synth": 1 }
]
```

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Shown in the player (max 120 characters) |
| `artist` | no | Shown under the title |
| `src` | no | A file in this folder (`.mp3`, `.ogg`, `.m4a`, `.wav`, `.aac`, `.flac`) or an `https://` URL. Without it, a synthesised placeholder plays |
| `bpm` | no | Tempo, 40-220. Smudge bobs his head to it. Default 80 |
| `mood` | no | Short style label shown in the song list, e.g. "Ambient focus" |
| `synth` | no | Which built-in Smudge FM song (0-5) plays if `src` is missing or fails to load |

Built-in songs: 0 Ink & Rain, 1 Midnight Panels, 2 Sponge Thoughts (lofi beats), 3 Graphite Drift
(ambient), 4 Panel by Panel (brushed jazz), 5 Night Shift Dub (slow dub).

If a file fails to load, the player logs a warning in the console and plays that track's placeholder instead.
