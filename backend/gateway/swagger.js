/**
 * Cortex AI - Interactive Swagger / OpenAPI 3.0 Documentation Module
 * Provides interactive API exploration, request testing, and schema validation.
 */

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Cortex AI Multi-Agent Platform API',
        version: '1.0.0',
        description: `
**Cortex AI** is an enterprise-grade multi-agent AI orchestration platform featuring:
- **Intelligent Routing**: LangGraph StateGraph routing across Chat, Search, Coding, PDF, PPT, and Image agents.
- **Microservices Architecture**: Microservices behind an API Gateway with Redis caching and Mongo persistence.
- **RAG Knowledge Base**: Hybrid lexical-semantic vector retrieval for private document analysis.
- **Multi-Modal Generation**: Dynamic PDF report synthesis, PowerPoint presentation generation, and live sandboxed coding artifacts.
- **Credit-Based Billing**: Integrated Razorpay billing and atomic credit deduction.
        `,
        contact: {
            name: 'Cortex AI Engineering Team',
            url: 'https://github.com/rohitkumar2438/Cortex.ai'
        }
    },
    servers: [
        {
            url: 'http://localhost:8000',
            description: 'API Gateway (Local Development & Docker)'
        }
    ],
    tags: [
        { name: 'System & Observability', description: 'Central health check, metrics, and API catalog' },
        { name: 'Multi-Agent Orchestrator', description: 'Execute LangGraph agents (Chat, Search, Coding, PDF, PPT, Image)' },
        { name: 'RAG Knowledge Engine', description: 'Upload, index, and manage private PDF & TXT knowledge bases' },
        { name: 'Authentication', description: 'Firebase token verification, session cookies, and user profiles' },
        { name: 'Chat Management', description: 'Conversation threads and persistent message history' },
        { name: 'Billing & Credits', description: 'Credit balances and Razorpay payment orders' }
    ],
    paths: {
        '/health/all': {
            get: {
                tags: ['System & Observability'],
                summary: 'Aggregated Multi-Microservice Health & Latency',
                description: 'Probes all 4 microservices (Auth, Chat, Agent, Billing) and Redis in parallel, reporting status, latency in ms, and memory metrics.',
                responses: {
                    200: { description: 'All microservices operational' },
                    207: { description: 'One or more microservices degraded' }
                }
            }
        },
        '/api/catalog': {
            get: {
                tags: ['System & Observability'],
                summary: 'Platform Endpoint Catalog',
                description: 'Returns machine-readable summary of all platform service routes.',
                responses: {
                    200: { description: 'Catalog retrieved successfully' }
                }
            }
        },
        '/agent/run': {
            post: {
                tags: ['Multi-Agent Orchestrator'],
                summary: 'Execute Specialized Agent (Synchronous)',
                description: 'Runs prompt through LangGraph workflow with selected agent or automatic router.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: { type: 'string', example: 'What is the latest quantum computing breakthrough?' },
                                    agent: { type: 'string', enum: ['auto', 'chat', 'search', 'coding', 'pdf', 'ppt', 'image'], example: 'search' },
                                    conversationId: { type: 'string', example: 'default' },
                                    userId: { type: 'string', example: 'user_123' }
                                },
                                required: ['prompt']
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Agent execution successful with synthesized output and sources' }
                }
            }
        },
        '/agent/stream': {
            post: {
                tags: ['Multi-Agent Orchestrator'],
                summary: 'Stream Multi-Agent Execution (Server-Sent Events)',
                description: 'Streams status events (Thinking -> Reasoning -> Generating) and final result.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: { type: 'string', example: 'Build an interactive calculator in HTML, CSS, and JS' },
                                    agent: { type: 'string', example: 'coding' },
                                    conversationId: { type: 'string', example: 'default' }
                                },
                                required: ['prompt']
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'SSE text/event-stream chunks' }
                }
            }
        },
        '/agent/rag/upload': {
            post: {
                tags: ['RAG Knowledge Engine'],
                summary: 'Upload & Index PDF/TXT Document',
                description: 'Ingests document, chunks it, generates vector embeddings, and stores in persistent vector cache.',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary', description: 'PDF or TXT document' },
                                    conversationId: { type: 'string', example: 'default' },
                                    userId: { type: 'string', example: 'user_123' }
                                },
                                required: ['file']
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Document successfully parsed, embedded, and indexed' }
                }
            }
        },
        '/agent/rag/documents': {
            get: {
                tags: ['RAG Knowledge Engine'],
                summary: 'List Indexed Documents',
                description: 'Retrieves all knowledge documents active for current user/conversation.',
                responses: {
                    200: { description: 'List of uploaded knowledge documents' }
                }
            }
        },
        '/agent/rag/documents/{docName}': {
            delete: {
                tags: ['RAG Knowledge Engine'],
                summary: 'Delete Knowledge Document',
                parameters: [
                    { name: 'docName', in: 'path', required: true, schema: { type: 'string' }, example: 'resume.pdf' }
                ],
                responses: {
                    200: { description: 'Document removed from knowledge base' }
                }
            }
        },
        '/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'User Login & Session Setup',
                description: 'Verifies Firebase ID token (or demo fallback) and creates Redis session cookie.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    idToken: { type: 'string', example: 'demo_token' }
                                },
                                required: ['idToken']
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Login successful, returns user profile and credits' }
                }
            }
        },
        '/auth/profile': {
            get: {
                tags: ['Authentication'],
                summary: 'Get Authenticated User Profile',
                responses: {
                    200: { description: 'User profile details and credits' }
                }
            }
        },
        '/auth/logout': {
            post: {
                tags: ['Authentication'],
                summary: 'User Logout',
                responses: {
                    200: { description: 'Session destroyed and cookie cleared' }
                }
            }
        },
        '/chat/conversations': {
            get: {
                tags: ['Chat Management'],
                summary: 'List User Conversations',
                responses: {
                    200: { description: 'Array of conversation metadata' }
                }
            },
            post: {
                tags: ['Chat Management'],
                summary: 'Create New Conversation Thread',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string', example: 'Quantum Computing Research' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'Conversation created' }
                }
            }
        },
        '/chat/conversations/{id}/messages': {
            get: {
                tags: ['Chat Management'],
                summary: 'Get Conversation Messages',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Ordered message history' }
                }
            }
        },
        '/billing/status': {
            get: {
                tags: ['Billing & Credits'],
                summary: 'Get User Credits Balance',
                responses: {
                    200: { description: 'Current available credit balance' }
                }
            }
        },
        '/billing/order': {
            post: {
                tags: ['Billing & Credits'],
                summary: 'Create Razorpay Credit Top-up Order',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    packId: { type: 'string', enum: ['starter_100', 'pro_500', 'enterprise_1000'], example: 'pro_500' }
                                },
                                required: ['packId']
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Razorpay order details for checkout modal' }
                }
            }
        }
    }
};

