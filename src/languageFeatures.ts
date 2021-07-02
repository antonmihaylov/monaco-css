/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorInjection, ILanguagesInjection } from './monaco.contribution';
import * as cssService from 'vscode-css-languageservice';
import {
	languages,
	IMarkdownString,
	Uri,
	Position,
	IRange,
	Range,
	CancellationToken,
	IDisposable,
	MarkerSeverity,
	editor
} from './fillers/monaco-editor-core';
import { CSSInJSWorker } from './cssWorker';
import { TextEdit } from 'vscode-css-languageservice';
import { InsertReplaceEdit } from 'vscode-languageserver-types';
type IEditor = editor.IEditor;
type ITextModel = editor.ITextModel;

export interface WorkerAccessor {
	(first: Uri, ...more: Uri[]): Promise<CSSInJSWorker>;
}

// --- diagnostics --- ---
export class DiagnosticsAdapter {
	private _disposables: IDisposable[] = [];
	private _listener: { [uri: string]: IDisposable } = Object.create(null);

	constructor(
		private _languageId: string,
		private editor: IEditor,
		private _worker: CSSInJSWorker,
		private editorInj: IEditorInjection
	) {
		const onModelAdd = (model: editor.IModel): void => {
			let modeId = model.getModeId();
			if (modeId !== this._languageId) {
				return;
			}

			let handle: number;
			this._listener[model.uri.toString()] = model.onDidChangeContent(() => {
				window.clearTimeout(handle);
				handle = window.setTimeout(
					() => this._doValidate(model.uri, modeId, editor, editorInj),
					500
				);
			});

			this._doValidate(model.uri, modeId, editor, editorInj);
		};

		const onModelRemoved = (model: editor.IModel): void => {
			editorInj.setModelMarkers(model, this._languageId, []);

			let uriStr = model.uri.toString();
			let listener = this._listener[uriStr];
			if (listener) {
				listener.dispose();
				delete this._listener[uriStr];
			}
		};

		this._disposables.push(editorInj.onDidCreateModel(onModelAdd));
		this._disposables.push(editorInj.onWillDisposeModel(onModelRemoved));
		this._disposables.push(
			editorInj.onDidChangeModelLanguage((event) => {
				onModelRemoved(event.model);
				onModelAdd(event.model);
			})
		);

		this._disposables.push({
			dispose: () => {
				for (let key in this._listener) {
					this._listener[key].dispose();
				}
			}
		});

		editorInj.getModels().forEach(onModelAdd);
	}

	public dispose(): void {
		this._disposables.forEach((d) => d && d.dispose());
		this._disposables = [];
	}

	private _doValidate(
		resource: Uri,
		languageId: string,
		editor: IEditor,
		editorInj: IEditorInjection
	): void {
		this._worker
			.doValidation(resource.toString(), editor.getModel() as ITextModel)
			.then((diagnostics) => {
				const markers = diagnostics.map((d) => toDiagnostics(resource, d, editorInj));
				let model = editor.getModel();
				if (model) {
					editorInj.setModelMarkers(model as ITextModel, languageId, markers);
				}
			})
			.then(undefined, (err) => {
				console.error(err);
			});
	}
}

function toSeverity(
	lsSeverity: number,
	severities: Record<keyof typeof MarkerSeverity, MarkerSeverity>
): MarkerSeverity {
	switch (lsSeverity) {
		case cssService.DiagnosticSeverity.Error:
			return severities.Error;
		case cssService.DiagnosticSeverity.Warning:
			return severities.Warning;
		case cssService.DiagnosticSeverity.Information:
			return severities.Info;
		case cssService.DiagnosticSeverity.Hint:
			return severities.Hint;
		default:
			return severities.Info;
	}
}

function toDiagnostics(
	resource: Uri,
	diag: cssService.Diagnostic,
	editor: IEditorInjection
): editor.IMarkerData {
	let code = typeof diag.code === 'number' ? String(diag.code) : <string>diag.code;

	return {
		severity: toSeverity(diag.severity || 0, editor.severities),
		startLineNumber: diag.range.start.line + 1,
		startColumn: diag.range.start.character + 1,
		endLineNumber: diag.range.end.line + 1,
		endColumn: diag.range.end.character + 1,
		message: diag.message,
		code: code,
		source: diag.source
	};
}

// --- completion ------

function fromPosition(position: Position): cssService.Position {
	if (!position) {
		return void 0 as any;
	}
	return { character: position.column - 1, line: position.lineNumber };
}

function fromRange(range: IRange): cssService.Range {
	if (!range) {
		return void 0 as any;
	}
	return {
		start: {
			line: range.startLineNumber,
			character: range.startColumn - 1
		},
		end: { line: range.endLineNumber, character: range.endColumn - 1 }
	};
}

function toRange(range: cssService.Range, ieditor: IEditorInjection): Range {
	if (!range) {
		return void 0 as any;
	}

	return new ieditor.Range(
		range.start.line,
		range.start.character + 1,
		range.end.line,
		range.end.character + 1
	);
}

function isInsertReplaceEdit(edit: TextEdit | InsertReplaceEdit): edit is InsertReplaceEdit {
	return (
		typeof (<InsertReplaceEdit>edit).insert !== 'undefined' &&
		typeof (<InsertReplaceEdit>edit).replace !== 'undefined'
	);
}

function toCompletionItemKind(
	kind: number,
	mItemKind: Record<keyof typeof languages.CompletionItemKind, languages.CompletionItemKind>
): languages.CompletionItemKind {
	switch (kind) {
		case cssService.CompletionItemKind.Text:
			return mItemKind.Text;
		case cssService.CompletionItemKind.Method:
			return mItemKind.Method;
		case cssService.CompletionItemKind.Function:
			return mItemKind.Function;
		case cssService.CompletionItemKind.Constructor:
			return mItemKind.Constructor;
		case cssService.CompletionItemKind.Field:
			return mItemKind.Field;
		case cssService.CompletionItemKind.Variable:
			return mItemKind.Variable;
		case cssService.CompletionItemKind.Class:
			return mItemKind.Class;
		case cssService.CompletionItemKind.Interface:
			return mItemKind.Interface;
		case cssService.CompletionItemKind.Module:
			return mItemKind.Module;
		case cssService.CompletionItemKind.Property:
			return mItemKind.Property;
		case cssService.CompletionItemKind.Unit:
			return mItemKind.Unit;
		case cssService.CompletionItemKind.Value:
			return mItemKind.Value;
		case cssService.CompletionItemKind.Enum:
			return mItemKind.Enum;
		case cssService.CompletionItemKind.Keyword:
			return mItemKind.Keyword;
		case cssService.CompletionItemKind.Snippet:
			return mItemKind.Snippet;
		case cssService.CompletionItemKind.Color:
			return mItemKind.Color;
		case cssService.CompletionItemKind.File:
			return mItemKind.File;
		case cssService.CompletionItemKind.Reference:
			return mItemKind.Reference;
	}
	return mItemKind.Property;
}

function toTextEdit(
	textEdit: cssService.TextEdit,
	ieditor: IEditorInjection
): editor.ISingleEditOperation {
	if (!textEdit) {
		return void 0 as any;
	}
	return {
		range: toRange(textEdit.range, ieditor),
		text: textEdit.newText
	};
}

export class CompletionAdapter implements languages.CompletionItemProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	public get triggerCharacters(): string[] {
		return [' ', ':'];
	}

	async provideCompletionItems(
		model: editor.IReadOnlyModel,
		position: Position,
		context: languages.CompletionContext,
		token: CancellationToken
	): Promise<languages.CompletionList> {
		const resource = model.uri;

		const info = await this._worker.doComplete(resource.toString(), fromPosition(position), model);

		if (!info) {
			return void 0 as any;
		}
		const wordInfo = model.getWordUntilPosition({
			column: position.column,
			lineNumber: position.lineNumber
		});

		const wordRange = new this.editor.Range(
			position.lineNumber,
			wordInfo.startColumn,
			position.lineNumber,
			wordInfo.endColumn
		);

		let items: languages.CompletionItem[] = info.items.map((entry) => {
			let item: languages.CompletionItem = {
				label: entry.label,
				insertText: entry.insertText || entry.label,
				sortText: entry.sortText,
				filterText: entry.filterText,
				documentation: entry.documentation,
				detail: entry.detail,
				range: wordRange,
				kind: toCompletionItemKind(entry.kind || 0, this.editor.itemKinds)
			};

			if (entry.textEdit) {
				if (isInsertReplaceEdit(entry.textEdit)) {
					item.range = {
						insert: toRange(entry.textEdit.insert, this.editor),
						replace: toRange(entry.textEdit.replace, this.editor)
					};
				} else {
					item.range = toRange(entry.textEdit.range, this.editor);
				}
				item.insertText = entry.textEdit.newText;
			}
			if (entry.additionalTextEdits) {
				item.additionalTextEdits = entry.additionalTextEdits.map((v) => toTextEdit(v, this.editor));
			}
			if (entry.insertTextFormat === cssService.InsertTextFormat.Snippet) {
				item.insertTextRules = this.editor.CompletionItemInsertTextRule.InsertAsSnippet;
			}

			return item;
		});

		return {
			incomplete: info.isIncomplete,
			suggestions: items
		};
	}
}

function isMarkupContent(thing: any): thing is cssService.MarkupContent {
	return (
		thing && typeof thing === 'object' && typeof (<cssService.MarkupContent>thing).kind === 'string'
	);
}

function toMarkdownString(
	entry: cssService.MarkupContent | cssService.MarkedString
): IMarkdownString {
	if (typeof entry === 'string') {
		return {
			value: entry
		};
	}
	if (isMarkupContent(entry)) {
		if (entry.kind === 'plaintext') {
			return {
				value: entry.value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&')
			};
		}
		return {
			value: entry.value
		};
	}

	return { value: '```' + entry.language + '\n' + entry.value + '\n```\n' };
}

function toMarkedStringArray(
	contents: cssService.MarkupContent | cssService.MarkedString | cssService.MarkedString[]
): IMarkdownString[] {
	if (!contents) {
		return void 0 as any;
	}
	if (Array.isArray(contents)) {
		return contents.map(toMarkdownString);
	}
	return [toMarkdownString(contents)];
}

// --- hover ------

export class HoverAdapter implements languages.HoverProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	async provideHover(
		model: editor.IReadOnlyModel,
		position: Position,
		token: CancellationToken
	): Promise<languages.Hover> {
		let resource = model.uri;

		const info = await this._worker.doHover(resource.toString(), fromPosition(position), model);
		if (!info) {
			return void 0 as any;
		}
		return <languages.Hover>{
			range: toRange(info.range as any, this.editor),
			contents: toMarkedStringArray(info.contents)
		};
	}
}

// --- document highlights ------

function toDocumentHighlightKind(
	kind: number,
	languages: ILanguagesInjection
): languages.DocumentHighlightKind {
	switch (kind) {
		case cssService.DocumentHighlightKind.Read:
			return languages.DocumentHighlightKind.Read;
		case cssService.DocumentHighlightKind.Write:
			return languages.DocumentHighlightKind.Write;
		case cssService.DocumentHighlightKind.Text:
			return languages.DocumentHighlightKind.Text;
	}
	return languages.DocumentHighlightKind.Text;
}

export class DocumentHighlightAdapter implements languages.DocumentHighlightProvider {
	constructor(
		private _worker: CSSInJSWorker,
		private languages: ILanguagesInjection,
		private editor: IEditorInjection
	) {}

	public async provideDocumentHighlights(
		model: editor.IReadOnlyModel,
		position: Position,
		token: CancellationToken
	): Promise<languages.DocumentHighlight[]> {
		const resource = model.uri;

		const entries = await this._worker.findDocumentHighlights(
			resource.toString(),
			fromPosition(position),
			model
		);
		if (!entries) {
			return void 0 as any;
		}
		return entries.map((entry) => {
			return <languages.DocumentHighlight>{
				range: toRange(entry.range, this.editor),
				kind: toDocumentHighlightKind(entry.kind || 0, this.languages)
			};
		});
	}
}

// --- definition ------

