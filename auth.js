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
  serviceName: process.env.SERVICE_NAME || 'AirPod-Support-Tracking-Portal'
};

if (!config.jwtSecret) {
  console.warn('⚠️  JWT_SECRET not set - authentication will fail');
  console.warn('   Set JWT_SECRET environment variable to match User Service');
}

function init(options = {}) {
  if (options.jwtSecret) config.jwtSecret = options.jwtSecret;
  if (options.userServiceUrl) config.userServiceUrl = options.userServiceUrl;
  if (options.serviceName) config.serviceName = options.serviceName;

  if (!config.jwtSecret) {
    console.warn('⚠️  JWT_SECRET not set - authentication will fail');
    console.warn('   Set JWT_SECRET environment variable or pass it to init()');
  }
}

function requireAuth() {
  return (req, res, next) => {
    if (!config.jwtSecret) {
      return res.status(500).json({
        error: 'AUTH_CONFIG_ERROR',
        message: 'JWT_SECRET not configured. Set JWT_SECRET environment variable.'
      });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No authorization token provided'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header. Expected: Bearer <token>'
      });
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

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        });
      }

      console.error('Authentication error:', error);
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
  getTokenExpiration
};

