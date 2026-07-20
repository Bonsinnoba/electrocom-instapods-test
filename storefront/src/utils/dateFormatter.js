/**
 * Formats a date string into a localized date and time string.
 * @param {string | Date} date - The date to format.
 * @param {object} options - Intl.DateTimeFormat options.
 * @returns {string} The formatted date string.
 */
export const formatDateTime = (date, options = {}) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    // Handle dateStyle/timeStyle options (newer Intl API)
    let finalOptions = { ...options };
    if (options.dateStyle || options.timeStyle) {
        // If using dateStyle/timeStyle, use them directly
        finalOptions = {
            ...options,
        };
    } else {
        // Otherwise use legacy options
        finalOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            ...options,
        };
    }

    return new Intl.DateTimeFormat('en-US', finalOptions).format(d);
};

/**
 * Formats a date string into just the date part.
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
export const formatDate = (date) => {
    return formatDateTime(date, { hour: undefined, minute: undefined });
};

/**
 * Formats a date string into just the time part.
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted time string.
 */
export const formatTime = (date) => {
    return formatDateTime(date, { year: undefined, month: undefined, day: undefined });
};

/**
 * Formats a date string into a relative time string (e.g., "2 hours ago").
 * @param {string | Date} date - The date to format.
 * @returns {string} The relative time string.
 */
export const formatRelativeTime = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffInSeconds = Math.floor((now - d) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks}w ago`;
    }

    // If older than a month, fall back to absolute date
    return formatDate(d);
};
