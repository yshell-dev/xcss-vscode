import fs from 'fs/promises';
import path from 'path';
import vscode from 'vscode';

import { SERVER } from './server';
import { PALETTE } from './shared/palette';
import { FORMATTING } from './shared/formatting';
import { SUMMON } from './shared/summon';
import { Definitions } from './shared/definition';
import { INTELLISENSE } from './shared/intellisense';

const ID = "xcss";
const BIN = [
	["core", "source", "scripts", 'live.sh'],
	["core", "run", "script.js"],
];

class ExtensionManager {
	readonly extensionId = ID;
	readonly rootBinary = BIN;
	readonly statusbarRefreshInterval = 1000;

	private Core: SERVER | undefined;
	private Definitions: Definitions | undefined;
	private Formatter: FORMATTING | undefined;
	private Intellisense: INTELLISENSE | undefined;
	private Palette: PALETTE | undefined;
	private BlockSummon: SUMMON | undefined;
	private Context: vscode.ExtensionContext | undefined;
	private Disposable: vscode.Disposable[] = [];

	private statusBarUpdateInterval: NodeJS.Timeout | undefined;

	constructor(context: vscode.ExtensionContext) {
		this.Context = context;
		if (!this.Context) { return; };

		this.Core = new SERVER(this.Context, this.extensionId, this.rootBinary);
		this.Definitions = new Definitions(this.Core);
		this.Formatter = new FORMATTING(this.Core);
		this.Intellisense = new INTELLISENSE(this.Core);
		this.Palette = new PALETTE(this.Core);
		this.BlockSummon = new SUMMON(this.Core);

		const ColorPicks = vscode.languages.registerColorProvider(['*'], new PALETTE(this.Core));
		const FoldRanges = vscode.languages.registerFoldingRangeProvider(['*'], this.Core);
		const Definition = vscode.languages.registerDefinitionProvider({ language: '*', scheme: 'file' }, new Definitions(this.Core));
		const Assistance = vscode.languages.registerCompletionItemProvider(['*'], this.Intellisense, ...this.Intellisense.triggers);
		const FileSwitch = vscode.commands.registerCommand(`${this.extensionId}.editor.toggle`, this.CommandFileToggle);
		const FileFormat = vscode.commands.registerCommand(`${this.extensionId}.editor.markdown`, this.CommandFileFormat);
		const Formatting = vscode.commands.registerCommand(`${this.extensionId}.editor.format`, this.Formatter.formatFile);
		const StructHere = vscode.commands.registerCommand(`${this.extensionId}.editor.summon`, this.BlockSummon.summonStructure);
		const PreviewNow = vscode.commands.registerCommand(`${this.extensionId}.editor.preview`, this.Core.W_COMPWEBVIEW.open);

		this.Disposable.push(
			this.Core,
			this.Palette,
			this.Formatter,
			this.BlockSummon,
			this.Definitions,
			this.Intellisense,
			ColorPicks,
			PreviewNow,
			StructHere,
			Definition,
			Assistance,
			FileFormat,
			FileSwitch,
			Formatting,
			FoldRanges,
		);
	};

	CommandFileToggle = async () => {

		async function fileExists(filePath: string): Promise<boolean> {
			try {
				await fs.access(filePath);
				return true;
			} catch {
				return false;
			}
		}

		try {
			const filePath = this.Core?.getTogglePath() || "";
			if (this.Core && filePath) {
				if (await fileExists(filePath)) {
					const targetUri = vscode.Uri.file(filePath);
					await vscode.commands.executeCommand('vscode.open', targetUri, {
						viewColumn: vscode.ViewColumn.Active
					});
					return;
				} else if (path.extname(filePath) === `.${this.extensionId}`) {
					vscode.window.showErrorMessage(`Toggle unavailable for *.${this.extensionId} files: ${filePath}`);
					return;
				} else {
					vscode.window.showErrorMessage(`Corresponding file not found: ${filePath}`);
					return;
				}
			}
			vscode.window.showErrorMessage('File is not in any source or target directory defined.');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to switch: ${errorMessage}`);
		}
	};

	CommandFileFormat = async () => {
		const result = await vscode.window.showInformationMessage(
			`Do you want to set Prettier as the default formatter for Markdown (and .${this.extensionId}) files?`,
			'Yes', 'No'
		);

		if (result === 'Yes') {
			const config = vscode.workspace.getConfiguration('editor');
			await config.update('defaultFormatter', 'esbenp.prettier-vscode', vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage('Prettier has been set as the default formatter (check your settings for confirmation). Please also consider enabling "editor.formatOnSave".');
		}
	};

	dispose = () => {
		if (this.statusBarUpdateInterval) {
			clearInterval(this.statusBarUpdateInterval);
			this.statusBarUpdateInterval = undefined;
		}

		this.Disposable.forEach((d) => { if (d.dispose) { d.dispose(); } });
		this.Disposable = [];
	};
}



let Manager: ExtensionManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	try {
		Manager = new ExtensionManager(context);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		console.error(`${ID.toLocaleUpperCase()} Extension: Failed to activate extension: ${errorMessage}`, error);
		vscode.window.showErrorMessage(`Failed to activate extension: ${errorMessage}`);
	}
}

export function deactivate(): void {
	try {
		Manager?.dispose();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		console.error(`${ID.toLocaleUpperCase()} Extension: Failed to deactivate extension: ${errorMessage}`, error);
		vscode.window.showErrorMessage(`Failed to deactivate extension: ${errorMessage}`);
	}
}
