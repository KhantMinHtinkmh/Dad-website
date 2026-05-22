## Audio files for book summaries

Put your `.mp3` files in this folder.

The player on `summary.html` loads audio based on the `audio:` path inside the `books` object, e.g.:

- `audio/the-coaching-habit.mp3`
- `audio/zero-to-one.mp3`

### Recommended naming

Use the same slug as the `?book=` query param:

`audio/<book-slug>.mp3`

Example:

- `summary.html?book=the-coaching-habit` → `audio/the-coaching-habit.mp3`

### If your filename is different

Edit the `audio:` field for that book inside `summary.html`.

# Book Audio Files

Add all book audio files in this `audio` folder.

Use these exact filenames so `summary.html` can load each book audio separately:

- `the-coaching-habit.mp3`
- `trillion-dollar-coach.mp3`
- `coaching-for-performance.mp3`
- `zero-to-one.mp3`
- `the-lean-startup.mp3`
- `good-to-great.mp3`
- `thinking-fast-and-slow.mp3`
- `influence.mp3`
- `flow.mp3`
- `atomic-habits.mp3`
- `mindset.mp3`
- `seven-habits.mp3`
- `digital-minimalism.mp3`
- `deep-work.mp3`
- `irresistible.mp3`
- `subtle-art.mp3`
- `you-are-a-badass.mp3`
- `awaken-the-giant-within.mp3`
- `to-sell-is-human.mp3`
- `influence-sales.mp3`
- `building-a-storybrand.mp3`

If you use different names, update the `audio` paths inside `summary.html`.
