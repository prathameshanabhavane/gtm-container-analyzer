/**
 * usePagination Hook
 * Manages pagination state and logic
 */

import { useState, useMemo } from 'react';

const usePagination = (items, defaultItemsPerPage = 15) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [itemsPerPageInput, setItemsPerPageInput] = useState(String(defaultItemsPerPage));

  // Calculate total pages
  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    const trimmed = value.trim().toLowerCase();
    setItemsPerPageInput(value);
    
    if (trimmed === 'all' || trimmed === '') {
      setItemsPerPage(items.length || 9999);
      setCurrentPage(1);
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0) {
        setItemsPerPage(num);
        setCurrentPage(1);
      }
    }
  };

  // Reset to page 1
  const resetPage = () => {
    setCurrentPage(1);
  };

  // Go to specific page
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
    }
  };

  // Go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1);
    }
  };

  // Calculate showing range
  const showingFrom = items.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  const showingTo = Math.min(currentPage * itemsPerPage, items.length);

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    itemsPerPageInput,
    handleItemsPerPageChange,
    totalPages,
    paginatedItems,
    resetPage,
    goToPage,
    nextPage,
    prevPage,
    showingFrom,
    showingTo,
    totalItems: items.length,
  };
};

export default usePagination;

