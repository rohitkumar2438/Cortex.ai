// Shared Constants for Cortex AI Platform

export const PORTS = {
    GATEWAY: process.env.PORT || 8000,
    AUTH_SERVICE: process.env.AUTH_PORT || 8001,
    CHAT_SERVICE: process.env.CHAT_PORT || 8002,
    AGENT_SERVICE: process.env.AGENT_PORT || 8003,
    BILLING_SERVICE: process.env.BILLING_PORT || 8004
};

export const COOKIE_NAME = 'session';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const AGENT_TYPES = {
    CHAT: 'chat',
    SEARCH: 'search',
    CODING: 'coding',
    PDF: 'pdf',
    PPT: 'ppt',
    IMAGE: 'image'
};

export const INITIAL_USER_CREDITS = 100;

export const CREDIT_COSTS = {
    chat: 1,
    search: 2,
    coding: 3,
    pdf: 5,
    ppt: 5,
    image: 5
};