/**
 * Returns the HTML string embedding the official Swagger UI layout
 */
export const getSwaggerHtml = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Cortex AI - Interactive API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>" />
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0b0f19;
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .topbar {
            display: none !important;
        }
        .swagger-ui {
            color: #e2e8f0;
        }
        .swagger-ui .info {
            margin: 30px 0;
        }
        .swagger-ui .info .title {
            color: #818cf8;
            font-size: 2.25rem;
        }
        .swagger-ui .info p, .swagger-ui .info li {
            color: #94a3b8;
            font-size: 0.95rem;
            line-height: 1.6;
        }
        .swagger-ui .scheme-container {
            background: #111827;
            border-bottom: 1px solid #1e293b;
            box-shadow: none;
            padding: 15px 30px;
        }
        .swagger-ui .opblock {
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            margin-bottom: 14px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .swagger-ui .opblock .opblock-summary {
            padding: 10px 16px;
        }
        .swagger-ui .opblock .opblock-summary-method {
            border-radius: 8px;
            font-weight: 700;
        }
        .swagger-ui .opblock .opblock-summary-path {
            color: #f8fafc;
            font-family: monospace;
        }
        .swagger-ui .opblock-body {
            background: #0f172a;
        }
        .swagger-ui table thead tr th {
            color: #cbd5e1;
            border-bottom: 1px solid #334155;
        }
        .swagger-ui .tab li button.tablinks {
            color: #cbd5e1;
        }
        .swagger-ui section.models {
            border-radius: 12px;
            border: 1px solid #1e293b;
            background: #0f172a;
        }
        .swagger-ui section.models h4 {
            color: #818cf8;
        }
        .custom-banner {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 18px 30px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: white;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        .custom-banner h1 {
            margin: 0;
            font-size: 1.25rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .custom-banner a {
            color: #e0e7ff;
            text-decoration: none;
            font-size: 0.85rem;
            padding: 6px 14px;
            background: rgba(255,255,255,0.15);
            border-radius: 8px;
            transition: all 0.2s;
        }
        .custom-banner a:hover {
            background: rgba(255,255,255,0.25);
        }
    </style>
</head>
<body>
    <div class="custom-banner">
        <h1>
            <span>⚡</span>
            <span>Cortex AI — Developer Portal & Interactive API Docs</span>
        </h1>
        <div style="display: flex; gap: 10px;">
            <a href="http://localhost:5173" target="_blank">Open Web App (Port 5173)</a>
            <a href="/health/all" target="_blank">Health Observability</a>
            <a href="/docs/openapi.json" target="_blank">Raw OpenAPI JSON</a>
        </div>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: '/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "BaseLayout",
                docExpansion: "list",
                defaultModelsExpandDepth: 1
            });
        };
    </script>
</body>
</html>
`;

