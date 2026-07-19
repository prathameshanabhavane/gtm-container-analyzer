/**
 * GTM Structure Validator
 * 
 * Validates GTM container structure and provides helpful error types
 * for graceful error handling when format changes occur.
 * 
 * DEVELOPER NOTE:
 * If validation fails after a GTM update, check these sections:
 * - containerVersion structure: validateGTMStructure()
 * - Google API responses: validateGoogleAPIResponse()
 * 
 * This file is standalone and imported directly where needed
 * to avoid breaking existing utils exports.
 */

/**
 * Validate GTM container structure
 * Returns { valid: boolean, errorType: string, errorCode: string, errorDetails: string }
 */
export const validateGTMStructure = (data) => {
  try {
    // Check if data exists
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errorType: 'parse_error',
        errorCode: 'INVALID_DATA',
        errorDetails: 'Data is null, undefined, or not an object'
      };
    }

    // Check for containerVersion (required)
    if (!data.containerVersion) {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'MISSING_CONTAINER_VERSION',
        errorDetails: 'Missing "containerVersion" field. This may not be a GTM export file.'
      };
    }

    const cv = data.containerVersion;

    // Check containerVersion type
    if (typeof cv !== 'object') {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'INVALID_CONTAINER_VERSION',
        errorDetails: '"containerVersion" should be an object'
      };
    }

    // Check for container info
    if (!cv.container) {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'MISSING_CONTAINER',
        errorDetails: 'Missing "containerVersion.container" field'
      };
    }

    // Check tags array (can be empty but should be array if exists)
    if (cv.tag !== undefined && !Array.isArray(cv.tag)) {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'INVALID_TAGS',
        errorDetails: '"containerVersion.tag" should be an array'
      };
    }

    // Check triggers array
    if (cv.trigger !== undefined && !Array.isArray(cv.trigger)) {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'INVALID_TRIGGERS',
        errorDetails: '"containerVersion.trigger" should be an array'
      };
    }

    // Check variables array
    if (cv.variable !== undefined && !Array.isArray(cv.variable)) {
      return {
        valid: false,
        errorType: 'gtm_format',
        errorCode: 'INVALID_VARIABLES',
        errorDetails: '"containerVersion.variable" should be an array'
      };
    }

    // All checks passed
    return {
      valid: true,
      errorType: null,
      errorCode: null,
      errorDetails: null
    };

  } catch (error) {
    return {
      valid: false,
      errorType: 'parse_error',
      errorCode: 'VALIDATION_ERROR',
      errorDetails: `Validation error: ${error.message}`
    };
  }
};

/**
 * Validate Google API response structure
 * Used when fetching containers via OAuth
 */
export const validateGoogleAPIResponse = (response, expectedType) => {
  try {
    if (!response) {
      return {
        valid: false,
        errorType: 'google_api',
        errorCode: 'EMPTY_RESPONSE',
        errorDetails: 'Google API returned empty response'
      };
    }

    switch (expectedType) {
      case 'accounts':
        if (!response.account && !Array.isArray(response)) {
          return {
            valid: false,
            errorType: 'google_api',
            errorCode: 'INVALID_ACCOUNTS_RESPONSE',
            errorDetails: 'Accounts response structure changed'
          };
        }
        break;

      case 'containers':
        if (!response.container && !Array.isArray(response)) {
          return {
            valid: false,
            errorType: 'google_api',
            errorCode: 'INVALID_CONTAINERS_RESPONSE',
            errorDetails: 'Containers response structure changed'
          };
        }
        break;

      case 'container_version':
        if (!response.containerVersion && !response.tag) {
          return {
            valid: false,
            errorType: 'google_api',
            errorCode: 'INVALID_VERSION_RESPONSE',
            errorDetails: 'Container version response structure changed'
          };
        }
        break;

      default:
        break;
    }

    return {
      valid: true,
      errorType: null,
      errorCode: null,
      errorDetails: null
    };

  } catch (error) {
    return {
      valid: false,
      errorType: 'google_api',
      errorCode: 'API_VALIDATION_ERROR',
      errorDetails: `API validation error: ${error.message}`
    };
  }
};

/**
 * Parse JSON safely with error handling
 */
export const safeJSONParse = (text, filename = 'file') => {
  try {
    return {
      success: true,
      data: JSON.parse(text),
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        errorType: 'parse_error',
        errorCode: 'JSON_PARSE_ERROR',
        errorDetails: `Failed to parse ${filename}: ${error.message}`
      }
    };
  }
};

/**
 * Extract MJS export safely
 */
export const extractMJSExport = (text, filename = 'file') => {
  try {
    const match = text.match(/export\s+const\s+data\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match) {
      return {
        success: false,
        data: null,
        error: {
          errorType: 'parse_error',
          errorCode: 'INVALID_MJS_FORMAT',
          errorDetails: `Invalid .mjs format in ${filename}. Expected: export const data = {...}`
        }
      };
    }
    return safeJSONParse(match[1], filename);
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        errorType: 'parse_error',
        errorCode: 'MJS_EXTRACT_ERROR',
        errorDetails: `Failed to extract data from ${filename}: ${error.message}`
      }
    };
  }
};

/**
 * Create error object for format change modal
 */
export const createFormatError = (type, code, details) => ({
  errorType: type,
  errorCode: code,
  errorDetails: details
});
