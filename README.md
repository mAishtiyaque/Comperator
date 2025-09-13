# Text Comparator - VS Code Extension

## Overview

Text Comparator is a VS Code extension that allows users to compare and highlight differences between two text files directly within the VS Code environment. This extension helps users easily identify changes, additions, and deletions between text files with intuitive visual highlighting.

## Features

### Text Comparison Functionality

- **Side-by-side comparison**: Display two text files in parallel for easy comparison
- **Inline comparison**: Option to view differences inline within a single file view
- **Highlighting differences**: Color-coded highlighting of:
  - Added lines/text (green)
  - Removed lines/text (red)
  - Modified lines/text (yellow)
- **Character-level diff**: Highlight specific characters that differ within modified lines
- **Line matching**: Smart algorithm to match corresponding lines even when content shifts

### User Interface

- **Comparison view**: Custom editor view for displaying the comparison results
- **Navigation controls**: Buttons/shortcuts to jump between differences
- **Minimap indicators**: Visual indicators in the scrollbar/minimap showing locations of differences
- **Status bar information**: Display statistics about the number of differences

### User Interaction

- **Context menu integration**: Right-click on files to compare with another file
- **Command palette commands**: Access comparison features through VS Code's command palette
- **Drag and drop support**: Drag files into comparison view
- **Keyboard shortcuts**: Customizable shortcuts for common operations

### Configuration Options

- **Highlighting colors**: Customizable colors for different types of changes
- **Ignore options**: Settings to ignore whitespace, case, line endings, etc.
- **Diff algorithm settings**: Options to adjust sensitivity and matching behavior
- **View preferences**: Configure how the comparison is displayed

### Additional Features

- **Export differences**: Option to export comparison results as HTML or other formats
- **History**: Keep track of recently compared files
- **Merge capabilities**: Allow users to merge changes from one file to another
- **Syntax highlighting**: Maintain language-specific syntax highlighting in diff view

## Technical Architecture

### Extension Structure

- **Extension manifest** (`package.json`): Define commands, configuration, and activation events
- **Extension entry point**: Main TypeScript file to register commands and providers
- **WebView implementation**: For rendering the comparison UI
- **Diff algorithm implementation**: Core logic for text comparison

### VS Code API Integration

- **TextDocument API**: For accessing file contents
- **WebView API**: For creating custom UI
- **Commands API**: For registering custom commands
- **Configuration API**: For user settings

### Performance Considerations

- **Efficient diff algorithm**: Handle large files without significant performance impact
- **Lazy loading**: Only compute diffs when needed
- **Caching**: Cache comparison results when appropriate

## Development Roadmap

### Phase 1: Project Setup and Core Functionality

- [x] Define requirements and features
- [x] Set up VS Code extension project structure (`src/`, `webpack`, `package.json`, etc.)
- [x] Implement basic text comparison algorithm
- [x] Create side-by-side and inline comparison views
- [x] Add context menu and command palette integration
- [x] Add build and packaging automation (`tasks.json`, `vsce`)

### Phase 2: Editing, Sync, and Save

- [x] Add editable webview content (live editing in comparison view)
- [ ] Implement save functionality (save button, file system write)
- [ ] Add live sync between views (real-time edit sync)
- [ ] Add edit status indicators (unsaved changes, saving status)

### Phase 3: Enhanced UI and User Experience

- [ ] Improve comparison view with syntax highlighting
- [ ] Add navigation controls for differences
- [ ] Add status bar information
- [ ] Add minimap indicators for differences

### Phase 4: Advanced Features

- [ ] Implement character-level diff highlighting
- [ ] Add configuration options for customization
- [ ] Create merge capabilities
- [ ] Implement export functionality (HTML, etc.)
- [ ] Add history of compared files

### Phase 5: Testing and Optimization

- [ ] Test with various file types and sizes
- [ ] Optimize performance for large files
- [ ] Add unit and integration tests
- [ ] Prepare for publication to VS Code Extension Marketplace

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- VS Code Extension Manager (`vsce`)

### Installation for Development

1. Clone the repository

   ```
   git clone https://github.com/yourusername/vscode-text-comparator.git
   cd vscode-text-comparator
   ```

2. Install dependencies

   ```
   npm install
   ```

3. Open the project in VS Code

   ```
   code .
   ```

4. Press F5 to launch the extension in debug mode

### Building the Extension

```
npm run build
vsce package
```

## Usage

1. Open VS Code with the extension installed
2. Right-click on a file in the explorer and select "Compare with..."
3. Select another file to compare with
4. View the differences in the comparison view
5. Use the navigation controls to move between differences
6. Optionally, merge changes between files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
