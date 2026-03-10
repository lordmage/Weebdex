# WeebDex++

Enhanced QOL for WeebDex - Advanced tracking, filtering, blocking, dark mode, keyboard shortcuts, and more.

## Installation

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.org/).
2. Create a new script and copy the contents of `WeebDex++.js` into it.
3. Save the script.

## Features

- **Manga Tracking**: Mark manga as read, ignored, or unmarked with persistent storage.
- **Filtering**: Hide read, ignored, or unmarked manga entries.
- **Blocking**: Block users, groups, and tags.
- **Dark Mode**: Toggle dark mode for better reading experience.
- **Keyboard Shortcuts**: Use R/I/U to toggle filters, D for dark mode, S for settings.
- **Auto-Mark Read**: Automatically mark manga as read when viewing chapters.
- **Settings Panel**: Comprehensive settings with statistics, export/import configurations.
- **Statistics**: View counts of read, ignored, and unmarked manga.

## Development

This project uses ESLint for code linting.

### Setup

```bash
npm install
```

### Linting

```bash
npm run lint
```

To automatically fix linting issues:

```bash
npm run lint:fix
```

## License

MIT