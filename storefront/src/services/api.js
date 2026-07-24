import { secureStorage } from '../utils/secureStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Helper to decode HTML entities like &gt; to >
 */
const decodeHtml = (html) => {
    if (!html) return html;
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
};

/**
 * Helper to ensure image URLs are absolute
 */
export const formatImageUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    // Check if it's an external URL (not localhost/127.0.0.1/electrocom.local)
    const isExternal = url.startsWith('http') &&
                      !url.includes('localhost') &&
                      !url.includes('127.0.0.1') &&
                      !url.includes('electrocom.local');

    if (isExternal) return url;

    // Fix hardcoded dev URLs from DB
    const cleaningBases = [
        'http://localhost:8000/api/',
        'http://localhost:8000/',
        'http://127.0.0.1:8000/api/',
        'http://127.0.0.1:8000/',
        'http://electrocom.local/api/',
        'http://electrocom.local/',
        'https://electrocom.local/api/',
        'https://electrocom.local/'
    ];
    cleaningBases.forEach(base => {
        url = url.replaceAll(base, '');
    });

    const relativePath = url.startsWith('/') ? url.slice(1) : url;
    if (relativePath.startsWith('uploads/')) {
        return `${API_BASE_URL}/media.php?path=${encodeURIComponent(relativePath)}`;
    }

    // Prepend the API base URL
    return `${API_BASE_URL}/${relativePath}`;
};

/**
 * Helper to get authentication headers
 * Adds X-Session-Token as a robust fallback for cross-origin cookie issues.
 */
const getAuthHeaders = () => {
    const token = secureStorage.getItem('token', 'shared');
    return {
        'Content-Type': 'application/json',
        'X-App-ID': 'storefront',
        ...(token ? { 'X-Session-Token': token } : {})
    };
};

/**
 * Fetch CSRF token from backend
 */
