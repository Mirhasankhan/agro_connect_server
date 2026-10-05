# 🌾 Agro Connect Backend Server

An enterprise-grade, scalable agricultural marketplace and supply chain backend API built with **NestJS 11**, **Prisma ORM (MongoDB)**, and **TypeScript**.

Agro Connect bridges agricultural producers (individual farmers, commercial farms, and agricultural businesses), buyers (consumers & bulk purchasers), delivery drivers, and platform administrators within an integrated, end-to-end commerce ecosystem.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture & Roles](#-system-architecture--roles)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Database Schema (Prisma & MongoDB)](#-database-schema-prisma--mongodb)
- [Environment Configuration](#-environment-configuration)
- [Getting Started](#-getting-started)
- [Database Seeding](#-database-seeding)
- [Available Scripts](#-available-scripts)
- [API Documentation & Postman](#-api-documentation--postman)
- [Production & Deployment](#-production--deployment)

---

## 🚀 Key Features

- **Role-Based Access Control (RBAC)**: Fine-grained access control across 4 core user roles: `ADMIN`, `PRODUCER`, `BUYER`, and `DRIVER`.
- **OTP-Based Authentication & Verification**: Secure registration flow with email OTP verification (`RegistrationVerification` model), JWT access & refresh tokens, and password reset flows.
- **Producer & Driver Onboarding**:
    - Verification workflow with document uploads (Trade License, National ID / NID, TIN, Driving License).
    - Admin approval/rejection lifecycle with custom rejection reasons.
- **Dynamic Tiered Pricing**:
    - Products support base unit prices as well as volume-based discount tiers (`PricingTier`).
    - Automatic pricing tier calculations applied in cart checkout and order items.
- **Cart & Wishlist Engine**:
    - Stock validation prevents adding more than available quantities.
    - Increment/decrement operations with live inventory limits.
- **Order Management & Stripe Checkout**:
    - Checkout session creation via Stripe API.
    - Secure webhook processing (`/api/v1/webhook/stripe`) for `checkout.session.completed`, `async_payment_succeeded`, and failed/expired sessions.
    - Atomic Prisma transactions to decrement inventory and clear cart items upon payment.
    - Automatic payment refund fallback via Stripe if order processing fails after charge.
- **Cloud Media Uploads**: Integrated with **Cloudinary** for product gallery photos, category thumbnails, and verification document storage.
- **Dynamic QueryBuilder**: Reusable utility supporting deep search, exact & nested filtering, sorting, pagination, and total count metadata.
- **Rate Limiting & Security**: Pre-configured with `@nestjs/throttler` (short, medium, long tiers), `helmet`, `cookie-parser`, and global exception filters.
- **Multi-Provider Email Service**: Modular mail sender supporting SMTP (Nodemailer), SendGrid, Resend, and Brevo.
- **API Spec & Postman Integration**: Automated Swagger specification generation and OpenAPI-to-Postman collection generator.

---

## 👥 System Architecture & Roles

```text
               ┌────────────────────────────────────────────────────────┐
               │                  Agro Connect Platform                 │
               └───────────────────────────┬────────────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         │                  │                    │                  │
         ▼                  ▼                    ▼                  ▼
   ┌───────────┐      ┌───────────┐        ┌───────────┐      ┌───────────┐
   │   BUYER   │      │ PRODUCER  │        │  DRIVER   │      │   ADMIN   │
   └─────┬─────┘      └─────┬─────┘        └─────┬─────┘      └─────┬─────┘
         │                  │                    │                  │
         ├► Browse Products ├► Onboard Profile   ├► Onboard Profile ├► Approve Producers
         ├► Manage Cart     ├► Add Products      ├► Vehicle Details ├► Approve Drivers
         ├► Wishlist        ├► Tiered Pricing    ├► Delivery State  ├► Manage Categories
         ├► Stripe Checkout ├► Track Orders      └──────────────────┘ └► Platform Audit
         └► Order History   └───────────────────┘
```

| Role           | Key Capabilities                                                                                                                                                      |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`BUYER`**    | Search/filter catalog, add items to cart, manage wishlists, maintain shipping addresses, place orders via Stripe Checkout, review purchases.                          |
| **`PRODUCER`** | Complete profile onboarding (Individual, Farm, Business), upload Trade License/NID, publish products with selling units and bulk pricing tiers, view received orders. |
| **`DRIVER`**   | Onboard with vehicle type (Bike, Motorcycle, Three Wheeler, Van, Truck, Pickup), driving license verification, toggle delivery availability.                          |
| **`ADMIN`**    | Review and accept/reject producer and driver applications, create and toggle product categories, audit system activity.                                               |

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) v11
- **Runtime**: [Node.js](https://nodejs.org/) (Express platform)
- **Language**: [TypeScript](https://www.typescriptlang.org/) v5.9
- **Database & ORM**: [MongoDB](https://www.mongodb.com/) with [Prisma ORM](https://www.prisma.io/) v6
- **Payments**: [Stripe](https://stripe.com/) Node SDK v18
- **Authentication**: JWT (`@nestjs/jwt`), Passport, Bcrypt
- **Cloud Storage**: [Cloudinary](https://cloudinary.com/), [AWS S3](https://aws.amazon.com/s3/)
- **Email Providers**: Nodemailer (SMTP), [SendGrid](https://sendgrid.com/), [Resend](https://resend.com/), [Brevo](https://brevo.com/)
- **API Documentation**: [Swagger / OpenAPI 3.0](https://swagger.io/)
- **Validation**: `class-validator`, `class-transformer`
- **Real-Time**: Socket.IO (`@nestjs/websockets`, `@nestjs/platform-socket.io`)

---

## 📁 Project Structure

```text
agro_connect_backend/
├── prisma/
│   └── schema.prisma                  # Prisma data models & MongoDB schema definitions
├── scripts/
│   ├── generate-module.ts             # CLI module scaffolding helper
│   └── generate-swagger.ts            # Swagger JSON spec export script
├── src/
│   ├── app/
│   │   ├── app.controller.ts          # Root controller & health check
│   │   └── app.module.ts              # Root application module
│   ├── common/
│   │   ├── decorators/                # Custom decorators (@Roles, @IsPublic, @OptionalAuth)
│   │   ├── errors/                    # Custom ApiError classes
│   │   ├── filters/                   # GlobalExceptionFilter
│   │   ├── guards/                    # Global AuthGuard & CompositeGuard
│   │   ├── interceptors/              # Response formatter, Multer & FormData interceptors
│   │   └── utils/                     # QueryBuilder, Bcrypt, localIp, slugify, url wrappers
│   ├── config/
│   │   └── index.ts                   # Centralized environment variable configurations
│   ├── core/
│   │   ├── services/
│   │   │   ├── email/                 # Modular email senders (Nodemailer, Sendgrid, Resend, Brevo)
│   │   │   ├── files/                 # Cloudinary & file handling services
│   │   │   ├── prisma/                # Prisma client service & modular seeders
│   │   │   └── stripe/                # Stripe checkout, webhook, and refund service
│   │   └── strategies/                # Passport authentication strategies
│   ├── modules/
│   │   ├── admin/                     # Admin verification & category management
│   │   ├── auth/                      # Registration, OTPs, login, token refresh, onboarding
│   │   ├── order/                     # Order creation, queries, and Stripe webhooks
│   │   ├── product/                   # Product catalog & volume pricing tiers
│   │   ├── shippingAddress/           # Buyer shipping addresses
│   │   ├── shopping/                  # Shopping cart & wishlist operations
│   │   └── socket/                    # WebSocket gateway for messaging & presence
│   └── main.ts                        # Application bootstrap, Swagger setup, CORS, prefix
├── .env.example                       # Template environment configuration
├── ecosystem.config.js                # PM2 production configuration
├── postman-collection.json            # Generated Postman collection
├── swagger-spec.json                  # Exported OpenAPI specification
└── package.json                       # Dependencies and project scripts
```

---

## 🔌 API Endpoints Overview

All routes are prefixed with `/api/v1`.

### 🔐 Authentication (`/api/v1/auth`)

| Method | Endpoint                          | Access        | Description                                                    |
| :----- | :-------------------------------- | :------------ | :------------------------------------------------------------- |
| `POST` | `/auth/register`                  | Public        | Submit registration payload and receive verification email OTP |
| `POST` | `/auth/verify-registration`       | Public        | Verify registration OTP and create active user account         |
| `POST` | `/auth/login`                     | Public        | Authenticate with email & password, returns JWT tokens         |
| `POST` | `/auth/send-otp/password-reset`   | Public        | Send password reset OTP code                                   |
| `POST` | `/auth/verify-otp/password-reset` | Public        | Verify reset OTP and obtain reset authorization token          |
| `POST` | `/auth/reset-password`            | Authenticated | Reset account password                                         |
| `POST` | `/auth/change-password`           | Authenticated | Change password using current credentials                      |
| `POST` | `/auth/refresh-token`             | Public        | Issue a new access token using a valid refresh token           |
| `POST` | `/auth/create-producer-profile`   | Producer      | Complete producer onboarding with trade license upload         |
| `POST` | `/auth/create-driver-profile`     | Driver        | Complete driver onboarding with driving license upload         |

### 🛡️ Administration (`/api/v1/admin`)

| Method  | Endpoint                            | Access | Description                                                |
| :------ | :---------------------------------- | :----- | :--------------------------------------------------------- |
| `GET`   | `/admin/all-producers`              | Admin  | List all producers with verification status & type filters |
| `PATCH` | `/admin/producer-approval`          | Admin  | Approve or reject a producer profile with a reason         |
| `GET`   | `/admin/all-drivers`                | Admin  | List all drivers with vehicle type and status filters      |
| `PATCH` | `/admin/driver-approval`            | Admin  | Approve or reject a driver application                     |
| `POST`  | `/admin/create-category`            | Admin  | Create product category with image upload                  |
| `PATCH` | `/admin/toggle-category-status/:id` | Admin  | Activate or deactivate a product category                  |

### 🌾 Products (`/api/v1/product`)

| Method | Endpoint                    | Access        | Description                                                     |
| :----- | :-------------------------- | :------------ | :-------------------------------------------------------------- |
| `POST` | `/product/create`           | Producer      | Create a new agricultural product with multiple images          |
| `GET`  | `/product/all`              | Public / Auth | Search, filter, and paginate products (producer/buyer views)    |
| `GET`  | `/product/details/:id`      | Public / Auth | Get product details including bulk pricing tiers                |
| `POST` | `/product/add-pricing-tier` | Producer      | Add bulk volume discount tier (quantity threshold & unit price) |
| `PUT`  | `/product/update`           | Producer      | Update product name, description, quantity, price               |
| `PUT`  | `/product/update-images`    | Producer      | Update or replace product image gallery                         |

### 🛒 Shopping & Wishlist (`/api/v1/shopping`)

| Method   | Endpoint                        | Access | Description                                               |
| :------- | :------------------------------ | :----- | :-------------------------------------------------------- |
| `POST`   | `/shopping/add-cart`            | Buyer  | Add item to cart with quantity validation                 |
| `GET`    | `/shopping/cart`                | Buyer  | Retrieve user cart items with tiered pricing calculations |
| `PATCH`  | `/shopping/update-cart`         | Buyer  | Increment or decrement cart item quantity                 |
| `DELETE` | `/shopping/remove-cart/:id`     | Buyer  | Remove item from cart                                     |
| `POST`   | `/shopping/add-wishlist/:id`    | Buyer  | Add product to wishlist                                   |
| `GET`    | `/shopping/wishlist`            | Buyer  | Retrieve user wishlist                                    |
| `DELETE` | `/shopping/remove-wishlist/:id` | Buyer  | Remove item from wishlist                                 |

### 📍 Shipping Address (`/api/v1/shipping-address`)

| Method | Endpoint                   | Access | Description                              |
| :----- | :------------------------- | :----- | :--------------------------------------- |
| `POST` | `/shipping-address/create` | Buyer  | Save a new delivery shipping address     |
| `GET`  | `/shipping-address`        | Buyer  | Retrieve user's saved shipping addresses |

### 📦 Orders & Payments (`/api/v1/order` & `/api/v1/webhook`)

| Method | Endpoint               | Access   | Description                                                                 |
| :----- | :--------------------- | :------- | :-------------------------------------------------------------------------- |
| `POST` | `/order/create`        | Buyer    | Create order from cart items and receive Stripe checkout URL                |
| `GET`  | `/order/user-wise`     | Buyer    | Fetch buyer's order history with status and items                           |
| `GET`  | `/order/producer-wise` | Producer | Fetch orders containing items sold by the logged-in producer                |
| `GET`  | `/order/details/:id`   | Buyer    | Detailed order receipt with shipping & producer information                 |
| `POST` | `/webhook/stripe`      | Public   | Stripe webhook endpoint handling payments, inventory decrement, and refunds |

---

## 🗄 Database Schema (Prisma & MongoDB)

The database schema is defined in [prisma/schema.prisma](file:///c:/Users/mirhasan/projects/agro_connect_backend/prisma/schema.prisma):

```text
User ────────────┬─── ProducerProfile
                 ├─── DriverProfile
                 ├─── ShippingAddress ────── Order ────── OrderItem
                 ├─── Product ────────────── PricingTier
                 ├─── Cart
                 └─── Wishlist
```

### Core Entities

- **`User`**: Account identity, credentials, roles (`ADMIN`, `PRODUCER`, `BUYER`, `DRIVER`), status (`ACTIVE`, `INACTIVE`, `SUSPENDED`), profile picture, and push notification tokens.
- **`ProducerProfile`**: Farm name, producer type (`Individual`, `Farm`, `Business`), farm size, district, trade license, NID, TIN, and verification status (`Pending`, `Accepted`, `Rejected`).
- **`DriverProfile`**: National ID, date of birth, license URL, vehicle type (`BIKE`, `MOTORCYCLE`, `THREE_WHEELER`, `VAN`, `TRUCK`, `PICKUP`), vehicle model/registration, and availability flag.
- **`Category`**: Name, slug, description, image, and active status flag.
- **`Product`**: Title, description, multiple gallery URLs, selling unit (`KG`, `GRAM`, `PIECE`, `DOZEN`, `LITER`, `BAG`, `BUNDLE`), price per unit, available quantity, rating, and status.
- **`PricingTier`**: Bulk quantity threshold and discounted price per unit.
- **`Cart` & `Wishlist`**: User-product associations with quantity constraints.
- **`Order` & `OrderItem`**: Unique order code (`AC-XXXXXX`), customer, shipping address, total amount, order status, Stripe payment intent ID, and per-item statuses.

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory by copying the example:

```bash
cp .env.example .env
```

| Variable                   | Description                                     | Example / Default                                       |
| :------------------------- | :---------------------------------------------- | :------------------------------------------------------ |
| `NODE_ENV`                 | Environment mode (`development` / `production`) | `development`                                           |
| `PORT`                     | HTTP server listening port                      | `5000`                                                  |
| `DATABASE_URL`             | MongoDB replica set connection URI              | `mongodb://localhost:27017/agro_connect?replicaSet=rs0` |
| `COMPANY_NAME`             | Platform branding name used in emails           | `Agro Connect`                                          |
| `JWT_SECRET`               | Secret key for JWT access tokens                | `<your-jwt-secret>`                                     |
| `JWT_SECRET_EXPIRES_IN`    | Access token lifespan in seconds                | `604800` (7 days)                                       |
| `REFRESH_TOKEN_SECRET`     | Secret key for JWT refresh tokens               | `<your-refresh-secret>`                                 |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifespan in seconds               | `2592000` (30 days)                                     |
| `RESET_TOKEN_SECRET`       | Secret key for password reset tokens            | `<your-reset-secret>`                                   |
| `RESET_TOKEN_EXPIRES_IN`   | Password reset token expiration                 | `900` (15 minutes)                                      |
| `PASSWORD_SALT`            | Bcrypt hashing salt rounds                      | `12`                                                    |
| `SMTP_HOST` / `SMTP_PORT`  | SMTP mail server credentials                    | `smtp.gmail.com` / `587`                                |
| `SMTP_USER` / `SMTP_PASS`  | SMTP username and password/app password         | `your_email@gmail.com`                                  |
| `SENDER_EMAIL`             | Default sender email address                    | `no-reply@agroconnect.com`                              |
| `STRIPE_SECRET_KEY`        | Stripe secret API key                           | `sk_test_...`                                           |
| `STRIPE_WEBHOOK_SECRET`    | Stripe webhook signing secret                   | `whsec_...`                                             |
| `CLOUDINARY_CLOUD_NAME`    | Cloudinary account cloud name                   | `your_cloud_name`                                       |
| `CLOUDINARY_API_KEY`       | Cloudinary API key                              | `your_api_key`                                          |
| `CLOUDINARY_API_SECRET`    | Cloudinary API secret                           | `your_api_secret`                                       |
| `FRONTEND_URL`             | Frontend application client origin              | `http://localhost:3000`                                 |
| `BACKEND_URL`              | Backend server URL                              | `http://localhost:5000`                                 |
| `PAYMENT_SUCCESS_URL`      | Redirect URL after successful Stripe payment    | `http://localhost:3000/payment/success`                 |
| `PAYMENT_FAILED_URL`       | Redirect URL after cancelled Stripe payment     | `http://localhost:3000/payment/failed`                  |

> [!IMPORTANT]
> MongoDB must be run with a **replica set** enabled (e.g. `?replicaSet=rs0`) because Prisma uses transactions for multi-record operations like orders and inventory adjustments.

---

## 🚦 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [MongoDB](https://www.mongodb.com/) (v6+ running with replica set enabled)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/Mirhasankhan/agro_connect_server.git
cd agro_connect_backend

# Install dependencies
npm install
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Seed the Database

Create the initial administrator account:

```bash
npm run db:seed
```

Default seeded administrator credentials (or configure via environment variables):

- **Email**: `admin@example.com` (or `$ADMIN_EMAIL`)
- **Password**: `123456` (or `$ADMIN_PASSWORD`)
- **Role**: `ADMIN`

### 5. Run the Application

```bash
# Start in development mode with hot reload
npm run dev

# Build the TypeScript production bundle
npm run build

# Start the compiled production server
npm run start:prod
```

The application will be live at:

- **API Base**: `http://localhost:5000/api/v1`
- **Swagger Documentation**: `http://localhost:5000/api/v1` (in non-production mode)

---

## 🌱 Database Seeding

The application implements a modular seeding architecture under [`src/core/services/prisma/seeds/`](file:///c:/Users/mirhasan/projects/agro_connect_backend/src/core/services/prisma/seeds/):

```bash
npm run db:seed
```

To register additional seeders:

1. Create `<feature>.seeder.ts` implementing the `ISeeder` interface.
2. Register the class in `src/core/services/prisma/seeds/seed.ts`.

---

## 📜 Available Scripts

| Script                     | Command                                                   | Description                                            |
| :------------------------- | :-------------------------------------------------------- | :----------------------------------------------------- |
| `npm run dev`              | `nest start --watch`                                      | Starts the development server with live reload         |
| `npm run build`            | `nest build`                                              | Compiles TypeScript code to `dist/`                    |
| `npm run start`            | `nest start`                                              | Starts the application without watch mode              |
| `npm run start:prod`       | `node dist/main`                                          | Runs the compiled production server                    |
| `npm run db:seed`          | `ts-node src/core/services/prisma/seeds/seed.ts`          | Runs registered database seeders                       |
| `npm run lint`             | `eslint "{src,apps,libs,test}/**/*.ts" --fix`             | Formats and fixes code style issues                    |
| `npm run generate:module`  | `node ./scripts/generate-module.ts <Name>`                | Scaffolds a new NestJS module, controller, and service |
| `npm run generate:swagger` | `npm run build && node ./scripts/generate-swagger.ts`     | Generates the static `swagger-spec.json`               |
| `npm run generate:postman` | `npx openapi-to-postmanv2 ...`                            | Converts the Swagger spec to `postman-collection.json` |
| `npm run g:spec`           | `npm run generate:swagger && npm run generate:postman`    | Rebuilds and exports both Swagger and Postman specs    |
| `npm run check`            | `eslint src && npx prettier --write src && npm run build` | Runs full linting, formatting, and build validation    |

---

## 📖 API Documentation & Postman

### Interactive Swagger UI

When running in `development` mode, access the live interactive Swagger documentation by navigating to:

```text
http://localhost:5000/api/v1
```

### Exporting Postman Collection

To regenerate the latest Postman collection from the codebase:

```bash
npm run g:spec
```

This updates both:

- `swagger-spec.json`: OpenAPI 3.0 specification
- `postman-collection.json`: Ready-to-import Postman collection with JWT Bearer authentication headers pre-configured

---

## 🚀 Production & Deployment

### PM2 Process Manager

A production process file [`ecosystem.config.js`](file:///c:/Users/mirhasan/projects/agro_connect_backend/ecosystem.config.js) is included for process resilience and clustering:

```bash
# Build production bundle
npm run build

# Start using PM2
pm2 start ecosystem.config.js

# Monitor PM2 logs
pm2 logs agro_connect_server
```

### Health Check

A root health endpoint is available at `GET /`:

```json
{
    "success": true,
    "message": "El Psy Congroo!",
    "server_name": "Agro Connect Server",
    "server_type": "WEB"
}
```

---

## 📄 License

This project is proprietary and confidential. Unauthorized copying, distribution, or modification is strictly prohibited.
