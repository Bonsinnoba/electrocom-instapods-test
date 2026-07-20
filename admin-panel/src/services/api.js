export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Global token store for API calls (set by AuthContext)
let globalAccessToken = null;
let refreshPromise = null;

export const setGlobalAccessToken = (token) => {
    globalAccessToken = token;
};

export const getGlobalAccessToken = () => {
    return globalAccessToken;
};

/**
 * Safe HTML entity decoder - prevents XSS by not using innerHTML
 * Decodes common HTML entities to their character equivalents
 */
const decodeHtml = (html) => {
    if (!html) return html;
    const entityMap = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#039;': "'",
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™'
    };
    
    return html.replace(/&[#\w]+;/g, (match) => entityMap[match] || match);
};

/**
 * Helper to ensure image URLs are absolute
 */
export const formatImageUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
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
        url = url.replace(base, '');
    });
    
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}/${url.startsWith('/') ? url.slice(1) : url}`;
};

const getAuthHeaders = (token, contentType = 'application/json') => {
    const authToken = (token === undefined || token === null) ? globalAccessToken : token;
    const headers = {
        'X-App-ID': 'admin',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    };
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return headers;
};

/**
 * Helper to fetch with auth headers and global interceptor
 * Uses global token and implements automatic refresh on 401
 */
const authFetch = async (url, options = {}, token = null) => {
    const authToken = token || globalAccessToken;
    const authHeaders = getAuthHeaders(authToken);

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            credentials: 'include',
            headers: {
                ...authHeaders,
                ...options.headers
            }
        });

        // Passive interceptor for 401/403
        if (response.status === 401 || response.status === 403) {
            window.dispatchEvent(new Event('auth_unauthorized'));
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('Invalid JSON response from server:', text);
            return { success: false, message: 'Server returned an invalid response.' };
        }
    } catch (error) {
        console.error('Network error during authFetch:', error);
        return { success: false, message: 'Network connection error.' };
    }
};

export const loginUser = async (credentials) => {
    try {
        const response = await fetch(`${API_BASE_URL}/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
            credentials: 'include' // Ensure cookies are sent and handled correctly for CORS
        });
        
        const rawText = await response.text();
        try {
            return JSON.parse(rawText);
        } catch (e) {
            console.error('Invalid JSON from server:', rawText);
            return { success: false, message: 'Server returned an invalid format.' };
        }
    } catch (error) {
        console.error('Login fetch error:', error);
        throw error; // Rethrow so Login.jsx catch block can show "Connection error"
    }
};


export const fetchBatch = async (resources) => {
    try {
        const response = await fetch(`${API_BASE_URL}/batch.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resources })
        });
        const result = await response.json();
        return result.success ? result.data : {};
    } catch (error) {
        console.error('Batch fetch error:', error);
        return {};
    }
};

export const fetchProducts = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/get_products.php?_t=${Date.now()}`);
        const result = await response.json();
        const data = result.success ? result.data : [];
        return data.map(product => ({
            ...product,
            name: decodeHtml(product.name),
            description: decodeHtml(product.description),
            category: decodeHtml(product.category),
            image_url: formatImageUrl(product.image_url),
            directions: formatImageUrl(product.directions),
            gallery: Array.isArray(product.gallery)
                ? product.gallery.map(formatImageUrl)
                : []
        }));
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
};

export const createProduct = async (productData) => authFetch('/admin_products.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...productData }),
});

export const updateProduct = async (id, productData) => authFetch('/admin_products.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', id, ...productData }),
});

export const deleteProduct = async (id) => authFetch('/admin_products.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
});

export const fetchCustomers = async () => {
    try {
        const result = await authFetch(`/admin_customers.php?_t=${Date.now()}`);
        const data = result.success ? result.data : [];

        return data.map(customer => ({
            ...customer,
            name: decodeHtml(customer.name),
            email: decodeHtml(customer.email)
        }));
    } catch (error) {
        console.error('Error fetching customers:', error);
        return [];
    }
};

