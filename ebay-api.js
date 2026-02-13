/**
 * eBay API Integration for Market Price Data
 *
 * Uses the eBay Browse API (item_summary/search) with OAuth2 client credentials
 * to fetch current listing prices. The Finding API (findCompletedItems) was
 * decommissioned by eBay in February 2025.
 *
 * Required env vars:
 *   EBAY_APP_ID     - eBay application client ID
 *   EBAY_CERT_ID    - eBay application client secret
 *   EBAY_MARKETPLACE - marketplace ID (default: EBAY_GB)
 *
 * The Browse API returns active listings. For sold/completed item data,
 * the Marketplace Insights API is required (needs eBay business approval).
 */

const BROWSE_API_BASE = 'https://api.ebay.com/buy/browse/v1';
const OAUTH_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const OAUTH_SCOPE = 'https://api.ebay.com/oauth/api_scope';

const config = {
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  marketplace: process.env.EBAY_MARKETPLACE || 'EBAY_GB',
};

// Cached OAuth token
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get an OAuth2 access token using client credentials grant.
 */
async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  if (!config.appId || !config.certId) {
    throw new Error('EBAY_APP_ID and EBAY_CERT_ID are required for OAuth2');
  }

  const credentials = Buffer.from(`${config.appId}:${config.certId}`).toString('base64');

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(OAUTH_SCOPE)}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token error (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

/**
 * Search eBay active listings via the Browse API.
 * Returns currently listed items (not sold items - that requires Marketplace Insights API).
 */
async function searchSoldListings(keywords, options = {}) {
  if (!config.appId || !config.certId) {
    throw new Error('EBAY_APP_ID and EBAY_CERT_ID not configured');
  }

  const {
    maxResults = 50,
    sortOrder = 'price',
    categoryId = null,
    minPrice = null,
    maxPrice = null,
  } = options;

  const token = await getAccessToken();

  // Build query parameters
  const params = new URLSearchParams({
    q: keywords,
    limit: String(Math.min(maxResults, 200)),
  });

  // Sort mapping
  const sortMap = {
    'EndTimeSoonest': 'endingSoonest',
    'price': 'price',
    '-price': '-price',
    'newlyListed': 'newlyListed',
  };
  params.set('sort', sortMap[sortOrder] || 'price');

  // Build filters
  const filters = [];

  const currency = config.marketplace === 'EBAY_GB' ? 'GBP' : 'USD';

  if (minPrice !== null && maxPrice !== null) {
    filters.push(`price:[${minPrice}..${maxPrice}],priceCurrency:${currency}`);
  } else if (minPrice !== null) {
    filters.push(`price:[${minPrice}],priceCurrency:${currency}`);
  } else if (maxPrice !== null) {
    filters.push(`price:[..${maxPrice}],priceCurrency:${currency}`);
  }

  // Include both Buy It Now and auction
  filters.push('buyingOptions:{FIXED_PRICE|AUCTION}');

  if (categoryId) {
    params.set('category_ids', categoryId);
  }

  if (filters.length > 0) {
    params.set('filter', filters.join(','));
  }

  const url = `${BROWSE_API_BASE}/item_summary/search?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': config.marketplace,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay Browse API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return parseBrowseSearchResponse(data);
}

/**
 * Parse the Browse API search response into our standard format.
 */
function parseBrowseSearchResponse(data) {
  const items = (data.itemSummaries || []).map(item => {
    const price = parseFloat(item.price?.value || '0');
    const currencyId = item.price?.currency || 'GBP';
    const endTime = item.itemEndDate || null;
    const conditionName = item.condition || item.conditionId || 'Unknown';
    const title = item.title || '';
    const itemId = item.itemId || '';
    const itemUrl = item.itemWebUrl || '';

    return {
      item_id: itemId,
      title,
      sold_price: price,
      currency: currencyId,
      selling_state: 'Active',
      sold_date: endTime ? new Date(endTime) : new Date(),
      condition: conditionName,
      url: itemUrl,
    };
  });

  return {
    success: true,
    total_results: data.total || items.length,
    items_returned: items.length,
    items,
  };
}

/**
 * Build an AirPod-specific search query for a generation/part.
 */
function buildAirPodSearchQuery(generation, partType, connectorType) {
  const partTerms = {
    'left': 'left earbud',
    'right': 'right earbud',
    'case': 'charging case',
  };

  const partTerm = partTerms[partType] || partType;
  let query = generation;
  if (connectorType) {
    query += ` ${connectorType}`;
  }
  query += ` ${partTerm}`;
  return query;
}

/**
 * Fetch active listing market prices for a specific AirPod part.
 * Returns price statistics and individual listings.
 */
async function fetchMarketPrices(generation, partType, options = {}) {
  const {
    connectorType = null,
    maxResults = 25,
    minPrice = 1,
    maxPrice = 200,
  } = options;

  const query = buildAirPodSearchQuery(generation, partType, connectorType);

  const result = await searchSoldListings(query, {
    maxResults,
    minPrice,
    maxPrice,
    sortOrder: 'price',
  });

  if (!result.success) {
    return { success: false, query, error: result.error, items_found: 0 };
  }

  if (result.items.length === 0) {
    return { success: false, query, error: 'No listings found', items_found: 0 };
  }

  const prices = result.items.map(i => i.sold_price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    success: true,
    query,
    generation,
    part_type: partType,
    connector_type: connectorType,
    items_found: result.items.length,
    total_available: result.total_results,
    price_stats: {
      avg_price: Math.round(avg * 100) / 100,
      median_price: Math.round(median * 100) / 100,
      min_price: Math.round(Math.min(...prices) * 100) / 100,
      max_price: Math.round(Math.max(...prices) * 100) / 100,
      currency: result.items[0]?.currency || 'GBP',
    },
    date_range: { newest: new Date(), oldest: new Date() },
    listings: result.items,
  };
}

/**
 * Check whether the eBay API is configured (both App ID and Cert ID needed for OAuth).
 */
function isConfigured() {
  return !!(config.appId && config.certId);
}

function getStatus() {
  return {
    configured: isConfigured(),
    marketplace: config.marketplace,
    has_app_id: !!config.appId,
    has_cert_id: !!config.certId,
  };
}

module.exports = {
  searchSoldListings,
  fetchMarketPrices,
  buildAirPodSearchQuery,
  isConfigured,
  getStatus,
};
