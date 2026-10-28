# Cortex AI: Production AWS Cloud Architecture & Deployment Guide

This guide details the complete production deployment procedure for Cortex AI across **Amazon ECS Fargate**, **Amazon ECR**, **Amazon ElastiCache (Redis)**, **Application Load Balancer (ALB)**, **Amazon S3**, and **Amazon CloudFront**.

---

## 1. Cloud Architecture Overview

```
                      [ Client (Browser) ]
                                |
             +------------------+------------------+
             |                                     |
     HTTPS (Static App)                     HTTPS (REST API)
             v                                     v
   [ CloudFront CDN ]                     [ Application Load Balancer ]
             |                                     |
    [ S3 Frontend Bucket ]                         v
                                          [ ECS Fargate (Gateway) ]
                                                   |
              +-------------------+----------------+-------------------+
              |                   |                                    |
              v                   v                                    v
     [ ECS: Auth Service ] [ ECS: Chat Service ]          [ ECS: Agent Service (LangGraph) ]
              |                   |                                    |
              +-------------------+------------------------------------+
                                  |
              +-------------------+-------------------+
              |                                       |
              v                                       v
    [ MongoDB Atlas Cluster ]               [ ElastiCache Redis Cluster ]
              |                                       |
  (Users, Chats, Billing)                    (Shared Sessions & Cache)
```

---

## 2. Infrastructure Setup Steps

### Step 1: Amazon Elastic Container Registry (ECR)
Create 5 private repositories in ECR:
- `cortex-gateway`
- `cortex-auth`
- `cortex-chat`
- `cortex-agent`
- `cortex-billing`

### Step 2: Amazon ElastiCache (Redis)
1. Create a Redis cluster in your VPC.
2. Note the primary endpoint (e.g. `cortex-redis.xxxxxx.0001.use1.cache.amazonaws.com:6379`).
3. Ensure its Security Group allows inbound TCP traffic on port `6379` exclusively from the ECS Tasks Security Group.

### Step 3: Application Load Balancer (ALB)
1. Create an internet-facing ALB in your public subnets.
2. Provision an AWS Certificate Manager (ACM) SSL/TLS certificate for your custom domain (e.g., `api.yourdomain.com`).
3. Add an HTTPS listener (port 443) forwarding traffic to the **Gateway Target Group** (port 8000).

### Step 4: Amazon ECS Cluster & Fargate Services
1. Create an ECS Cluster: `cortex-ai-cluster`.
2. Define Fargate Task Definitions for each service with appropriate CPU/Memory limits:
   - `cortex-gateway-task` (0.25 vCPU, 512MB RAM)
   - `cortex-auth-task` (0.25 vCPU, 512MB RAM)
   - `cortex-chat-task` (0.5 vCPU, 1GB RAM)
   - `cortex-agent-task` (1 vCPU, 2GB RAM)
   - `cortex-billing-task` (0.25 vCPU, 512MB RAM)
3. Create ECS Services with AWS Service Connect enabled so the Gateway can resolve internal services via standard DNS names:
   - `http://auth:8001`
   - `http://chat:8002`
   - `http://agent:8003`
   - `http://billing:8004`

### Step 5: Amazon S3 & CloudFront (Frontend)
1. Create an S3 Bucket for static hosting: `cortex-ai-frontend`.
2. Create a CloudFront Distribution pointing to the S3 bucket via Origin Access Control (OAC).
3. Configure Custom Error Responses: Map HTTP 403 and 404 to `/index.html` with HTTP 200 (Single Page Application routing).

### Step 6: Firebase Console Configuration
In Firebase Console -> Authentication -> Settings -> **Authorized domains**:
- Add your CloudFront domain (e.g., `d111111abcdef8.cloudfront.net`) and custom domain (e.g., `app.yourdomain.com`).

---

## 3. GitHub Actions Secrets Configuration

Configure the following secrets in your GitHub repository (**Settings > Secrets and variables > Actions**):

| Secret Name | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM Access Key with ECR, ECS, S3, and CloudFront permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM Secret Key |
| `FRONTEND_S3_BUCKET` | Name of your frontend S3 bucket (e.g., `cortex-ai-frontend`) |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront Distribution ID for CDN cache invalidation |
| `VITE_PRODUCTION_GATEWAY_URL` | Public ALB URL (e.g., `https://api.yourdomain.com`) |
| `VITE_FIREBASE_API_KEY` | Firebase Client API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Client Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Live Key ID |

---

## 4. Local Development Verification with Docker Compose

To test the entire containerized architecture locally before pushing to AWS:

```bash
# Start all 5 microservices + local Redis container
docker-compose up --build

# In a separate terminal, launch the frontend
cd frontend
npm run dev
```
