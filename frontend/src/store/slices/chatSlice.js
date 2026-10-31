import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cortex-backend-s1mw.onrender.com';

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true
});

export const fetchConversations = createAsyncThunk(
    'chat/fetchConversations',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/chat/conversations');
            return res.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Failed to fetch conversations');
        }
    }
);

export const selectConversation = createAsyncThunk(
    'chat/selectConversation',
    async (conversationId, { rejectWithValue }) => {
        try {
            const res = await api.get(`/chat/conversations/${conversationId}/messages`);
            return {
                conversationId,
                messages: res.data
            };
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Failed to fetch messages');
        }
    }
);

export const createNewConversation = createAsyncThunk(
    'chat/createNewConversation',
    async (title = 'New Chat', { rejectWithValue }) => {
        try {
            const res = await api.post('/chat/conversations', { title });
            return res.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Failed to create conversation');
        }
    }
);

export const deleteConversationById = createAsyncThunk(
    'chat/deleteConversationById',
    async (conversationId, { rejectWithValue }) => {
        try {
            await api.delete(`/chat/conversations/${conversationId}`);
            return conversationId;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Failed to delete conversation');
        }
    }
);

const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        conversations: [],
        activeConversationId: null,
        messages: [],
        selectedAgent: 'auto', // Auto (router) as default
        streamingStatus: null, // 'Thinking' | 'Reasoning' | 'Generating' | null
        isStreaming: false,
        loadingConversations: false,
        loadingMessages: false,
        error: null
    },
    reducers: {
        setSelectedAgent: (state, action) => {
            state.selectedAgent = action.payload;
        },
        setActiveConversationId: (state, action) => {
            state.activeConversationId = action.payload;
        },
        setStreamingStatus: (state, action) => {
            state.streamingStatus = action.payload;
        },
        setIsStreaming: (state, action) => {
            state.isStreaming = action.payload;
        },
        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },
        clearActiveChat: (state) => {
            state.activeConversationId = null;
            state.messages = [];
            state.streamingStatus = null;
            state.isStreaming = false;
        },
        clearChatError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchConversations
            .addCase(fetchConversations.pending, (state) => {
                state.loadingConversations = true;
            })
            .addCase(fetchConversations.fulfilled, (state, action) => {
                state.loadingConversations = false;
                state.conversations = action.payload;
            })
            .addCase(fetchConversations.rejected, (state, action) => {
                state.loadingConversations = false;
                state.error = action.payload;
            })
            // selectConversation
            .addCase(selectConversation.pending, (state) => {
                state.loadingMessages = true;
            })
            .addCase(selectConversation.fulfilled, (state, action) => {
                state.loadingMessages = false;
                state.activeConversationId = action.payload.conversationId;
                state.messages = action.payload.messages;
                state.streamingStatus = null;
            })
            .addCase(selectConversation.rejected, (state, action) => {
                state.loadingMessages = false;
                state.error = action.payload;
            })
            // createNewConversation
            .addCase(createNewConversation.fulfilled, (state, action) => {
                state.conversations.unshift(action.payload);
                state.activeConversationId = action.payload._id || action.payload.id;
                state.messages = [];
            })
            // deleteConversationById
            .addCase(deleteConversationById.fulfilled, (state, action) => {
                state.conversations = state.conversations.filter(
                    c => (c._id || c.id) !== action.payload
                );
                if (state.activeConversationId === action.payload) {
                    state.activeConversationId = null;
                    state.messages = [];
                }
            });
    }
});

export const {
    setSelectedAgent,
    setActiveConversationId,
    setStreamingStatus,
    setIsStreaming,
    addMessage,
    clearActiveChat,
    clearChatError
} = chatSlice.actions;

export default chatSlice.reducer;

