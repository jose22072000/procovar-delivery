# 🚚 ProCovar Delivery

A full-stack delivery route optimization and pricing web application built with **Next.js 14**, **Prisma**, **Tailwind CSS**, and **Leaflet.js**.

---

## 🎯 Features

- **Route Optimization** — Greedy nearest-neighbor algorithm to minimize travel distance
- **Delivery Pricing Engine** — `price = base_fee + (distance_km × cost_per_km) + (weight_kg × cost_per_kg)`
- **Order Management** — Create, edit, delete orders with GPS coordinates
- **Interactive Map** — Visualize routes with OpenStreetMap (no API key required)
- **Dashboard** — Stats: total deliveries, distance, revenue, delivery rate
- **Driver View** — Mobile-friendly UI to mark deliveries and navigate
- **Pricing Settings** — Admin-configurable pricing parameters

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Map | Leaflet.js + OpenStreetMap (free, no API key) |
| State | Zustand + TanStack Query |
| Backend | Next.js API Routes |
| Database | SQLite via Prisma ORM |
| Auth | JWT (jsonwebtoken + bcryptjs) |

---

## 📦 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Clone & Install

```bash
git clone https://github.com/jose22072000/procovar-delivery.git
cd procovar-delivery
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your `JWT_SECRET` (any random string).

### 3. Initialize Database

```bash
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Folder Structure

```
src/
├── app/
│   ├── (auth)/           # Login & Register pages
│   ├── (dashboard)/      # Dashboard, Orders, Routes, Settings
│   ├── driver/[routeId]/ # Mobile driver view
│   └── api/              # REST API routes
├── components/           # Reusable UI components
├── lib/                  # Prisma client, auth helpers, pricing logic
└── store/                # Zustand global state
prisma/
└── schema.prisma         # Database schema
```

---

## 🗄️ Database Schema

- **User** — email, password (hashed), name, role (admin/driver)
- **Order** — customerName, address, lat/lng, weight, status, price, stopOrder
- **Route** — name, status, totalDistance, totalWeight, totalPrice, orders[]
- **Settings** — baseFee, costPerKm, costPerKg, currency

---

## 💰 Pricing Formula

```
price = base_fee + (distance_km × cost_per_km) + (weight_kg × cost_per_kg)
```

Default values:
- `base_fee` = $5.00
- `cost_per_km` = $1.50/km
- `cost_per_kg` = $0.50/kg

---

## 📱 Pages

| Route | Description |
|-------|-------------|
| `/login` | User login |
| `/register` | New account registration |
| `/dashboard` | Stats overview |
| `/orders` | Order management (CRUD) |
| `/routes` | Route planner with map |
| `/settings` | Pricing configuration |
| `/driver/[id]` | Driver mobile view |

---

## 🚀 Production Build

```bash
npm run build
npm start
```

---

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite path (e.g., `file:./dev.db`) | ✅ |
| `JWT_SECRET` | Secret key for JWT signing | ✅ |
| `NEXT_PUBLIC_APP_URL` | App URL for links | Optional |
| `GOOGLE_MAPS_API_KEY` | Google Maps API (optional, app uses OpenStreetMap by default) | Optional |