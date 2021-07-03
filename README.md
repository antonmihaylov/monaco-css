# Monaco CSS-in-JS

Fork of the CSS, LESS and SCSS plugin for the Monaco Editor, providing support for CSS-in-JS (styled components, emotion). It is intended to be used with [monaco-react](https://www.npmjs.com/package/@monaco-editor/react). 

## Overview

monaco-css by default can't handle css-in-js syntax, where css properties are written at the root level, without a selector.
This modification adds a small proxy between the input document and the scss language service, so that input gets transformed like this:

*Input (valid css-in-js, but invalid css/scss)*
```scss
background: red;

div {
 color: blue;
}
```

*Gets passed down to the language service as this (valid scss)*
```scss
.this-element {
 background: red;
 
 div {
  color: blue;
 }
}
```

The response is modified so that the positioning is as if the extra syntax doesn't exist.

## Installation

[npm package](https://www.npmjs.com/package/monaco-css-in-js)

```
npm install monaco-css-in-js
```

or 

```
yarn add monaco-css-in-js
```

## Sample usage (with monaco-react)
```tsx
import MonacoEditor, { EditorProps, Monaco } from '@monaco-editor/react'
import {
  CSSInJSWorker,
  IEditorInjection,
  setupCssInJsLang,
  setupValidation,
} from 'monaco-css-in-js'
import React, { useRef } from 'react'

export type EmotionCssEditorProps = Omit<
  EditorProps,
  'language' | 'onMount' | 'beforeMount'
>

const getEditorInjection = (monaco: Monaco) => {
  const editorInjection: IEditorInjection = {
    Uri: monaco.Uri,
    createWebWorker: monaco.editor.createWebWorker,
    getModels: monaco.editor.getModels,
    getModel: monaco.editor.getModel,
    CompletionItemInsertTextRule: monaco.languages.CompletionItemInsertTextRule,
    itemKinds: monaco.languages.CompletionItemKind,
    onDidChangeModelLanguage: monaco.editor.onDidChangeModelLanguage,
    onDidCreateModel: monaco.editor.onDidCreateModel,
    onWillDisposeModel: monaco.editor.onWillDisposeModel,
    setModelMarkers: monaco.editor.setModelMarkers,
    severities: monaco.MarkerSeverity,
    Range: monaco.Range,
    Emitter: monaco.Emitter,
  }

  return editorInjection
}

export const EmotionCssEditor = ({
  theme,
  ...props
}: EmotionCssEditorProps) => {
  const workerRef = useRef<any>()

  return (
    <MonacoEditor
      language={'cssInJs'}
      theme={theme || 'vs-dark'}
      {...props}
      onMount={(editor, monaco) => {
        const editorInjection = getEditorInjection(monaco)
        setupValidation(workerRef.current, editor, editorInjection)
      }}
      beforeMount={(monaco) => {
        // We are injecting the editor instance, because of a css conflict that arises if we import the whole monaco.editor module
        const editorInjection = getEditorInjection(monaco)

        workerRef.current = new CSSInJSWorker()

        setupCssInJsLang(workerRef.current, monaco.languages, editorInjection)
      }}
    />
  )
}
```


### [Original repo](https://github.com/Microsoft/monaco-editor)


Internally the CSS plugin uses the [vscode-css-languageservice](https://github.com/Microsoft/vscode-css-languageservice)
node module, providing the implementation of the functionally listed above. The same module is also used
in [Visual Studio Code](https://github.com/Microsoft/vscode) to power the CSS, LESS and SCSS editing experience.



## Development

- `npm install .`
- compile with `npm run compile`
- watch with `npm run watch`
- `npm run prepublishOnly`
- open `$/monaco-css/test/index.html` in your favorite browser.

## License

[MIT](https://github.com/Microsoft/monaco-css/blob/master/LICENSE.md)
