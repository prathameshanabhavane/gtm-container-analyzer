/**
 * Tag Validation Rules Engine
 * 
 * Validates captured tag parameters against best-practice rules.
 * Returns actionable warnings & errors for the dashboard UI.
 * 
 * Severity levels:
 *   - error:   Tag will not work / data will be lost
 *   - warning: Tag works but data may be inaccurate
 *   - info:    Best practice suggestion
 */

// ============================================
// SHARED HELPERS
// ============================================

const ISO_4217_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'BRL',
    'KRW', 'MXN', 'RUB', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'IDR',
    'TRY', 'SAR', 'AED', 'HKD', 'SGD', 'TWD', 'NZD', 'CZK', 'HUF', 'ILS',
    'CLP', 'PHP', 'MYR', 'COP', 'ARS', 'VND', 'EGP', 'NGN', 'PKR', 'BDT',
    'UAH', 'RON', 'PEN', 'BGN', 'HRK', 'LKR', 'KES', 'QAR', 'KWD', 'BHD',
]);

const isNumeric = (val) => {
    if (val === null || val === undefined || val === '') return false;
    return !isNaN(Number(val));
};

const isEmpty = (val) => val === null || val === undefined || val === '' || val === 'undefined' || val === 'null';

const hasParam = (params, key) => !isEmpty(params?.[key]);

// ============================================
// GA4 RULES (Google Analytics 4)
// ============================================

const GA4_RULES = [
    {
        id: 'ga4_missing_measurement_id',
        check: (params) => {
            if (!hasParam(params, '_measurement_id')) {
                return { severity: 'error', message: 'Missing measurement ID (G-XXXXXXX). Tag will not send data to any GA4 property.' };
            }
            const id = params._measurement_id;
            if (!String(id).match(/^G-[A-Z0-9]+$/i)) {
                return { severity: 'warning', message: `Measurement ID "${id}" doesn't match expected format G-XXXXXXX.` };
            }
            return null;
        }
    },
    {
        id: 'ga4_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'warning', message: 'No event name detected. GA4 requires an event name for each hit.' };
            }
            return null;
        }
    },
    {
        id: 'ga4_missing_client_id',
        check: (params) => {
            if (!hasParam(params, '_client_id')) {
                return { severity: 'warning', message: 'Missing client_id. GA4 uses client_id to identify users across sessions.' };
            }
            return null;
        }
    },
    {
        id: 'ga4_missing_session_id',
        check: (params) => {
            if (!hasParam(params, '_session_id')) {
                return { severity: 'info', message: 'No session_id detected. Session tracking may not be working.' };
            }
            return null;
        }
    },
    {
        id: 'ga4_purchase_missing_value',
        check: (params) => {
            const eventName = params?._event_name;
            if (eventName === 'purchase' && !hasParam(params, 'value') && !hasParam(params, 'revenue')) {
                return { severity: 'error', message: 'Purchase event is missing "value" parameter. Revenue will not be tracked.' };
            }
            return null;
        }
    },
    {
        id: 'ga4_purchase_missing_currency',
        check: (params) => {
            const eventName = params?._event_name;
            if (eventName === 'purchase' && hasParam(params, 'value') && !hasParam(params, 'currency')) {
                return { severity: 'error', message: 'Purchase has "value" but no "currency". GA4 requires currency with monetary values.' };
            }
            return null;
        }
    },
    {
        id: 'ga4_invalid_currency',
        check: (params) => {
            if (hasParam(params, 'currency')) {
                const currency = String(params.currency).toUpperCase();
                if (!ISO_4217_CURRENCIES.has(currency)) {
                    return { severity: 'warning', message: `Currency "${params.currency}" is not a valid ISO 4217 code (expected: USD, EUR, GBP, etc.)` };
                }
            }
            return null;
        }
    },
    {
        id: 'ga4_value_not_numeric',
        check: (params) => {
            if (hasParam(params, 'value') && !isNumeric(params.value)) {
                return { severity: 'error', message: `Value "${params.value}" is not numeric. GA4 requires numeric values for revenue.` };
            }
            return null;
        }
    },
    {
        id: 'ga4_ecommerce_missing_items',
        check: (params) => {
            const ecommerceEvents = ['purchase', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'view_item', 'view_item_list', 'select_item'];
            if (ecommerceEvents.includes(params?._event_name) && !hasParam(params, 'items')) {
                return { severity: 'warning', message: `E-commerce event "${params._event_name}" is missing "items" array. Product data will not be captured.` };
            }
            return null;
        }
    },
    {
        id: 'ga4_items_missing_id_or_name',
        check: (params) => {
            const items = params?.items;
            if (items && Array.isArray(items) && items.length > 0) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (!item.item_id && !item.item_name) {
                        return { severity: 'error', message: `Item at index ${i} is missing both "item_id" and "item_name". GA4 requires at least one.` };
                    }
                }
            }
            return null;
        }
    },
    {
        id: 'ga4_purchase_missing_transaction_id',
        check: (params) => {
            if (params?._event_name === 'purchase' && !hasParam(params, 'transaction_id')) {
                return { severity: 'error', message: 'Purchase event is missing "transaction_id". GA4 cannot deduplicate purchases without it.' };
            }
            return null;
        }
    },
];

