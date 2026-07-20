import React, { createContext, useContext, useState, useCallback } from 'react';

const ComparisonContext = createContext();

export const useComparison = () => {
  const ctx = useContext(ComparisonContext);
  if (!ctx) throw new Error('useComparison must be used within a ComparisonProvider');
  return ctx;
};

export const ComparisonProvider = ({ children }) => {
  const [compareList, setCompareList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addToCompare = useCallback((product) => {
    setCompareList(prev => {
      if (prev.some(p => p.id === product.id)) return prev;
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, product];
    });
  }, []);

  const removeFromCompare = useCallback((id) => {
    setCompareList(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareList([]);
    setIsModalOpen(false);
  }, []);

  const isInCompare = useCallback((id) => {
    return compareList.some(p => p.id === id);
  }, [compareList]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <ComparisonContext.Provider value={{
      compareList,
      addToCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
      isModalOpen,
      openModal,
      closeModal,
    }}>
      {children}
    </ComparisonContext.Provider>
  );
};
