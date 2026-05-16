import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './AdminHRs.module.css';
import AdminLayout from '../../layouts/admin/AdminLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface Company {
    id: string;
    name: string;
}

interface HRAccount {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    is_verified: boolean;
    created_at: string;
    companies: Company[];
}

type StatusFilter = 'all' | 'active' | 'locked';

/* ─── Helpers ────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#0f172a','#1e4076','#7c3aed','#059669','#b45309','#db2777','#0369a1','#dc2626'];
const toColor = (id: string) => {
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length] || AVATAR_COLORS[0];
};
const toInit  = (name: string) => {
    if (!name) return 'HR';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'HR';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
};
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; } };

const genPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/* ─── Company Tag component ──────────────────────────────────── */
const CompanyTags: React.FC<{ companies: Company[] }> = ({ companies }) => {
    const MAX = 2;
    const shown = companies.slice(0, MAX);
    const rest  = companies.length - MAX;
    return (
        <div className={styles.tagRow}>
            {shown.map(c => <span key={c.id} className={styles.compTag}>{c.name}</span>)}
            {rest > 0 && <span className={styles.compTagMore}>+{rest} nữa</span>}
            {companies.length === 0 && <span className={styles.noAssign}>Chưa phân công</span>}
        </div>
    );
};

/* ─── Multi-select dropdown ──────────────────────────────────── */
interface MultiSelectProps {
    options: Company[];
    selected: string[];
    onChange: (ids: string[]) => void;
    onAddNew: (name: string) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, onAddNew }) => {
    const [open, setOpen]           = useState(false);
    const [search, setSearch]       = useState('');
    const [newName, setNewName]     = useState('');
    const [addMode, setAddMode]     = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (id: string) => {
        onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
    };

    const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
    const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name);

    return (
        <div className={styles.multiSelect} ref={ref}>
            <button type="button" className={styles.msToggle} onClick={() => setOpen(o => !o)}>
                <span className={styles.msValue}>
                    {selected.length === 0
                        ? 'Chọn công ty đối tác...'
                        : selectedNames.slice(0, 2).join(', ') + (selectedNames.length > 2 ? ` +${selectedNames.length - 2}` : '')}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#64748b' }}>
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {open && (
                <div className={styles.msDropdown}>
                    <div className={styles.msSearch}>
                        <span className="material-symbols-outlined">search</span>
                        <input
                            autoFocus
                            placeholder="Tìm công ty..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={styles.msSearchInput}
                        />
                    </div>
                    <div className={styles.msOptions}>
                        {filtered.length === 0 && (
                            <p className={styles.msEmpty}>Không tìm thấy</p>
                        )}
                        {filtered.map(opt => (
                            <label key={opt.id} className={styles.msOption}>
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt.id)}
                                    onChange={() => toggle(opt.id)}
                                    className={styles.msCheckbox}
                                />
                                <span className={styles.msCheckMark} />
                                {opt.name}
                            </label>
                        ))}
                    </div>
                    <div className={styles.msDivider} />
                    {addMode ? (
                        <div className={styles.msAddRow}>
                            <input
                                autoFocus
                                placeholder="Tên công ty mới..."
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newName.trim()) {
                                        onAddNew(newName.trim());
                                        setNewName('');
                                        setAddMode(false);
                                    }
                                    if (e.key === 'Escape') setAddMode(false);
                                }}
                                className={styles.msAddInput}
                            />
                            <button type="button" className={styles.msAddConfirm}
                                onClick={() => { if (newName.trim()) { onAddNew(newName.trim()); setNewName(''); setAddMode(false); } }}>
                                Thêm
                            </button>
                        </div>
                    ) : (
                        <button type="button" className={styles.msAddLink} onClick={() => setAddMode(true)}>
                            <span className="material-symbols-outlined">add</span>
                            Thêm công ty mới
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

/* ─── Create/Edit HR Modal ────────────────────────────────────────── */
interface ModalProps {
    initialData?: HRAccount | null;
    companies: Company[];
    onClose: () => void;
    onSave: (data: any) => void;
    onAddCompany: (name: string) => void;
}

const HRModal: React.FC<ModalProps> = ({ initialData, companies, onClose, onSave, onAddCompany }) => {
    const [form, setForm] = useState({
        full_name: initialData?.full_name || '', 
        email: initialData?.email || '', 
        password: '',
        selectedCompanyIds: initialData?.companies.map(c => c.id) || ([] as string[]),
    });
    const [showPass, setShowPass] = useState(false);
    const [saving, setSaving]     = useState(false);
    const [errors, setErrors]     = useState<Record<string, string>>({});

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.full_name.trim())  e.full_name = 'Vui lòng nhập họ tên';
        if (!form.email.trim())      e.email = 'Vui lòng nhập email';
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email không hợp lệ';
        if (!initialData && !form.password.trim())   e.password = 'Vui lòng nhập mật khẩu';
        else if (form.password && form.password.length < 8) e.password = 'Mật khẩu tối thiểu 8 ký tự';
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2 className={styles.modalTitle}>{initialData ? 'Chỉnh sửa tài khoản HR' : 'Tạo tài khoản HR mới'}</h2>
                        <p className={styles.modalSub}>{initialData ? 'Cập nhật thông tin và phân công' : 'Điền thông tin và phân công đối tác ngay lập tức'}</p>
                    </div>
                    <button className={styles.modalClose} onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className={styles.modalBody}>
                    {/* Block 1: Thông tin cá nhân */}
                    <div className={styles.formBlock}>
                        <p className={styles.formBlockTitle}>
                            <span className="material-symbols-outlined">person</span>
                            Thông tin cá nhân
                        </p>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Họ và tên <span className={styles.req}>*</span></label>
                                <input
                                    className={`${styles.input} ${errors.full_name ? styles.inputError : ''}`}
                                    placeholder="Nguyễn Văn A"
                                    value={form.full_name}
                                    onChange={e => set('full_name', e.target.value)}
                                />
                                {errors.full_name && <p className={styles.errMsg}>{errors.full_name}</p>}
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email <span className={styles.req}>*</span></label>
                                <input
                                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                                    placeholder="hr@company.com"
                                    type="email"
                                    value={form.email}
                                    onChange={e => set('email', e.target.value)}
                                />
                                {errors.email && <p className={styles.errMsg}>{errors.email}</p>}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Mật khẩu {initialData ? <span style={{fontWeight: 400, color: '#64748b', fontSize: '0.85em'}}>(Bỏ trống nếu không đổi)</span> : <span className={styles.req}>*</span>}</label>
                            <div className={styles.passRow}>
                                <div className={styles.passInputWrap}>
                                    <input
                                        className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                                        placeholder="Tối thiểu 8 ký tự"
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => set('password', e.target.value)}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button type="button" className={styles.passEye} onClick={() => setShowPass(s => !s)}>
                                        <span className="material-symbols-outlined">{showPass ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className={styles.genBtn}
                                    onClick={() => { set('password', genPassword()); setShowPass(true); }}
                                >
                                    <span className="material-symbols-outlined">refresh</span>
                                    Tạo ngẫu nhiên
                                </button>
                            </div>
                            {errors.password && <p className={styles.errMsg}>{errors.password}</p>}
                        </div>
                    </div>

                    {/* Block 2: Phân công */}
                    <div className={styles.formBlock}>
                        <p className={styles.formBlockTitle}>
                            <span className="material-symbols-outlined">business</span>
                            Phân công đối tác
                        </p>
                        <p className={styles.formBlockHint}>
                            Chọn các công ty Nhật mà HR này sẽ phụ trách. Có thể bổ sung thêm sau.
                        </p>
                        <MultiSelect
                            options={companies}
                            selected={form.selectedCompanyIds}
                            onChange={ids => set('selectedCompanyIds', ids)}
                            onAddNew={onAddCompany}
                        />
                        {form.selectedCompanyIds.length > 0 && (
                            <div className={styles.selectedPreview}>
                                {form.selectedCompanyIds.map(id => {
                                    const c = companies.find(co => co.id === id);
                                    return c ? (
                                        <span key={id} className={styles.selectedChip}>
                                            {c.name}
                                            <button type="button" onClick={() => set('selectedCompanyIds', form.selectedCompanyIds.filter(s => s !== id))}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.modalFooter}>
                    <button className={styles.btnCancel} onClick={onClose}>Huỷ</button>
                    <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <><span className={styles.spinner} />Đang lưu...</>
                        ) : (
                            <><span className="material-symbols-outlined">{initialData ? 'save' : 'check'}</span>{initialData ? 'Lưu thay đổi' : 'Tạo tài khoản'}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════ */
const AdminHR: React.FC = () => {
    const [hrList,      setHrList]      = useState<HRAccount[]>([]);
    const [companies,   setCompanies]   = useState<Company[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [search,      setSearch]      = useState('');
    const [statusFilter,setStatusFilter]= useState<StatusFilter>('all');
    const [showModal,   setShowModal]   = useState(false);
    const [editingHR,   setEditingHR]   = useState<HRAccount | null>(null);
    const [toastMsg,    setToastMsg]    = useState('');

    const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [hrRes, compRes] = await Promise.all([
                    axiosClient.get('/api/admin/hr-accounts'),
                    axiosClient.get('/api/admin/companies'),
                ]);
                setHrList(hrRes.data?.length > 0 ? hrRes.data : []);
                setCompanies(compRes.data?.length > 0 ? compRes.data : []);
            } catch {
                setHrList([]);
                setCompanies([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        let list = [...hrList];
        if (statusFilter === 'active') list = list.filter(h => h.is_verified);
        if (statusFilter === 'locked') list = list.filter(h => !h.is_verified);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(h => h.full_name.toLowerCase().includes(q) || h.email.toLowerCase().includes(q));
        }
        return list;
    }, [hrList, statusFilter, search]);

    const handleToggleLock = async (id: string, current: boolean) => {
        setHrList(prev => prev.map(h => h.id === id ? { ...h, is_verified: !current } : h));
        try {
            await axiosClient.patch(`/api/admin/hr-accounts/${id}`, { is_verified: !current });
            toast(current ? 'Đã khóa tài khoản' : 'Đã kích hoạt tài khoản');
        } catch {
            setHrList(prev => prev.map(h => h.id === id ? { ...h, is_verified: current } : h));
        }
    };

    const handleAddCompany = async (name: string) => {
        try {
            const res = await axiosClient.post('/api/admin/companies', { name });
            const newCompany = res.data;
            setCompanies(prev => [...prev, newCompany]);
            toast('Thêm công ty đối tác thành công!');
        } catch (error) {
            toast('Lỗi khi thêm công ty mới!');
        }
    };


    const handleSave = async (data: any) => {
        try {
            if (editingHR) {
                const payload: any = {
                    full_name: data.full_name,
                    company_ids: data.selectedCompanyIds,
                };
                if (data.email !== editingHR.email) payload.email = data.email;
                if (data.password) payload.password = data.password;

                const res = await axiosClient.patch(`/api/admin/hr-accounts/${editingHR.id}`, payload);
                setHrList(prev => prev.map(h => h.id === editingHR.id ? { ...h, ...res.data } : h));
                toast('Cập nhật tài khoản HR thành công!');
            } else {
                const res = await axiosClient.post('/api/admin/hr-accounts', {
                    email: data.email,
                    password: data.password,
                    full_name: data.full_name,
                    company_ids: data.selectedCompanyIds,
                });
                setHrList(prev => [res.data, ...prev]);
                toast('Tạo tài khoản HR thành công!');
            }
        } catch {
            toast('Đã có lỗi xảy ra!');
        }
        setShowModal(false);
        setEditingHR(null);
    };

    return (
        <AdminLayout
            pageTitle="Quản lý HR"
            pageSubtitle={`${hrList.filter(h => h.is_verified).length} đang hoạt động · ${hrList.filter(h => !h.is_verified).length} bị khóa`}
            headerActions={
                <button className={styles.btnPrimary} onClick={() => { setEditingHR(null); setShowModal(true); }}>
                    <span className="material-symbols-outlined">add</span>
                    Tạo tài khoản HR mới
                </button>
            }
        >
            {/* Filter bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <span className="material-symbols-outlined">search</span>
                    <input
                        className={styles.searchInput}
                        placeholder="Tìm theo tên, email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className={styles.clearSearch} onClick={() => setSearch('')}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>
                <div className={styles.statusTabs}>
                    {([
                        { key: 'all',    label: `Tất cả (${hrList.length})` },
                        { key: 'active', label: `Hoạt động (${hrList.filter(h => h.is_verified).length})` },
                        { key: 'locked', label: `Bị khóa (${hrList.filter(h => !h.is_verified).length})` },
                    ] as { key: StatusFilter; label: string }[]).map(t => (
                        <button
                            key={t.key}
                            className={`${styles.statusTab} ${statusFilter === t.key ? styles.statusTabActive : ''}`}
                            onClick={() => setStatusFilter(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Data table */}
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
                                    <th>Tên HR & Email</th>
                                    <th>Công ty phụ trách</th>
                                    <th>Ngày tạo</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyRow}>
                                            <span className="material-symbols-outlined">manage_accounts</span>
                                            Không tìm thấy tài khoản HR nào
                                        </td>
                                    </tr>
                                ) : filtered.map(hr => (
                                    <tr key={hr.id} className={`${styles.tr} ${!hr.is_verified ? styles.trLocked : ''}`}>
                                        {/* Name & email */}
                                        <td>
                                            <div className={styles.nameCell}>
                                                {hr.avatar_url ? (
                                                    <img
                                                        src={hr.avatar_url}
                                                        alt={hr.full_name}
                                                        className={styles.avatarImg}
                                                    />
                                                ) : (
                                                    <div
                                                        className={styles.avatar}
                                                        style={{ background: toColor(hr.id) }}
                                                    >
                                                        {toInit(hr.full_name)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className={styles.hrName}>{hr.full_name}</div>
                                                    <div className={styles.hrEmail}>{hr.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Companies */}
                                        <td><CompanyTags companies={hr.companies} /></td>

                                        {/* Date */}
                                        <td className={styles.dateCell}>{fmtDate(hr.created_at)}</td>

                                        {/* Status */}
                                        <td>
                                            <span className={`${styles.statusBadge} ${hr.is_verified ? styles.statusActive : styles.statusLocked}`}>
                                                <span className={styles.statusDot} />
                                                {hr.is_verified ? 'Hoạt động' : 'Bị khóa'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td>
                                            <div className={styles.actionsCell}>
                                                <button className={styles.actionBtn} title="Chỉnh sửa phân công" onClick={() => { setEditingHR(hr); setShowModal(true); }}>
                                                    <span className="material-symbols-outlined">edit</span>
                                                    Sửa
                                                </button>
                                                <button
                                                    className={`${styles.actionBtn} ${hr.is_verified ? styles.actionBtnDanger : styles.actionBtnSuccess}`}
                                                    title={hr.is_verified ? 'Khóa tài khoản' : 'Kích hoạt lại'}
                                                    onClick={() => handleToggleLock(hr.id, hr.is_verified)}
                                                >
                                                    <span className="material-symbols-outlined">
                                                        {hr.is_verified ? 'lock' : 'lock_open'}
                                                    </span>
                                                    {hr.is_verified ? 'Khóa' : 'Mở khóa'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer count */}
                {!loading && filtered.length > 0 && (
                    <div className={styles.tableFooter}>
                        Hiển thị {filtered.length} / {hrList.length} tài khoản
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <HRModal
                    initialData={editingHR}
                    companies={companies}
                    onClose={() => { setShowModal(false); setEditingHR(null); }}
                    onSave={handleSave}
                    onAddCompany={handleAddCompany}
                />
            )}

            {/* Toast */}
            {toastMsg && (
                <div className={styles.toast}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {toastMsg}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminHR;