/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cssService from 'vscode-css-languageservice';
import { editor } from './fillers/monaco-editor-core';

export class CSSInJSWorker {
	private _languageService: cssService.LanguageService;

	constructor() {
		// this._languageService = cssService.getCSSLanguageService(lsOptions);
		this._languageService = cssService.getSCSSLanguageService({
			useDefaultDataProvider: true
		});
		this._languageService.configure();
	}

	// --- language service host ---------------

	async doValidation(uri: string, model: editor.IReadOnlyModel): Promise<cssService.Diagnostic[]> {
		let document = this._getTextDocument(uri, model);
		if (document) {
			let stylesheet = this._languageService.parseStylesheet(document);
			let diagnostics = this._languageService.doValidation(document, stylesheet);
			return Promise.resolve(diagnostics);
		}
		return Promise.resolve([]);
	}

	async doComplete(
		uri: string,
		position: cssService.Position,
		model: editor.IReadOnlyModel
	): Promise<cssService.CompletionList> {
		let document = this._getTextDocument(uri, model);

		let stylesheet = this._languageService.parseStylesheet(document);
		let completions = this._languageService.doComplete(document, this.mapPos(position), stylesheet);

		return Promise.resolve(completions);
	}
	mapPos(position: cssService.Position): cssService.Position {
		return position;
	}

	async doHover(
		uri: string,
		position: cssService.Position,
		model: editor.IReadOnlyModel
	): Promise<cssService.Hover> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let hover = this._languageService.doHover(document, this.mapPos(position), stylesheet);
		return Promise.resolve(hover as any);
	}

	async findDefinition(
		uri: string,
		position: cssService.Position,
		model: editor.IReadOnlyModel
	): Promise<cssService.Location> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let definition = this._languageService.findDefinition(
			document,
			this.mapPos(position),
			stylesheet
		);
		return Promise.resolve(definition as any);
	}

	async findReferences(
		uri: string,
		position: cssService.Position,
		model: editor.IReadOnlyModel
	): Promise<cssService.Location[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let references = this._languageService.findReferences(
			document,
			this.mapPos(position),
			stylesheet
		);
		return Promise.resolve(references);
	}

	async findDocumentHighlights(
		uri: string,
		position: cssService.Position,
		model: editor.IReadOnlyModel
	): Promise<cssService.DocumentHighlight[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let highlights = this._languageService.findDocumentHighlights(
			document,
			this.mapPos(position),
			stylesheet
		);
		return Promise.resolve(highlights);
	}

	async findDocumentSymbols(
		uri: string,
		model: editor.IReadOnlyModel
	): Promise<cssService.SymbolInformation[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let symbols = this._languageService.findDocumentSymbols(document, stylesheet);
		return Promise.resolve(symbols);
	}

	async doCodeActions(
		uri: string,
		range: cssService.Range,
		context: cssService.CodeActionContext,
		model: editor.IReadOnlyModel
	): Promise<cssService.Command[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let actions = this._languageService.doCodeActions(
			document,
			this.mapRange(range),
			context,
			stylesheet
		);
		return Promise.resolve(actions);
	}

	async findDocumentColors(
		uri: string,
		model: editor.IReadOnlyModel
	): Promise<cssService.ColorInformation[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let colorSymbols = this._languageService.findDocumentColors(document, stylesheet);
		return Promise.resolve(colorSymbols);
	}

	async getColorPresentations(
		uri: string,
		color: cssService.Color,
		range: cssService.Range,
		model: editor.IReadOnlyModel
	): Promise<cssService.ColorPresentation[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let colorPresentations = this._languageService.getColorPresentations(
			document,
			stylesheet,
			color,
			this.mapRange(range)
		);
		return Promise.resolve(colorPresentations);
	}
	mapRange(range: cssService.Range): cssService.Range {
		return {
			start: this.mapPos(range.start),
			end: this.mapPos(range.end)
		};
	}

	async getFoldingRanges(
		uri: string,
		model: editor.IReadOnlyModel,
		context?: { rangeLimit?: number }
	): Promise<cssService.FoldingRange[]> {
		let document = this._getTextDocument(uri, model);
		let ranges = this._languageService.getFoldingRanges(document, context);
		return Promise.resolve(ranges);
	}

	async getSelectionRanges(
		uri: string,
		positions: cssService.Position[],
		model: editor.IReadOnlyModel
	): Promise<cssService.SelectionRange[]> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let ranges = this._languageService.getSelectionRanges(
			document,
			positions.map(this.mapPos),
			stylesheet
		);
		return Promise.resolve(ranges);
	}

	async doRename(
		uri: string,
		position: cssService.Position,
		newName: string,
		model: editor.IReadOnlyModel
	): Promise<cssService.WorkspaceEdit> {
		let document = this._getTextDocument(uri, model);
		let stylesheet = this._languageService.parseStylesheet(document);
		let renames = this._languageService.doRename(
			document,
			this.mapPos(position),
			newName,
			stylesheet
		);
		return Promise.resolve(renames);
	}

	private _getTextDocument(uri: string, model: editor.IReadOnlyModel): cssService.TextDocument {
		const value = `.this-element {
		 ${model?.getValue() || ''}
		}`;

		return cssService.TextDocument.create(uri, 'emotionCss', model.getVersionId(), value);
	}
}
