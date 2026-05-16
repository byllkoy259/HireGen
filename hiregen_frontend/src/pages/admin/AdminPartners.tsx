import React, { useState, useEffect, useMemo } from 'react';
import styles from './AdminPartners.module.css';
import AdminLayout from '../../layouts/admin/AdminLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface Partner {
    id: string;
    name: string;
    website?: string;
    description?: string;
    industry?: string;
    logo_url?: string;
    hr_count: number;
    created_at: string;
}

const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; } };

/* ─── Add/Edit Partner Modal ──────────────────────────────────────── */
interface PartnerModalProps {
    initialData?: Partner | null;
    onClose: () => void;
    onSave:  (data: { name: string; website: string; description: string; industry: string; logo_url: string }) => Promise<void>;
}

const PartnerModal: React.FC<PartnerModalProps> = ({ initialData, onClose, onSave }) => {
    const [form, setForm]   = useState({ 
        name: initialData?.name || '', 
        website: initialData?.website || '', 
        description: initialData?.description || '',
        industry: initialData?.industry || '',
        logo_url: initialData?.logo_url || ''
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]     = useState('');

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
                        <h2 className={styles.modalTitle}>{initialData ? 'Sửa thông tin đối tác' : 'Thêm đối tác mới'}</h2>
                        <p className={styles.modalSub}>{initialData ? 'Cập nhật thông tin công ty' : 'Thêm công ty Nhật vào danh sách đối tác'}</p>
                    </div>
                    <button className={styles.modalClose} onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Tên công ty <span className={styles.req}>*</span></label>
                        <input className={`${styles.input} ${err ? styles.inputError : ''}`} placeholder="Ví dụ: Toyota IT" value={form.name} onChange={e => { set('name', e.target.value); setErr(''); }} />
                        {err && <p className={styles.errMsg}>{err}</p>}
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Website</label>
                        <input className={styles.input} placeholder="https://company.com" value={form.website} onChange={e => set('website', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Mô tả</label>
                        <textarea className={styles.textarea} rows={3} placeholder="Giới thiệu ngắn về công ty..." value={form.description} onChange={e => set('description', e.target.value)} />
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
                        {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">{initialData ? 'save' : 'add_business'}</span>{initialData ? 'Lưu thay đổi' : 'Thêm đối tác'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════ */
const AdminPartners: React.FC = () => {
    const [partners,  setPartners]  = useState<Partner[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
    const [toastMsg,  setToastMsg]  = useState('');

    const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await axiosClient.get('/api/admin/companies');
                setPartners(res.data?.length > 0 ? res.data : []);
            } catch {
                setPartners([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return partners;
        const q = search.toLowerCase();
        return partners.filter(p => p.name.toLowerCase().includes(q) || (p.website || '').toLowerCase().includes(q));
    }, [partners, search]);

    const handleSave = async (data: { name: string; website: string; description: string; industry: string; logo_url: string }) => {
        try {
            if (editingPartner) {
                const res = await axiosClient.put(`/api/admin/companies/${editingPartner.id}`, data);
                setPartners(prev => prev.map(p => p.id === editingPartner.id ? { ...p, ...res.data } : p));
                toast('Cập nhật đối tác thành công!');
            } else {
                const res = await axiosClient.post('/api/admin/companies', data);
                setPartners(prev => [...prev, { ...res.data, hr_count: 0 }]);
                toast('Thêm đối tác thành công!');
            }
        } catch {
            toast('Lỗi khi lưu dữ liệu!');
        }
        setShowModal(false);
        setEditingPartner(null);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa công ty này không?')) return;
        try {
            await axiosClient.delete(`/api/admin/companies/${id}`);
            setPartners(prev => prev.filter(p => p.id !== id));
            toast('Đã xóa đối tác thành công!');
        } catch {
            toast('Lỗi khi xóa đối tác!');
        }
    };

    /* Stat cards */
    const totalHR = partners.reduce((sum, p) => sum + (p.hr_count || 0), 0);

    return (
        <AdminLayout
            pageTitle="Quản lý Đối tác"
            pageSubtitle={`${partners.length} công ty đối tác · ${totalHR} HR đang phụ trách`}
            headerActions={
                <button className={styles.btnPrimary} onClick={() => { setEditingPartner(null); setShowModal(true); }}>
                    <span className="material-symbols-outlined">add_business</span>
                    Thêm đối tác mới
                </button>
            }
        >
            {/* Stat strip */}
            <div className={styles.statStrip}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}><span className="material-symbols-outlined">business</span></div>
                    <div>
                        <p className={styles.statValue}>{partners.length}</p>
                        <p className={styles.statLabel}>Tổng đối tác</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}><span className="material-symbols-outlined">manage_accounts</span></div>
                    <div>
                        <p className={styles.statValue}>{totalHR}</p>
                        <p className={styles.statLabel}>HR đang hoạt động</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}><span className="material-symbols-outlined">trending_up</span></div>
                    <div>
                        <p className={styles.statValue}>{partners.filter(p => p.hr_count === 0).length}</p>
                        <p className={styles.statLabel}>Chưa có HR phụ trách</p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <span className="material-symbols-outlined">search</span>
                    <input
                        className={styles.searchInput}
                        placeholder="Tìm theo tên công ty, website..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className={styles.clearSearch} onClick={() => setSearch('')}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>
                <p className={styles.resultCount}>
                    {filtered.length} kết quả
                </p>
            </div>

            {/* Table */}
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
                                    <th>HR phụ trách</th>
                                    <th>Ngày tạo</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyRow}>
                                            <span className="material-symbols-outlined">domain_disabled</span>
                                            Không tìm thấy đối tác nào
                                        </td>
                                    </tr>
                                ) : filtered.map(p => (
                                    <tr key={p.id} className={styles.tr}>
                                        {/* Company */}
                                        <td>
                                            <div className={styles.companyCell}>
                                                {p.logo_url ? (
                                                    <img src={p.logo_url} alt={p.name} className={styles.companyLogo} />
                                                ) : (
                                                    <div className={styles.companyIcon}>{p.name.charAt(0).toUpperCase()}</div>
                                                )}
                                                <div>
                                                    <div className={styles.companyName}>{p.name}</div>
                                                    {p.industry && <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 500 }}>{p.industry}</div>}
                                                    {p.description && <div className={styles.companyDesc}>{p.description}</div>}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Website */}
                                        <td>
                                            {p.website ? (
                                                <a href={p.website} target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                    {p.website.replace('https://', '').replace('http://', '')}
                                                </a>
                                            ) : (
                                                <span className={styles.noData}>—</span>
                                            )}
                                        </td>

                                        {/* HR count */}
                                        <td>
                                            <div className={styles.hrCountCell}>
                                                <span className={`${styles.hrCountBadge} ${(!p.hr_count || p.hr_count === 0) ? styles.hrCountZero : ''}`}>
                                                    {p.hr_count || 0}
                                                </span>
                                                <span className={styles.hrCountLabel}>HR</span>
                                            </div>
                                        </td>

                                        {/* Date */}
                                        <td className={styles.dateCell}>{fmtDate(p.created_at)}</td>

                                        {/* Actions */}
                                        <td>
                                            <div className={styles.actionsCell}>
                                                <button className={styles.actionBtn} onClick={() => { setEditingPartner(p); setShowModal(true); }}>
                                                    <span className="material-symbols-outlined">edit</span>
                                                    Sửa
                                                </button>
                                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(p.id)}>
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
                {!loading && filtered.length > 0 && (
                    <div className={styles.tableFooter}>
                        Hiển thị {filtered.length} / {partners.length} đối tác
                    </div>
                )}
            </div>

            {showModal && <PartnerModal initialData={editingPartner} onClose={() => { setShowModal(false); setEditingPartner(null); }} onSave={handleSave} />}

            {toastMsg && (
                <div className={styles.toast}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {toastMsg}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminPartners;