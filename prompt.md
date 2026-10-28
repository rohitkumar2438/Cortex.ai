CORTEX AI - MASTER PROMPT (ALL PHASES IN ONE FILE)
==================================================

HOW TO USE: Give this file to Antigravity and say:
"Read cortex-ai-master-prompt.txt. Do Phase 1 only. Stop when it runs and wait for me to say 'next'."
Then say "Do Phase 2", and so on. Do not let it jump ahead.

==================================================
SHARED CONTEXT (applies to every phase)
==================================================

You are a senior full-stack and AI engineer building "Cortex AI", a production-ready Multi-Agent AI Platform (ChatGPT-style web app, not a plain chatbot).

Stack: React (Vite) + Tailwind (indigo/violet) + Redux Toolkit; Node.js + Express + MongoDB (Mongoose) + Redis; LangChain.js + LangGraph.js; Groq, Gemini 2.5 Flash, DeepSeek; Tavily search; Firebase Google sign-in; Razorpay; Docker; AWS.

Agents routed by LangGraph: chat, search, coding, pdf, ppt, image.

Architecture: microservices behind a gateway (port 8000). The frontend only talks to the gateway, which proxies /auth, /chat, /agent, /billing. Each service has its own port, .env and Mongo connection. The gateway reads the session cookie + Redis and attaches req.user (including userId); downstream services trust it and never re-verify Firebase tokens.

Folder layout:
backend/{gateway, shared, services/{auth-service, chat-service, agent-service, billing-service}}, frontend/, docker-compose.yml

Rules:
- Every key comes from env vars (Groq, Gemini, DeepSeek, Tavily, Firebase, Razorpay, Mongo, Redis). Never hardcode.
- Controllers, routes, models and services are separated.
- Centralized error handling, input validation, rate limiting, CORS, helmet.
- Short comments on non-obvious logic.
- After each phase, make sure it runs, then give me the run commands and the list of files created.
- Do only the phase I ask for. Do not start the next phase.


==================================================
PHASE 1
==================================================

Phase 1. Give a short plan and the exact folder tree first, then implement:
- Repo skeleton and the gateway (port 8000): proxy routes, auth middleware (cookie -> Redis session -> req.user with userId), rate limiting, CORS, helmet, morgan.
- shared/: Redis client, DB helper, constants.
- auth-service: POST /auth/login verifies the Firebase ID token with Firebase Admin, finds or creates the user (User: firebaseUid, name, email, avatar, credits, timestamps), stores the session in Redis, sets an httpOnly cookie. POST /auth/logout deletes the session and clears the cookie. GET /auth/me.
- .env.example for each service.


==================================================
PHASE 2
==================================================

Phase 2. Build chat-service:
- Models: Conversation (userId, title, timestamps); Message (conversationId ref, role user|assistant, content, agent, images[] of links, artifact optional {files, language, preview}, timestamps).
- APIs: create/list/get/update-title/delete conversation; create message; get messages by conversation. All scoped to req.user.userId.
- Image links must persist in the message document so they survive a reload.
- Wire it through the gateway under /chat and add validation + error handling.


==================================================
PHASE 3
==================================================

Phase 3. Build agent-service with LangGraph:
- State: messages, prompt, agent, response, images, artifact.
- Router node: a Groq LLM classifies the prompt and returns exactly one word: chat, search, coding, pdf, ppt, or image (describe each category in the router prompt; search = current info, news, internet lookup).
- Conditional edges -> chosen agent node -> END. Only chat and search are implemented now; stub the rest.
- config/llmModels.js with getModel(agent) (switch on agent name).
- Chat agent (Groq, history-aware, markdown) and Search agent (Tavily: answer + source links + images). Each has its own system prompt as "Cortex AI".
- Controller: save the user message, invoke the graph with prior messages as context, save the assistant message (with images), return it.
- Add SSE streaming with "Thinking -> Reasoning -> Generating" status events.


==================================================
PHASE 4
==================================================

Phase 4. Build the frontend (Vite + React + Tailwind + Redux Toolkit):
- Login page ("Continue with Google" via Firebase, then POST /auth/login).
- Home page with agent cards; chat layout with a collapsible sidebar (conversation list, New Chat), message list, and prompt input.
- Agent selector with Auto (router) as the default.
- Render markdown (react-markdown), code blocks (react-syntax-highlighter, oneDark, "Copy code" button), image grids, and source links.
- Consume SSE and show the Thinking/Reasoning/Generating states; add loading animations, error toasts, and a responsive layout.


==================================================
PHASE 5
==================================================

Phase 5. Implement the coding agent (DeepSeek via getModel):
- Generates, debugs, reviews and explains code; returns structured output {files[], language, preview}.
- Frontend artifact panel: file tree/tabs, editor view, live preview iframe (HTML/CSS/JS, sandboxed), and a copy button.
- Persist the artifact in the Message model and restore it on reload.


==================================================
PHASE 6
==================================================

Phase 6. Implement:
- PDF agent: LLM drafts content, then generate a downloadable PDF (e.g. pdfkit or puppeteer).
- PPT agent: LLM outputs structured slides, then generate a .pptx (pptxgenjs).
- Image agent: free image-generation API/model from a text prompt.
- Store generated files (local storage now, S3-ready abstraction), return download URLs, and add download buttons in the UI.


==================================================
PHASE 7
==================================================

Phase 7. Build billing-service:
- Credit packs (100/500/1000). Create a Razorpay order, verify the payment signature, and add credits atomically.
- Idempotent Razorpay webhook handler; transaction history model and endpoint.
- Configurable per-agent credit cost, deducted on each agent call; block with a clear error when credits are insufficient.
- Frontend: credits badge and a buy-credits modal with Razorpay checkout.


==================================================
PHASE 8
==================================================

Phase 8. Add RAG to agent-service:
- Choose one vector DB (Pinecone, Qdrant, or Chroma) and justify the choice in 3-4 lines.
- Upload endpoint for PDF/TXT: chunk, embed, store per user/conversation.
- Retrieve context for the chat and PDF agents; show an upload UI and cite which document was used.


==================================================
PHASE 9
==================================================

Phase 9. DevOps:
- A Dockerfile per service and the frontend; docker-compose.yml (gateway, services, Redis, Mongo) with .env.example files.
- AWS deployment guide: EC2 or ECS behind an ALB, S3 for generated files, MongoDB Atlas, secrets in SSM/Secrets Manager.
- A basic GitHub Actions CI/CD workflow.
- Finish with a README: architecture diagram, setup steps, env variables, API reference.