export const deleteUser = async (id) => authFetch('/admin_customers.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
});
export const fetchAnalytics = async () => authFetch('/admin_analytics.php');

// --- CMS ---
export const fetchCMSPages = async () => authFetch('/cms.php?all=1');
export const getCMSPage = async (slug) => authFetch(`/cms.php?slug=${slug}`);
export const saveCMSPage = async (pageData) => authFetch('/cms.php', { method: 'POST', body: JSON.stringify(pageData) });
export const deleteCMSPage = async (id) => authFetch(`/cms.php?id=${id}`, { method: 'DELETE' });

// deleteCustomer is kept as a backward-compat alias for deleteUser
export const deleteCustomer = deleteUser;
export const generateReportToken = async () => authFetch('/generate_report_token.php', { method: 'POST' });
export const setUserRole = async (id, role) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_customers.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'set_role', id, role }),
        });

        return await response.json();
    } catch (error) {
        console.error('Error setting user role:', error);
        throw error;
    }
};


export const toggleUserStatus = async (id, currentStatus) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_customers.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'toggle_status', id, status: currentStatus }),
        });

        return await response.json();
    } catch (error) {
        console.error('Error toggling user status:', error);
        throw error;
    }
};

export const fetchOrders = async (query = '') => {
    try {
        const url = query 
            ? `${API_BASE_URL}/admin_orders.php?search=${encodeURIComponent(query)}&_t=${Date.now()}`
            : `${API_BASE_URL}/admin_orders.php?_t=${Date.now()}`;
            
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
};

export const fetchReturns = async () => authFetch('/admin_returns.php');
export const processReturn = async (returnData) => authFetch('/admin_returns.php', { 
    method: 'POST', 
    body: JSON.stringify(returnData) 
});

export const updateOrderStatus = async (id, status) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_orders.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'update_status', id, status }),
        });

        return await response.json();
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
};

export const updatePickerOrderStage = async (id, stage) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_orders.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'picker_update', id, stage }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating picker order stage:', error);
        throw error;
    }
};

export const reportPickerMissingItems = async (id, items) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_orders.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'picker_report_missing', id, items }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error reporting missing picker items:', error);
        throw error;
    }
};

export const resendReceipt = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_orders.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'resend_receipt', id }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error resending receipt:', error);
        throw error;
    }
};

export const verifyDelivery = async (id, otp) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_orders.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'verify_delivery', id, otp }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error verifying delivery:', error);
        throw error;
    }
};

export const fetchPosReturnOrder = (orderId) => {
    const id = String(orderId || '').replace(/^ORD-/i, '').trim();
    return authFetch(`/pos_return.php?order_id=${encodeURIComponent(id)}`);
};

export const processPosReturn = (payload) =>
    authFetch('/pos_return.php', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

// ─── Refunds ──────────────────────────────────────────────────────────────────

/** Fetch refund history + refundable balance for an order. */
export const fetchRefundInfo = (orderId) =>
    authFetch(`/admin_refund.php?order_id=${encodeURIComponent(orderId)}`);

/**
 * Issue a refund.
 * @param {{ order_id: number, amount: number, method: 'paystack'|'cash', return_ids?: number[], note?: string }} payload
 */
export const issueRefund = (payload) =>
    authFetch('/admin_refund.php', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

export const sendBroadcast = async (broadcastData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_broadcast.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(broadcastData),
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending broadcast:', error);
        throw error;
    }
};

export const fetchDeliveryAnalytics = (days = 30) =>
    authFetch(`/admin_delivery_analytics.php?days=${encodeURIComponent(days)}`);

export const fetchNotificationQueue = (status = 'failed', limit = 100) =>
    authFetch(`/admin_notification_queue.php?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`);

export const retryFailedNotificationQueue = () =>
    authFetch('/admin_notification_queue.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry_failed' }),
    });

export const fetchEmailDashboard = ({ status = 'pending', days = 30, limit = 100 } = {}) =>
    authFetch(`/admin_email_dashboard.php?status=${encodeURIComponent(status)}&days=${encodeURIComponent(days)}&limit=${encodeURIComponent(limit)}`);

