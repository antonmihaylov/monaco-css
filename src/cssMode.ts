/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSSInJSWorker } from './cssWorker';
import {
	IEditorInjection,
	ILanguagesInjection,
	LanguageServiceDefaults
} from './monaco.contribution';
import * as languageFeatures from './languageFeatures';
import { Uri, IDisposable } from './fillers/monaco-editor-core';

export function setupMode(
	worker: CSSInJSWorker,
	defaults: LanguageServiceDefaults,
	editor: IEditorInjection,
	languages: ILanguagesInjection
): IDisposable {
	const disposables: IDisposable[] = [];
	const providers: IDisposable[] = [];

	function registerProviders(): void {
		const { languageId, modeConfiguration } = defaults;

		disposeAll(providers);

		if (modeConfiguration.completionItems) {
			providers.push(
				languages.registerCompletionItemProvider(
					languageId,
					new languageFeatures.CompletionAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.hovers) {
			providers.push(
				languages.registerHoverProvider(
					languageId,
					new languageFeatures.HoverAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.documentHighlights) {
			providers.push(
				languages.registerDocumentHighlightProvider(
					languageId,
					new languageFeatures.DocumentHighlightAdapter(worker, languages, editor)
				)
			);
		}
		if (modeConfiguration.definitions) {
			providers.push(
				languages.registerDefinitionProvider(
					languageId,
					new languageFeatures.DefinitionAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.references) {
			providers.push(
				languages.registerReferenceProvider(
					languageId,
					new languageFeatures.ReferenceAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.documentSymbols) {
			providers.push(
				languages.registerDocumentSymbolProvider(
					languageId,
					new languageFeatures.DocumentSymbolAdapter(worker, languages, editor)
				)
			);
		}
		if (modeConfiguration.rename) {
			providers.push(
				languages.registerRenameProvider(
					languageId,
					new languageFeatures.RenameAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.colors) {
			providers.push(
				languages.registerColorProvider(
					languageId,
					new languageFeatures.DocumentColorAdapter(worker, editor)
				)
			);
		}
		if (modeConfiguration.foldingRanges) {
			providers.push(
				languages.registerFoldingRangeProvider(
					languageId,
					new languageFeatures.FoldingRangeAdapter(worker, languages)
				)
			);
		}

		if (modeConfiguration.selectionRanges) {
			providers.push(
				languages.registerSelectionRangeProvider(
					languageId,
					new languageFeatures.SelectionRangeAdapter(worker, editor)
				)
			);
		}
	}

	registerProviders();

	disposables.push(asDisposable(providers));

	return asDisposable(disposables);
}

function asDisposable(disposables: IDisposable[]): IDisposable {
	return { dispose: () => disposeAll(disposables) };
}

function disposeAll(disposables: IDisposable[]) {
	while (disposables.length) {
		disposables.pop().dispose();
	}
}
