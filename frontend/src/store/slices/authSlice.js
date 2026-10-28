import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true
});

export const checkAuthSession = createAsyncThunk(
    'auth/checkSession',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/auth/me');
            return res.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Not authenticated');
        }
    }
);

export const loginWithFirebase = createAsyncThunk(
    'auth/loginWithFirebase',
    async (idToken, { rejectWithValue }) => {
        try {
            const res = await api.post('/auth/login', { idToken });
            return res.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Authentication failed');
        }
    }
);

export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async (_, { rejectWithValue }) => {
        try {
            await api.post('/auth/logout');
            return null;
        } catch (err) {
            return rejectWithValue(err.response?.data?.error || 'Logout failed');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        isAuthenticated: false,
        loading: true,
        error: null
    },
    reducers: {
        setUser: (state, action) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.loading = false;
        },
        updateUserCredits: (state, action) => {
            if (state.user) {
                state.user.credits = action.payload;
            }
        },
        clearAuthError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // checkAuthSession
            .addCase(checkAuthSession.pending, (state) => {
                state.loading = true;
            })
            .addCase(checkAuthSession.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isAuthenticated = true;
                state.loading = false;
                state.error = null;
            })
            .addCase(checkAuthSession.rejected, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.loading = false;
            })
            // loginWithFirebase
            .addCase(loginWithFirebase.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginWithFirebase.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isAuthenticated = true;
                state.loading = false;
                state.error = null;
            })
            .addCase(loginWithFirebase.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // logoutUser
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.loading = false;
                state.error = null;
            });
    }
});

export const { setUser, updateUserCredits, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

