# Prompt: eBay-Service Microservice - Requirements Gathering

## Context

We are building an **eBay-Service** microservice to extract all eBay-related functionality from the AirPod Support Tracking Portal monolith into a standalone, reusable service. This follows the same pattern as the existing **AutoRestock User Service** (centralized auth microservice).

### Current Architecture
- **AirPod Support Tracking Portal**: Node.js/Express monolith running on Railway.app with MongoDB
- **AutoRestock User Service**: Existing microservice handling centralized JWT authentication
- **eBay-Service** (new): Will handle all eBay API interactions, data imports, market data, and order management

### Existing eBay Functionality in the Monolith
The portal currently handles eBay integration inline across ~2,500+ lines of server.js, including:
1. **eBay Data Import System** - CSV parsing for purchases and sales, session management, auto-matching, and final import into the main database
2. **eBay Order Tracking** - Linking products to eBay order numbers, search by eBay order
3. **eBay Market Data** - Cached sold listings for price recommendations (ebay_market_data collection)
4. **Manual eBay Prices** - User-entered eBay sold prices for the bid/price calculator
5. **eBay Fee Calculation** - Calculating actual fee percentages from historical eBay sales data
6. **eBay Return Process** - Customer-facing return instructions page, resale workflow
7. **eBay Case Management** - Marking eBay cases as opened, tracking resolution status
8. **Feedback Generation** - AI-generated eBay seller feedback based on purchase quality

---

## Questions to Answer

### 1. Scope & Boundaries

**1.1** Which eBay features should be extracted into the microservice vs. remaining in the portal?
- Should the eBay-Service own the full import pipeline (CSV parse, stage, match, import)?
- Should market data fetching (eBay sold listings scraping/API) live in the service?
- Should manual eBay price management live in the service or remain in the portal?
- Should the eBay return page and customer-facing flows stay in the portal?

**1.2** Will the eBay-Service serve multiple client applications (e.g., other AutoRestock services), or is it exclusively for the AirPod Portal?

**1.3** Should the eBay-Service integrate directly with eBay's official APIs (Browse API, Trading API, Fulfillment API), or continue with CSV-based imports?

---

### 2. eBay API Integration

**2.1** Do we plan to use the eBay Developer Program APIs?
- **Browse API** - Search sold listings, get item details
- **Trading API** - Manage listings, get seller info
- **Fulfillment API** - Order management, shipping
- **Analytics API** - Seller performance data
- **Finances API** - Fee breakdowns, payouts

**2.2** If using eBay APIs, what authentication flow will we use?
- OAuth 2.0 Client Credentials (app-level, no user interaction)
- OAuth 2.0 Authorization Code (user-level, requires seller consent)
- Both depending on the endpoint?

**2.3** What eBay marketplace(s) need to be supported?
- eBay UK (ebay.co.uk) only?
- eBay US (ebay.com)?
- Multiple marketplaces?

**2.4** Do we need real-time eBay notifications (e.g., order placed, item sold, return opened)?
- eBay Platform Notifications?
- Polling-based approach?
- Webhook receiver?

---

### 3. Data & Storage

**3.1** Should the eBay-Service have its own dedicated MongoDB database, or share the portal's database?
- Own database follows microservice best practices (data isolation)
- Shared database is simpler but creates coupling

**3.2** Which collections should migrate to the eBay-Service's ownership?
- `ebay_import_sessions` - Import session tracking
- `ebay_import_purchases` - Staged purchase imports
- `ebay_import_sales` - Staged sales imports
- `ebay_import_matches` - Purchase-to-sale matching
- `ebay_market_data` - Cached eBay sold listings
- `manual_ebay_prices` - Manual price entries for bid calculator

**3.3** How should the eBay-Service communicate completed imports back to the portal?
- Direct database writes to the portal's `purchases`, `sales`, and `products` collections?
- API callbacks to the portal (portal owns its own data)?
- Event-based (message queue)?

**3.4** What data retention policies should apply?
- How long to keep import sessions?
- How long to cache market data before refreshing?
- Should old import sessions be auto-purged?

---

### 4. Service Communication

**4.1** How should the portal call the eBay-Service?
- REST API (same as User Service pattern)?
- Service-to-service auth using `SERVICE_API_KEY` (matching existing pattern)?
- Direct HTTP with JWT validation?

**4.2** Should the eBay-Service call back to the portal, or should data flow be one-directional?
- Portal → eBay-Service (requests data/actions)
- eBay-Service → Portal (pushes completed imports, notifications)
- Bidirectional?

