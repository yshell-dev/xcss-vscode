# XCSS Extension for VS Code

Essential XCSS developer tooling for VSCode, featuring integrated LSP, bundled binary, and focused support for XCSS workflows.

![Extension Demo](./preview.png)

## Shortcuts

### Template Import: `[ alt + x ]` 

- Import available templates for the `symclass` at the active cursor position, appending them to the current HTML tag.

### Template Import: `[ alt + shift + x ]` 

- Format only XCSS-specific blocks. Use repeatedly to toggle folding for the nearest foldable range.

### Component Sandbox: `[ ctrl + alt + x ]`

- Open the component sandbox webview for the symclass at the cursor, next to the editor.

### Source/Target Switch: `[ ctrl + alt + shift + x ]`

- Toggle between files in the source and target directories with a one-to-one mapping.

## Features

### Statusbar Widget

- Displays file status and error count.
- Quick access to integrated core binary commands from the status bar.

### Developer Assistance

- Real-time diagnostics.
- Intellisense and autocomplete.
- Tooltips with information.
- Folding range support.
- Attribute detection, decoration, and highlighting.
- Go to definition for `symclasses`.
- Color picker for formats: `rgb`, `rgba`, `hsl`, `hsla`, `lch`, `oklch`, `lab`, `oklab`, `hex`

## Language Support

- Files with a `.xcss` extension are treated as Markdown and support all core extension features.