function toLocation(location: cssService.Location, editor: IEditorInjection): languages.Location {
	return {
		uri: editor.Uri.parse(location.uri),
		range: toRange(location.range, editor)
	};
}

export class DefinitionAdapter {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	public async provideDefinition(
		model: editor.IReadOnlyModel,
		position: Position,
		token: CancellationToken
	): Promise<languages.Definition> {
		const resource = model.uri;

		const definition = await this._worker.findDefinition(
			resource.toString(),
			fromPosition(position),
			model
		);
		if (!definition) {
			return void 0 as any;
		}
		return [toLocation(definition, this.editor)];
	}
}

// --- references ------

export class ReferenceAdapter implements languages.ReferenceProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	async provideReferences(
		model: editor.IReadOnlyModel,
		position: Position,
		context: languages.ReferenceContext,
		token: CancellationToken
	): Promise<languages.Location[]> {
		const resource = model.uri;

		const entries = await this._worker.findReferences(
			resource.toString(),
			fromPosition(position),
			model
		);
		if (!entries) {
			return void 0 as any;
		}
		return entries.map((e) => toLocation(e, this.editor));
	}
}

// --- rename ------

function toWorkspaceEdit(
	edit: cssService.WorkspaceEdit,
	editor: IEditorInjection
): languages.WorkspaceEdit {
	if (!edit || !edit.changes) {
		return void 0 as any;
	}
	let resourceEdits: languages.WorkspaceTextEdit[] = [];
	for (let uri in edit.changes) {
		const _uri = editor.Uri.parse(uri);
		// let edits: languages.TextEdit[] = [];
		for (let e of edit.changes[uri]) {
			resourceEdits.push({
				resource: _uri,
				edit: {
					range: toRange(e.range, editor),
					text: e.newText
				}
			});
		}
	}
	return {
		edits: resourceEdits
	};
}

export class RenameAdapter implements languages.RenameProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	async provideRenameEdits(
		model: editor.IReadOnlyModel,
		position: Position,
		newName: string,
		token: CancellationToken
	): Promise<languages.WorkspaceEdit> {
		const resource = model.uri;

		const edit = await this._worker.doRename(
			resource.toString(),
			fromPosition(position),
			newName,
			model
		);
		return toWorkspaceEdit(edit, this.editor);
	}
}

// --- document symbols ------

function toSymbolKind(
	kind: cssService.SymbolKind,
	languages: ILanguagesInjection
): languages.SymbolKind {
	let mKind = languages.SymbolKind;

	switch (kind) {
		case cssService.SymbolKind.File:
			return mKind.Array;
		case cssService.SymbolKind.Module:
			return mKind.Module;
		case cssService.SymbolKind.Namespace:
			return mKind.Namespace;
		case cssService.SymbolKind.Package:
			return mKind.Package;
		case cssService.SymbolKind.Class:
			return mKind.Class;
		case cssService.SymbolKind.Method:
			return mKind.Method;
		case cssService.SymbolKind.Property:
			return mKind.Property;
		case cssService.SymbolKind.Field:
			return mKind.Field;
		case cssService.SymbolKind.Constructor:
			return mKind.Constructor;
		case cssService.SymbolKind.Enum:
			return mKind.Enum;
		case cssService.SymbolKind.Interface:
			return mKind.Interface;
		case cssService.SymbolKind.Function:
			return mKind.Function;
		case cssService.SymbolKind.Variable:
			return mKind.Variable;
		case cssService.SymbolKind.Constant:
			return mKind.Constant;
		case cssService.SymbolKind.String:
			return mKind.String;
		case cssService.SymbolKind.Number:
			return mKind.Number;
		case cssService.SymbolKind.Boolean:
			return mKind.Boolean;
		case cssService.SymbolKind.Array:
			return mKind.Array;
	}
	return mKind.Function;
}

export class DocumentSymbolAdapter implements languages.DocumentSymbolProvider {
	constructor(
		private _worker: CSSInJSWorker,
		private languages: ILanguagesInjection,
		private editor: IEditorInjection
	) {}

