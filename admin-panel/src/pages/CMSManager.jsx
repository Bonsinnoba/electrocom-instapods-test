import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Check, X, FileText, Globe, EyeOff, Save, ShieldCheck, Search, ChevronRight, Layout, ArrowLeft, History } from 'lucide-react';
import { fetchCMSPages, saveCMSPage, deleteCMSPage, getCMSPage } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const SYSTEM_PAGES = ['privacy-policy', 'terms-of-service', 'return-policy', 'shipping-info'];

export default function CMSManager() {
  const { confirm } = useConfirm();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    slug: '',
    content: '',
    is_published: 0
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image', 'video'],
      ['clean']
    ],
  };

  const loadPages = async () => {
    setLoading(true);
    try {
      const res = await fetchCMSPages();
      if (res.success) {
        setPages(res.data || []);
      } else {
        setError('Failed to load pages');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const filteredPages = useMemo(() => {
    return pages.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pages, searchQuery]);

  const handleEdit = async (pageSummary) => {
    setIsEditing(true);
    setSaveLoading(true);
    try {
       const res = await getCMSPage(pageSummary.slug);
       if (res.success && res.data) {
           setFormData({
               id: res.data.id,
               title: res.data.title,
               slug: res.data.slug,
               content: res.data.content || '',
               is_published: parseInt(res.data.is_published) || 0
           });
       }
    } catch(e) {
       alert("Failed to load page content.");
       setIsEditing(false);
    } finally {
        setSaveLoading(false);
    }
  };

  const handleCreateNew = () => {
    setFormData({ id: null, title: '', slug: '', content: '', is_published: 0 });
    setIsEditing(true);
  };

  const handleDelete = async (id, slug) => {
    if (SYSTEM_PAGES.includes(slug)) {
        alert("This is a system-required page and cannot be deleted.");
        return;
    }
    if (!(await confirm("Are you sure you want to delete this page? This cannot be undone."))) return;
    try {
      const res = await deleteCMSPage(id);
      if (res.success) {
        loadPages();
      } else {
        alert("Failed to delete page.");
      }
    } catch (e) {
      alert("Error deleting page: " + e.message);
    }
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.title || !formData.slug) {
        alert("Title and URL Slug are required.");
        return;
    }
    
    setSaveLoading(true);
    try {
        const res = await saveCMSPage(formData);
        if (res.success) {
            setIsEditing(false);
            loadPages();
        } else {
            alert(res.error || "Failed to save page.");
        }
    } catch (e) {
        alert("Error saving page: " + e.message);
    } finally {
        setSaveLoading(false);
    }
  };

  const handleSlugify = () => {
      const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      setFormData({...formData, slug});
  };

  return (
    <div className="cms-manager-container animate-fade-in">
      <header className="cms-header">
        <div className="cms-title-area">
          {isEditing && (
             <button onClick={() => setIsEditing(false)} className="back-btn glass">
                <ArrowLeft size={18} />
             </button>
          )}
          <div className="cms-title-text">
            <div className="cms-badge-top">
               <span className="dot"></span>
               Storefront Content
            </div>
            <h1>{isEditing ? (formData.id ? 'Edit Page' : 'New Page') : 'Content Hub'}</h1>
          </div>
        </div>

        <div className="cms-actions">
           {!isEditing ? (
             <>
               <div className="search-box glass">
                  <Search size={16} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search pages..."
                  />
               </div>
               <button onClick={handleCreateNew} className="btn-primary-cms">
                 <Plus size={18} /> Add Page
               </button>
             </>
           ) : (
             <button onClick={handleSave} disabled={saveLoading} className="btn-primary-cms deploy-btn">
                {saveLoading ? <span className="loading-spinner"></span> : <Save size={18} />}
                {saveLoading ? 'Deploying...' : 'Save & Publish'}
             </button>
           )}
        </div>
      </header>

      {error && (
        <div className="cms-error-alert animate-shake">
          <X size={18} /> {error}
        </div>
      )}

      {isEditing ? (
        <div className="cms-editor-workspace">
           <aside className="meta-controls">
              <section className="meta-card glass">
                 <div className="section-head">
                    <ShieldCheck size={14} /> Page Metadata
                 </div>
                 
                 <div className="control-group">
                    <label>Visible Title</label>
                    <input 
                       type="text" 
                       value={formData.title}
                       onChange={(e) => setFormData({...formData, title: e.target.value})}
                       onBlur={!formData.id && !formData.slug ? handleSlugify : undefined}
                       placeholder="e.g. About Us"
                    />
                 </div>

                 <div className="control-group">
                    <label className="flex-spread">
                       URL Segment
                       <span onClick={handleSlugify} className="text-link">Sync</span>
                    </label>
                    <div className="slug-input-wrapper">
                       <span className="prefix">/</span>
                       <input 
                        type="text" 
                        value={formData.slug}
                        onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                        placeholder="about-us"
                       />
                    </div>
                 </div>

                 <div className="status-toggle-container pt-line">
                    <div className="section-head">
                       <Globe size={14} /> Visibility
                    </div>
                    <label className="toggle-box">
                       <input 
                          type="checkbox" 
                          checked={formData.is_published === 1}
                          onChange={(e) => setFormData({...formData, is_published: e.target.checked ? 1 : 0})}
                       />
                       <div className="toggle-text">
                          <p>Publicly Published</p>
                          <span>Visible to all storefront visitors</span>
                       </div>
                    </label>
                 </div>
              </section>

              {SYSTEM_PAGES.includes(formData.slug) && (
                 <div className="system-alert-card">
                    <ShieldCheck size={18} />
                    <div>
                       <p className="bold">System Required</p>
                       <p className="small">Affects core storefront logic.</p>
                    </div>
                 </div>
              )}
           </aside>

           <main className="editor-canvas glass">
              <div className="canvas-header">
                 <div className="window-dots">
                    <span></span><span></span><span></span>
                 </div>
                 <span className="header-label">Rich Text Canvas</span>
              </div>
              <div className="quill-wrapper">
                 <ReactQuill 
                    theme="snow" 
                    value={formData.content} 
                    onChange={(val) => setFormData({...formData, content: val})} 
                    modules={modules}
                    placeholder="Refine your content..."
                 />
              </div>
           </main>
        </div>
      ) : (
        <div className="cms-catalog">
           {loading ? (
             <div className="skeleton-grid">
                {[1,2,3].map(i => <div key={i} className="skeleton-card glass animate-pulse"></div>)}
             </div>
           ) : filteredPages.length === 0 ? (
             <div className="empty-state glass">
                 <FileText size={48} />
                 <h3>The library is empty</h3>
                 <p>Your custom pages will appear here. Start by creating a new entry.</p>
                 <button onClick={handleCreateNew} className="btn-primary-cms">Create Page</button>
             </div>
           ) : (
             <div className="catalog-grid">
                 {filteredPages.map(page => (
                    <div 
                       key={page.id} 
                       className="page-card glass animate-fade-in"
                       onClick={() => handleEdit(page)}
                    >
                       <div className="card-top">
                          <div className="card-icon">
                             <FileText size={20} />
                          </div>
                          <div className="card-quick-actions">
                             <button onClick={(e) => { e.stopPropagation(); handleEdit(page); }} className="action-btn edit-btn"><Edit size={12} /></button>
                             {!SYSTEM_PAGES.includes(page.slug) && (
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(page.id, page.slug); }} className="action-btn delete-btn"><Trash2 size={12} /></button>
                             )}
                          </div>
                       </div>

                       <div className="card-body">
                          <h4>{page.title}</h4>
                          <span className="slug-badge">/{page.slug}</span>
                          {SYSTEM_PAGES.includes(page.slug) && <span className="system-badge"><ShieldCheck size={10}/> SYSTEM</span>}
                       </div>

                       <div className="card-footer">
                          <div className="status-pill">
                             <span className={parseInt(page.is_published) === 1 ? 'live' : 'draft'}></span>
                             {parseInt(page.is_published) === 1 ? 'Live' : 'Draft'}
                          </div>
                          <span className="date-text">{new Date(page.updated_at).toLocaleDateString()}</span>
                       </div>
                    </div>
                 ))}
             </div>
           )}
        </div>
      )}

      <style>{`
        .cms-manager-container { padding-bottom: 50px; }
        
        .cms-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px; flex-wrap: wrap; gap: 20px; }
        .cms-title-area { display: flex; align-items: center; gap: 15px; }
        .cms-title-text h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
        .cms-badge-top { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-blue); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .cms-badge-top .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-blue); }
        
        .cms-actions { display: flex; align-items: center; gap: 12px; }
        .search-box { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 12px; min-width: 250px; }
        .search-box input { background: transparent; border: none; outline: none; color: var(--text-main); font-size: 14px; width: 100%; }
        .search-box svg { color: var(--text-muted); }
        
        .btn-primary-cms { background: var(--primary-blue); color: #fff; padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 15px rgba(var(--primary-blue-rgb), 0.2); }
        .btn-primary-cms:hover { background: var(--accent-blue); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(var(--accent-blue-rgb), 0.3); }
        .deploy-btn { padding: 12px 28px; font-size: 16px; border-radius: 16px; }
        
        .back-btn { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); cursor: pointer; border: 1px solid var(--border-light); }
        .back-btn:hover { color: var(--primary-blue); border-color: var(--primary-blue); }

        /* Catalog Layout */
        .catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .page-card { padding: 20px; border-radius: 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1.5px solid var(--border-light); }
        .page-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px -15px rgba(0,0,0,0.1); border-color: var(--accent-blue); }
        
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .card-icon { width: 42px; height: 42px; background: var(--bg-surface-secondary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .page-card:hover .card-icon { background: rgba(var(--accent-blue-rgb), 0.1); color: var(--accent-blue); }
        
        .card-quick-actions { display: flex; gap: 6px; opacity: 0; transform: translateX(10px); transition: all 0.2s; }
        .page-card:hover .card-quick-actions { opacity: 1; transform: translateX(0); }
        .action-btn { width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .edit-btn { background: rgba(var(--accent-blue-rgb), 0.1); color: var(--accent-blue); }
        .delete-btn { background: var(--danger-bg); color: var(--danger); }
        .action-btn:hover { background: var(--text-main); color: var(--bg-surface); }

        .card-body h4 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
        .slug-badge { font-family: monospace; font-size: 11px; color: var(--text-muted); }
        .system-badge { font-size: 10px; font-weight: 800; color: var(--accent-blue); background: rgba(var(--accent-blue-rgb), 0.05); padding: 2px 6px; border-radius: 4px; margin-left: 8px; }

        .card-footer { margin-top: 25px; pt: 15px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; padding-top: 15px; }
        .status-pill { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); }
        .status-pill span { width: 6px; height: 6px; border-radius: 50%; }
        .status-pill .live { background: var(--success); box-shadow: 0 0 8px var(--success); }
        .status-pill .draft { background: var(--warning); }
        .date-text { font-size: 11px; font-weight: 600; color: var(--text-muted); opacity: 0.6; }

        /* Workspace Layout */
        .cms-editor-workspace { display: grid; grid-template-columns: 320px 1fr; gap: 30px; }
        .meta-card { padding: 24px; border-radius: 20px; display: flex; flex-direction: column; gap: 20px; }
        .section-head { font-size: 11px; font-weight: 900; color: var(--text-muted); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; }
        
        .control-group label { display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; margin-left: 4px; }
        .control-group input { width: 100%; padding: 12px 16px; background: var(--bg-surface-secondary); border: 1.5px solid var(--border-light); border-radius: 12px; color: var(--text-main); outline: none; transition: all 0.2s; }
        .control-group input:focus { border-color: var(--accent-blue); }
        
        .flex-spread { display: flex; justify-content: space-between; }
        .text-link { color: var(--accent-blue); cursor: pointer; font-size: 11px; border-bottom: 1px dashed transparent; }
        .text-link:hover { border-bottom-color: currentColor; }

        .slug-input-wrapper { display: flex; align-items: center; relative; }
        .slug-input-wrapper .prefix { position: absolute; left: 14px; color: var(--text-muted); font-family: monospace; }
        .slug-input-wrapper input { padding-left: 28px; font-family: monospace; font-size: 13px; }

        .toggle-box { display: flex; gap: 12px; padding: 16px; background: var(--bg-surface-secondary); border-radius: 16px; cursor: pointer; margin-top: 10px; border: 1.5px solid var(--border-light); }
        .toggle-box input { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue); }
        .toggle-text p { font-size: 14px; font-weight: 700; margin: 0; }
        .toggle-text span { font-size: 11px; color: var(--text-muted); }

        .system-alert-card { display: flex; gap: 12px; padding: 16px; background: rgba(var(--accent-blue-rgb), 0.05); color: var(--primary-blue); border-radius: 20px; border: 1px solid rgba(var(--accent-blue-rgb), 0.1); margin-top: 20px; }
        .system-alert-card .bold { font-weight: 800; font-size: 13px; margin: 0; }
        .system-alert-card .small { font-size: 11px; margin-top: 2px; }

        .editor-canvas { background: var(--bg-surface); border-radius: 24px; border: 1.5px solid var(--border-light); overflow: hidden; display: flex; flex-direction: column; height: 700px; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.1); }
        .canvas-header { padding: 15px 24px; border-bottom: 1px solid var(--border-light); background: var(--bg-surface-secondary); display: flex; justify-content: space-between; align-items: center; }
        .window-dots { display: flex; gap: 6px; }
        .window-dots span { width: 10px; height: 10px; border-radius: 50%; background: #e2e8f0; }
        .header-label { font-size: 10px; font-weight: 900; text-transform: uppercase; tracking: 2px; color: var(--text-muted); }
        
        .quill-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .quill-wrapper .ql-toolbar { border: none !important; border-bottom: 1px solid var(--border-light) !important; padding: 15px !important; }
        .quill-wrapper .ql-container { border: none !important; flex: 1; font-size: 16px; overflow-y: auto; }
        .quill-wrapper .ql-editor { padding: 35px; line-height: 1.7; color: var(--text-main); height: 100%; }
        
        .loading-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1100px) {
           .cms-editor-workspace { grid-template-columns: 1fr; }
           .editor-canvas { height: 600px; }
        }
        @media (max-width: 600px) {
           .cms-header { flex-direction: column; align-items: flex-start; }
           .search-box { width: 100%; }
        }
      `}</style>
    </div>
  );
}
