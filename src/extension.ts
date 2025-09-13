import * as vscode from "vscode";
import { TextComparatorPanel } from "./textComparatorPanel";

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log("Text Comparator extension is now active!");

  // Register the compare command
  let compareCommand = vscode.commands.registerCommand(
    "text-comparator.compare",
    async (fileUri: vscode.Uri) => {
      if (!fileUri) {
        // If command was triggered from command palette instead of context menu
        const files = await vscode.window.showOpenDialog({
          canSelectMany: true,
          canSelectFolders: false,
          canSelectFiles: true,
          openLabel: "Select Files to Compare",
          filters: {
            "All Files": ["*"],
          },
          title: "Select Two Files to Compare",
        });

        if (!files || files.length !== 2) {
          vscode.window.showErrorMessage(
            "Please select exactly two files to compare."
          );
          return;
        }

        TextComparatorPanel.createOrShow(
          context.extensionUri,
          files[0],
          files[1]
        );
      } else {
        // Command was triggered from context menu (right-click on a file)
        // Get the recently opened files from VS Code's history
        const openEditors = vscode.workspace.textDocuments
          .filter((doc) => !doc.isUntitled && doc.uri.fsPath !== fileUri.fsPath)
          .map((doc) => ({
            uri: doc.uri,
            lastOpened: Date.now(), // Currently open files are most recent
          }));

        // Get all files in the workspace
        const files = await vscode.workspace.findFiles(
          "**/*.*",
          "**/node_modules/**"
        );

        // Create items for the quick pick menu
        const recentSection: FileQuickPickItem[] = openEditors.map(
          (editor) => ({
            label: "$(history) " + vscode.workspace.asRelativePath(editor.uri),
            description: "Recently Used",
            uri: editor.uri,
            picked: true,
          })
        );

        const workspaceSection: FileQuickPickItem[] = files
          .filter(
            (uri) =>
              uri.fsPath !== fileUri.fsPath &&
              !openEditors.some((editor) => editor.uri.fsPath === uri.fsPath)
          )
          .map((uri) => ({
            label: vscode.workspace.asRelativePath(uri),
            description: "Workspace File",
            uri: uri,
          }));

        type FileQuickPickItem = vscode.QuickPickItem & {
          uri?: vscode.Uri;
        };

        // Combine all sections with separators
        const fileItems: FileQuickPickItem[] = [
          {
            label: "Recently Used Files",
            kind: vscode.QuickPickItemKind.Separator,
          },
          ...recentSection,
          {
            label: "Workspace Files",
            kind: vscode.QuickPickItemKind.Separator,
          },
          ...workspaceSection,
          {
            label: "Other Options",
            kind: vscode.QuickPickItemKind.Separator,
          },
          {
            label: "$(file-directory) Open another file...",
            description: "Browse file system",
            uri: undefined,
          },
        ];

        const selected = await vscode.window.showQuickPick(fileItems, {
          placeHolder: "Select a file to compare with",
          matchOnDescription: true,
        });

        let secondFileUri: vscode.Uri | undefined;
        if (selected && selected.uri) {
          secondFileUri = selected.uri;
        } else if (selected && !selected.uri) {
          // User chose to open a new file
          const openDialog = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFolders: false,
            canSelectFiles: true,
            openLabel: "Select File to Compare With",
            filters: { "All Files": ["*"] },
            title: "Select File to Compare With",
          });
          if (openDialog && openDialog.length === 1) {
            secondFileUri = openDialog[0];
          }
        }

        if (!secondFileUri) {
          return;
        }

        TextComparatorPanel.createOrShow(
          context.extensionUri,
          fileUri,
          secondFileUri
        );
      }
    }
  );

  context.subscriptions.push(compareCommand);
}

// This method is called when the extension is deactivated
export function deactivate() {}