// ============================================
// META PIXEL RULES (Facebook)
// ============================================

const META_RULES = [
    {
        id: 'meta_missing_pixel_id',
        check: (params) => {
            if (!hasParam(params, '_pixel_id')) {
                return { severity: 'error', message: 'Missing Meta Pixel ID. Events will not be attributed to any pixel.' };
            }
            return null;
        }
    },
    {
        id: 'meta_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'warning', message: 'No event name for Meta Pixel. fbq() call may be malformed.' };
            }
            return null;
        }
    },
    {
        id: 'meta_purchase_missing_value',
        check: (params) => {
            if (params?._event_name === 'Purchase' && !hasParam(params, 'value')) {
                return { severity: 'error', message: 'Purchase event missing "value". Meta cannot attribute revenue.' };
            }
            return null;
        }
    },
    {
        id: 'meta_purchase_missing_currency',
        check: (params) => {
            if (params?._event_name === 'Purchase' && hasParam(params, 'value') && !hasParam(params, 'currency')) {
                return { severity: 'error', message: 'Purchase has "value" but no "currency". Meta requires both for revenue tracking.' };
            }
            return null;
        }
    },
    {
        id: 'meta_invalid_currency',
        check: (params) => {
            if (hasParam(params, 'currency')) {
                const currency = String(params.currency).toUpperCase();
                if (!ISO_4217_CURRENCIES.has(currency)) {
                    return { severity: 'warning', message: `Currency "${params.currency}" is not a valid ISO 4217 code.` };
                }
            }
            return null;
        }
    },
    {
        id: 'meta_catalog_missing_content_ids',
        check: (params) => {
            const catalogEvents = ['ViewContent', 'AddToCart', 'Purchase', 'InitiateCheckout'];
            if (catalogEvents.includes(params?._event_name) && !hasParam(params, 'content_ids') && !hasParam(params, 'contents')) {
                return { severity: 'warning', message: `${params._event_name} missing "content_ids" or "contents". Dynamic Product Ads will not match products.` };
            }
            return null;
        }
    },
    {
        id: 'meta_catalog_missing_content_type',
        check: (params) => {
            const catalogEvents = ['ViewContent', 'AddToCart', 'Purchase', 'InitiateCheckout'];
            if (catalogEvents.includes(params?._event_name) && (hasParam(params, 'content_ids') || hasParam(params, 'contents')) && !hasParam(params, 'content_type')) {
                return { severity: 'warning', message: 'Dynamic ad event is missing "content_type" (should be "product" or "product_group").' };
            }
            return null;
        }
    },
];

