import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, X, Upload, Save, CheckCircle, Image as ImageIcon, Loader, Star, Download, UploadCloud, ShieldAlert, FileText, CheckSquare, Square, MoreVertical } from 'lucide-react';
import Papa from 'papaparse';
import { fetchProducts, createProduct, updateProduct, deleteProduct, formatImageUrl, fetchBatch } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatPrice } from '../utils/formatPrice';
import { compressImageAuto } from '../utils/imageCompression';


const colorsToString = (colors) => Array.isArray(colors) ? colors.join(', ') : '';
const stringToColors = (str) => str.split(',').map(s => s.trim()).filter(s => s !== '');

const includedToString = (included) => Array.isArray(included) ? included.join(', ') : '';
const stringToIncluded = (str) => str.split(',').map(s => s.trim()).filter(s => s !== '');

const specsToString = (specs) => {
  if (!specs || typeof specs !== 'object') return '';
  return Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join('\n');
};
const stringToSpecs = (str) => {
  const specs = {};
  str.split('\n').forEach(line => {
    const [key, ...valParts] = line.split(':');
    if (key && valParts.length > 0) {
      specs[key.trim()] = valParts.join(':').trim();
    }
  });
  return specs;
};

/**
 * Returns true only when a product is actively on promotion:
 * - discount_percent must be > 0
 * - sale_ends_at must be absent OR in the future
 */
const isPromoActive = (product) => {
  if (!product.discount_percent || product.discount_percent <= 0) return false;
  if (!product.sale_ends_at || product.sale_ends_at === '0000-00-00 00:00:00') return true;
  return new Date(product.sale_ends_at) > new Date();
};

const validateShelvingClient = (aisle, rack, bin) => {
  const a = String(aisle || '').trim();
  const r = String(rack || '').trim();
  const b = String(bin || '').trim();
  const hasStruct = Boolean(a || r || b);
  if (!hasStruct) return null;
  if (!a || !r || !b) {
    return 'Aisle, Rack, and Bin must all be filled together, or leave all three empty and use Location only.';
  }
  const pattern = /^[A-Za-z0-9][A-Za-z0-9.\-_]{0,15}$/;
  const check = (label, v) => (pattern.test(v) ? null : `Invalid ${label} format. Use letters/numbers (e.g. A1, R2, B03).`);
  return check('Aisle', a) || check('Rack', r) || check('Bin', b);
};

