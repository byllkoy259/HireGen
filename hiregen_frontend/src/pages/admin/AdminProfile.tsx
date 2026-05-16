import React, { useState, useEffect, useRef } from 'react';
import styles from './AdminProfile.module.css';
import AdminLayout from '../../layouts/admin/AdminLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface AdminProfileData {
    display_name: string;
    email:        string;
    avatar_url:   string;
}

const getInitials = (name: string) =>
    name.trim().split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() || 'AD';

/* ═══════════════════════════════════════════════════════════════
   AdminProfile Page
═══════════════════════════════════════════════════════════════ */
const AdminProfile: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile,    setProfile]    = useState<AdminProfileData>({ display_name: '', email: '', avatar_url: '' });
    const [original,   setOriginal]   = useState<AdminProfileData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [avatarPrev, setAvatarPrev] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [toast,      setToast]      = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [nameError,  setNameError]  = useState('');

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3200);
    };

    /* ── Fetch ─────────────────────────────────────────────── */
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await axiosClient.get('/api/auth/me');
                const data: AdminProfileData = {
                    display_name: res.data.full_name || res.data.username || res.data.name || 'Quản trị viên',
                    email:        res.data.email || '',
                    avatar_url:   res.data.avatar_url || '',
                };
                setProfile(data);
                setOriginal(data);
                if (data.avatar_url) setAvatarPrev(data.avatar_url);
            } catch {
                const empty: AdminProfileData = {
                    display_name: '',
                    email: '',
                    avatar_url: '',
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
        ? profile.display_name !== original.display_name || avatarPrev !== (original.avatar_url || '')
        : false;

    /* ── Avatar ────────────────────────────────────────────── */
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Ảnh tối đa 5MB', 'err'); return; }
        setAvatarPrev(URL.createObjectURL(file));
        setSelectedFile(file);
    };

    /* ── Save ──────────────────────────────────────────────── */
    const handleSave = async () => {
        if (!profile.display_name.trim()) { setNameError('Vui lòng nhập tên hiển thị'); return; }
        setNameError('');
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
            await axiosClient.put('/api/auth/me', { 
                display_name: profile.display_name,
                avatar_url: finalAvatarUrl
            });
            setOriginal({ ...profile, avatar_url: finalAvatarUrl });
            setAvatarPrev(finalAvatarUrl);
            setSelectedFile(null);
            showToast('Hồ sơ đã được cập nhật!');
        } catch {
            showToast('Lưu thất bại, vui lòng thử lại', 'err');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (original) { setProfile({ ...original }); setAvatarPrev(original.avatar_url || ''); }
        setSelectedFile(null);
        setNameError('');
    };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <AdminLayout
            pageTitle="Hồ sơ quản trị viên"
            pageSubtitle="Thông tin cá nhân và cài đặt tài khoản Admin"
            headerActions={
                isDirty ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.btnReset} onClick={handleReset}>Huỷ thay đổi</button>
                        <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                            {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">check</span>Lưu</>}
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

                    {/* ── Avatar Panel ─────────────────────── */}
                    <div className={styles.avatarPanel}>
                        <div className={styles.avatarWrap}>
                            {avatarPrev ? (
                                <img src={avatarPrev} alt="avatar" className={styles.avatarImg} />
                            ) : (
                                <div className={styles.avatarInitials}>
                                    {getInitials(profile.display_name)}
                                </div>
                            )}
                            <button
                                className={styles.avatarEditBtn}
                                onClick={() => fileInputRef.current?.click()}
                                title="Thay đổi ảnh đại diện"
                            >
                                <span className="material-symbols-outlined">photo_camera</span>
                            </button>
                            <input
                                ref={fileInputRef} type="file" accept="image/*"
                                className={styles.hiddenInput}
                                onChange={handleAvatarChange}
                            />
                        </div>

                        <h2 className={styles.avatarName}>{profile.display_name || 'Admin'}</h2>
                        <span className={styles.adminBadge}>
                            <span className="material-symbols-outlined">verified_user</span>
                            System Admin
                        </span>
                        <p className={styles.avatarEmail}>{profile.email}</p>

                        <div className={styles.avatarActions}>
                            <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                                <span className="material-symbols-outlined">upload</span>
                                Tải ảnh lên
                            </button>
                            {avatarPrev && (
                                <button className={styles.removeAvatarBtn} onClick={() => {
                                    setAvatarPrev('');
                                    setSelectedFile(null);
                                }}>
                                    Xoá ảnh
                                </button>
                            )}
                        </div>

                        <p className={styles.avatarHint}>JPG, PNG hoặc WebP · Tối đa 5MB</p>
                    </div>

                    {/* ── Form Panel ───────────────────────── */}
                    <div className={styles.formPanel}>

                        {/* Warning banner */}
                        <div className={styles.warningBanner}>
                            <span className="material-symbols-outlined">shield</span>
                            <div>
                                <p className={styles.warningTitle}>Tài khoản quyền cao nhất</p>
                                <p className={styles.warningText}>
                                    Email đăng nhập không thể thay đổi để bảo vệ quyền kiểm soát hệ thống.
                                    Liên hệ nhà phát triển nếu cần cập nhật.
                                </p>
                            </div>
                        </div>

                        {/* Block: Thông tin tài khoản */}
                        <div className={styles.formCard}>
                            <div className={styles.formCardHeader}>
                                <div className={styles.formCardIcon}>
                                    <span className="material-symbols-outlined">manage_accounts</span>
                                </div>
                                <div>
                                    <h3 className={styles.formCardTitle}>Thông tin tài khoản</h3>
                                    <p className={styles.formCardSub}>Tên hiển thị trên hệ thống quản trị</p>
                                </div>
                            </div>

                            <div className={styles.formBody}>
                                {/* Display name */}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        Tên hiển thị <span className={styles.req}>*</span>
                                    </label>
                                    <input
                                        className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                                        placeholder="Quản trị viên / Tên của bạn"
                                        value={profile.display_name}
                                        onChange={e => {
                                            setProfile(p => ({ ...p, display_name: e.target.value }));
                                            if (nameError) setNameError('');
                                        }}
                                    />
                                    {nameError && <p className={styles.errMsg}>{nameError}</p>}
                                    <p className={styles.fieldHint}>
                                        Tên này hiển thị ở header, sidebar và các báo cáo hệ thống.
                                    </p>
                                </div>

                                {/* Email — READONLY */}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        Email quản trị
                                        <span className={styles.readonlyBadge}>
                                            <span className="material-symbols-outlined">lock</span>
                                            Không thể thay đổi
                                        </span>
                                    </label>
                                    <div className={styles.readonlyInput}>
                                        <span className="material-symbols-outlined">admin_panel_settings</span>
                                        <span>{profile.email}</span>
                                    </div>
                                    <p className={styles.fieldHint}>
                                        Email gắn liền với quyền Admin. Thay đổi email có thể gây mất quyền truy cập hệ thống.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Block: Bảo mật */}
                        <div className={styles.formCard}>
                            <div className={styles.formCardHeader}>
                                <div className={`${styles.formCardIcon} ${styles.iconDanger}`}>
                                    <span className="material-symbols-outlined">security</span>
                                </div>
                                <div>
                                    <h3 className={styles.formCardTitle}>Bảo mật tài khoản</h3>
                                    <p className={styles.formCardSub}>Mật khẩu và phiên đăng nhập</p>
                                </div>
                            </div>

                            <div className={styles.formBody}>
                                <div className={styles.securityRow}>
                                    <div>
                                        <p className={styles.secLabel}>Mật khẩu Admin</p>
                                        <p className={styles.secSub}>
                                            Sử dụng mật khẩu mạnh, tối thiểu 12 ký tự có chữ hoa, số và ký tự đặc biệt.
                                        </p>
                                    </div>
                                    <button className={styles.btnChangePass}>
                                        <span className="material-symbols-outlined">key</span>
                                        Đổi mật khẩu
                                    </button>
                                </div>

                                <div className={styles.sessionRow}>
                                    <div>
                                        <p className={styles.secLabel}>Phiên đăng nhập hiện tại</p>
                                        <p className={styles.secSub}>Thiết bị này · Hà Nội, Vietnam</p>
                                    </div>
                                    <button className={styles.btnDangerOutline}>
                                        <span className="material-symbols-outlined">logout</span>
                                        Đăng xuất
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Save bar */}
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
        </AdminLayout>
    );
};

export default AdminProfile;