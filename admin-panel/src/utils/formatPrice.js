/**
 * Formats a number consistently as Ghana Cedi (GH₵)
 * @param {number|string} price - The price to format
 * @returns {string} - Formatted price string
 */
export const formatPrice = (price) => {
    const val = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(val)) return 'GH₵ 0.00';
    
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
        minimumFractionDigits: 2,
    }).format(val).replace('GHS', 'GH₵');
};
