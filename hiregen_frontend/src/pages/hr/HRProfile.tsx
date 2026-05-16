import React, { useState, useEffect, useRef } from 'react';
import styles from './HRProfile.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Nav (Cài đặt active) ───────────────────────────────────── */
const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr', isActive: false }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs'       },
            { icon: 'person_search', label: 'Ứng viên',         href: '/hr/candidates' },
        ],
    },
    {
        title: 'CÔNG CỤ',
        items: [
            { icon: 'auto_awesome', label: 'AI Matching', href: '/hr/ai-matching' },
            { icon: 'bar_chart',    label: 'Báo cáo',    href: '/hr/reports'     },
        ],
    },
    {
        title: 'CÀI ĐẶT',
        items: [
            { icon: 'domain',   label: 'Hồ sơ công ty', href: '/hr/companies'  },
            { icon: 'settings', label: 'Cài đặt',       href: '/hr/settings', isActive: true },
        ],
    },
];

/* ─── Types ──────────────────────────────────────────────────── */
interface HRProfileData {
    full_name:    string;
    phone_number: string;
    email:        string;
    avatar_url:   string;
    department:   string;
    position:     string;
}

/* ─── Avatar Initials ────────────────────────────────────────── */
const getInitials = (name: string) =>
    name.trim().split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() || 'HR';

