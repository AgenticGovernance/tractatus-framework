/**
 * Validation Middleware
 * Input validation and sanitization
 */

const validator = require('validator');
const sanitizeHtml = require('sanitize-html');

/**
 * Validate email
 * Supports nested fields: validateEmail('contact.email')
 */
function validateEmail(fieldPath = 'email') {
  return (req, res, next) => {
    // Get value from nested path (e.g., 'contact.email')
    const getValue = (obj, path) => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    // Set value at nested path
    const setValue = (obj, path, value) => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
      }, obj);
      target[lastKey] = value;
    };

    const email = getValue(req.body, fieldPath);

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Valid email address is required for ${fieldPath}`
      });
    }

    // Normalize email
    const normalized = validator.normalizeEmail(email);
    setValue(req.body, fieldPath, normalized);

    next();
  };
}

/**
 * Validate required fields
 * Supports nested fields: validateRequired(['contact.name', 'contact.email'])
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];

    // Get value from nested path (e.g., 'contact.email')
    const getValue = (obj, path) => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    for (const field of fields) {
      const value = getValue(req.body, field);

      if (value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '')) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Required fields missing',
        missing: missing
      });
    }

    next();
  };
}

/**
 * Sanitize string inputs
 */
function sanitizeInputs(req, res, next) {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return validator.escape(str.trim());
  };

  const sanitizeObject = (obj) => {
    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  };

  req.body = sanitizeObject(req.body);

  next();
}

/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id || !validator.isMongoId(id)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid ID format'
      });
    }

    next();
  };
}

/**
 * Validate slug format
 */
function validateSlug(req, res, next) {
  const { slug } = req.body;

  if (!slug) {
    return next();
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugRegex.test(slug)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Slug must be lowercase letters, numbers, and hyphens only'
    });
  }

  next();
}

/**
 * Validate URL
 */
function validateUrl(fieldName = 'url') {
  return (req, res, next) => {
    const url = req.body[fieldName];

    if (!url || !validator.isURL(url, { require_protocol: true })) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Valid URL required for ${fieldName}`
      });
    }

    next();
  };
}

/**
 * Sanitize HTML content
 */
function sanitizeContent(fieldName = 'content') {
  return (req, res, next) => {
    const content = req.body[fieldName];

    if (!content) {
      return next();
    }

    req.body[fieldName] = sanitizeHtml(content, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'u', 'code', 'pre',
        'a', 'img',
        'ul', 'ol', 'li',
        'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      allowedAttributes: {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title'],
        'code': ['class'],
        'pre': ['class']
      }
    });

    next();
  };
}

module.exports = {
  validateEmail,
  validateRequired,
  sanitizeInputs,
  validateObjectId,
  validateSlug,
  validateUrl,
  sanitizeContent
};
