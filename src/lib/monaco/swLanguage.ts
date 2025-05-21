// src/lib/monaco/swLanguage.ts
import type * as monaco from 'monaco-editor';

// --- 1. Define the Monarch Tokenizer ---
// This is the core part - you need to define the rules for YOUR language.
// This is a VERY basic example. You'll need to replace it with rules
// that match the actual syntax of '.sw' files.
// See Monarch documentation: https://microsoft.github.io/monaco-editor/docs.html#interfaces/languages.IMonarchLanguage.html
export const swMonarchLanguage = <monaco.languages.IMonarchLanguage>{
  // Set defaultToken to invalid to see errors in syntax definition
  defaultToken: 'invalid',

  keywords: [
    'func', 'return', 'let', 'const', 'if', 'else', 'for', 'while',
    'class', 'struct', 'import', 'export', 'true', 'false', 'nil',
    'ainisha','fafanua','ongeza', 'kama', 'sivyo','wakati','andika',
    'ikiwa','ikiwa_kingine','kingine','kweli','si_kweli','tupu','nafsi',
  ],

  typeKeywords: [
    'int', 'float', 'string', 'bool', 'void', 'any',
    
    // Add type keywords specific to your .sw language
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=',
    // Add operators specific to your .sw language
  ],

  // Symbols used as delimiters
  symbols: /[=><!~?:&|+\-*/^%]+/,

  // C# style strings
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  // The main tokenizer routine
  tokenizer: {
    root: [
      // Identifiers and keywords
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@typeKeywords': 'keyword.type', // Use custom CSS class name if needed
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],

      // Whitespace
      { include: '@whitespace' },

      // Delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],

      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      // Delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid' ], // Unterminated string
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

      // Characters
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string','string.escape','string']],
      [/'/, 'string.invalid']
    ],

    comment: [
      [/[^/*]+/, 'comment' ],
      [/\/\*/, 'comment', '@push' ],    // Nested comment
      ["\\*/", 'comment', '@pop'  ],
      [/[/*]/, 'comment' ]
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment' ],
      [/\/\/.*$/, 'comment'],
    ],
  },
};

// --- 2. Define Language Configuration (Optional but Recommended) ---
// Controls features like comments, brackets, auto-closing pairs.
// See: https://microsoft.github.io/monaco-editor/docs.html#interfaces/languages.LanguageConfiguration.html
export const swLanguageConfiguration = <monaco.languages.LanguageConfiguration>{
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
    ],
    // Add folding rules etc. if needed
};


// --- 3. Registration Function ---
// This function will be called once Monaco is loaded.
let languageRegistered = false; // Prevent double registration

export function registerSwLanguage(monacoInstance: typeof monaco) {
    if (languageRegistered) {
        console.log("SW Language already registered.");
        return;
    }

    const languageId = 'swalang'; // The ID for your language

    // Register the language ID with Monaco
    monacoInstance.languages.register({ id: languageId, extensions: ['.sw'] });
    console.log(`Registered language ID: ${languageId} for extension .sw`);

    // Set the Monarch tokenizer for the language ID
    monacoInstance.languages.setMonarchTokensProvider(languageId, swMonarchLanguage);
    console.log(`Set Monarch tokens provider for ${languageId}`);

    // Set the language configuration
    monacoInstance.languages.setLanguageConfiguration(languageId, swLanguageConfiguration);
     console.log(`Set language configuration for ${languageId}`);

    languageRegistered = true;
}