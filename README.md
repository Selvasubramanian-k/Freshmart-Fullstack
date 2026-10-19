# FreshMart – Full-stack Grocery Marketplace

React (Vite) + FastAPI (Python) + MongoDB, MVC backend.

Your existing FreshMart customer UI (`Selvasubramanian-k/Freshmart-grocery`) is now the **customer app**,
connected to a real backend. A **Store Admin (Shop Owner) dashboard**, a **Register page** and a
**single role-based login** were added.

---

## 1. The 6 roles – roadmap

| # | Role | What they do | Status |
|---|------|--------------|--------|
| 1 | **Buyer / Customer** | Browse products, cart, checkout & pay, track orders, cancel, returns & complaints | ✅ **Phase 1 – built** |
| 2 | **Shop Owner / Store Admin** | Products, prices, stock, expiry, orders, store open/close, staff, earnings, returns | ✅ **Phase 1 – built** |
| 3 | Delivery Partner | Accept delivery tasks, navigate to store/customer, update delivery status, earnings | Phase 2 |
| 4 | Super Admin / Platform Owner | All stores, commissions, service areas, users, promotions, reports | Phase 3 |
| 5 | Store Picker / Packing Staff | Pick list, scan items, check qty & expiry, pack, mark ready | Phase 2 |
| 6 | Customer Support / Ops | Complaints, cancellations, substitutions, refunds, delays, escalations | Phase 3 |

**How the next roles plug in (already prepared):**
- Order status flow `placed → confirmed → packed → out_for_delivery → delivered` already exists.
  Picker takes over `confirmed → packed`; Delivery Partner takes over `packed → delivered`.
- `staff` collection already stores pickers/packers per store → Picker logins in phase 2.
- `PLATFORM_COMMISSION_PERCENT` (backend `.env`) → Super Admin will manage this per store.
- `complaints` collection with statuses → Support team gets a cross-store queue.
- To add a role: add it to `Role` in `backend/app/models/user.py`, a `require_role("x")` router,
  and one line each in `frontend/src/shared/utils/roles.js` and `frontend/src/App.jsx`.

---

## 2. Folder structure

```
freshmart/
├── backend/                         # FastAPI – MVC
│   ├── app/
│   │   ├── main.py                  # app, CORS, routers, /uploads static
│   │   ├── config.py                # settings from .env
│   │   ├── database.py              # MongoDB connection + indexes
│   │   ├── models/                  # M – Pydantic schemas (user, store, product, order, complaint, staff)
│   │   ├── controllers/             # C – business logic (auth, product, order, complaint, staff, store, dashboard)
│   │   ├── routes/                  # V – API endpoints (auth, public, customer, admin)
│   │   ├── middleware/auth.py       # JWT + role guard (require_role)
│   │   └── utils/                   # security (bcrypt/JWT), pricing (bill rules), helpers
│   ├── seed_data/products.json      # your 154 products (exported from the old static list)
│   ├── seed.py                      # demo store + users + products
│   ├── requirements.txt
│   └── .env.example
└── frontend/                        # React + Vite (one app, role-based routing)
    └── src/
        ├── App.jsx                  # /login, /register, /admin/*, /* (customer)
        ├── shared/                  # login, register, auth context, API client, route guard
        ├── customer/                # your original customer app (components, pages, data, utils)
        ├── admin/                   # store admin dashboard (pages, components, admin.css)
        └── assets/                  # your product images (unchanged)
```

**Login flow:** one URL `/login` → backend returns `user.role` →
`customer` goes to `/` (shop), `admin` goes to `/admin` (dashboard).
A customer opening `/admin` is sent back to `/`, and vice versa.

---

## 3. Install & run