export const retryAllFailedEmails = () =>
    authFetch('/admin_email_dashboard.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry_failed' }),
    });

export const retryEmailQueueIds = (ids = []) =>
    authFetch('/admin_email_dashboard.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry_ids', ids }),
    });

export const cancelEmailQueueIds = (ids = []) =>
    authFetch('/admin_email_dashboard.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel_ids', ids }),
    });

export const bulkUpdateShelving = (payload) =>
    authFetch('/admin_products.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'bulk_shelving', ...payload }),
    });

export const fetchSlides = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/get_slider.php`);
        const result = await response.json();
        const slides = result.success ? result.data : [];
        return slides.map(slide => ({
            ...slide,
            title: decodeHtml(slide.title),
            subtitle: decodeHtml(slide.subtitle),
            button_text: decodeHtml(slide.button_text),
            image_url: formatImageUrl(slide.image_url)
        }));
    } catch (error) {
        console.error('Error fetching slides:', error);
        return [];
    }
};

export const fetchAdminSlides = async () => {
    try {
        // Typically admin needs all slides (including inactive)
        const response = await fetch(`${API_BASE_URL}/admin_slider.php?_t=${Date.now()}`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        const slides = result.success ? result.data : [];
        return slides.map(slide => ({
            ...slide,
            title: decodeHtml(slide.title),
            subtitle: decodeHtml(slide.subtitle),
            button_text: decodeHtml(slide.button_text),
            image_url: formatImageUrl(slide.image_url)
        }));
    } catch (error) {
        console.error('Error fetching admin slides:', error);
        return [];
    }
};

export const createSlide = async (slideData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_slider.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'create', ...slideData }),
        });

        return await response.json();
    } catch (error) {
        console.error('Error creating slide:', error);
        throw error;
    }
};

export const updateSlide = async (id, slideData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_slider.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'update', id, ...slideData }),
        });

        return await response.json();
    } catch (error) {
        console.error('Error updating slide:', error);
        throw error;
    }
};

export const deleteSlide = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_slider.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'delete', id }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Failed to delete slide');
        }
        return result;
    } catch (error) {
        console.error('Error deleting slide:', error);
        throw error;
    }
};

export const fetchAdminPartners = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_partners.php?_t=${Date.now()}`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();
        const partners = result.success ? result.data : [];
        return partners.map(partner => ({
            ...partner,
            name: decodeHtml(partner.name),
            logo_url: formatImageUrl(partner.logo_url)
        }));
    } catch (error) {
        console.error('Error fetching admin partners:', error);
        return [];
    }
};

export const createPartner = async (partnerData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_partners.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'create', ...partnerData }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating partner:', error);
        throw error;
    }
};

export const updatePartner = async (id, partnerData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_partners.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'update', id, ...partnerData }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating partner:', error);
        throw error;
    }
};

export const deletePartner = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_partners.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'delete', id }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Failed to delete partner');
        }
        return result;
    } catch (error) {
        console.error('Error deleting partner:', error);
        throw error;
    }
};

// ─── Super User Endpoints ─────────────────────────────────────────────────────

export const fetchSuperDashboard = async () => {
    return authFetch('/super_dashboard.php');
};

export const fetchLogs = async () => {
    return authFetch('/super_logs.php');
};

export const clearLogs = async () => {
    return authFetch('/super_logs.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear' }),
    });
};

export const deleteLogDay = async (dateStr) => {
    return authFetch('/super_logs.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_day', date: dateStr }),
    });
};

export const fetchSuperSettings = async () => {
    return authFetch(`/super_settings.php?_t=${Date.now()}`, {
        cache: 'no-store',
    });
};