// ============================================
// GOOGLE ADS RULES
// ============================================

const GOOGLE_ADS_RULES = [
    {
        id: 'gads_missing_conversion_id',
        check: (params) => {
            const hasConvId = hasParam(params, '_conversion_id') || hasParam(params, '_pixel_id');
            if (!hasConvId) {
                return { severity: 'error', message: 'Missing conversion ID (AW-XXXXXXXXX). Conversion will not be tracked.' };
            }
            return null;
        }
    },
    {
        id: 'gads_missing_conversion_label',
        check: (params) => {
            if (!hasParam(params, '_conversion_label') && !hasParam(params, 'label')) {
                return { severity: 'warning', message: 'Missing conversion label. Google Ads may not attribute this conversion correctly.' };
            }
            return null;
        }
    },
    {
        id: 'gads_value_not_numeric',
        check: (params) => {
            const value = params?.conversion_value || params?.value;
            if (value && !isNumeric(value)) {
                return { severity: 'error', message: `Conversion value "${value}" is not numeric.` };
            }
            return null;
        }
    },
    {
        id: 'gads_missing_currency',
        check: (params) => {
            const value = params?.conversion_value || params?.value;
            if (value && !hasParam(params, 'currency')) {
                return { severity: 'warning', message: 'Conversion has value but no currency. Google Ads defaults to account currency.' };
            }
            return null;
        }
    },
    {
        id: 'gads_purchase_deduplication',
        check: (params) => {
            if (hasParam(params, 'transaction_id')) return null;
            // Many names are used for purchase, look for value with no transaction_id
            const value = params?.conversion_value || params?.value;
            if (value && !hasParam(params, 'transaction_id') && !hasParam(params, 'order_id')) {
                return { severity: 'info', message: 'Conversion has value but no deduplication ID (transaction_id/order_id). Double-counting may occur.' };
            }
            return null;
        }
    },
];

// ============================================
// TIKTOK RULES
// ============================================

const TIKTOK_RULES = [
    {
        id: 'tt_missing_pixel_id',
        check: (params) => {
            if (!hasParam(params, '_pixel_id') && !hasParam(params, 'pixel_code')) {
                return { severity: 'error', message: 'Missing TikTok pixel ID. Events will not be tracked.' };
            }
            return null;
        }
    },
    {
        id: 'tt_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'warning', message: 'No event name for TikTok Pixel.' };
            }
            return null;
        }
    },
    {
        id: 'tt_purchase_missing_value',
        check: (params) => {
            if (params?._event_name === 'CompletePayment' && !hasParam(params, 'value')) {
                return { severity: 'warning', message: 'CompletePayment event missing "value". Revenue will not be attributed.' };
            }
            return null;
        }
    },
    {
        id: 'tt_catalog_missing_contents',
        check: (params) => {
            const catalogEvents = ['ViewContent', 'AddToCart', 'CompletePayment', 'InitiateCheckout'];
            if (catalogEvents.includes(params?._event_name) && !hasParam(params, 'contents')) {
                return { severity: 'info', message: `${params._event_name} is missing "contents" array. TikTok dynamic showcase ads require this.` };
            }
            return null;
        }
    },
];

// ============================================
// LINKEDIN RULES
// ============================================

const LINKEDIN_RULES = [
    {
        id: 'li_missing_partner_id',
        check: (params) => {
            if (!hasParam(params, '_partner_id') && !hasParam(params, '_pixel_id')) {
                return { severity: 'error', message: 'Missing LinkedIn Partner ID. Insight tag will not work.' };
            }
            return null;
        }
    },
    {
        id: 'li_missing_conversion_id',
        check: (params) => {
            if (!hasParam(params, '_conversion_id') && !hasParam(params, 'conversionId')) {
                return { severity: 'info', message: 'No specific conversion ID. LinkedIn will only track page views.' };
            }
            return null;
        }
    },
];