**4.3** What endpoints should the eBay-Service expose?
Proposed endpoint categories:
```
# Import Pipeline
POST   /api/v1/imports/sessions              - Create import session
GET    /api/v1/imports/sessions               - List sessions
GET    /api/v1/imports/sessions/:id           - Get session details
DELETE /api/v1/imports/sessions/:id           - Delete session
POST   /api/v1/imports/sessions/:id/purchases - Upload purchase CSV data
POST   /api/v1/imports/sessions/:id/sales     - Upload sales CSV data
POST   /api/v1/imports/sessions/:id/auto-match - Run auto-matching
POST   /api/v1/imports/sessions/:id/import    - Execute final import
GET    /api/v1/imports/sessions/:id/stats     - Get import statistics

# Market Data
GET    /api/v1/market/sold-listings           - Get eBay sold listings for a SKU
GET    /api/v1/market/price-history           - Price history for a product
POST   /api/v1/market/refresh                 - Force refresh market data cache

# Manual Prices
GET    /api/v1/prices/manual                  - Get saved manual prices
POST   /api/v1/prices/manual                  - Save manual eBay prices
DELETE /api/v1/prices/manual/:id              - Delete manual price entry

# Orders
GET    /api/v1/orders/:orderNumber            - Look up eBay order details
GET    /api/v1/orders/search                  - Search orders

# Fees
GET    /api/v1/fees/calculate                 - Calculate eBay fees for a price
GET    /api/v1/fees/average                   - Get average fee percentage

# Generations/Parts Reference
GET    /api/v1/generations                    - List product generations
```

---

### 5. Price Calculator Integration

**5.1** The portal's bid/price calculator currently:
- Looks up internal sales data for a generation/part type
- Falls back to saved manual eBay prices
- Falls back to real-time eBay market data
- Calculates fee percentages from historical eBay sales

Should the eBay-Service own the full price calculation, or just provide the data for the portal to calculate?

**5.2** Should the eBay-Service proactively fetch and cache market data (scheduled job), or only fetch on demand?

**5.3** How should the eBay search suggestions feature work?
- Currently generates eBay search URLs for missing parts
- Should the service actually perform the search and return results?

---

### 6. Authentication & Security

**6.1** Should the eBay-Service use the same authentication pattern as the User Service?
- JWT validation with shared `JWT_SECRET`
- Service-to-service API key authentication
- Both?

**6.2** Should the eBay-Service connect to the User Service for auth, or be independently authenticated?

**6.3** What access control is needed?
- Admin-only endpoints (import, price management)?
- Public endpoints (market data lookup)?
- Service-to-service only (internal data sync)?

---

### 7. Deployment & Infrastructure

**7.1** Will the eBay-Service be deployed on Railway.app (same as portal)?

**7.2** What environment configuration is needed?
- `MONGODB_URI` - Own database connection
- `EBAY_APP_ID` / `EBAY_CERT_ID` - eBay API credentials (if using official APIs)
- `EBAY_OAUTH_TOKEN` - eBay OAuth token
- `SERVICE_API_KEY` - Service-to-service auth
- `JWT_SECRET` - Token validation
- `USER_SERVICE_URL` - User Service connection
- `PORTAL_CALLBACK_URL` - Portal webhook URL (if bidirectional)

**7.3** What monitoring and logging is required?
- Import success/failure tracking?
- API rate limit monitoring (eBay has strict rate limits)?
- Market data freshness alerts?

---

### 8. Migration Strategy

**8.1** Should we migrate incrementally (feature by feature) or all at once?
- Phase 1: Extract eBay import system
- Phase 2: Extract market data/price features
- Phase 3: Add eBay API integration
- Phase 4: Add real-time features (notifications, auto-sync)

**8.2** How do we handle the transition period where both the portal and the service may need to access the same data?

**8.3** Should the portal maintain a fallback to local eBay functionality if the service is unavailable?

---

### 9. Future Features

**9.1** Are any of these planned for the eBay-Service?
- Automatic listing creation from inventory
- Automatic repricing based on market data
- Order auto-sync (no more CSV imports)
- Return/refund automation
- Multi-account support (multiple eBay seller accounts)
- Cross-platform support (eBay + Vinted + other marketplaces)

**9.2** Should the service be named more generically (e.g., "marketplace-service") to support future platforms beyond eBay?

---

## Summary of Key Decisions Needed

| # | Decision | Options |
|---|----------|---------|
| 1 | Service scope | eBay-only vs. multi-marketplace |
| 2 | eBay API integration | CSV-only vs. official APIs vs. hybrid |
| 3 | Database strategy | Dedicated DB vs. shared DB |
| 4 | Data flow direction | Portal→Service vs. bidirectional |
| 5 | Price calculator ownership | Service calculates vs. service provides data |
| 6 | Migration approach | Incremental vs. big-bang |
| 7 | Authentication pattern | Match User Service pattern vs. independent |
| 8 | Market data strategy | On-demand vs. scheduled caching |
| 9 | Naming | eBay-Service vs. Marketplace-Service |

---

## Technical Stack (Proposed)

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB (dedicated instance) |
| Authentication | JWT + Service API Key |
| eBay Integration | eBay REST APIs (OAuth 2.0) |
| Deployment | Railway.app |
| CSV Parsing | Existing parse logic (extracted from portal) |
| Logging | Structured JSON logging |
| Rate Limiting | Token bucket for eBay API calls |