export const fetchCSRFToken = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/csrf_token.php`, {
            credentials: 'include'
        });
        const result = await response.json();
        if (result.success && result.data?.csrf_token) {
            return result.data.csrf_token;
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        return null;
    }
};

export const fetchHomepageBoot = async () => {
    const response = await apiFetch(`${API_BASE_URL}/get_homepage_boot.php`, getFetchOptions());
    if (response.status === 503) return { success: false, maintenance: true };
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'API error');
    return result.data;
};

/**
 * Get CSRF token from localStorage or fetch new one
 */
const GET_CSRF_TOKEN = async () => {
    let token = sessionStorage.getItem('csrf_token');
    if (!token) {
        token = await fetchCSRFToken();
        if (token) {
            sessionStorage.setItem('csrf_token', token);
        }
    }
    return token;
};

// Global fetch options to ensure cookies are included
const getFetchOptions = (options = {}) => {
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    };

    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
        const csrfToken = sessionStorage.getItem('csrf_token');
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return {
        credentials: 'include',
        ...options,
        headers
    };
};

/**
 * Retry helper with exponential backoff
 */
const fetchWithRetry = async (url, options, maxRetries = 3, baseDelay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // Don't retry on client errors (4xx) except 408 (Request Timeout) and 429 (Too Many Requests)
            if (response.status >= 400 && response.status < 500 && 
                response.status !== 408 && response.status !== 429) {
                return response;
            }
            
            // Don't retry on successful responses
            if (response.ok) {
                return response;
            }
            
            // Retry on server errors (5xx) and network issues
            lastError = new Error(`HTTP ${response.status}`);
            
            // If this is the last attempt, return the response
            if (attempt === maxRetries) {
                return response;
            }
            
            // Exponential backoff: delay = baseDelay * 2^attempt
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            
        } catch (error) {
            lastError = error;
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Exponential backoff for network errors
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError || new Error('Max retries exceeded');
};

/**
 * Global fetch wrapper that passively intercepts 401 Unauthorized responses
 * and triggers a global logout event instead of relying on wasteful 10-second background polling.
 * Includes retry mechanism for network failures and server errors.
 */
const apiFetch = async (url, options = {}) => {
    const response = await fetchWithRetry(url, options, 3, 1000);
    
    // Check for HTTP 401 status
    if (response.status === 401) {
        handleTokenExpiration();
        return response;
    }
    
    // Check response body for token expiration errors
    // Only parse JSON for non-401 responses to avoid double-handling
    if (response.ok) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();
                
                // Check for specific error structure indicating token expiration
                if (data.status === 'error' && 
                    (data.message?.toLowerCase().includes('token') || 
                     data.message?.toLowerCase().includes('unauthorized') ||
                     data.message?.toLowerCase().includes('expired'))) {
                    handleTokenExpiration();
                }
            }
        } catch (e) {
            // If JSON parsing fails, ignore and continue
        }
    }
    
    return response;
};

/**
 * Centralized token expiration handler
 * Clears all auth tokens and dispatches global logout event
 */
const handleTokenExpiration = () => {
    // Clear expired token from storage
    try {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('csrf_token');
        // Also clear from secureStorage if available
        if (typeof secureStorage !== 'undefined') {
            secureStorage.removeItem('token', 'shared');
        }
    } catch (e) {
        // Ignore storage errors
    }
    // Dispatch global logout event
    window.dispatchEvent(new Event('auth_unauthorized'));
};

export const fetchProducts = async (category = null) => {
    const url = category
        ? `${API_BASE_URL}/get_products.php?category=${encodeURIComponent(category)}`
        : `${API_BASE_URL}/get_products.php`;

    const response = await apiFetch(url, getFetchOptions());
    if (response.status === 503) {
        const err = new Error('Maintenance Mode');
        err.maintenance = true;
        throw err;
    }
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const result = await response.json();
    if (!result.success) throw new Error(result.message || "API error");

    const data = result.data || [];
    return data.map(product => ({
        ...product,
        name: decodeHtml(product.name),
        description: decodeHtml(product.description),
        category: decodeHtml(product.category),
        image: formatImageUrl(product.image_url),
        image_url: formatImageUrl(product.image_url),
        directions: formatImageUrl(product.directions), // Handles PDF uploads
        gallery: Array.isArray(product.gallery)
            ? product.gallery.map(formatImageUrl)
            : []
    }));
};

export const registerUser = async (userData) => {
    const response = await apiFetch(`${API_BASE_URL}/register.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify(userData),
    }));
    if (response.status === 503) return { success: false, maintenance: true };
    return await response.json();
};

export const verifyUser = async (userId, code) => {
    const response = await apiFetch(`${API_BASE_URL}/verify.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify({ user_id: userId, code }),
    }));
    return await response.json();
};

export const loginUser = async (credentials) => {
    const response = await apiFetch(`${API_BASE_URL}/login.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify(credentials),
    }));
    if (response.status === 503) return { success: false, maintenance: true };
    return await response.json();
};

export const logoutUser = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/logout.php`, getFetchOptions({
            method: 'POST'
        }));
        return await response.json();
    } catch (error) {
        console.error('Logout error:', error);
    }
};

export const forgotPassword = async (email, method = 'email') => {
    const response = await apiFetch(`${API_BASE_URL}/forgot_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, method }),
    });
    return await response.json();
};

export const changePassword = async (currentPassword, newPassword) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/change_password.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        }));
        return await response.json();
    } catch (error) {
        console.error('Change password error:', error);
        throw error;
    }
};

export const resetPassword = async (resetData) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/reset_password.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify(resetData),
        }));
        if (response.status === 503) return { success: false, maintenance: true };
        return await response.json();
    } catch (error) {
        console.error('Reset password error:', error);
        throw error;
    }
};

export const updateProfile = async (profileData) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/update_profile.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify(profileData),
        }));
        if (response.status === 503) return { success: false, maintenance: true };
        return await response.json();
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
};

export const createOrder = async (orderData) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/orders.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify(orderData),
        }));
        if (response.status === 503) return { success: false, maintenance: true };
        return await response.json();
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

export const fetchOrders = async (userId) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/orders.php?user_id=${userId}`, getFetchOptions());
        if (response.status === 503) return []; // Silent during maintenance
        if (!response.ok) throw new Error('Failed to fetch orders');
        const result = await response.json();
        return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
};

export const fetchOrderDetails = async (orderId) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/orders.php?order_id=${orderId}`, getFetchOptions());
        if (response.status === 503) throw new Error('Maintenance Mode');
        if (!response.ok) throw new Error('Failed to fetch order details');
        const result = await response.json();
        return result.success ? result.data : null;
    } catch (error) {
        console.error('Error fetching order details:', error);
        throw error;
    }
};

// Promise deduplication cache for in-flight requests
const pendingRequests = new Map();
const requestCache = new Map(); // Cache completed requests with TTL

export const checkUserStatus = async () => {
    const requestKey = 'checkUserStatus';
    const cacheTTL = 2000; // 2 seconds cache TTL
    
    // Check if we have a cached result that's still valid
    const cached = requestCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
        return cached.result;
    }
    
    // Return existing in-flight promise if available
    if (pendingRequests.has(requestKey)) {
        return pendingRequests.get(requestKey);
    }
    
    // Create new promise and cache it
    const promise = (async () => {
        try {
            const response = await apiFetch(`${API_BASE_URL}/check_user_status.php`, getFetchOptions());
            if (response.status === 503) return { success: false, maintenance: true };
            if (!response.ok) {
                // If 401, token might be invalid
                if (response.status === 401) return { success: false, unauthorized: true };
                return { success: false };
            }
            const result = await response.json();
            
            // Cache the result
            requestCache.set(requestKey, { result, timestamp: Date.now() });
            
            return result;
        } catch (error) {
            console.error('Error checking user status:', error);
            return { success: false };
        } finally {
            // Remove from pending cache when complete
            pendingRequests.delete(requestKey);
        }
    })();
    
    pendingRequests.set(requestKey, promise);
    return promise;
};

export const deleteMyAccount = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/delete_account.php`, getFetchOptions({
            method: 'POST'
        }));
        return await response.json();
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
};

export const recoverAccount = async (credentials) => {
    const response = await apiFetch(`${API_BASE_URL}/recover_account.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify(credentials),
    }));
    if (response.status === 503) return { success: false, maintenance: true };
    return await response.json();
};

export const fetchTransactions = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/get_transactions.php`, getFetchOptions());
        if (response.status === 503) return { success: false, maintenance: true };
        return await response.json();
    } catch (error) {
        console.error('Error fetching transactions:', error);
        throw error;
    }
};

export const verifyPayment = async (reference, type = 'wallet_topup', orderId = null) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/verify_payment.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ reference, type, order_id: orderId })
        }));
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Payment verification failed');
        return result;
    } catch (error) {
        console.error('Error verifying payment:', error);
        throw error;
    }
};

export const fetchSlides = async () => {
    const response = await apiFetch(`${API_BASE_URL}/get_slider.php`);

    if (response.status === 503) return [];
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    const slides = result.success ? result.data : [];

    return slides.map(slide => ({
        ...slide,
        title: decodeHtml(slide.title),
        subtitle: decodeHtml(slide.subtitle),
        button_text: decodeHtml(slide.button_text),
        image_url: formatImageUrl(slide.image_url)
    }));
};

// --- Reviews ---
export const fetchProductReviews = async (productId) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/reviews.php?product_id=${productId}`);
        if (!response.ok) throw new Error('Failed to fetch reviews');
        const result = await response.json();
        return result.success ? result.data : { reviews: [], average_rating: 0, total_reviews: 0 };
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return { reviews: [], average_rating: 0, total_reviews: 0 };
    }
};

export const submitReview = async (productId, rating, comment) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify({ product_id: productId, rating, comment }),
    }));
    return await response.json();
};

// --- Invoice ---
export const getInvoiceUrl = (orderId) => {
    const token = secureStorage.getItem('token', 'shared');
    const base = `${API_BASE_URL}/invoice.php?order_id=${orderId}`;
    return token ? `${base}&token=${encodeURIComponent(token)}` : base;
};

// --- Coupons ---
export const validateCoupon = async (code, cartTotal) => {
    const response = await apiFetch(`${API_BASE_URL}/coupons.php?action=validate`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify({ code, cartTotal })
    }));
    return await response.json();
};


