/**
 * eBay API Integration for Market Price Data
 *
 * Uses the eBay Finding API (findCompletedItems) to fetch sold listing prices.
 * Used by the bid calculator / price recommender to get real eBay market data
 * instead of requiring manual price entry.
 */

const FINDING_API_URL = 'https://svcs.ebay.com/services/search/FindingService/v1';

const config = {
  appId: process.env.EBAY_APP_ID,
  marketplace: process.env.EBAY_MARKETPLACE || 'EBAY-GB',
};

/**
 * Search eBay completed/sold listings via the Finding API.
 * Returns only items that actually sold (EndedWithSales).
 */
async function searchSoldListings(keywords, options = {}) {
  if (!config.appId) {
    throw new Error('EBAY_APP_ID not configured - register at developer.ebay.com');
  }

  const {
    maxResults = 50,
    sortOrder = 'EndTimeSoonest',
    categoryId = null,
    minPrice = null,
    maxPrice = null,
  } = options;

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': config.appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': keywords,
    'GLOBAL-ID': config.marketplace,
    'paginationInput.entriesPerPage': String(Math.min(maxResults, 100)),
    'sortOrder': sortOrder,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
  });

  let filterIndex = 1;

  if (categoryId) {
    params.set('categoryId', categoryId);
  }

  const currency = config.marketplace === 'EBAY-GB' ? 'GBP' : 'USD';

  if (minPrice !== null) {
    params.set(`itemFilter(${filterIndex}).name`, 'MinPrice');
    params.set(`itemFilter(${filterIndex}).value`, String(minPrice));
    params.set(`itemFilter(${filterIndex}).paramName`, 'Currency');
    params.set(`itemFilter(${filterIndex}).paramValue`, currency);
    filterIndex++;
  }

  if (maxPrice !== null) {
    params.set(`itemFilter(${filterIndex}).name`, 'MaxPrice');
    params.set(`itemFilter(${filterIndex}).value`, String(maxPrice));
    params.set(`itemFilter(${filterIndex}).paramName`, 'Currency');
    params.set(`itemFilter(${filterIndex}).paramValue`, currency);
    filterIndex++;
  }

  const url = `${FINDING_API_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseCompletedItemsResponse(data);
}

/**
 * Parse the Finding API findCompletedItems response.
 */
function parseCompletedItemsResponse(data) {
  const response = data?.findCompletedItemsResponse?.[0];

  if (!response) {
    return { success: false, error: 'Invalid API response', items: [] };
  }

  const ack = response.ack?.[0];
  if (ack !== 'Success') {
    const errorMessage = response.errorMessage?.[0]?.error?.[0]?.message?.[0] || 'Unknown error';
    return { success: false, error: errorMessage, items: [] };
  }

  const searchResult = response.searchResult?.[0];
  const totalResults = parseInt(response.paginationOutput?.[0]?.totalEntries?.[0] || '0');

  const items = (searchResult?.item || []).map(item => {
    const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0');
    const currencyId = item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'GBP';
    const sellingState = item.sellingStatus?.[0]?.sellingState?.[0] || '';
    const endTime = item.listingInfo?.[0]?.endTime?.[0] || null;
    const conditionName = item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown';
    const title = item.title?.[0] || '';
    const itemId = item.itemId?.[0] || '';
    const itemUrl = item.viewItemURL?.[0] || '';

    return {
      item_id: itemId,
      title,
      sold_price: price,
      currency: currencyId,
      selling_state: sellingState,
      sold_date: endTime ? new Date(endTime) : null,
      condition: conditionName,
      url: itemUrl,
    };
  });

  // Only include items that actually sold
  const soldItems = items.filter(item => item.selling_state === 'EndedWithSales');

  return {
    success: true,
    total_results: totalResults,
    items_returned: soldItems.length,
    items: soldItems,
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
 * Fetch sold-listing market prices for a specific AirPod part.
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
    sortOrder: 'EndTimeSoonest',
  });

  if (!result.success) {
    return { success: false, query, error: result.error, items_found: 0 };
  }

  if (result.items.length === 0) {
    return { success: false, query, error: 'No sold listings found', items_found: 0 };
  }

  const prices = result.items.map(i => i.sold_price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const dates = result.items.filter(i => i.sold_date).map(i => new Date(i.sold_date));
  const newest = dates.length > 0 ? new Date(Math.max(...dates)) : null;
  const oldest = dates.length > 0 ? new Date(Math.min(...dates)) : null;

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
    date_range: { newest, oldest },
    listings: result.items,
  };
}

/**
 * Check whether the eBay API is configured.
 */
function isConfigured() {
  return !!config.appId;
}

function getStatus() {
  return {
    configured: isConfigured(),
    marketplace: config.marketplace,
    has_app_id: !!config.appId,
  };
}

module.exports = {
  searchSoldListings,
  fetchMarketPrices,
  buildAirPodSearchQuery,
  isConfigured,
  getStatus,
};
