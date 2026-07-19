/**
 * CSV Export utilities for GTM tags
 */

/**
 * Export tags to CSV file
 * @param {Array} tags - Array of tag objects to export
 * @param {string} filename - Name of the downloaded file
 */
export const exportToCSV = (tags, filename = 'gtm_tags_export.csv') => {
  // Define CSV headers
  const headers = [
    'Tag Name',
    'Tag Type',
    'Tag Type Code',
    'Status',
    'Trigger Name',
    'Trigger Type',
    'Tag Information',
    'Conditions',
    'Page Paths',
    'Page URLs',
    'Query Params',
    'Events',
    'Parameters'
  ];
  
  // Convert tags to CSV rows
  const rows = tags.map(tag => {
    // Format conditions (use typeLabel for full condition objects)
    const conditionsStr = tag.conditions.map(c => 
      `${c.variable || ''} ${c.typeLabel || c.type || ''} ${c.value || ''}`
    ).join('; ');
    
    // Format page paths (use type property)
    const pagePathsStr = tag.pagePaths.map(p => 
      `${p.type || 'Condition'}: ${p.value || ''}`
    ).join('; ');
    
    // Format page URLs (use type property)
    const pageUrlsStr = tag.pageUrls.map(p => 
      `${p.type || 'Condition'}: ${p.value || ''}`
    ).join('; ');
    
    // Format query params (use type property)
    const queryParamsStr = tag.queryParams.map(p => 
      `${p.type || 'Condition'}: ${p.value || ''}`
    ).join('; ');
    
    // Format events (use type property)
    const eventsStr = tag.events ? tag.events.map(e => 
      `${e.type || 'Event'}: ${e.value || ''}`
    ).join('; ') : '';
    
    return [
      tag.name,
      tag.typeLabel,
      tag.type,
      tag.paused ? 'Paused' : 'Active',
      tag.triggerName,
      tag.triggerType,
      tag.tagSpecificInfo.replace(/\n/g, ' ').replace(/"/g, '""'),
      conditionsStr,
      pagePathsStr,
      pageUrlsStr,
      queryParamsStr,
      eventsStr,
      tag.parameters.replace(/\n/g, ' ').replace(/"/g, '""')
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