// ============================================
// SNAPCHAT RULES
// ============================================

const SNAPCHAT_RULES = [
    {
        id: 'snap_missing_pixel_id',
        check: (params) => {
            if (!hasParam(params, '_pixel_id')) {
                return { severity: 'error', message: 'Missing Snapchat Pixel ID.' };
            }
            return null;
        }
    },
    {
        id: 'snap_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'warning', message: 'No event name for Snapchat Pixel.' };
            }
            return null;
        }
    },
];

// ============================================
// PINTEREST RULES
// ============================================

const PINTEREST_RULES = [
    {
        id: 'pin_missing_pixel_id',
        check: (params) => {
            if (!hasParam(params, '_pixel_id') && !hasParam(params, 'tid')) {
                return { severity: 'error', message: 'Missing Pinterest Tag ID.' };
            }
            return null;
        }
    },
    {
        id: 'pin_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'info', message: 'No event name — Pinterest will only track page visit.' };
            }
            return null;
        }
    },
];

// ============================================
// MICROSOFT UET RULES
// ============================================

const MICROSOFT_UET_RULES = [
    {
        id: 'uet_missing_tag_id',
        check: (params) => {
            if (!hasParam(params, '_tag_id') && !hasParam(params, '_pixel_id')) {
                return { severity: 'error', message: 'Missing UET Tag ID. Microsoft Ads conversion tracking will not work.' };
            }
            return null;
        }
    },
    {
        id: 'uet_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'info', message: 'No custom event — UET is only tracking page views.' };
            }
            return null;
        }
    },
    {
        id: 'uet_revenue_not_numeric',
        check: (params) => {
            if (hasParam(params, 'revenue') && !isNumeric(params.revenue)) {
                return { severity: 'error', message: `Revenue "${params.revenue}" is not numeric.` };
            }
            return null;
        }
    },
];

// ============================================
// CRITEO RULES
// ============================================

const CRITEO_RULES = [
    {
        id: 'criteo_missing_account',
        check: (params) => {
            if (!hasParam(params, '_pixel_id') && !hasParam(params, 'account')) {
                return { severity: 'error', message: 'Missing Criteo account/partner ID.' };
            }
            return null;
        }
    },
];

// ============================================
// TABOOLA RULES
// ============================================

const TABOOLA_RULES = [
    {
        id: 'taboola_missing_pixel_id',
        check: (params) => {
            if (!hasParam(params, '_pixel_id')) {
                return { severity: 'error', message: 'Missing Taboola Pixel ID.' };
            }
            return null;
        }
    },
    {
        id: 'taboola_missing_event_name',
        check: (params) => {
            if (!hasParam(params, '_event_name')) {
                return { severity: 'info', message: 'No custom event — Taboola is only tracking page views.' };
            }
            return null;
        }
    },
];

// ============================================
// GENERAL RULES (apply to all tags)
// ============================================

const GENERAL_RULES = [
    {
        id: 'general_invalid_currency',
        check: (params) => {
            if (hasParam(params, 'currency')) {
                const currency = String(params.currency).toUpperCase();
                if (currency.length !== 3) {
                    return { severity: 'warning', message: `Currency "${params.currency}" should be a 3-letter ISO 4217 code.` };
                }
            }
            return null;
        }
    },
    {
        id: 'general_value_not_numeric',
        check: (params) => {
            // Only check if not already validated by tag-specific rules
            if (hasParam(params, 'value') && !isNumeric(params.value)) {
                return { severity: 'warning', message: `Value "${params.value}" is not numeric. Revenue tracking may fail.` };
            }
            return null;
        }
    },
];

// ============================================
// TAG TYPE → RULES MAP
// ============================================