/* ═══════════════════════════════════════════════════════════════
   HRProfile Page
═══════════════════════════════════════════════════════════════ */
const HRProfile: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<HRProfileData>({
        full_name: '', phone_number: '', email: '', avatar_url: '', department: '', position: '',
    });
    const [original,  setOriginal]  = useState<HRProfileData | null>(null);
    const [loading,   setLoading]   = useState(true);
    const [saving,    setSaving]    = useState(false);
    const [avatarPrev,setAvatarPrev]= useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [toast,     setToast]     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [errors,    setErrors]    = useState<Record<string, string>>({});

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3200);
    };

    /* ── Fetch ─────────────────────────────────────────────── */
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [meRes, profileRes] = await Promise.all([
                    axiosClient.get('/api/auth/me'),
                    axiosClient.get('/api/hr/profile'),
                ]);
                const data: HRProfileData = {
                    full_name:    profileRes.data.full_name    || meRes.data.full_name    || '',
                    phone_number: profileRes.data.phone_number || '',
                    email:        meRes.data.email             || '',
                    avatar_url:   profileRes.data.avatar_url   || '',
                    department:   profileRes.data.department   || '',
                    position:     profileRes.data.position     || '',
                };
                setProfile(data);
                setOriginal(data);
                if (data.avatar_url) setAvatarPrev(data.avatar_url);
            } catch {
                const empty: HRProfileData = {
                    full_name: '', phone_number: '',
                    email: '', avatar_url: '',
                    department: '', position: '',
                };
                setProfile(empty);
                setOriginal(empty);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const isDirty = original 
    ? JSON.stringify(profile) !== JSON.stringify(original) || selectedFile !== null 
    : false;

    /* ── Avatar upload ─────────────────────────────────────── */
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Ảnh tối đa 5MB', 'err'); return; }
        const url = URL.createObjectURL(file);
        setAvatarPrev(url);
        setSelectedFile(file);
    };

    /* ── Validation ────────────────────────────────────────── */
    const validate = () => {
        const e: Record<string, string> = {};
        if (!profile.full_name.trim()) e.full_name = 'Vui lòng nhập họ và tên';
        if (profile.phone_number && !/^[0-9\s\+\-()]{7,15}$/.test(profile.phone_number))
            e.phone_number = 'Số điện thoại không hợp lệ';
        return e;
    };

    /* ── Save ──────────────────────────────────────────────── */
    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setErrors({});
        setSaving(true);
        
        let finalAvatarUrl = avatarPrev;
        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            try {
                const uploadRes = await axiosClient.post('/api/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                finalAvatarUrl = uploadRes.data.url;
            } catch {
                showToast('Lỗi khi tải ảnh lên', 'err');
                setSaving(false);
                return;
            }
        }

        try {
            await axiosClient.put('/api/hr/profile', {
                full_name:    profile.full_name,
                phone_number: profile.phone_number,
                department:   profile.department,
                position:     profile.position,
                avatar_url:   finalAvatarUrl
            });
            setOriginal({ ...profile, avatar_url: finalAvatarUrl });
            setAvatarPrev(finalAvatarUrl);
            setSelectedFile(null);
            showToast('Hồ sơ đã được cập nhật thành công!');
        } catch {
            showToast('Lưu thất bại, vui lòng thử lại', 'err');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (original) { setProfile({ ...original }); setAvatarPrev(original.avatar_url || ''); }
        setSelectedFile(null);
        setErrors({});
    };

    const set = (k: keyof HRProfileData, v: string) => {
        setProfile(p => ({ ...p, [k]: v }));
        if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
    };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            pageTitle="Hồ sơ cá nhân"
            pageSubtitle="Quản lý thông tin đại diện của bạn trên nền tảng"
            headerActions={
                isDirty ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.btnReset} onClick={handleReset}>Huỷ thay đổi</button>
                        <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                            {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">check</span>Lưu hồ sơ</>}
                        </button>
                    </div>
                ) : null
            }
        >
            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.loadingDots}><span /><span /><span /></div>
                    <p>Đang tải hồ sơ...</p>
                </div>
            ) : (
                <div className={styles.pageLayout}>

                    {/* ── Left: Avatar card ────────────────── */}
                    <div className={styles.leftCol}>
                        <div className={styles.avatarCard}>
                            {/* Avatar */}
                            <div className={styles.avatarWrap}>
                                {avatarPrev ? (
                                    <img src={avatarPrev} alt="avatar" className={styles.avatarImg} />
                                ) : (
                                    <div className={styles.avatarInitials}>
                                        {getInitials(profile.full_name || 'HR')}
                                    </div>
                                )}
                                <button
                                    className={styles.avatarEditBtn}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Đổi ảnh đại diện"
                                >
                                    <span className="material-symbols-outlined">photo_camera</span>
                                </button>
                                <input
                                    ref={fileInputRef} type="file" accept="image/*"
                                    className={styles.hiddenInput}
                                    onChange={handleAvatarChange}
                                />
                            </div>

                            <h2 className={styles.avatarName}>{profile.full_name || 'Tên hiển thị'}</h2>
                            <p className={styles.avatarRole}>{profile.position || 'HR Recruiter'}</p>
                            <p className={styles.avatarDept}>{profile.department || 'Recruitment'}</p>

                            <div className={styles.avatarDivider} />

                            {/* Quick info */}
                            <div className={styles.quickInfo}>
                                <div className={styles.quickInfoRow}>
                                    <span className="material-symbols-outlined">mail</span>
                                    <span className={styles.quickInfoText}>{profile.email || '—'}</span>
                                </div>
                                <div className={styles.quickInfoRow}>
                                    <span className="material-symbols-outlined">phone</span>
                                    <span className={styles.quickInfoText}>{profile.phone_number || 'Chưa cập nhật'}</span>
                                </div>
                            </div>

                            <p className={styles.avatarHint}>
                                <span className="material-symbols-outlined">info</span>
                                Ảnh tối đa 5MB · JPG, PNG, WebP
                            </p>
                        </div>
                    </div>

                    {/* ── Right: Form ──────────────────────── */}
                    <div className={styles.rightCol}>

                        {/* Block 1: Thông tin cá nhân */}
                        <div className={styles.formCard}>
                            <div className={styles.formCardHeader}>
                                <div className={styles.formCardIcon}>
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <div>
                                    <h3 className={styles.formCardTitle}>Thông tin cá nhân</h3>
                                    <p className={styles.formCardSub}>Tên và liên hệ hiển thị với đối tác Nhật Bản</p>
                                </div>
                            </div>

                            <div className={styles.formBody}>
                                {/* Full name */}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        Họ và tên <span className={styles.req}>*</span>
                                    </label>
                                    <input
                                        className={`${styles.input} ${errors.full_name ? styles.inputError : ''}`}
                                        placeholder="Nguyễn Văn A"
                                        value={profile.full_name}
                                        onChange={e => set('full_name', e.target.value)}
                                    />
                                    {errors.full_name && <p className={styles.errMsg}>{errors.full_name}</p>}
                                </div>

                                {/* Email — readonly */}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        Email đăng nhập
                                        <span className={styles.readonlyBadge}>
                                            <span className="material-symbols-outlined">lock</span>
                                            Không thể thay đổi
                                        </span>
                                    </label>
                                    <div className={styles.readonlyInput}>
                                        <span className="material-symbols-outlined">mail</span>
                                        <span>{profile.email}</span>
                                    </div>
                                    <p className={styles.fieldHint}>Email là định danh duy nhất của tài khoản và không thể sửa đổi.</p>
                                </div>

                                {/* Phone */}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Số điện thoại</label>
                                    <input
                                        className={`${styles.input} ${errors.phone_number ? styles.inputError : ''}`}
                                        placeholder="0912 345 678"
                                        value={profile.phone_number}
                                        onChange={e => set('phone_number', e.target.value)}
                                    />
                                    {errors.phone_number && <p className={styles.errMsg}>{errors.phone_number}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Block 2: Vị trí công tác */}
                        <div className={styles.formCard}>
                            <div className={styles.formCardHeader}>
                                <div className={styles.formCardIcon}>
                                    <span className="material-symbols-outlined">badge</span>
                                </div>
                                <div>
                                    <h3 className={styles.formCardTitle}>Vị trí công tác</h3>
                                    <p className={styles.formCardSub}>Chức danh và phòng ban tại Agency</p>
                                </div>
                            </div>

                            <div className={styles.formBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Chức danh</label>
                                        <input
                                            className={styles.input}
                                            placeholder="Senior Recruiter"
                                            value={profile.position}
                                            onChange={e => set('position', e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Phòng ban</label>
                                        <input
                                            className={styles.input}
                                            placeholder="Recruitment"
                                            value={profile.department}
                                            onChange={e => set('department', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Block 3: Bảo mật tài khoản */}
                        <div className={styles.formCard}>
                            <div className={styles.formCardHeader}>
                                <div className={`${styles.formCardIcon} ${styles.iconDanger}`}>
                                    <span className="material-symbols-outlined">security</span>
                                </div>
                                <div>
                                    <h3 className={styles.formCardTitle}>Bảo mật tài khoản</h3>
                                    <p className={styles.formCardSub}>Quản lý mật khẩu và phiên đăng nhập</p>
                                </div>
                            </div>

                            <div className={styles.formBody}>
                                <div className={styles.securityRow}>
                                    <div>
                                        <p className={styles.secLabel}>Mật khẩu hiện tại</p>
                                        <p className={styles.secSub}>Lần đổi mật khẩu gần nhất: chưa xác định</p>
                                    </div>
                                    <button className={styles.btnChangePass}>
                                        <span className="material-symbols-outlined">key</span>
                                        Đổi mật khẩu
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Save bar bottom (mobile friendly) */}
                        {isDirty && (
                            <div className={styles.saveBar}>
                                <p className={styles.saveBarHint}>
                                    <span className="material-symbols-outlined">edit</span>
                                    Bạn có thay đổi chưa được lưu
                                </p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className={styles.btnReset} onClick={handleReset}>Huỷ</button>
                                    <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                                        {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">check</span>Lưu hồ sơ</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`${styles.toast} ${toast.type === 'err' ? styles.toastErr : ''}`}>
                    <span className="material-symbols-outlined">{toast.type === 'ok' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}
        </HRLayout>
    );
};

export default HRProfile;