// --- Wishlist ---
export const fetchWishlist = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/wishlist.php`, getFetchOptions());
        if (!response.ok) throw new Error('Failed to fetch wishlist');
        const result = await response.json();
        const items = result.success && Array.isArray(result.items) ? result.items : [];
        return items.map(product => ({
            ...product,
            name: decodeHtml(product.name),
            category: decodeHtml(product.category),
            image: formatImageUrl(product.image),
            image_url: formatImageUrl(product.image)
        }));
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return [];
    }
};

export const addToWishlist = async (productId) => {
    const response = await apiFetch(`${API_BASE_URL}/wishlist.php`, getFetchOptions({
        method: 'POST',
        body: JSON.stringify({ product_id: productId })
    }));
    return await response.json();
};

export const removeFromWishlist = async (productId) => {
    const response = await apiFetch(`${API_BASE_URL}/wishlist.php`, getFetchOptions({
        method: 'DELETE',
        body: JSON.stringify({ product_id: productId })
    }));
    return await response.json();
};

// --- Cart ---
export const syncCart = async (cartItems) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/cart_sync.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ cart: cartItems })
        }));
        return await response.json();
    } catch {
        // Silently fail for background cart syncs
        return { success: false };
    }
};

export const fetchServerCart = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/cart_sync.php`, getFetchOptions());
        if (!response.ok) return [];
        const result = await response.json();
        return result.success ? (Array.isArray(result.cart) ? result.cart : []) : [];
    } catch {
        return [];
    }
};

// --- Order Tracking ---
export const trackOrder = async (orderId, email) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/track_order.php?order_id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`, getFetchOptions());
        return await response.json();
    } catch (error) {
        console.error('Error tracking order:', error);
        return { success: false, error: 'Network error preventing order tracking.' };
    }
};

export const fetchSiteSettings = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/get_site_settings.php`);
        const result = await response.json();
        return result.success ? result.data : null;
    } catch (error) {
        console.error('Error fetching site settings:', error);
        return null;
    }
};

export const getShippingFee = async (region, subtotal) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/fetch_shipping.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ region, subtotal })
        }));
        return await response.json();
    } catch (error) {
        console.error('Error fetching shipping fee:', error);
        return { success: false, fee: 0 };
    }
};

export const fetchPickupLocations = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/get_pickup_locations.php`, getFetchOptions());
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching pickup locations:', error);
        return [];
    }
};

export const fetchMissingItemConfirmations = async () => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/missing_item_confirmation.php`, getFetchOptions());
        return await response.json();
    } catch (error) {
        console.error('Error fetching missing-item confirmations:', error);
        return { success: false, data: [] };
    }
};

export const submitMissingItemConfirmation = async (id, choice) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/missing_item_confirmation.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ id, choice }),
        }));
        return await response.json();
    } catch (error) {
        console.error('Error submitting missing-item confirmation:', error);
        return { success: false };
    }
};

export const requestReturn = async (orderId, items, reason) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/customer_return_request.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ order_id: orderId, items, reason }),
        }));
        return await response.json();
    } catch (error) {
        console.error('Error requesting return:', error);
        return { success: false, error: 'Network error' };
    }
};

export const socialAuthExchange = async (code) => {
    try {
        const response = await apiFetch(`${API_BASE_URL}/social_auth_exchange.php`, getFetchOptions({
            method: 'POST',
            body: JSON.stringify({ code }),
        }));
        const result = await response.json();
        console.log('Social auth exchange response:', result);
        return result;
    } catch (error) {
        console.error('Error during social auth exchange:', error);
        console.error('API_BASE_URL:', API_BASE_URL);
        console.error('Code being sent:', code ? code.substring(0, 8) + '...' : 'none');
        return { success: false, message: 'Network error during social exchange.' };
    }
};

export const fetchFlashSaleBannerSettings = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/flash_sale_banner_settings.php`);
        const result = await response.json();
        if (result.success) {
            return result.data;
        }
        console.error('API returned error:', result.message);
        return null;
    } catch (error) {
        console.error('Error fetching flash sale banner settings:', error);
        return null;
    }
};
