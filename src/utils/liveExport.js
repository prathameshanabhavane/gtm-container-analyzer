/**
 * CSV Export utilities for Live Captured GTM tags
 */

/**
 * Export live captured tags to CSV file
 * @param {Array} tags - Array of live tag objects to export
 * @param {Object} pageContext - Page context information
 * @param {string} filename - Name of the downloaded file
 */
export const exportLiveTagsToCSV = (tags, pageContext, filename = 'gtm_live_tags_export.csv') => {
  // Define CSV headers
  const headers = [
    'Tag Name',
    'Tag Type',
    'Status',
    'Request Count',
    'Event Name',
    'Event Parameters',
    'First Seen',
    'Request URLs',
    'Page URL',
    'Page Hostname',
    'GTM Container',
    'Capture Time'
  ];
  
  // Convert tags to CSV rows
  const rows = tags.map(tag => {
    // Format request URLs
    const requestUrls = tag.requests
      .map(r => r.url)
      .join(' | ');
    
    // Extract event parameters from requests
    const allParams = tag.requests
      .filter(r => r.eventParams)
      .map(r => r.eventParams)
      .reduce((acc, params) => ({ ...acc, ...params }), {});
    
    const eventName = allParams._event_name || '';
    const eventParams = Object.entries(allParams)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    
    return [
      tag.name,
      tag.type,
      'Fired', // Live captured tags are always fired
      tag.requestCount,
      eventName,
      eventParams,
      tag.firstSeen ? new Date(tag.firstSeen).toLocaleString() : '',
      requestUrls,
      pageContext.url || '',
      pageContext.hostname || '',
      pageContext.gtmContainerId || '',
      pageContext.captureStarted ? new Date(pageContext.captureStarted).toLocaleString() : ''
    ];
  });
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        // Escape cells that contain commas, quotes, or newlines
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('|')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');
  
  // Create and trigger download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export dataLayer events to CSV file
 * @param {Array} events - Array of dataLayer event objects
 * @param {Object} pageContext - Page context information
 * @param {string} filename - Name of the downloaded file
 */
export const exportDataLayerEventsToCSV = (events, pageContext, filename = 'gtm_live_datalayer_events.csv') => {
  // Define CSV headers
  const headers = [
    'Event Name',
    'Category',
    'Timestamp',
    'Event Data (JSON)',
    'Page URL',
    'Page Hostname'
  ];
  
  // Convert events to CSV rows
  const rows = events.map(evt => {
    return [
      evt.event || 'push',
      evt.category || 'Custom',
      evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '',
      JSON.stringify(evt.data || {}),
      pageContext.url || '',
      pageContext.hostname || ''
    ];
  });
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        // Escape cells that contain commas, quotes, or newlines
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');
  
  // Create and trigger download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export URL parameters to CSV file
 * @param {Object} queryParams - Query parameters object
 * @param {Object} pageContext - Page context information
 * @param {string} filename - Name of the downloaded file
 */
export const exportURLParamsToCSV = (queryParams, pageContext, filename = 'gtm_live_url_params.csv') => {
  // Define CSV headers
  const headers = [
    'Parameter',
    'Value',
    'Type',
    'Has Value',
    'Page URL',
    'Page Hostname'
  ];
  
  // Convert params to CSV rows
  const rows = Object.entries(queryParams || {}).map(([param, value]) => {
    const isUTM = param.toLowerCase().startsWith('utm_');
    const isTracking = ['gclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id'].includes(param.toLowerCase());
    const paramType = isUTM ? 'UTM' : isTracking ? 'Tracking' : 'Custom';
    const hasValue = value && value.trim() !== '';
    
    return [
      param,
      value || '',
      paramType,
      hasValue ? 'Yes' : 'No',
      pageContext.url || '',
      pageContext.hostname || ''
    ];
  });
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');
  
  // Create and trigger download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export full live capture data to CSV (combined)
 * @param {Array} tags - Array of live tag objects
 * @param {Array} events - Array of dataLayer events
 * @param {Object} pageContext - Page context information
 * @param {string} filename - Name of the downloaded file
 */
export const exportFullLiveCaptureToCSV = (tags, events, pageContext, filename = 'gtm_live_full_capture.csv') => {
  // Section 1: Summary
  const summaryHeaders = ['Metric', 'Value'];
  const queryParams = pageContext.queryParams || {};
  const paramCount = Object.keys(queryParams).length;
  
  const summaryRows = [
    ['Page URL', pageContext.url || ''],
    ['Hostname', pageContext.hostname || ''],
    ['GTM Container', pageContext.gtmContainerId || 'Not detected'],
    ['Capture Time', pageContext.captureStarted ? new Date(pageContext.captureStarted).toLocaleString() : ''],
    ['Total Tags Fired', tags.length],
    ['Total Network Requests', tags.reduce((sum, t) => sum + t.requestCount, 0)],
    ['Total DataLayer Events', events.length],
    ['Total URL Parameters', paramCount],
    ['', ''], // Empty row separator
  ];
  
  // Section 2: URL Parameters (if any)
  const paramHeaders = ['[URL PARAMETERS]', '', ''];
  const paramColumnHeaders = ['Parameter', 'Value', 'Type'];
  const paramRows = Object.entries(queryParams).map(([param, value]) => {
    const isUTM = param.toLowerCase().startsWith('utm_');
    const isTracking = ['gclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id'].includes(param.toLowerCase());
    const paramType = isUTM ? 'UTM' : isTracking ? 'Tracking' : 'Custom';
    return [param, value || '(empty)', paramType];
  });
  
  // Section 3: Tags
  const tagHeaders = ['[TAGS]', '', '', '', ''];
  const tagColumnHeaders = ['Tag Name', 'Type', 'Request Count', 'Status', 'Request URLs'];
  const tagRows = tags.map(tag => [
    tag.name,
    tag.type,
    tag.requestCount,
    'Fired',
    tag.requests.map(r => r.url).join(' | ')
  ]);
  
  // Section 4: DataLayer Events (if any)
  const eventHeaders = ['[DATALAYER EVENTS]', '', '', ''];
  const eventColumnHeaders = ['Event Name', 'Category', 'Timestamp', 'Data'];
  const eventRows = events.map(evt => [
    evt.event || 'push',
    evt.category || 'Custom',
    evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '',
    JSON.stringify(evt.data || {})
  ]);
  
  // Build CSV content
  const allRows = [
    summaryHeaders,
    ...summaryRows,
  ];
  
  // Add URL parameters if any
  if (paramCount > 0) {
    allRows.push(paramHeaders, paramColumnHeaders, ...paramRows, ['', '', '']);
  }
  
  // Add tags
  allRows.push(tagHeaders, tagColumnHeaders, ...tagRows, ['', '', '', '', '']);
  
  // Add events
  allRows.push(eventHeaders, eventColumnHeaders, ...eventRows);
  
  const csvContent = allRows.map(row => 
    row.map(cell => {
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('|')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
  
  // Create and trigger download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

