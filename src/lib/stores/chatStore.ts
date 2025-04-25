import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// Define message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error'; // System for initial prompt, error for UI errors
  content: string;
  model?: string; // Optionally store which model generated the response
  timestamp: number;
}

// Define store state
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  currentModel: string; // Store the selected model
}

// Initial state
const initialState: ChatState = {
  messages: [],
  isLoading: false,
  currentModel: "llama3-8b-8192", // Default model
};

// Create the writable store
const chatStore: Writable<ChatState> = writable(initialState);

// --- Store Actions --- (Optional helpers, can also be done in component)

/** Adds a message to the store */
function addMessage(message: ChatMessage) {
  chatStore.update(state => ({
    ...state,
    messages: [...state.messages, message]
  }));
}

/** Sets the loading state */
function setLoading(loading: boolean) {
  chatStore.update(state => ({ ...state, isLoading: loading }));
}

/** Updates the currently selected model */
function setModel(model: string) {
    chatStore.update(state => ({ ...state, currentModel: model }));
}

/** Updates the content of the last assistant message (for streaming) */
function updateLastAssistantMessage(contentChunk: string, modelUsed?: string) {
    chatStore.update(state => {
        const lastIndex = state.messages.length - 1;
        if (lastIndex >= 0 && state.messages[lastIndex].role === 'assistant') {
            const updatedMessages = [...state.messages];
            updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                content: updatedMessages[lastIndex].content + contentChunk,
                model: modelUsed || updatedMessages[lastIndex].model // Store model if provided
            };
            return { ...state, messages: updatedMessages };
        }
        return state; // Return unchanged state if last message is not assistant
    });
}


// Export the store and actions/helpers
export { chatStore, addMessage, setLoading, setModel, updateLastAssistantMessage };
// Export types for use in components
// export type { ChatMessage, ChatState };