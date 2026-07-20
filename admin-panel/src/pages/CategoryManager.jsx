import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Save, X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    display_order: 0,
    is_active: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/get_categories.php`);
      const result = await res.json();
      if (result.success) {
        setCategories(result.data || []);
      } else {
        setError('Failed to load categories');
      }
    } catch (err) {
      setError('Error loading categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || '',
        display_order: category.display_order || 0,
        is_active: category.is_active === 1
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        icon: '',
        display_order: 0,
        is_active: true
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      display_order: 0,
      is_active: true
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingCategory ? `${API_BASE}/update_category.php` : `${API_BASE}/create_category.php`;
    const payload = editingCategory ? { ...formData, id: editingCategory.id } : formData;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        handleCloseModal();
        fetchCategories();
      } else {
        setError(result.error || 'Failed to save category');
      }
    } catch (err) {
      setError('Error saving category');
      console.error(err);
    }
  };

  const handleDelete = async (category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/delete_category.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id })
      });
      const result = await res.json();

      if (result.success) {
        fetchCategories();
      } else {
        setError(result.error || 'Failed to delete category');
      }
    } catch (err) {
      setError('Error deleting category');
      console.error(err);
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newCategories = [...categories];
    [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];
    
    // Update display_order for both categories
    newCategories.forEach((cat, idx) => {
      cat.display_order = idx;
    });

    // Save the new order
    newCategories.forEach(cat => {
      fetch(`${API_BASE}/update_category.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, display_order: cat.display_order })
      }).catch(console.error);
    });

    setCategories(newCategories);
  };

  const handleMoveDown = (index) => {
    if (index === categories.length - 1) return;
    const newCategories = [...categories];
    [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];
    
    // Update display_order for both categories
    newCategories.forEach((cat, idx) => {
      cat.display_order = idx;
    });

    // Save the new order
    newCategories.forEach(cat => {
      fetch(`${API_BASE}/update_category.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, display_order: cat.display_order })
      }).catch(console.error);
    });

    setCategories(newCategories);
  };

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading categories...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Category Manager</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Manage product categories for the storefront
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={18} /> Add Category
        </button>
      </div>

      {error && (
        <div className="card" style={{
          padding: '16px',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          borderRadius: '12px',
          border: '1px solid var(--danger)'
        }}>
          {error}
        </div>
      )}

      <div className="card glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Order</th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Name</th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Slug</th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Icon</th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No categories found. Click "Add Category" to create one.
                </td>
              </tr>
            ) : (
              categories.map((category, index) => (
                <tr
                  key={category.id}
                  style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          style={{
                            padding: '2px 6px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-surface)',
                            borderRadius: '4px',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            opacity: index === 0 ? 0.5 : 1,
            fontSize: '10px'
                          }}
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === categories.length - 1}
                          style={{
                            padding: '2px 6px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-surface)',
                            borderRadius: '4px',
                            cursor: index === categories.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: index === categories.length - 1 ? 0.5 : 1,
            fontSize: '10px'
                          }}
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {category.name}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {category.slug}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {category.icon || '-'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: category.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: category.is_active ? 'var(--success)' : 'var(--danger)'
                      }}
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleOpenModal(category)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-light)',
                          background: 'var(--bg-surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
          fontSize: '13px',
          fontWeight: 600
                        }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--danger)',
                          background: 'var(--danger-bg)',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600
        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card glass" style={{
            width: '500px',
            maxWidth: '90%',
            borderRadius: '16px',
            padding: '32px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={handleCloseModal}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--bg-surface-secondary)',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Optics"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                  Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., optics"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Brief description of this category"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                  Icon (Lucide icon name)
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Package, Zap, Cpu"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="is_active" style={{ fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  Active
                </label>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                    fontWeight: 600,
          fontSize: '14px'
        }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
          fontSize: '14px'
        }}
                >
                  <Save size={16} /> {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