	public async provideDocumentSymbols(
		model: editor.IReadOnlyModel,
		token: CancellationToken
	): Promise<languages.DocumentSymbol[]> {
		const resource = model.uri;

		const items = await this._worker.findDocumentSymbols(resource.toString(), model);
		if (!items) {
			return void 0 as any;
		}
		return items.map((item) => ({
			name: item.name,
			detail: '',
			containerName: item.containerName,
			kind: toSymbolKind(item.kind, this.languages),
			tags: [],
			range: toRange(item.location.range, this.editor),
			selectionRange: toRange(item.location.range, this.editor)
		}));
	}
}

export class DocumentColorAdapter implements languages.DocumentColorProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	public async provideDocumentColors(
		model: editor.IReadOnlyModel,
		token: CancellationToken
	): Promise<languages.IColorInformation[]> {
		const resource = model.uri;

		const infos = await this._worker.findDocumentColors(resource.toString(), model);
		if (!infos) {
			return void 0 as any;
		}
		return infos.map((item) => ({
			color: item.color,
			range: toRange(item.range, this.editor)
		}));
	}

	public async provideColorPresentations(
		model: editor.IReadOnlyModel,
		info: languages.IColorInformation,
		token: CancellationToken
	): Promise<languages.IColorPresentation[]> {
		const resource = model.uri;

		const presentations = await this._worker.getColorPresentations(
			resource.toString(),
			info.color,
			fromRange(info.range),
			model
		);
		if (!presentations) {
			return void 0 as any;
		}
		return presentations.map((presentation) => {
			let item: languages.IColorPresentation = {
				label: presentation.label
			};
			if (presentation.textEdit) {
				item.textEdit = toTextEdit(presentation.textEdit, this.editor) as any;
			}
			if (presentation.additionalTextEdits) {
				item.additionalTextEdits = presentation.additionalTextEdits.map((v) =>
					toTextEdit(v, this.editor)
				) as any;
			}
			return item;
		});
	}
}

export class FoldingRangeAdapter implements languages.FoldingRangeProvider {
	constructor(private _worker: CSSInJSWorker, private languages: ILanguagesInjection) {}

	public async provideFoldingRanges(
		model: editor.IReadOnlyModel,
		context: languages.FoldingContext,
		token: CancellationToken
	): Promise<languages.FoldingRange[]> {
		const resource = model.uri;

		const ranges = await this._worker.getFoldingRanges(resource.toString(), model, context);
		if (!ranges) {
			return void 0 as any;
		}
		return ranges.map((range) => {
			let result: languages.FoldingRange = {
				start: range.startLine + 1,
				end: range.endLine + 1
			};
			if (typeof range.kind !== 'undefined') {
				result.kind = toFoldingRangeKind(<cssService.FoldingRangeKind>range.kind, this.languages);
			}
			return result;
		});
	}
}

function toFoldingRangeKind(
	kind: cssService.FoldingRangeKind,
	languages: ILanguagesInjection
): languages.FoldingRangeKind {
	switch (kind) {
		case cssService.FoldingRangeKind.Comment:
			return languages.FoldingRangeKind.Comment;
		case cssService.FoldingRangeKind.Imports:
			return languages.FoldingRangeKind.Imports;
		case cssService.FoldingRangeKind.Region:
			return languages.FoldingRangeKind.Region;
	}
}

export class SelectionRangeAdapter implements languages.SelectionRangeProvider {
	constructor(private _worker: CSSInJSWorker, private editor: IEditorInjection) {}

	public async provideSelectionRanges(
		model: editor.IReadOnlyModel,
		positions: Position[],
		token: CancellationToken
	): Promise<languages.SelectionRange[][]> {
		const resource = model.uri;

		const selectionRanges = await this._worker.getSelectionRanges(
			resource.toString(),
			positions.map(fromPosition),
			model
		);
		if (!selectionRanges) {
			return void 0 as any;
		}
		return selectionRanges.map((selectionRange) => {
			const result: languages.SelectionRange[] = [];
			while (selectionRange) {
				result.push({ range: toRange(selectionRange.range, this.editor) });
				selectionRange = selectionRange.parent as any;
			}
			return result;
		});
	}
}
