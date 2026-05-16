import React, { useState, useEffect, useMemo } from 'react';
import styles from './HRCompanies.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface Company {
    id: string;
    name: string;
    website?: string;
    description?: string;
    industry?: string;
    logo_url?: string;
    created_at: string;
}

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr' }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs' },
            { icon: 'person_search', label: 'Ứng viên',         href: '/hr/candidates' },
        ],
    },
    {
        title: 'CÔNG CỤ',
        items: [
            { icon: 'auto_awesome', label: 'AI Matching', href: '/hr/ai-matching' },
            { icon: 'bar_chart',    label: 'Báo cáo',    href: '/hr/reports' },
        ],
    },
    {
        title: 'CÀI ĐẶT',
        items: [
            { icon: 'domain',   label: 'Hồ sơ công ty', href: '/hr/companies', isActive: true },
            { icon: 'settings', label: 'Cài đặt',       href: '/hr/settings' },
        ],
    },
];

const fmtDate = (iso: string) => { 
    try { 
        return new Date(iso).toLocaleDateString('vi-VN'); 
    } catch { 
        return iso; 
    } 
};

/* ─── Modal ─────────────────────────────────────────────────── */
interface CompanyModalProps {
    initialData?: Company | null;
    onClose: () => void;
    onSave:  (data: { name: string; website: string; description: string; industry: string; logo_url: string }) => Promise<void>;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ initialData, onClose, onSave }) => {
    const [form, setForm] = useState({ 
        name:        initialData?.name        || '', 
        website:     initialData?.website     || '', 
        description: initialData?.description || '',
        industry:    initialData?.industry    || '',
        logo_url:    initialData?.logo_url    || ''
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.name.trim()) { setErr('Vui lòng nhập tên công ty'); return; }
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <div>
                        <h2 className={styles.modalTitle}>{initialData ? 'Sửa thông tin công ty' : 'Thêm công ty mới'}</h2>
                        <p className={styles.modalSub}>Nhập thông tin công ty khách hàng vào hệ thống</p>
                    </div>
                    <button className={styles.modalClose} onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Tên công ty <span className={styles.req}>*</span></label>
                        <input className={`${styles.input} ${err ? styles.inputError : ''}`} placeholder="Ví dụ: Rakuten Group" value={form.name} onChange={e => { set('name', e.target.value); setErr(''); }} />
                        {err && <p className={styles.errMsg}>{err}</p>}
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Website</label>
                        <input className={styles.input} placeholder="https://corp.rakuten.co.jp" value={form.website} onChange={e => set('website', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Mô tả chi tiết</label>
                        <textarea className={styles.textarea} rows={4} placeholder="Thông tin về quy mô, lĩnh vực..." value={form.description} onChange={e => set('description', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Lĩnh vực</label>
                        <input className={styles.input} placeholder="Ví dụ: Công nghệ thông tin" value={form.industry} onChange={e => set('industry', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>URL Logo</label>
                        <input className={styles.input} placeholder="https://example.com/logo.png" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} />
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btnCancel} onClick={onClose}>Huỷ</button>
                    <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                        {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">save</span>Lưu lại</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Page ──────────────────────────────────────────────── */
const HRCompanies: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [toastMsg, setToastMsg]   = useState('');

    const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axiosClient.get('/api/companies/me');
            setCompanies(res.data || []);
        } catch {
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCompanies(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return companies.filter(c => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
    }, [companies, search]);

    const handleSave = async (data: { name: string; website: string; description: string; industry: string; logo_url: string }) => {
        try {
            if (editingCompany) {
                const res = await axiosClient.put(`/api/companies/${editingCompany.id}`, data);
                setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, ...res.data } : c));
                toast('Cập nhật thành công!');
            } else {
                const res = await axiosClient.post('/api/companies/', data);
                setCompanies(prev => [...prev, res.data]);
                toast('Thêm mới thành công!');
            }
        } catch { toast('Có lỗi xảy ra!'); }
        setShowModal(false);
        setEditingCompany(null);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xóa đối tác này?')) return;
        try {
            await axiosClient.delete(`/api/companies/${id}`);
            setCompanies(prev => prev.filter(c => c.id !== id));
            toast('Đã xóa thành công!');
        } catch { toast('Không thể xóa đối tác!'); }
    };

    return (
        <HRLayout
            pageTitle="Hồ sơ công ty"
            pageSubtitle={`Đang quản lý ${companies.length} công ty`}
            navSections={NAV_SECTIONS}
            headerActions={
                <button className={styles.btnPrimary} onClick={() => { setEditingCompany(null); setShowModal(true); }}>
                    <span className="material-symbols-outlined">add_business</span>
                    Thêm công ty mới
                </button>
            }
        >
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <span className="material-symbols-outlined">search</span>
                    <input className={styles.searchInput} placeholder="Tìm kiếm đối tác..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <p className={styles.resultCount}>{filtered.length} kết quả</p>
            </div>

            <div className={styles.card}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingDots}><span /><span /><span /></div>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Công ty</th>
                                    <th>Website</th>
                                    <th>Mô tả</th>
                                    <th>Ngày tạo</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className={styles.emptyRow}>Không tìm thấy dữ liệu</td></tr>
                                ) : filtered.map(c => (
                                    <tr key={c.id} className={styles.tr}>
                                        <td>
                                            <div className={styles.companyCell}>
                                                {c.logo_url ? (
                                                    <img src={c.logo_url} alt={c.name} className={styles.companyLogo} />
                                                ) : (
                                                    <div className={styles.companyIcon}>{c.name.charAt(0).toUpperCase()}</div>
                                                )}
                                                <div>
                                                    <div className={styles.companyName}>{c.name}</div>
                                                    {c.industry && <span className={styles.industryTag} style={{ fontSize: 12, color: '#64748b' }}>{c.industry}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {c.website ? (
                                                <a href={c.website} target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                    {c.website.replace('https://', '').replace('http://', '')}
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td className={styles.descCell}>{c.description || 'Chưa có mô tả'}</td>
                                        <td className={styles.dateCell}>{fmtDate(c.created_at)}</td>
                                        <td>
                                            <div className={styles.actionsCell}>
                                                <button className={styles.actionBtn} onClick={() => { setEditingCompany(c); setShowModal(true); }}>
                                                    <span className="material-symbols-outlined">edit</span>
                                                    Sửa
                                                </button>
                                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(c.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && <CompanyModal initialData={editingCompany} onClose={() => setShowModal(false)} onSave={handleSave} />}
            {toastMsg && <div className={styles.toast}>{toastMsg}</div>}
        </HRLayout>
    );
};

export default HRCompanies;