export const saveSuperSettings = async (payload) => {
    return authFetch('/super_settings.php', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const uploadBrandingAsset = async (file, type, oldPath = '') => {
    try {
        // Import compression utility dynamically
        const { compressImageAuto } = await import('../utils/imageCompression');

        // Compress image before upload (AVIF/WEBP format)
        const compressedBase64 = await compressImageAuto(file, {
            maxWidth: type === 'favicon' ? 64 : 400,
            maxHeight: type === 'favicon' ? 64 : 400,
            targetSize: type === 'favicon' ? 20 * 1024 : 100 * 1024, // 20KB for favicon, 100KB for logo
        });

        // Convert base64 back to File object
        const format = compressedBase64.match(/^data:image\/([a-zA-Z]+);/)?.[1] || 'webp';
        const byteString = atob(compressedBase64.split(',')[1]);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) {
            uint8Array[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([uint8Array], { type: `image/${format}` });
        const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${format}`), { type: `image/${format}` });

        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('type', type);
        formData.append('oldPath', oldPath);

        const response = await fetch(`${API_BASE_URL}/upload_branding.php`, {
            method: 'POST',
            headers: getAuthHeaders(null, null),
            body: formData,
        });
        return await response.json();
    } catch (error) {
        console.error('Error uploading branding asset:', error);
        throw error;
    }
};



export const wipeDemoData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/cleanup_demo.php`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error wiping demo data:', error);
        throw error;
    }
};

export const fetchBackups = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/super_backup.php?action=list`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching backups:', error);
        throw error;
    }
};

export const createBackup = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/super_backup.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'create' }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    }
};

export const deleteBackup = async (filename) => {
    try {
        const response = await fetch(`${API_BASE_URL}/super_backup.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'delete', file: filename }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting backup:', error);
        throw error;
    }
};


export const updateProfile = async (profileData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/update_profile.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(profileData),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, message: 'Network error.' };
    }
};

// --- Reviews ---
export const fetchAllReviews = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_reviews.php?_t=${Date.now()}`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return { success: false, data: [] };
    }
};

export const deleteReview = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_reviews.php`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'delete', id })
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting review:', error);
        throw error;
    }
};

export const fetchAbandonedCarts = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_abandoned_carts.php?_t=${Date.now()}`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching abandoned carts:', error);
        return { success: false, data: [] };
    }
};

export const fetchMissingItemsReports = async (status = 'open', limit = 100) =>
    authFetch(`/admin_missing_items.php?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`);

export const resolveMissingItemsReport = async (id, note = '') =>
    authFetch('/admin_missing_items.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'resolve', id, note }),
    });

export const reopenMissingItemsReport = async (id) =>
    authFetch('/admin_missing_items.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'reopen', id }),
    });

export const resolveMissingItemsWithCustomerAction = async (id, resolution, note = '') =>
    authFetch('/admin_missing_items.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'customer_resolution', id, resolution, note }),
    });

export const requestCustomerMissingItemConfirmation = async (id) =>
    authFetch('/admin_missing_items.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'request_customer_confirmation', id }),
    });

// --- Notifications ---



export const fetchAdminNotifications = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/get_notifications.php?admin=true&_t=${Date.now()}`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching admin notifications:', error);
        return { success: false, data: [] };
    }
};

export const markNotificationRead = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/get_notifications.php?action=mark_read`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id })
        });
        return await response.json();
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};


export const fetchBackend = authFetch;

// --- Pickup Locations (Super Admin) ---
export const fetchPickupLocationsAdmin = async () => authFetch('/admin_pickup_locations.php');

export const createPickupLocation = async (payload) => authFetch('/admin_pickup_locations.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload })
});

export const updatePickupLocation = async (payload) => authFetch('/admin_pickup_locations.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', ...payload })
});

export const deletePickupLocation = async (id) => authFetch('/admin_pickup_locations.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
});

// --- Flash Sale Banner Settings ---
export const fetchFlashSaleBannerSettings = async () => authFetch('/flash_sale_banner_settings.php?admin=true');

export const updateFlashSaleBannerSettings = async (settings) => authFetch('/flash_sale_banner_settings.php?admin=true', {
    method: 'POST',
    body: JSON.stringify(settings)
});