const TAG_RULES_MAP = {
    // GA4
    'Google Analytics 4': GA4_RULES,
    'GA4': GA4_RULES,

    // Meta / Facebook
    'Meta Pixel': META_RULES,
    'Meta Pixel (Facebook)': META_RULES,
    'Facebook': META_RULES,

    // Google Ads
    'Google Ads': GOOGLE_ADS_RULES,

    // TikTok
    'TikTok Pixel': TIKTOK_RULES,
    'TikTok': TIKTOK_RULES,

    // LinkedIn
    'LinkedIn Ads': LINKEDIN_RULES,
    'LinkedIn Insight Tag': LINKEDIN_RULES,
    'LinkedIn': LINKEDIN_RULES,

    // Snapchat
    'Snapchat Pixel': SNAPCHAT_RULES,
    'Snapchat': SNAPCHAT_RULES,

    // Pinterest
    'Pinterest Tag': PINTEREST_RULES,
    'Pinterest': PINTEREST_RULES,

    // Microsoft
    'Microsoft Ads': MICROSOFT_UET_RULES,
    'Microsoft UET': MICROSOFT_UET_RULES,

    // Criteo
    'Criteo': CRITEO_RULES,

    // Taboola
    'Taboola': TABOOLA_RULES,
    'Taboola Pixel': TABOOLA_RULES,
};

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validate a tag's parameters against rules for its type.
 * 
 * @param {string} tagType - The tag type name (e.g., "Google Analytics 4")
 * @param {Object} eventParams - The captured event parameters
 * @returns {{ results: Array<{severity, message, ruleId}>, summary: {errors, warnings, infos, passed} }}
 */
export function validateTag(tagType, eventParams) {
    const results = [];
    const params = eventParams || {};

    // Run tag-specific rules
    const tagRules = TAG_RULES_MAP[tagType] || [];
    for (const rule of tagRules) {
        try {
            const result = rule.check(params);
            if (result) {
                results.push({
                    ruleId: rule.id,
                    severity: result.severity,
                    message: result.message,
                });
            }
        } catch (e) {
            // Never crash on validation — silently skip broken rules
        }
    }

    // Run general rules (only if tag-specific didn't already flag the same field)
    const flaggedFields = new Set(results.map(r => r.ruleId.split('_').pop()));
    for (const rule of GENERAL_RULES) {
        const fieldName = rule.id.split('_').pop();
        if (flaggedFields.has(fieldName)) continue;

        try {
            const result = rule.check(params);
            if (result) {
                results.push({
                    ruleId: rule.id,
                    severity: result.severity,
                    message: result.message,
                });
            }
        } catch (e) {
            // Silent skip
        }
    }

    // Summary
    const summary = {
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        infos: results.filter(r => r.severity === 'info').length,
        passed: results.length === 0,
        total: results.length,
    };

    return { results, summary };
}

/**
 * Get the worst severity from validation results.
 * Used for the status dot color on event cards.
 * 
 * @param {{ results: Array }} validation
 * @returns {'error' | 'warning' | 'info' | 'pass'}
 */
export function getValidationStatus(validation) {
    if (!validation || !validation.results || validation.results.length === 0) return 'pass';
    if (validation.summary.errors > 0) return 'error';
    if (validation.summary.warnings > 0) return 'warning';
    return 'info';
}

/**
 * Get total validation counts across all tags.
 * Used for the stats bar summary.
 * 
 * @param {Array<{validation: Object}>} tags
 * @returns {{ totalErrors, totalWarnings, totalInfos, totalPassed, totalTags }}
 */
export function getValidationSummary(tags) {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;
    let totalPassed = 0;

    for (const tag of tags) {
        if (!tag.validation) continue;
        if (tag.validation.summary.passed) {
            totalPassed++;
        } else {
            totalErrors += tag.validation.summary.errors;
            totalWarnings += tag.validation.summary.warnings;
            totalInfos += tag.validation.summary.infos;
        }
    }

    return { totalErrors, totalWarnings, totalInfos, totalPassed, totalTags: tags.length };
}
