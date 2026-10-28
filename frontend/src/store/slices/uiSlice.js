import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
    name: 'ui',
    initialState: {
        sidebarOpen: true,
        toasts: []
    },
    reducers: {
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action) => {
            state.sidebarOpen = action.payload;
        },
        addToast: (state, action) => {
            const id = Date.now() + Math.random().toString(36).substring(2, 6);
            state.toasts.push({
                id,
                message: action.payload.message || 'Notification',
                type: action.payload.type || 'info', // 'success' | 'error' | 'info'
                duration: action.payload.duration || 4000
            });
        },
        removeToast: (state, action) => {
            state.toasts = state.toasts.filter(t => t.id !== action.payload);
        }
    }
});

export const { toggleSidebar, setSidebarOpen, addToast, removeToast } = uiSlice.actions;
export default uiSlice.reducer;