### Requirements
- **Python 3.10+**
- **Node.js 20+**
- **MongoDB** – either install MongoDB Community Server locally
  (https://www.mongodb.com/try/download/community) or create a free **MongoDB Atlas** cluster and use its connection string.

### Backend
```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # Windows: copy .env.example .env
# edit .env -> MONGO_URI (local: mongodb://localhost:27017, or your Atlas URI) and JWT_SECRET

python seed.py                # loads demo store + 154 products + demo users
uvicorn app.main:app --reload --port 8000
```
API docs (Swagger): http://localhost:8000/docs

Python packages installed: `fastapi`, `uvicorn[standard]`, `pymongo` (async client), `pydantic`,
`pydantic-settings`, `email-validator`, `PyJWT`, `bcrypt`, `python-dotenv`, `python-multipart`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev
```
Open http://localhost:5173

npm packages: `react`, `react-dom`, `react-router-dom`, `lucide-react` (already in your project) –
no new frontend dependencies were added.

### Demo logins (after `python seed.py`)
| Role | Email | Password |
|------|-------|----------|
| Customer | customer@freshmart.com | customer123 |
| Store admin | admin@freshmart.com | admin123 |

Or create your own from **/register** (choose *Customer* or *Store owner*).

---

## 4. Features built

### Customer (your original UI, now live)
- Register (name, email, mobile, password, delivery address) and login
- Product catalog loaded from MongoDB – categories, search, filters, recommendations all unchanged
- Stock aware: "Only N left", "Sold out", can't add more than stock
- Checkout (address, slot, tip, UPI / card / net banking / COD, coupon `FRESH20`) → real order in DB.
  Backend recalculates the bill (`backend/app/utils/pricing.py`), reserves stock atomically
- Multi-store cart: one checkout is split into one order per store
- Order tracking: Placed → Confirmed → Packed → On the way → Delivered, with timeline
- Cancel (before packing → stock restored, online payment refunded)
- Returns & complaints (damaged, missing item, quality, late, refund) + store replies
- Profile edit, saved addresses, order again

### Store Admin / Shop Owner
- Register with store details (store name, type, GST, timings, address)
- Dashboard: orders to handle, net earnings, low stock, complaints, 7-day chart, recent orders
- Products: add / edit / delete, image upload or URL, price & MRP, quick stock edit, expiry warnings, hide/show
- Orders: tabs (Active, New, Delivered, Returns, Cancelled), accept → pack → dispatch → deliver, reject with reason
- Store open/closed switch (closed stores' products are hidden from customers)
- Store settings, staff management (manager / picker / packer / cashier, shifts)
- Earnings: gross sales, platform commission, net, COD to collect, refunds, daily chart (7/14/30 days)
- Returns & complaints: approve return → order "returned" + refund, reject, reply

> Payments are a **mock gateway** (online methods are marked paid with a transaction id; only the card's
> last 4 digits are stored). Plug Razorpay/Stripe into `order_controller.place_order` for real payments.

---

## 5. Main API endpoints

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/auth/register` · `/api/auth/login` | everyone |
| GET/PUT | `/api/auth/me` | logged in |
| GET | `/api/products` · `/api/stores` · `/api/categories` | public |
| POST/GET | `/api/customer/orders` · `/api/customer/orders/{id}` | customer |
| POST | `/api/customer/orders/{id}/cancel` | customer |
| POST/GET | `/api/customer/complaints` | customer |
| GET | `/api/admin/dashboard` · `/api/admin/earnings` | admin |
| GET/POST/PUT/DELETE | `/api/admin/products[/{pid}]` · PATCH `/stock` | admin |
| POST | `/api/admin/uploads` (image) | admin |
| GET · PATCH | `/api/admin/orders` · `/api/admin/orders/{id}/status` | admin |
| GET/PUT · PATCH | `/api/admin/store` · `/api/admin/store/availability` | admin |
| GET/POST/PUT/DELETE | `/api/admin/staff[/{id}]` | admin |
| GET · PATCH | `/api/admin/complaints` · `/api/admin/complaints/{id}` | admin |

Full interactive docs at `/docs` when the backend is running.

---

## 6. Deploying (when ready)
- Frontend: Vercel (as now). Set env `VITE_API_URL` to your backend URL. `frontend/vercel.json` (included)
  rewrites every path to `index.html`, so `/login`, `/admin` work on refresh (your current deploy 404s on `/login` without it). Set the Vercel project root to `frontend`.
- Backend: Render / Railway / any VPS: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  Set `MONGO_URI` (Atlas), `JWT_SECRET`, and `CORS_ORIGINS=https://your-vercel-domain`.
- Uploaded images are saved to `backend/uploads/`; on hosts without a persistent disk, switch to
  S3 / Cloudinary later.
