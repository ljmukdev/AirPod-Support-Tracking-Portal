# eBay-Service Microservice - Requirements Gathering Prompt

Copy everything below the line and paste into your AI chat.

---

I need your help designing an eBay-Service microservice. I'm going to give you the full context of my current system, then I need you to ask me the right questions so we can define the scope, architecture, and implementation plan.

CONTEXT:

I run an AirPod Support Tracking Portal - a Node.js/Express monolith on Railway.app with MongoDB. It manages AirPod replacement parts inventory, warranty registration, customer support, purchases, sales, and returns. I already have one microservice extracted: an AutoRestock User Service that handles centralized JWT authentication across my services using service-to-service API keys.

The portal currently has roughly 2,500+ lines of eBay-related code baked directly into the monolith (server.js). I want to extract all of this into a dedicated eBay-Service microservice, following the same pattern as the User Service.

Here is everything the portal currently does with eBay:

1. eBay Data Import System - A full CSV import pipeline where I upload eBay purchase and sales CSV exports. It parses the CSVs (handling both UK and US date/price formats), stages them into temporary collections (ebay_import_sessions, ebay_import_purchases, ebay_import_sales), runs auto-matching to pair purchases with their corresponding sales, allows manual review and editing, then imports the matched data into my main purchases, products, and sales collections. It also handles unmatched purchases and unmatched sales separately.

2. eBay Order Tracking - Every product in my inventory can have an ebay_order_number field. I can search products by eBay order number, link products to their eBay purchase orders, and track which eBay order each product came from.

3. eBay Market Data - I have an ebay_market_data collection that caches eBay sold listings data. This feeds into my price recommender/bid calculator to help me know what to bid on purchases based on what things sell for on eBay.

4. Manual eBay Prices - When automated market data is not available or stale, I manually enter eBay sold prices (from searching eBay completed listings). These are stored in a manual_ebay_prices collection and are used by the bid calculator. They get superseded automatically when I have 5+ new internal sales since the manual price was entered.

5. eBay Fee Calculation - The bid calculator analyses my last 50 eBay sales to calculate the actual average fee percentage (transaction fees + ad fees), rather than using a hardcoded estimate. This gives me accurate profit projections.

6. eBay Return Process - A customer-facing page (ebay-return.html) that guides customers through returning items via eBay's return system. Also a resale workflow where returned items get relisted with new eBay order numbers.

7. eBay Case Management - When I have issues with eBay purchases from suppliers, I can mark eBay cases as opened on check-ins, track resolution status, and manage refund verification workflows. The system knows not to request seller feedback while an eBay case is still open.

8. Feedback Generation - AI-generated (Anthropic Claude) eBay/Vinted seller feedback based on the quality assessment of purchases. It generates platform-appropriate feedback (e.g. "A+++" style for eBay).

The existing MongoDB collections related to eBay are:
- ebay_import_sessions (import session tracking)
- ebay_import_purchases (staged purchase imports from CSV)
- ebay_import_sales (staged sales imports from CSV)
- ebay_import_matches (purchase-to-sale auto-matching)
- ebay_market_data (cached eBay sold listings for price recommendations)
- manual_ebay_prices (user-entered eBay sold prices for the bid calculator)

The portal also uses eBay data across these main collections:
- products (ebay_order_number field on each product)
- purchases (platform field set to "eBay", order_number tracking)
- sales (platform "eBay", transaction_fees, ad fees, profit calculations)
- check_ins (eBay case opened/resolved status)

My existing service-to-service auth pattern works like this: the portal stores a SERVICE_API_KEY and SERVICE_NAME. When it needs something from the User Service, it makes HTTP requests with Authorization: Bearer {SERVICE_API_KEY} and an X-Service-Name header. The User Service validates the key and returns the requested data (like the shared JWT_SECRET). The portal is deployed on Railway.app and the User Service is also on Railway.app.

The portal's tech stack is: Node.js, Express.js, MongoDB (v6.3.0), JWT (jsonwebtoken), Multer for file uploads, Nodemailer for email, Stripe for payments, Anthropic AI SDK for feedback generation, and Tesseract.js for OCR. The frontend is vanilla JavaScript with no framework.

WHAT I NEED FROM YOU:

Based on all of this context, please ask me the questions you need answered to design this eBay-Service microservice. Organise your questions into clear categories. Focus on:

- What should be extracted vs. what should stay in the portal
- Whether to use eBay's official APIs or continue with CSV imports
- Database strategy (own database vs. shared)
- How the portal and eBay-Service should communicate
- How the bid/price calculator should work across the two services
- Authentication and security approach
- Migration strategy (incremental vs. all-at-once)
- Whether to design it as eBay-only or as a generic marketplace service for future expansion (I also sell on Vinted)
- Deployment and infrastructure considerations
- What the API endpoint structure should look like

Ask me one category at a time so we can work through each area thoroughly. Start with the most fundamental decisions first (scope and boundaries), then work towards the implementation details.