export default function ProductManager() {
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: '', price: '', stock: '', description: '', image: '',
    rating: 5,
    product_code: '',
    location: '',
    aisle: '',
    rack: '',
    bin: '',
    gallery: ['', '', '', ''],
    variants: [],
    discount_percent: 0,
    sale_ends_at: '',
    datasheet_url: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Bulk actions state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const uniqueCategories = Array.from(new Set([
    ...categories.map(c => c.name),
    ...products.map(p => p.category).filter(Boolean)
  ]));

  const user = JSON.parse(localStorage.getItem('ehub_user') || '{}');
  const isAccountant = user.role === 'accountant';
  const isMarketing = user.role === 'marketing';

  useEffect(() => {
    if (!isAccountant) {
      loadProductsAndCategories();
    }
  }, []);

  const loadProductsAndCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchBatch(['products', 'categories']);
      
      // Process products
      const productsData = data.products || [];
      const mapped = productsData.map(p => {
        const available = parseInt(p.stock_quantity || 0);
        const physical = parseInt(p.physical_stock || available);
        const reserved = physical - available;
        
        return {
            ...p,
            stock: available,
            physical_stock: physical,
            reserved: reserved,
            image: formatImageUrl(p.image_url || p.image),
            status: available <= 0 ? 'Out of Stock' : (available < 10 ? 'Low Stock' : 'In Stock')
        };
      });
      setProducts(mapped);
      
      // Set categories
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load products and categories:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isAccountant) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <ShieldAlert size={64} color="var(--danger)" style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Access Denied</h1>
        <p style={{ color: 'var(--text-muted)' }}>Accounting roles do not have permission to manage store products. Please use the Finance Dashboard.</p>
      </div>
    );
  }



  const loadProducts = async () => {
    setLoading(true);
    const data = await fetchProducts();
    // Map stock_quantity (available) and physical_stock for auditing
    const mapped = data.map(p => {
        const available = parseInt(p.stock_quantity || 0);
        const physical = parseInt(p.physical_stock || available);
        const reserved = physical - available;
        
        return {
            ...p,
            stock: available,
            physical_stock: physical,
            reserved: reserved,
            image: formatImageUrl(p.image_url || p.image),
            status: available <= 0 ? 'Out of Stock' : (available < 10 ? 'Low Stock' : 'In Stock')
        };
    });
    setProducts(mapped);
    setLoading(false);
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      const categoryNames = categories.map(c => c.name);
      const isCustom = product.category && !categoryNames.includes(product.category);
      setIsCustomCategory(isCustom);
      const galleryData = Array.isArray(product.gallery)
        ? [...product.gallery.map(img => formatImageUrl(img)), '', '', '', ''].slice(0, 4)
        : ['', '', '', ''];

      setFormData({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        description: product.description || '',
        image: product.image || '',
        colors: colorsToString(product.colors),
        specs: specsToString(product.specs),
        included: includedToString(product.included),
        rating: product.rating || 5,
        product_code: product.product_code || '',
        location: product.location || '',
        aisle: product.aisle || '',
        rack: product.rack || '',
        bin: product.bin || '',
        gallery: galleryData,
        variants: product.variants || [],
        discount_percent: product.discount_percent ? parseInt(product.discount_percent) : 0,
        sale_ends_at: (product.sale_ends_at && product.sale_ends_at !== '0000-00-00 00:00:00')
            ? String(product.sale_ends_at).substring(0, 16).replace(' ', 'T')
            : '',
        datasheet_url: product.datasheet_url || ''
      });
    } else {
      setEditingProduct(null);
      setIsCustomCategory(false);
      setFormData({
        name: '', category: '', price: '', stock: '', description: '', image: '',
        colors: '', specs: '', included: '', directions: '', status: 'In Stock',
        rating: 5,
        product_code: '',
        location: '',
        aisle: '',
        rack: '',
        bin: '',
        gallery: ['', '', '', ''],
        variants: [],
        discount_percent: 0,
        sale_ends_at: '',
        datasheet_url: ''
      });
    }
    setShowModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image is too large. Max 5MB', 'error');
        return;
      }
      try {
        addToast('Compressing image...', 'info');
        const compressedImage = await compressImageAuto(file);
        setFormData({ ...formData, image: compressedImage });
        addToast('Image compressed successfully', 'success');
      } catch (error) {
        console.error('Image compression failed:', error);
        addToast('Failed to compress image, using original', 'warning');
        // Fallback to original
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, image: reader.result });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleGalleryUpload = async (index, e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image is too large. Max 5MB', 'error');
        return;
      }
      try {
        addToast('Compressing gallery image...', 'info');
        const compressedImage = await compressImageAuto(file);
        const newGallery = [...formData.gallery];
        newGallery[index] = compressedImage;
        setFormData({ ...formData, gallery: newGallery });
        addToast('Gallery image compressed successfully', 'success');
      } catch (error) {
        console.error('Image compression failed:', error);
        addToast('Failed to compress image, using original', 'warning');
        // Fallback to original
        const reader = new FileReader();
        reader.onloadend = () => {
          const newGallery = [...formData.gallery];
          newGallery[index] = reader.result;
          setFormData({ ...formData, gallery: newGallery });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.type !== 'application/pdf') {
            addToast('Please upload a PDF file', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            addToast('File is too large. Max 10MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData({ ...formData, directions: reader.result });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasLegacyLocation = Boolean((formData.location || '').trim());
    const hasStructuredShelving = [formData.aisle, formData.rack, formData.bin].some((value) => Boolean((value || '').trim()));
    if (!hasLegacyLocation && !hasStructuredShelving) {
        const confirmSave = await confirm("Shelving location is missing (Aisle/Rack/Bin). Are you sure you want to save without a shelf location?");
        if (!confirmSave) return;
    }

    const shelfErr = validateShelvingClient(formData.aisle, formData.rack, formData.bin);
    if (shelfErr) {
      addToast(shelfErr, 'error');
      return;
    }

    setSaving(true);
    
    // Prepare data for API (convert strings back to JSON where necessary)
    const apiData = {
        ...formData,
        colors: JSON.stringify(stringToColors(formData.colors)),
        included: JSON.stringify(stringToIncluded(formData.included)),
        specs: JSON.stringify(stringToSpecs(formData.specs)),
        gallery: formData.gallery.filter(img => img !== ''),
        variants: formData.variants,
        discount_percent: parseInt(formData.discount_percent) || 0,
        sale_ends_at: formData.sale_ends_at || null,
        aisle: formData.aisle || '',
        rack: formData.rack || '',
        bin: formData.bin || ''
    };

    console.log("Saving Product - ID:", editingProduct?.id, "Payload:", apiData);

    try {
      if (editingProduct) {
        const res = await updateProduct(editingProduct.id, apiData);
        if (!res.success) throw new Error(res.error || res.message || 'Failed to update product');
      } else {
        const res = await createProduct(apiData);
        if (!res.success) throw new Error(res.error || res.message || 'Failed to create product');
      }
      addToast(editingProduct ? 'Product updated successfully' : 'Product created successfully', 'success');
      handleCloseModal();
      loadProducts();
    } catch (err) {
      console.error("Save error:", err);
      addToast(err.message || 'Error saving product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (await confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        loadProducts();
      } catch (error) {
        console.error("Delete error:", error);
        alert(error.message || 'Failed to delete product');
      }

    }
  };

  // Bulk action handlers
  const handleSelectProduct = (id) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;

    const confirmed = await confirm(`Are you sure you want to delete ${selectedProducts.size} products?`);
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('ehub_token');
      const promises = Array.from(selectedProducts).map(id =>
        fetch(`${API_BASE}/admin_products.php`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-App-ID': 'admin'
          },
          body: JSON.stringify({ id })
        })
      );

      await Promise.all(promises);
      addToast(`${selectedProducts.size} products deleted successfully`, 'success');
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      addToast('Failed to delete products', 'error');
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedProducts.size === 0) return;

    try {
      const token = localStorage.getItem('ehub_token');
      const promises = Array.from(selectedProducts).map(id =>
        fetch(`${API_BASE}/admin_products.php`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-App-ID': 'admin'
          },
          body: JSON.stringify({ id, status: newStatus })
        })
      );

      await Promise.all(promises);
      addToast(`${selectedProducts.size} products updated to ${newStatus}`, 'success');
      setSelectedProducts(new Set());
      setBulkAction(null);
      loadProducts();
    } catch (error) {
      addToast('Failed to update products', 'error');
    }
  };

  const handleBulkCategoryUpdate = async (newCategory) => {
    if (selectedProducts.size === 0) return;

    try {
      const token = localStorage.getItem('ehub_token');
      const promises = Array.from(selectedProducts).map(id =>
        fetch(`${API_BASE}/admin_products.php`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-App-ID': 'admin'
          },
          body: JSON.stringify({ id, category: newCategory })
        })
      );

      await Promise.all(promises);
      addToast(`${selectedProducts.size} products moved to ${newCategory}`, 'success');
      setSelectedProducts(new Set());
      setBulkAction(null);
      loadProducts();
    } catch (error) {
      addToast('Failed to update products', 'error');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'All' || product.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const handleExportCSV = () => {
    const dataToExport = filteredProducts.map(p => ({
      ID: p.id,
      Name: p.name,
      Code: p.product_code || '',
      Category: p.category,
      Price: p.price,
      AvailableStock: p.stock,
      PhysicalStock: p.physical_stock || p.stock,
      Reserved: p.reserved || 0,
      Location: p.location || '',
      Aisle: p.aisle || '',
      Rack: p.rack || '',
      Bin: p.bin || '',
      Status: p.status,
      Rating: p.rating || 5,
      Description: p.description || '',
      Colors: colorsToString(p.colors),
      Included: includedToString(p.included),
      DiscountPercent: p.discount_percent || 0,
      SaleEndsAt: p.sale_ends_at || ''
    }));
    
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('url');
    const url = URL.createObjectURL(blob);
    
    let a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSVClick = () => {
    fileInputRef.current.click();
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          let successCount = 0;
          let errorCount = 0;

          for (const row of rows) {
              const existingProduct = row.ID ? products.find(p => String(p.id) === String(row.ID)) : null;

              const apiData = {
                name: row.Name !== undefined ? row.Name : (existingProduct ? existingProduct.name : 'Unnamed Product'),
                product_code: row.Code !== undefined ? row.Code : (existingProduct ? existingProduct.product_code : ''),
                category: row.Category !== undefined ? row.Category : (existingProduct ? existingProduct.category : 'Passives'),
                price: row.Price !== undefined ? row.Price : (existingProduct ? existingProduct.price : 0),
                stock: row.Stock !== undefined ? row.Stock : (existingProduct ? existingProduct.stock : 0),
                location: row.Location !== undefined ? row.Location : (existingProduct ? existingProduct.location : ''),
                aisle: row.Aisle !== undefined ? row.Aisle : (existingProduct ? existingProduct.aisle : ''),
                rack: row.Rack !== undefined ? row.Rack : (existingProduct ? existingProduct.rack : ''),
                bin: row.Bin !== undefined ? row.Bin : (existingProduct ? existingProduct.bin : ''),
                rating: row.Rating !== undefined ? row.Rating : (existingProduct ? existingProduct.rating : 5),
                description: row.Description !== undefined ? row.Description : (existingProduct ? existingProduct.description : ''),
                image: existingProduct ? (existingProduct.image || existingProduct.image_url || '') : '',
                colors: row.Colors !== undefined ? JSON.stringify(stringToColors(row.Colors)) : (existingProduct ? JSON.stringify(existingProduct.colors || []) : '[]'),
                specs: existingProduct ? JSON.stringify(existingProduct.specs || {}) : '{}',
                included: row.Included !== undefined ? JSON.stringify(stringToIncluded(row.Included)) : (existingProduct ? JSON.stringify(existingProduct.included || []) : '[]'),
                discount_percent: row.DiscountPercent !== undefined ? parseInt(row.DiscountPercent) : (existingProduct ? existingProduct.discount_percent : 0),
                sale_ends_at: row.SaleEndsAt !== undefined ? row.SaleEndsAt : (existingProduct ? existingProduct.sale_ends_at : ''),
                directions: existingProduct ? (existingProduct.directions || '') : '',
                gallery: existingProduct ? (existingProduct.gallery || []) : []
              };

            try {
              if (existingProduct) {
                  await updateProduct(existingProduct.id, apiData);
              } else {
                  await createProduct(apiData);
              }
              successCount++;
            } catch (err) {
              console.error("Failed to import row:", row, err);
              errorCount++;
            }
          }
          
          alert(`Import complete. Successfully imported: ${successCount}. Errors: ${errorCount}.`);
          loadProducts();
        } catch (error) {
           console.error("CSV Import error:", error);
           alert("Failed to process CSV file.");
        } finally {
           setIsImporting(false);
           // Reset file input
           if (fileInputRef.current) {
             fileInputRef.current.value = '';
           }
        }
      },
      error: (error) => {
        console.error("CSV Parse error:", error);
        alert("Error parsing CSV file.");
        setIsImporting(false);
      }
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px' }}>
        <Loader className="animate-spin" size={48} color="var(--primary-blue)" />
        <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Loading Catalog...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Products</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your catalog and inventory.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)' }}>
            <Download size={18} /> Export CSV
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            style={{ display: 'none' }} 
          />
          <button className="btn" onClick={handleImportCSVClick} disabled={isImporting} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-light)' }}>
            {isImporting ? <Loader className="animate-spin" size={18} /> : <UploadCloud size={18} />} Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> Add Product
          </button>
        </div>
      </header>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 40px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedProducts.size > 0 && (
              <>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedProducts.size} selected
                </span>
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="btn"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'var(--primary-blue)',
                      color: 'white'
                    }}
                  >
                    <MoreVertical size={18} /> Bulk Actions
                  </button>
                  {showBulkActions && (
                    <>
                      <div 
                        onClick={() => setShowBulkActions(false)}
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '8px',
                        minWidth: '200px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        zIndex: 100
                      }}>
                      <button
                        onClick={handleBulkDelete}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          textAlign: 'left',
                          background: 'transparent',
                          color: 'var(--danger)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 500,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={16} /> Delete Selected
                      </button>
                      <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
                      <button
                        onClick={() => handleBulkStatusUpdate('In Stock')}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          textAlign: 'left',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 500,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <CheckCircle size={16} /> Set In Stock
                      </button>
                      <button
                        onClick={() => handleBulkStatusUpdate('Out of Stock')}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          textAlign: 'left',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 500,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <ShieldAlert size={16} /> Set Out of Stock
                      </button>
                    </div>
                  </>
                )}
                </div>
              </>
            )}
            <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="btn" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: filterCategory !== 'All' ? 'var(--primary-blue)' : 'var(--bg-surface-secondary)',
                color: filterCategory !== 'All' ? 'white' : 'var(--text-main)'
              }}
            >
              <Filter size={18} /> {filterCategory !== 'All' ? filterCategory : 'Filters'}
            </button>
            {showFilterMenu && (
              <>
                <div 
                  onClick={() => setShowFilterMenu(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: '180px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                  zIndex: 100
                }}>
                  {['All', ...uniqueCategories].map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setFilterCategory(cat);
                        setShowFilterMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        textAlign: 'left',
                        background: filterCategory === cat ? 'var(--primary-blue)' : 'transparent',
                        color: filterCategory === cat ? 'white' : 'var(--text-main)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: filterCategory === cat ? 600 : 400,
                        transition: 'all 0.2s',
                        marginBottom: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (filterCategory !== cat) {
                          e.currentTarget.style.background = 'var(--bg-surface-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (filterCategory !== cat) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 24px', width: '40px' }}>
                  <button
                    onClick={handleSelectAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                      <CheckSquare size={18} style={{ color: 'var(--primary-blue)' }} />
                    ) : (
                      <Square size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '16px 24px' }}>Product</th>
                <th style={{ padding: '16px 24px' }}>Category</th>
                <th style={{ padding: '16px 24px' }}>Price</th>
                <th style={{ padding: '16px 24px' }}>Stock</th>
                <th style={{ padding: '16px 24px' }}>Location</th>
                <th style={{ padding: '16px 24px' }}>Status</th>
                <th style={{ padding: '16px 24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => (
                <tr 
                  key={p.id} 
                  className="animate-fade-in"
                  style={{ 
                    borderBottom: '1px solid var(--border-light)', 
                    fontSize: '14px',
                    animationDelay: `${idx * 0.05}s`,
                    animationFillMode: 'both',
                    background: selectedProducts.has(p.id) ? 'var(--bg-surface-secondary)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <button
                      onClick={() => handleSelectProduct(p.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {selectedProducts.has(p.id) ? (
                        <CheckSquare size={18} style={{ color: 'var(--primary-blue)' }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.image ? (
                          <img src={p.image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <ImageIcon size={16} opacity={0.3} />
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                          {p.product_code && <span style={{ fontSize: '11px', color: 'var(--primary-blue)', fontWeight: 700 }}>{p.product_code}</span>}
                          {isPromoActive(p) && (
                            <span style={{ 
                              fontSize: '10px', 
                              color: 'white', 
                              background: 'var(--danger)', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontWeight: 800,
                              textTransform: 'uppercase'
                            }}>
                              -{p.discount_percent}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{p.category}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: isPromoActive(p) ? 'var(--success)' : 'inherit' 
                      }}>
                        {formatPrice(isPromoActive(p) 
                          ? (p.price * (1 - p.discount_percent / 100))
                          : p.price)}
                      </span>
                      {isPromoActive(p) && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          {formatPrice(p.price)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{p.stock}</span>
                      {p.reserved > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                          ({p.reserved} reserved)
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {p.aisle || p.rack || p.bin ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {p.aisle && <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>A:{p.aisle}</span>}
                        {p.rack && <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>R:{p.rack}</span>}
                        {p.bin && <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>B:{p.bin}</span>}
                      </div>
                    ) : (
                      (p.location ? (
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: 'var(--accent-blue)',
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}>
                          {p.location}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                      ))
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '100px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    background: p.status === 'In Stock' ? 'var(--success-bg)' : 
                                p.status === 'Low Stock' ? 'var(--warning-bg)' : 
                                (p.status === 'Out of Stock' || p.status === 'Suspended') ? 'var(--danger-bg)' : 'rgba(100, 116, 139, 0.1)',
                    color: p.status === 'In Stock' ? 'var(--success)' : 
                           p.status === 'Low Stock' ? 'var(--warning)' : 
                           (p.status === 'Out of Stock' || p.status === 'Suspended') ? 'var(--danger)' : 'var(--text-muted)'
                  }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(p); }} title="Edit Product" style={{ padding: '8px', color: 'var(--primary-blue)', background: 'var(--info-bg)', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={16} /></button>
                    {!isMarketing && (
                      <button className="btn" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} title="Delete Product" style={{ padding: '8px', color: 'var(--danger)', background: 'var(--danger-bg)', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    )}
                  </div>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '12px',
          overflowY: 'auto'
        }}>
          <div className="card glass" style={{
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            margin: 'auto'
          }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 800 }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Product Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                      placeholder="e.g. Sony WH-1000XM5"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Part Code</label>
                    <input 
                      type="text" 
                      value={formData.product_code}
                      onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                      placeholder="e.g. NE555"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Datasheet URL</label>
                    <input 
                      type="url" 
                      value={formData.datasheet_url}
                      onChange={(e) => setFormData({ ...formData, datasheet_url: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                      placeholder="https://example.com/datasheet.pdf"
                    />
                  </div>
                </div>

                <div style={{ padding: '18px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.03))', border: '1px solid rgba(59, 130, 246, 0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                  <label style={{ display: 'block', marginBottom: '14px', fontSize: '12px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shelving Location (Global Warehouse)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Aisle</label>
                      <input 
                        type="text" 
                        value={formData.aisle}
                        onChange={(e) => setFormData({ ...formData, aisle: e.target.value.toUpperCase() })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)', background: 'var(--bg-surface)', color: 'var(--text-main)', outline: 'none', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em' }}
                        placeholder="e.g. A1"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Rack</label>
                      <input 
                        type="text" 
                        value={formData.rack}
                        onChange={(e) => setFormData({ ...formData, rack: e.target.value.toUpperCase() })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)', background: 'var(--bg-surface)', color: 'var(--text-main)', outline: 'none', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em' }}
                        placeholder="e.g. S4"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Bin</label>
                      <input 
                        type="text" 
                        value={formData.bin}
                        onChange={(e) => setFormData({ ...formData, bin: e.target.value.toUpperCase() })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)', background: 'var(--bg-surface)', color: 'var(--text-main)', outline: 'none', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em' }}
                        placeholder="e.g. 102"
                      />
                    </div>
                  </div>
                </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600 }}>Category</label>
                    <button 
                      type="button" 
                      onClick={() => setIsCustomCategory(!isCustomCategory)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary-blue)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '0' }}
                    >
                      {isCustomCategory ? 'Select Existing' : '+ Add Custom'}
                    </button>
                  </div>
                  {isCustomCategory ? (
                    <input 
                      type="text" 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Cables & Wire"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                      required
                    />
                  ) : (
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                      required
                    >
                      <option value="">Select Category</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Price (GH₵)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Stock Qty</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.stock}
                    onChange={(e) => {
                      const val = e.target.value;
                      const stockVal = parseInt(val) || 0;
                      let newStatus = 'In Stock';
                      if (stockVal <= 0) newStatus = 'Out of Stock';
                      else if (stockVal < 10) newStatus = 'Low Stock';
                      setFormData({ ...formData, stock: val, status: newStatus });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Star Rating (1-5)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-surface-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                            key={star}
                            size={20}
                            fill={star <= formData.rating ? "#fbbf24" : "transparent"}
                            color={star <= formData.rating ? "#fbbf24" : "var(--text-muted)"}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => setFormData({ ...formData, rating: star })}
                        />
                    ))}
                    <span style={{ marginLeft: '8px', fontWeight: 700, color: 'var(--primary-blue)' }}>{formData.rating}.0</span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Product Status (Auto-calculated)</label>
                  <div style={{ 
                    width: '100%', 
                    padding: '10px 14px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-light)', 
                    background: 'rgba(0,0,0,0.05)', 
                    color: formData.status === 'In Stock' ? 'var(--success)' : 
                           formData.status === 'Low Stock' ? 'var(--warning)' : 'var(--danger)',
                    fontWeight: 700,
                    fontSize: '14px'
                  }}>
                    {formData.status}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Available Colors</label>
                  <input 
                    type="text" 
                    value={formData.colors}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="Red, Blue, Black..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Included Items</label>
                  <input 
                    type="text" 
                    value={formData.included}
                    onChange={(e) => setFormData({ ...formData, included: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="Unit, Charger, Manual..."
                  />
                </div>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', marginBottom: '16px' }}>
                  <ImageIcon size={16} /> FLASH SALE CONFIGURATION
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Discount Percent (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="99"
                      value={formData.discount_percent}
                      onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                      style={{ 
                        width: '100%', 
                        padding: '12px 14px', 
                        borderRadius: '8px', 
                        border: '2px solid var(--border-light)', 
                        background: 'var(--bg-surface-secondary) !important', 
                        color: 'var(--text-main) !important', 
                        outline: 'none',
                        fontWeight: '600'
                      }}
                      placeholder="e.g. 20"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Sale End Date & Time</label>
                    <input 
                      type="datetime-local" 
                      value={formData.sale_ends_at}
                      onChange={(e) => setFormData({ ...formData, sale_ends_at: e.target.value })}
                      style={{ 
                        width: '100%', 
                        padding: '12px 14px', 
                        borderRadius: '8px', 
                        border: '2px solid var(--border-light)', 
                        background: 'var(--bg-surface-secondary) !important', 
                        color: 'var(--text-main) !important', 
                        outline: 'none',
                        fontWeight: '600'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Specifications</label>
                  <textarea 
                    value={formData.specs}
                    onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none', minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    placeholder="Brand: Sony&#10;Model: XM5..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Directions (PDF File)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '10px 14px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-light)', 
                        background: 'var(--bg-surface-secondary)', 
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}>
                        <Upload size={16} /> 
                        {formData.directions && formData.directions.startsWith('data:') ? 'Change PDF' : (formData.directions ? 'PDF Uploaded' : 'Upload Directions PDF')}
                        <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
                    </label>
                    {formData.directions && (
                        <div style={{ fontSize: '12px', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            <FileText size={14} /> 
                            {formData.directions.startsWith('http') ? (
                                <a href={formData.directions} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View Current PDF</a>
                            ) : 'New PDF ready for upload'}
                            <button type="button" onClick={() => setFormData({...formData, directions: ''})} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px' }}>Remove</button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Product Image</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px',
                    padding: '32px', 
                    border: '2px dashed var(--border-light)', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: 'var(--bg-surface-secondary)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '100px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-blue)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                  >
                    {formData.image ? (
                        <>
                            <img src={formData.image} alt="Preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2 }} />
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', color: 'white', fontWeight: 600 }}>
                                <Upload size={18} /> Change Image
                            </div>
                        </>
                    ) : (
                        <>
                            <Upload size={20} />
                            <span style={{ fontSize: '14px', fontWeight: 600 }}>Click to upload product image</span>
                        </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  {formData.image && (
                     <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} color="var(--success)" /> Image ready for upload
                        <button type="button" onClick={() => setFormData({...formData, image: ''})} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Remove</button>
                     </div>
                  )}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>Product Gallery (up to 4 extra images)</label>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Click a slot to upload, or paste a URL below each slot.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {formData.gallery.map((img, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ 
                        aspectRatio: '1/1', 
                        border: img ? '2px solid var(--primary-blue)' : '2px dashed var(--border-light)', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: 'var(--bg-surface-secondary)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {img ? (
                          <>
                            <img src={img} alt={`Gallery ${idx+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              onError={(e) => { e.target.style.display='none'; }}
                            />
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.preventDefault();
                                const newGallery = [...formData.gallery];
                                newGallery[idx] = '';
                                setFormData({ ...formData, gallery: newGallery });
                              }} 
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', zIndex: 2 }}
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                            <Plus size={20} />
                            <span style={{ fontSize: '10px' }}>Image {idx + 1}</span>
                          </div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handleGalleryUpload(idx, e)} style={{ display: 'none' }} />
                      </label>
                      <input
                        type="text"
                        placeholder="Paste URL..."
                        value={img && (img.startsWith('http') || img.startsWith('//')) ? img : ''}
                        onChange={(e) => {
                          const newGallery = [...formData.gallery];
                          newGallery[idx] = e.target.value;
                          setFormData({ ...formData, gallery: newGallery });
                        }}
                        style={{ 
                          width: '100%', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-light)', 
                          background: 'var(--bg-surface-secondary)', 
                          color: 'var(--text-main)', 
                          fontSize: '11px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>General Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Marketing text and general overview..."
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                   <label style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Product Variants (SKUs)</label>
                   <button 
                     type="button" 
                     className="btn-outline" 
                     onClick={() => setFormData({...formData, variants: [...formData.variants, { sku: '', attributes: '', price_modifier: 0, stock_quantity: 0, image_url: '' }]})}
                     style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                   >
                     <Plus size={14} /> Add Variant
                   </button>
                </div>
                
                {formData.variants.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {formData.variants.map((v, idx) => (
                      <div key={idx} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', display: 'grid', gap: '12px', position: 'relative' }}>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newV = [...formData.variants];
                            newV.splice(idx, 1);
                            setFormData({...formData, variants: newV});
                          }}
                          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Variant SKU/Code</label>
                            <input value={v.sku} onChange={e => {
                                const newV = [...formData.variants];
                                newV[idx].sku = e.target.value;
                                setFormData({...formData, variants: newV});
                            }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }} placeholder="e.g. WH1000XM5-BLK" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Variant Name/Attributes</label>
                            <input value={v.attributes} onChange={e => {
                                const newV = [...formData.variants];
                                newV[idx].attributes = e.target.value;
                                setFormData({...formData, variants: newV});
                            }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }} placeholder="e.g. 128GB - Red" />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Price (GH₵) *</label>
                            <input type="number" step="0.01" value={v.price_modifier} onChange={e => {
                                const newV = [...formData.variants];
                                newV[idx].price_modifier = parseFloat(e.target.value) || 0;
                                setFormData({...formData, variants: newV});
                            }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }} placeholder="0.00" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Variant Stock</label>
                            <input type="number" value={v.stock_quantity} onChange={e => {
                                const newV = [...formData.variants];
                                newV[idx].stock_quantity = parseInt(e.target.value) || 0;
                                setFormData({...formData, variants: newV});
                            }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }} placeholder="0" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Image URL (Optional)</label>
                            <input value={v.image_url} onChange={e => {
                                const newV = [...formData.variants];
                                newV[idx].image_url = e.target.value;
                                setFormData({...formData, variants: newV});
                            }} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '13px' }} placeholder="https://..." />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-light)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No variants added. The main product details will be used.
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: '12px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px' }}
                >
                  {saving ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <Save size={20} />
                  )}
                  {saving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
