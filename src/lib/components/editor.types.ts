export type ActivePanel = 'console' | 'preview' | null;

// Define type for the instance methods we want to expose
export interface FileEditorInstance {
    runCode: () => Promise<void>;
    saveFile: () => Promise<void>;
    togglePanel: (panel: ActivePanel) => void;
    clearConsole: () => void;
    updatePreview: () => void;
    // Add other methods if needed by parent, e.g., editor.focus()
}