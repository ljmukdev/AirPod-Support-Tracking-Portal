/**
 * @autorestock/auth
 * 
 * Simple authentication middleware for AutoRestock microservices
 * Downloaded from: https://autorestock-user-service-production.up.railway.app/api/v1/integration/auth.js
 */

const jwt = require('jsonwebtoken');

// Configuration
const config = {
  jwtSecret: process.env.JWT_SECRET,
  userServiceUrl: process.env.USER_SERVICE_URL || 'https://autorestock-user-service-production.up.railway.app',
  serviceName: process.env.SERVICE_NAME || 'AirPod-Support-Tracking-Portal',
  serviceApiKey: process.env.SERVICE_API_KEY
};

// Track if we've attempted to fetch JWT_SECRET
let jwtSecretFetchAttempted = false;
let jwtSecretFetchPromise = null;

if (!config.jwtSecret) {
  console.warn('⚠️  JWT_SECRET not set - will attempt to fetch from User Service');
  console.warn('   Set JWT_SECRET environment variable to skip auto-fetch');
}

// Fetch JWT_SECRET from User Service
async function fetchJwtSecretFromUserService(retryCount = 0, maxRetries = 3) {
  const { userServiceUrl, serviceApiKey, serviceName } = config;

  if (!serviceApiKey) {
    throw new Error('SERVICE_API_KEY not configured - cannot fetch JWT_SECRET from User Service');
  }

  try {
    console.log(`[AUTH] Fetching JWT_SECRET from User Service (attempt ${retryCount + 1}/${maxRetries + 1})...`);

    const response = await fetch(`${userServiceUrl}/api/v1/services/config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
        'X-Service-Name': serviceName,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.jwtSecret) {
      throw new Error('Invalid response from User Service: jwtSecret not found');
    }

    config.jwtSecret = data.data.jwtSecret;
    console.log('[AUTH] ✅ JWT_SECRET fetched successfully from User Service');
    return data.data.jwtSecret;

  } catch (error) {
    console.error(`[AUTH] Failed to fetch JWT_SECRET (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

    // Retry with exponential backoff
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`[AUTH] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchJwtSecretFromUserService(retryCount + 1, maxRetries);
    }

    throw new Error(`Failed to fetch JWT_SECRET after ${maxRetries + 1} attempts: ${error.message}`);
  }
}

// Initialize JWT_SECRET (fetch from User Service if needed)
async function ensureJwtSecret() {
  // If already set, no need to fetch
  if (config.jwtSecret) {
    return config.jwtSecret;
  }

  // If already attempting to fetch, wait for that promise
  if (jwtSecretFetchPromise) {
    return jwtSecretFetchPromise;
  }

  // If already attempted and failed, don't retry
  if (jwtSecretFetchAttempted && !config.jwtSecret) {
    throw new Error('JWT_SECRET fetch previously failed - manual configuration required');
  }

  // Mark that we're attempting to fetch
  jwtSecretFetchAttempted = true;

  // Start fetching
  jwtSecretFetchPromise = fetchJwtSecretFromUserService()
    .then(secret => {
      jwtSecretFetchPromise = null; // Clear promise
      return secret;
    })
    .catch(error => {
      jwtSecretFetchPromise = null; // Clear promise
      throw error;
    });

  return jwtSecretFetchPromise;
}

function init(options = {}) {
  if (options.jwtSecret) config.jwtSecret = options.jwtSecret;
  if (options.userServiceUrl) config.userServiceUrl = options.userServiceUrl;
  if (options.serviceName) config.serviceName = options.serviceName;
  if (options.serviceApiKey) config.serviceApiKey = options.serviceApiKey;

  if (!config.jwtSecret && !config.serviceApiKey) {
    console.warn('⚠️  JWT_SECRET not set and SERVICE_API_KEY not configured');
    console.warn('   Either set JWT_SECRET directly or set SERVICE_API_KEY to fetch from User Service');
  }
}

function requireAuth() {
  return async (req, res, next) => {
    console.log('[JWT] Validating JWT token...');

    // Ensure JWT_SECRET is available (fetch if needed)
    try {
      await ensureJwtSecret();
    } catch (error) {
      console.error('[JWT] ❌ JWT_SECRET not available:', error.message);
      return res.status(500).json({
        error: 'AUTH_CONFIG_ERROR',
        message: 'JWT_SECRET not configured. Set JWT_SECRET environment variable or SERVICE_API_KEY to fetch from User Service.'
      });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.error('[JWT] ❌ No authorization header');
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No authorization token provided'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.error('[JWT] ❌ Invalid authorization header format');
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header. Expected: Bearer <token>'
      });
    }

    const token = parts[1];
    console.log(`[JWT] Token received: ${token.substring(0, 20)}...`);

    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        audience: 'autorestock-microservices',
        issuer: 'autorestock-user-service'
      });

      console.log(`[JWT] ✅ Token valid - User: ${decoded.email}, Level: ${decoded.userLevel}`);

      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        tenantId: decoded.tenantId,
        userLevel: decoded.userLevel || 'standard',
        isMaster: decoded.userLevel === 'master' || decoded.isMaster || false
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.error('[JWT] ❌ Token expired');
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        console.error('[JWT] ❌ Invalid token:', error.message);
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        });
      }

      console.error('[JWT] ❌ Authentication error:', error);
      return res.status(401).json({
        error: 'AUTH_ERROR',
        message: 'Authentication failed'
      });
    }
  };
}

function requireLevel(level) {
  const levels = { 'standard': 1, 'managing': 2, 'master': 3 };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const userLevel = levels[req.user.userLevel] || 0;
    const required = levels[level] || 0;

    if (userLevel < required) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `This endpoint requires ${level} level access`
      });
    }

    next();
  };
}

function requireMaster() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (req.user.userLevel !== 'master' && !req.user.isMaster) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Master/admin access required'
      });
    }

    next();
  };
}

function optionalAuth() {
  return (req, res, next) => {
    if (!config.jwtSecret) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        audience: 'autorestock-microservices',
        issuer: 'autorestock-user-service'
      });

      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        tenantId: decoded.tenantId,
        userLevel: decoded.userLevel || 'standard',
        isMaster: decoded.userLevel === 'master' || decoded.isMaster || false
      };
    } catch (error) {
      // Silently fail for optional auth
    }

    next();
  };
}

function getUserFromToken(token) {
  if (!config.jwtSecret || !token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      audience: 'autorestock-microservices',
      issuer: 'autorestock-user-service'
    });

    return {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      tenantId: decoded.tenantId,
      userLevel: decoded.userLevel || 'standard',
      isMaster: decoded.userLevel === 'master' || decoded.isMaster || false
    };
  } catch (error) {
    return null;
  }
}

async function login(email, password, serviceName = null) {
  const url = `${config.userServiceUrl}/api/v1/users/login`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      serviceName: serviceName || config.serviceName
    })
  });

  const data = await response.json();

  if (response.ok && data.success) {
    return {
      success: true,
      user: data.data.user,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      expiresIn: data.data.expiresIn
    };
  } else {
    throw new Error(data.message || data.error || 'Login failed');
  }
}

async function refreshToken(refreshTokenValue) {
  const url = `${config.userServiceUrl}/api/v1/auth/refresh`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: refreshTokenValue
    })
  });

  const data = await response.json();

  if (response.ok && data.success) {
    return {
      success: true,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken || refreshTokenValue,
      expiresIn: data.data.expiresIn
    };
  } else {
    throw new Error(data.message || data.error || 'Token refresh failed');
  }
}

function isTokenExpired(token) {
  if (!token) return true;

  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;
    
    const now = Date.now() / 1000;
    return decoded.exp < now;
  } catch (error) {
    return true;
  }
}

function getTokenExpiration(token) {
  if (!token) return null;

  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
}

module.exports = {
  init,
  config,
  requireAuth,
  requireLevel,
  requireMaster,
  optionalAuth,
  getUserFromToken,
  login,
  refreshToken,
  isTokenExpired,
  getTokenExpiration,
  ensureJwtSecret,
  fetchJwtSecretFromUserService
};

