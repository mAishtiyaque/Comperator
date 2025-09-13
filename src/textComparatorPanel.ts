import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as diff from "diff";

/**
 * Manages the Text Comparator webview panel
 */
export class TextComparatorPanel {
  public static currentPanel: TextComparatorPanel | undefined;

  private static readonly viewType = "textComparator";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _file1Uri: vscode.Uri;
  private _file2Uri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    file1Uri: vscode.Uri,
    file2Uri: vscode.Uri
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (TextComparatorPanel.currentPanel) {
      TextComparatorPanel.currentPanel._panel.reveal(column);
      TextComparatorPanel.currentPanel.updateContent(file1Uri, file2Uri);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      TextComparatorPanel.viewType,
      "Text Comparator",
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `media` directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
        // Retain context when hidden
        retainContextWhenHidden: true,
      }
    );

    TextComparatorPanel.currentPanel = new TextComparatorPanel(
      panel,
      extensionUri,
      file1Uri,
      file2Uri
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    file1Uri: vscode.Uri,
    file2Uri: vscode.Uri
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._file1Uri = file1Uri;
    this._file2Uri = file2Uri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (_e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
          case "save":
            try {
              const fileUri =
                message.file === 1 ? this._file1Uri : this._file2Uri;
              await vscode.workspace.fs.writeFile(
                fileUri,
                Buffer.from(message.content)
              );
              this._panel.webview.postMessage({
                command: "saved",
                file: message.file,
              });
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to save file: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public updateContent(file1Uri: vscode.Uri, file2Uri: vscode.Uri) {
    this._file1Uri = file1Uri;
    this._file2Uri = file2Uri;
    this._update();
  }

  public dispose() {
    TextComparatorPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    this._panel.title = `Compare: ${path.basename(
      this._file1Uri.fsPath
    )} ↔ ${path.basename(this._file2Uri.fsPath)}`;
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview() {
    try {
      // Read the file contents
      const file1Content = fs.readFileSync(this._file1Uri.fsPath, "utf8");
      const file2Content = fs.readFileSync(this._file2Uri.fsPath, "utf8");

      // Get the configuration settings
      const config = vscode.workspace.getConfiguration("textComparator");
      const ignoreWhitespace = config.get("ignoreWhitespace", false);
      const ignoreCase = config.get("ignoreCase", false);

      // Colors for highlighting
      const addColor = config.get("highlightAdditions", "#28a745");
      const deleteColor = config.get("highlightDeletions", "#d73a49");
      const modifyColor = config.get("highlightModifications", "#f9c513");

      // First perform line-level diff to identify which lines need word-level comparison
      let lineDiffResult: Array<any>;
      if (ignoreWhitespace) {
        const file1Normalized = file1Content.replace(/\s+/g, " ");
        const file2Normalized = file2Content.replace(/\s+/g, " ");
        lineDiffResult = diff.diffLines(
          ignoreCase ? file1Normalized.toLowerCase() : file1Normalized,
          ignoreCase ? file2Normalized.toLowerCase() : file2Normalized
        );
      } else {
        lineDiffResult = diff.diffLines(
          ignoreCase ? file1Content.toLowerCase() : file1Content,
          ignoreCase ? file2Content.toLowerCase() : file2Content
        );
      }

      // Process the line diff result to identify modified lines that need word-level comparison
      const processedDiff: Array<
        any | { modified: boolean; oldValue: string; newValue: string }
      > = [];

      // Helper function to find matching added/removed blocks that should be treated as modifications
      const findModifiedBlocks = () => {
        for (let i = 0; i < lineDiffResult.length; i++) {
          const current = lineDiffResult[i];

          if (
            current.removed &&
            i + 1 < lineDiffResult.length &&
            lineDiffResult[i + 1].added
          ) {
            // This is a potential modification (remove followed by add)
            const removed = current;
            const added = lineDiffResult[i + 1];

            // Add as a special 'modified' type
            processedDiff.push({
              modified: true,
              oldValue: removed.value,
              newValue: added.value,
            });

            // Skip the next item since we've processed it
            i++;
          } else {
            // Just a regular addition, removal, or unchanged block
            processedDiff.push(current);
          }
        }
      };

      findModifiedBlocks();

      // Generate HTML for the diff
      let file1Html = "";
      let file2Html = "";
      let lineNumber1 = 1;
      let lineNumber2 = 1;

      processedDiff.forEach((part: any) => {
        if (part.modified) {
          // Modified lines - apply word-level diff
          const oldLines = part.oldValue.split("\n");
          const newLines = part.newValue.split("\n");

          // Remove empty lines at the end if they exist
          if (oldLines[oldLines.length - 1] === "") {
            oldLines.pop();
          }
          if (newLines[newLines.length - 1] === "") {
            newLines.pop();
          }

          // Process each line pair for word differences
          const maxLines = Math.max(oldLines.length, newLines.length);
          for (let i = 0; i < maxLines; i++) {
            const oldLine = i < oldLines.length ? oldLines[i] : "";
            const newLine = i < newLines.length ? newLines[i] : "";

            file1Html += `<div class="line modified" style="background-color: ${modifyColor}20;">
              <span class="line-number">${lineNumber1++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${lineNumber1-1}">${this._processLineWithWordDiff(
                oldLine,
                newLine,
                true,
                false,
                modifyColor
              )}</span>
            </div>`;
            file2Html += `<div class="line modified" style="background-color: ${modifyColor}20;">
              <span class="line-number">${lineNumber2++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${lineNumber2-1}">${this._processLineWithWordDiff(
                oldLine,
                newLine,
                false,
                true,
                modifyColor
              )}</span>
            </div>`;
          }
        } else if (part.added) {
          // Added lines - only in file 2
          const lines = part.value.split("\n");
          // Remove the last empty line if it exists
          if (lines[lines.length - 1] === "") {
            lines.pop();
          }

          lines.forEach((line: string) => {
            file1Html += `<div class="line empty-line"></div>`;
            file2Html += `<div class="line added" style="background-color: ${addColor}20;">
              <span class="line-number">${lineNumber2++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${lineNumber2-1}">${this._processLineWithWordDiff(
                "",
                line,
                false,
                true,
                addColor
              )}</span>
            </div>`;
          });
        } else if (part.removed) {
          // Removed lines - only in file 1
          const lines = part.value.split("\n");
          // Remove the last empty line if it exists
          if (lines[lines.length - 1] === "") {
            lines.pop();
          }

          lines.forEach((line: string) => {
            file1Html += `<div class="line removed" style="background-color: ${deleteColor}20;">
              <span class="line-number">${lineNumber1++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${lineNumber1-1}">${this._processLineWithWordDiff(
                line,
                "",
                true,
                false,
                deleteColor
              )}</span>
            </div>`;
            file2Html += `<div class="line empty-line"></div>`;
          });
        } else {
          // Unchanged lines - in both files
          const lines = part.value.split("\n");
          // Remove the last empty line if it exists
          if (lines[lines.length - 1] === "") {
            lines.pop();
          }

          lines.forEach((line: string) => {
            file1Html += `<div class="line">
              <span class="line-number">${lineNumber1++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${
                lineNumber1 - 1
              }">${this._escapeHtml(line)}</span>
            </div>`;
            file2Html += `<div class="line">
              <span class="line-number">${lineNumber2++}</span>
              <span class="line-content" contenteditable="true" spellcheck="false" data-line="${
                lineNumber2 - 1
              }">${this._escapeHtml(line)}</span>
            </div>`;
          });
        }
      });

      // Return the HTML for the webview
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Text Comparator</title>
          <style>
            body {
              font-family: var(--vscode-editor-font-family);
              font-size: var(--vscode-editor-font-size);
              padding: 0;
              margin: 0;
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
            }
            .container {
              display: flex;
              height: 100vh;
              width: 100%;
              overflow: hidden;
            }
            .file-view {
              flex: 1;
              overflow-y: auto;
              padding: 0;
              border-right: 1px solid var(--vscode-panel-border);
            }
            .file-view:last-child {
              border-right: none;
            }
            .file-header {
              position: sticky;
              top: 0;
              background-color: var(--vscode-editor-background);
              padding: 10px;
              font-weight: bold;
              border-bottom: 1px solid var(--vscode-panel-border);
              z-index: 10;
            }
            .line {
              display: flex;
              min-height: 1.5em;
              white-space: pre;
            }
            .line-number {
              width: 3em;
              text-align: right;
              padding-right: 0.5em;
              color: var(--vscode-editorLineNumber-foreground);
              user-select: none;
              flex-shrink: 0;
            }
            .line-content {
              flex-grow: 1;
              white-space: pre-wrap;
              word-break: break-all;
              outline: none;
              min-height: 1.5em;
              padding: 0 4px;
            }
            .line-content:focus {
              background-color: var(--vscode-editor-selectionBackground);
            }
            .line-content[contenteditable="true"]:empty:before {
              content: "\\00a0";
            }
            .empty-line {
              background-color: var(--vscode-editor-background);
              min-height: 1.5em;
            }
            .added {
              background-color: ${addColor}20;
            }
            .removed {
              background-color: ${deleteColor}20;
            }
            .modified {
              background-color: ${modifyColor}20;
            }
            .unsaved-changes {
              border-left: 2px solid var(--vscode-editorInfo-foreground);
            }
            .saving {
              border-left: 2px solid var(--vscode-editorWarning-foreground);
            }
            .file-status {
              margin-left: 8px;
              font-size: 0.9em;
              opacity: 0.8;
            }
            .word-diff {
              display: inline-block;
              border-radius: 2px;
              padding: 0 2px;
              margin: 0 -2px;
            }
            .word-added {
              background-color: ${addColor}40;
            }
            .word-removed {
              background-color: ${deleteColor}40;
            }
            .word-modified {
              background-color: ${modifyColor}40;
            }
            .controls {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 10px;
              z-index: 100;
            }
            button {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              padding: 8px 12px;
              cursor: pointer;
              border-radius: 2px;
            }
            button:hover {
              background-color: var(--vscode-button-hoverBackground);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="file-view" id="file1">
              <div class="file-header">
                ${this._escapeHtml(path.basename(this._file1Uri.fsPath))}
                <span class="file-status" id="file1-status"></span>
              </div>
              <div class="file-content" id="file1-content">${file1Html}</div>
            </div>
            <div class="file-view" id="file2">
              <div class="file-header">
                ${this._escapeHtml(path.basename(this._file2Uri.fsPath))}
                <span class="file-status" id="file2-status"></span>
              </div>
              <div class="file-content" id="file2-content">${file2Html}</div>
            </div>
          </div>
          <div class="status-bar">
            <div class="controls">
              <button id="prev-diff">Previous Diff</button>
              <button id="next-diff">Next Diff</button>
            </div>
            <div class="save-controls">
              <button id="save-left">Save Left</button>
              <button id="save-right">Save Right</button>
            </div>
          </div>
          <script>
            (function() {
              const vscode = acquireVsCodeApi();
              
              // Synchronize scrolling between the two views
              const file1View = document.getElementById('file1');
              const file2View = document.getElementById('file2');
              
              file1View.addEventListener('scroll', () => {
                file2View.scrollTop = file1View.scrollTop;
              });
              
              file2View.addEventListener('scroll', () => {
                file1View.scrollTop = file2View.scrollTop;
              });
              
              // Navigation between diffs
              const prevDiffButton = document.getElementById('prev-diff');
              const nextDiffButton = document.getElementById('next-diff');
              
              const diffElements = document.querySelectorAll('.added, .removed, .modified');
              let currentDiffIndex = -1;
              
              function scrollToDiff(index) {
                if (diffElements.length === 0) return;
                
                if (index < 0) index = diffElements.length - 1;
                if (index >= diffElements.length) index = 0;
                
                currentDiffIndex = index;
                diffElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              
              prevDiffButton.addEventListener('click', () => {
                scrollToDiff(currentDiffIndex - 1);
              });
              
              nextDiffButton.addEventListener('click', () => {
                scrollToDiff(currentDiffIndex + 1);
              });
              
              // Initialize with the first diff
              if (diffElements.length > 0) {
                scrollToDiff(0);
              }

              // Handle file editing
              let file1Changed = false;
              let file2Changed = false;
              const file1Status = document.getElementById('file1-status');
              const file2Status = document.getElementById('file2-status');
              const saveLeft = document.getElementById('save-left');
              const saveRight = document.getElementById('save-right');

              function updateFileStatus(fileNum, status) {
                const statusElem = fileNum === 1 ? file1Status : file2Status;
                const view = document.getElementById('file' + fileNum + '-content');
                
                if (status === 'unsaved') {
                  statusElem.textContent = '(unsaved changes)';
                  view.classList.add('unsaved-changes');
                  view.classList.remove('saving');
                } else if (status === 'saving') {
                  statusElem.textContent = '(saving...)';
                  view.classList.add('saving');
                  view.classList.remove('unsaved-changes');
                } else {
                  statusElem.textContent = '';
                  view.classList.remove('unsaved-changes', 'saving');
                }
              }

              function handleContentChange(event, fileNum) {
                const target = event.target;
                if (!target.matches('.line-content')) return;

                if (fileNum === 1) {
                  file1Changed = true;
                  updateFileStatus(1, 'unsaved');
                } else {
                  file2Changed = true;
                  updateFileStatus(2, 'unsaved');
                }
              }

              function getFileContent(fileNum) {
                const lines = [];
                document.querySelectorAll('#file' + fileNum + '-content .line-content').forEach(content => {
                  lines.push(content.textContent);
                });
                return lines.join('\\n');
              }

              document.getElementById('file1-content').addEventListener('input', e => handleContentChange(e, 1));
              document.getElementById('file2-content').addEventListener('input', e => handleContentChange(e, 2));

              saveLeft.addEventListener('click', () => {
                if (!file1Changed) return;
                updateFileStatus(1, 'saving');
                const content = getFileContent(1);
                vscode.postMessage({ 
                  command: 'save',
                  file: 1,
                  content: content
                });
              });

              saveRight.addEventListener('click', () => {
                if (!file2Changed) return;
                updateFileStatus(2, 'saving');
                const content = getFileContent(2);
                vscode.postMessage({ 
                  command: 'save',
                  file: 2,
                  content: content
                });
              });

              // Handle messages from extension
              window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                  case 'saved':
                    if (message.file === 1) {
                      file1Changed = false;
                      updateFileStatus(1, 'saved');
                    } else {
                      file2Changed = false;
                      updateFileStatus(2, 'saved');
                    }
                    break;
                }
              });
            }());
          </script>
        </body>
        </html>
      `;
    } catch (error) {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
        </head>
        <body>
          <h1>Error</h1>
          <p>Failed to load file comparison: ${
            error instanceof Error ? error.message : String(error)
          }</p>
        </body>
        </html>
      `;
    }
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private _processLineWithWordDiff(
    line1: string,
    line2: string,
    isFile1: boolean,
    isFile2: boolean,
    _color: string
  ): string {
    // If one of the lines is empty, just return the escaped content of the other
    if (!line1) {
      return this._escapeHtml(line2);
    }
    if (!line2) {
      return this._escapeHtml(line1);
    }

    // Perform word-level diff with better granularity
    const wordDiff = diff.diffWordsWithSpace(line1, line2);

    // Generate HTML with word-level highlighting
    let result = "";
    wordDiff.forEach((part) => {
      // Make sure part.value is defined before using it
      const value = part.value || "";

      if (part.added && isFile2) {
        // Word added in file 2
        result += `<span class="word-diff word-added">${this._escapeHtml(
          value
        )}</span>`;
      } else if (part.removed && isFile1) {
        // Word removed in file 1
        result += `<span class="word-diff word-removed">${this._escapeHtml(
          value
        )}</span>`;
      } else if (!part.added && !part.removed) {
        // Unchanged words
        result += this._escapeHtml(value);
      }
      // Skip parts that don't apply to the current file view
    });

    return result;
  }
}
