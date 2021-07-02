/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//  Only import the types, because otherwise we will get a css error in next.js
import type {
	languages,
	editor,
	MarkerSeverity,
	Uri,
	IDisposable,
	Position,
	IRange,
	CancellationToken,
	IMarkdownString,
	Range,
	worker,
	IEvent
} from 'monaco-editor-core';

import { Emitter } from 'monaco-editor-core/esm/vs/base/common/event';

export type {
	languages,
	editor,
	MarkerSeverity,
	Uri,
	IDisposable,
	Position,
	IRange,
	CancellationToken,
	IMarkdownString,
	Range,
	worker,
	IEvent
};

export { Emitter };
