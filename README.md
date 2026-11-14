# Karakeeb — Recycling Marketplace API

> **Recycle at home, earn points, and buy recycled goods.** One REST + WebSocket API that serves the Karakeeb web app (Next.js) and mobile app.

[![Live API](https://img.shields.io/badge/API-live-2ea44f)](https://recycling-backend-4nqw.onrender.com/api/categories)
[![API Docs](https://img.shields.io/badge/OpenAPI-docs-85EA2D?logo=swagger&logoColor=black)](https://recycling-backend-4nqw.onrender.com/api-docs/)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)

| | |
|---|---|
| **Live API** | https://recycling-backend-4nqw.onrender.com |
| **API docs (Swagger)** | https://recycling-backend-4nqw.onrender.com/api-docs/ |
| **Web app (Next.js)** | [Ahmed-Bakr611/Karakeeb](https://github.com/Ahmed-Bakr611/Karakeeb) |

> Hosted on Render's free tier: the first request after a quiet period can take ~50 s while the server wakes up.

---

## What it does

Karakeeb connects **households that have recyclables** with **buyers who want recycled materials**, and the **couriers** who move them. The backend owns the whole business:

- **Customers** list recyclables (by kg or piece), schedule a pickup, and **earn points** when it is completed. Points grow through **7 reward tiers**.
- **Buyers** browse the recycled-goods catalog, order from live stock, and **pay cash or by card (Stripe)**.
- **Couriers** apply with documents, get approved by an admin, then collect or deliver orders with photo proof.
- **Admins** assign couriers, approve couriers, adjust quantities, issue refunds and see analytics (top cities, top materials, points leaderboard).

---

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        W[Next.js web app]
        M[Mobile app]
    end

    subgraph API["Karakeeb API · Node.js + Express 5 + TypeScript"]
        R[REST routes<br/>/api/*]
        A[Auth<br/>JWT access + refresh<br/>Google OAuth]
        S[Socket.IO<br/>real-time events]
        D[Swagger<br/>/api-docs]
    end

    DB[(MongoDB Atlas)]
    ST[Stripe<br/>payments & refunds]
    CL[Cloudinary<br/>images & proofs]
    GM[Gmail SMTP<br/>OTP & emails]
    GR[Groq<br/>voice transcription]
    GO[Google<br/>ID-token verify]

    W & M -- HTTPS + Bearer token --> R
    W & M <-- WebSocket --> S
    R --> A
    R --> DB
    S --> DB
    R --> ST
    R --> CL
    A --> GM
    A --> GO
    R --> GR
```

---

## Roles at a glance

```mermaid
flowchart TB
    C((Customer)) -->|sells recyclables| P[Pickup order]
    P -->|completed| PTS[Points + tier bonus]
    P -->|completed| STK[(Catalog stock ↑)]

    B((Buyer)) -->|buys from catalog| O[Purchase order]
    STK -->|available items| B
    O -->|placed| STK2[(Catalog stock ↓)]
    O -->|cash / card| PAY[Stripe payment]

    K((Courier)) -->|collects / delivers| P & O
    AD((Admin)) -->|assigns courier, approves couriers,<br/>refunds, analytics| P & O & K
```

---

## Flow 1 — Customer recycles and earns points

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant API as Karakeeb API
    participant DB as MongoDB
    actor AD as Admin
    actor K as Courier
    participant WS as Socket.IO

    C->>API: POST /cart (items by kg / piece)
    C->>API: POST /orders (address)
    API->>DB: save order (status = pending), clear cart
    AD->>API: PUT /orders/:id/assign-courier
    API->>DB: status = assigntocourier
    API-->>WS: notify courier + customer
    K->>API: mark collected (+ photo proof, adjusted quantity)
    API->>DB: status = collected, collectedAt
    AD->>API: complete order
    API->>DB: status = completed, stock ↑
    API->>DB: add points + tier bonus to pointsHistory
    API-->>WS: "You earned N points" (+ tier-up notification)
```

### Reward tiers

| Tier | Completed orders | Bonus per order | One-time tier-up bonus |
|---|---|---|---|
| Eco Beginner | 0–4 | 1 | 50 |
| Eco Starter | 5–14 | 5 | 150 |
| Green Helper | 15–29 | 10 | 300 |
| Silver Recycler | 30–49 | 15 | 500 |
| Gold Guardian | 50–74 | 20 | 700 |
| Platinum Pioneer | 75–99 | 25 | 850 |
| Diamond Elite | 100+ | 30 | 1000 |

---

## Flow 2 — Buyer purchases recycled goods

```mermaid
sequenceDiagram
    autonumber
    actor B as Buyer
    participant API as Karakeeb API
    participant DB as MongoDB
    participant ST as Stripe
    actor K as Courier

    B->>API: GET /categories, /search (live stock)
    B->>API: POST /cart
    B->>API: POST /orders (cash or credit-card)
    API->>DB: save order, stock ↓ immediately
    alt credit-card
        API->>ST: create Checkout Session / PaymentIntent
        ST-->>B: hosted payment page
    end
    API->>DB: assign courier → status = assigntocourier
    K->>API: delivered → status = completed
    opt refund
        API->>ST: POST /payment/:id/refund
    end
```

---

## Order status machine

The allowed transitions depend on who placed the order. Every change is written to `statusHistory`.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> assigntocourier: admin assigns courier
    pending --> cancelled
    assigntocourier --> pending: courier revoked
    assigntocourier --> collected: courier picks up (customer orders)
    assigntocourier --> completed: delivered (buyer orders)
    assigntocourier --> cancelled
    collected --> completed: points awarded, stock ↑
    collected --> cancelled
    completed --> [*]
    cancelled --> [*]
```

---

## Flow 3 — Sign-up, sessions and courier approval

```mermaid
flowchart LR
    G[Guest session<br/>POST /sessions/guest] -->|guest cart| U
    U[Sign up<br/>initiateSignup → email OTP → register] --> L
    GG[Google sign-in<br/>ID token verified] --> L
    L[Login → access token 15 m<br/>+ refresh token 7 d] -->|POST /sessions/upgrade| CART[Guest cart merged]
    L -->|role = delivery| DOCS[Upload documents<br/>Cloudinary]
    DOCS --> REV{Admin review}
    REV -->|approve| ACT[Courier active]
    REV -->|decline| FIX[Re-submit]
```

---

## Tech stack

| Area | Tools |
|---|---|
| Runtime | Node.js 22, Express 5, TypeScript |
| Data | MongoDB Atlas, Mongoose |
| Auth | JWT (access + refresh), Passport, Google OAuth 2.0, email OTP |
| Real time | Socket.IO (notifications, stock updates) |
| Payments | Stripe (Checkout, PaymentIntents, refunds) |
| Files | Cloudinary (images, courier documents, proof photos) |
| Email | Nodemailer + Gmail |
| Voice | Groq (speech-to-text for voice input) |
| i18n | Arabic / English messages |
| Docs | OpenAPI 3 + Swagger UI |
| Hosting | Render (API), MongoDB Atlas (DB) |

---

## API overview

Full, interactive reference: **[/api-docs](https://recycling-backend-4nqw.onrender.com/api-docs/)**

| Area | Main endpoints |
|---|---|
| Auth | `POST /auth/initiateSignup`, `/auth/verifyOtp`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/provider/google` |
| Sessions | `POST /sessions/guest`, `POST /sessions/upgrade` |
| Catalog | `GET /categories`, `/categories/get-items/:name`, `/search`, `/categories/search-suggestions` |
| Cart | `GET/POST/PUT /cart`, `POST /cart/save`, `DELETE /cart/:id` |
| Orders | `POST /orders`, `GET /orders`, `PUT /orders/:id/status`, `PATCH /orders/:id/cancel`, `PUT /admin/orders/:id/status` |
| Couriers | `PUT /orders/:id/assign-courier`, `GET /my-orders`, `PATCH /delivery/approve/:userId` |
| Points | `GET /users/:id/points`, `/users/points/leaderboard` |
| Payments | `POST /users/:id/create-checkout-session`, `GET /payment`, `POST /payment/:id/refund` |
| Notifications | `GET /notifications`, `/notifications/unread-count`, `PATCH /notifications/mark-read` |
| Analytics | `GET /orders/analytics`, `/orders/analytics/top-cities`, `/top-materials-recycled` |

---

## Run locally

```bash
git clone https://github.com/Ahmed-Bakr611/Recycling-BackEnd.git
cd Recycling-BackEnd
cp .env.example .env        # fill in MongoDB, JWT secrets, Google, Stripe, Cloudinary, Gmail, Groq
npm ci
npm run dev                 # http://localhost:5000  ·  docs at /api-docs
```

Production build: `npm run build && npm start`.

---

## Team & my part

ITI graduation project (2025), team of 5: Sarah Hesham, **Ahmed Bakr**, Hazem Abdelrahman, Esraa Ahmed, Jihan Ahmed.

**What I built (Ahmed Bakr):**
- **Authentication:** JWT access/refresh tokens, sessions, Google OAuth on web and mobile, welcome notifications
- **Rewards:** the 7-tier points system, tier-up bonuses, points history and e-wallet transactions
- **Cart & stock:** whole-cart save, stock checks, admin order filtering
- **Search** endpoints and OpenAPI docs
- **Deployment and maintenance:** production setup on Render + Atlas, secret rotation and history clean-up (2026)
