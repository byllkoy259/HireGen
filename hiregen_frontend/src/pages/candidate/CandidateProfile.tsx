import React, { useState, useEffect, useRef } from 'react';
import CandidateLayout from '../../layouts/candidate/CandidateLayout';
import styles from './CandidateProfile.module.css';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface ExpItem { id: string; title: string; org: string; period: string; desc: string; }
interface CertItem { id: string; name: string; org: string; date: string; }
interface EduItem { id: string; degree: string; school: string; period: string; desc: string; }
interface ProjectItem { id: string; name: string; role: string; period: string; desc: string; url: string; }
interface ResumeFile {
    id: string; cv_url: string; filename: string; uploaded_at: string;
    size_label: string; is_primary: boolean; status: string;
}

interface ProfileForm {
    id: string;
    full_name: string; 
    email: string; 
    phone: string; 
    date_of_birth: string;
    address: string; 
    about_me: string; 
    years_of_experience: string;
    desired_position: string; 
    github_url: string; 
    linkedin_url: string; 
    avatar_url?: string;
    tech_skills: string[]; 
    soft_skills: string[];
    work_experience: ExpItem[]; 
    education: EduItem[];
    certifications: CertItem[]; 
    projects: ProjectItem[];
}

const uid = () => Math.random().toString(36).slice(2, 9);
const getInitials = (name: string) => name.trim().split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() || 'CA';

/* ─── Skill Input ────────────────────────────────────────────── */
const SkillInput: React.FC<{
    skills: string[]; onChange: (s: string[]) => void;
    variant?: 'primary' | 'soft'; placeholder?: string;
}> = ({ skills, onChange, variant = 'primary', placeholder = 'Thêm kỹ năng...' }) => {
    const [input, setInput] = useState('');
    const addSkill = (val: string) => {
        const trimmed = val.trim();
        if (trimmed && !skills.includes(trimmed)) onChange([...skills, trimmed]);
        setInput('');
    };
    return (
        <div className={styles.skillsWrap}>
            {skills.map(s => (
                <span key={s} className={`${styles.chip} ${variant === 'soft' ? styles.chipSoft : ''}`}>
                    {s}
                    <button onClick={() => onChange(skills.filter(x => x !== s))}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </span>
            ))}
            <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addSkill(input); }
                    if (e.key === 'Backspace' && !input && skills.length) onChange(skills.slice(0, -1));
                }}
                placeholder={skills.length === 0 ? placeholder : ''}
            />
        </div>
    );
};

/* ─── Completeness logic ─────────────────────────────────────── */
const calcCompleteness = (f: ProfileForm, resumes: ResumeFile[]) => {
    const checks = [
        { label: 'Thông tin cơ bản',     done: !!(f.full_name && f.phone && f.date_of_birth && f.address) },
        { label: 'Giới thiệu bản thân',  done: !!f.about_me?.trim() },
        { label: 'Kỹ năng & Tags',       done: f.tech_skills.length > 0 },
        { label: 'Kinh nghiệm làm việc', done: f.work_experience.length > 0 },
        { label: 'Học vấn',              done: f.education.length > 0 },
        { label: 'Upload file CV',       done: resumes.length > 0 },
        { label: 'Mô tả dự án chi tiết', done: f.projects.length > 0 },
        { label: 'Chứng chỉ',            done: f.certifications.length > 0 },
        { label: 'Portfolio',            done: !!(f.github_url?.trim() || f.linkedin_url?.trim()) },
    ];
    const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);
    return { checks, pct };
};

/* ─── Editable Card ──────────────────────────────────────────── */
const EditableCard: React.FC<{ children: React.ReactNode; onEdit: () => void; onDelete?: () => void; }> = ({ children, onEdit, onDelete }) => (
    <div className={styles.expCard}>
        <div className={styles.expActions}>
            <button className={styles.expActionBtn} onClick={onEdit} title="Chỉnh sửa"><span className="material-symbols-outlined">edit</span></button>
            {onDelete && <button className={`${styles.expActionBtn} ${styles.expActionBtnDanger}`} onClick={onDelete} title="Xóa"><span className="material-symbols-outlined">delete</span></button>}
        </div>
        {children}
    </div>
);

/* ─── Modal ──────────────────────────────────────────────────── */
const ItemModal: React.FC<{ title: string; fields: any[]; initial: any; onSave: (d: any) => void; onClose: () => void; }> = ({ title, fields, initial, onSave, onClose }) => {
    const [data, setData] = useState<Record<string, string>>(initial);
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button className={styles.modalClose} onClick={onClose}><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className={styles.modalBody}>
                    {fields.map(f => (
                        <div key={f.key} className={styles.formGroup}>
                            <label className={styles.label}>{f.label}</label>
                            {f.multiline ? (
                                <textarea className={styles.input} style={{ minHeight: '100px', paddingTop: '10px' }} value={data[f.key] || ''} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                            ) : (
                                <input type={f.type || 'text'} className={styles.input} value={data[f.key] || ''} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                            )}
                        </div>
                    ))}
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btnReset} onClick={onClose}>Huỷ</button>
                    <button className={styles.btnSave} onClick={() => { onSave(data); onClose(); }}><span className="material-symbols-outlined">check</span>Lưu</button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   CandidateProfile Page
═══════════════════════════════════════════════════════════════ */
const CandidateProfile: React.FC = () => {
    const cvInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    
    // Lưu lại trạng thái ban đầu để so sánh (đếm số trường thay đổi)
    const [originalForm, setOriginalForm] = useState<ProfileForm | null>(null);
    
    const [resumes, setResumes]     = useState<ResumeFile[]>([]);
    const [userEmail, setUserEmail] = useState('');
    const [modal, setModal]         = useState<React.ReactNode>(null);
    const [avatarPrev, setAvatarPrev] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
    const [toast, setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    const [form, setForm] = useState<ProfileForm>({
        id: '',
        full_name: '', 
        email: '', 
        phone: '', 
        date_of_birth: '', 
        address: '', 
        about_me: '',
        years_of_experience: '', 
        desired_position: '', 
        github_url: '', 
        linkedin_url: '', 
        avatar_url: '',
        tech_skills: [], 
        soft_skills: [], 
        work_experience: [], 
        education: [], 
        certifications: [], 
        projects: [],
    });

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };

    /* ── Fetch profile ── */
    useEffect(() => {
        const load = async () => {
            try {
                const [meRes, profileRes, resumeRes] = await Promise.all([
                    axiosClient.get('/api/auth/me'),
                    axiosClient.get('/api/candidate/profile'),
                    axiosClient.get('/api/candidate/resumes').catch(() => ({ data: [] })),
                ]);
                setUserEmail(meRes.data.email || '');
                const p = profileRes.data;
                
                const loadedData = {
                    id: String(meRes.data.id || p.user_id || ''),
                    full_name: p.full_name || '', 
                    email: meRes.data.email || '', 
                    phone: p.phone || '', 
                    date_of_birth: p.date_of_birth || '', 
                    address: p.address || '',
                    about_me: p.about_me || '', 
                    years_of_experience: String(p.years_of_experience || ''),
                    desired_position: p.desired_position || '', 
                    github_url: p.github_url || '', 
                    linkedin_url: p.linkedin_url || '', 
                    avatar_url: p.avatar_url || '',
                    tech_skills: p.tech_skills || [], 
                    soft_skills: p.soft_skills || [],

                    // Mapping NGƯỢC LẠI: Backend Keys -> Frontend Form Keys
                    work_experience: (p.work_experience || []).map((x: any) => ({ 
                        id: x.id || uid(),
                        title: x.position || '',         // position -> title
                        org: x.company_name || '',       // company_name -> org
                        period: x.end_date || '',        // end_date -> period
                        desc: x.description || ''        // description -> desc
                    })),
                    education: (p.education || []).map((x: any) => ({ 
                        id: x.id || uid(),
                        degree: x.major || '',           // major -> degree
                        school: x.school_name || '',     // school_name -> school
                        period: x.end_date || '',        // end_date -> period
                        desc: x.description || ''        // description -> desc
                    })),
                    certifications: (p.certifications || []).map((x: any) => ({ 
                        id: x.id || uid(),
                        name: x.name || '',
                        org: x.issuer || '',             // issuer -> org
                        date: x.year || ''               // year -> date
                    })),
                    projects: (p.projects || []).map((x: any) => ({ 
                        id: x.id || uid(),
                        name: x.project_name || '',      // project_name -> name
                        role: x.role || '',
                        period: x.period || '', 
                        desc: x.description || '',       // description -> desc
                        url: x.url || ''
                    })),
                };

                setForm(loadedData);
                setOriginalForm(loadedData); // Lưu mốc gốc

                if (p.avatar_url && !p.avatar_url.startsWith('blob:')) {
                    setAvatarPrev(p.avatar_url);
                } else if (p.avatar_url?.startsWith('blob:')) {
                    console.warn('Phát hiện URL blob cũ trong Database, bỏ qua hiển thị để tránh lỗi 404.');
                }
                setResumes((resumeRes.data || []).map((r: any) => ({
                    id: String(r.id), cv_url: r.cv_url, filename: r.cv_url?.split('/').pop() || 'CV.pdf',
                    uploaded_at: r.uploaded_at || r.created_at || '', size_label: r.file_size || '',
                    is_primary: r.is_primary ?? false, status: r.status || 'pending',
                })));
            } catch (e) { showToast('Lỗi tải hồ sơ', 'err'); } finally { setLoading(false); }
        };
        load();
    }, []);

    const setField = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => {
        setForm(f => ({ ...f, [k]: v }));
    };

    /* ── Avatar Upload ── */
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Ảnh tối đa 5MB', 'err'); return; }
        setAvatarPrev(URL.createObjectURL(file));
        setSelectedAvatar(file);
    };

    /* ── Tính toán số trường thay đổi (Dirty check logic) ── */
    const getChangedFieldsCount = () => {
        if (!originalForm) return 0;
        let count = 0;
        const keys = Object.keys(originalForm) as Array<keyof ProfileForm>;
        for (const key of keys) {
            // So sánh sâu bằng JSON.stringify để bao quát cả Array/Object
            if (JSON.stringify(form[key]) !== JSON.stringify(originalForm[key])) {
                count++;
            }
        }
        if (selectedAvatar) count++; // Nếu đổi avatar cũng tính là 1 thay đổi
        return count;
    };
    const changedCount = getChangedFieldsCount();

    /* ── Save profile ── */
    const handleSave = async () => {
        setSaving(true);
        let finalAvatarUrl = form.avatar_url;
        
        // 1. Xử lý Upload Avatar
        if (selectedAvatar) {
            const formData = new FormData();
            formData.append('file', selectedAvatar);
            try {
                const uploadRes = await axiosClient.post('/api/upload', formData, { 
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                finalAvatarUrl = uploadRes.data.url;
            } catch {
                showToast('Lỗi tải ảnh lên', 'err'); 
                setSaving(false); 
                return;
            }
        }

        try {
            // 2. Chuẩn bị Payload theo đúng Schema CandidateProfileUpdate
            const payload = {
                full_name: form.full_name || null,
                avatar_url: finalAvatarUrl || null,
                about_me: form.about_me || null,
                phone: form.phone || null,
                date_of_birth: form.date_of_birth || null,
                address: form.address || null,
                years_of_experience: form.years_of_experience ? parseFloat(form.years_of_experience) : null,
                desired_position: form.desired_position || null,
                github_url: form.github_url || null,
                linkedin_url: form.linkedin_url || null,
                tech_skills: form.tech_skills,
                soft_skills: form.soft_skills,

                // Mapping Kinh nghiệm làm việc: org -> company_name, title -> position
                work_experience: form.work_experience.map(exp => ({
                    company_name: exp.org,
                    position: exp.title,
                    start_date: null, // Backend yêu cầu start_date/end_date là string
                    end_date: exp.period,
                    description: exp.desc
                })),

                // Mapping Học vấn: school -> school_name, degree -> major
                education: form.education.map(edu => ({
                    school_name: edu.school,
                    major: edu.degree,
                    start_date: null,
                    end_date: edu.period,
                    description: edu.desc
                })),

                // Mapping Dự án: name -> project_name
                projects: form.projects.map(proj => ({
                    project_name: proj.name,
                    role: proj.role,
                    technologies: null, // Có thể bổ sung nếu form có trường này
                    description: proj.desc
                })),

                // Mapping Chứng chỉ
                certifications: form.certifications.map(cert => ({
                    name: cert.name,
                    issuer: cert.org,
                    year: cert.date
                }))
            };

            // 3. Gửi yêu cầu lên Server
            await axiosClient.put('/api/candidate/profile', payload);
            
            setOriginalForm({ ...form, avatar_url: finalAvatarUrl });
            setSelectedAvatar(null);
            showToast('Hồ sơ đã được cập nhật thành công!');
        } catch (e) { 
            console.error("Chi tiết lỗi 422:", e);
            showToast('Lỗi xác thực dữ liệu. Vui lòng kiểm tra lại các trường nhập liệu.', 'err'); 
        } finally { 
            setSaving(false); 
        }
    };

    /* ── CV Upload ── */
    const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await axiosClient.post('/api/candidate/resumes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResumes(prev => [...prev, {
                id: String(res.data.id), cv_url: res.data.cv_url, filename: file.name,
                uploaded_at: new Date().toISOString(), size_label: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
                is_primary: false, status: 'pending',
            }]);
            showToast('Đã tải CV lên thành công');
        } catch { showToast('Upload thất bại. Vui lòng thử lại.', 'err'); }
    };

    const handleDeleteResume = async (id: string) => {
        try {
            await axiosClient.delete(`/api/candidate/resumes/${id}`);
            setResumes(prev => prev.filter(r => r.id !== id));
            showToast('Đã xoá CV');
        } catch { showToast('Không thể xóa CV.', 'err'); }
    };

    const { checks, pct } = calcCompleteness(form, resumes);

    if (loading) return (
        <CandidateLayout pageTitle="Hồ sơ & CV">
            <div className={styles.loadingState}>
                <div className={styles.loadingDots}><span /><span /><span /></div>
                <p>Đang tải hồ sơ...</p>
            </div>
        </CandidateLayout>
    );

    return (
        <CandidateLayout
            pageTitle="Hồ sơ & CV"
            pageSubtitle="Quản lý thông tin cá nhân và tài liệu ứng tuyển của bạn"
            headerActions={
                <button 
                    className={styles.btnOutline} 
                    onClick={() => {
                        if (!form.id) {
                            showToast('Chưa lấy được ID hồ sơ, vui lòng thử lại', 'err');
                            return;
                        }
                        window.open(`/profile/${form.id}`, '_blank'); 
                    }}
                >
                    <span className="material-symbols-outlined">visibility</span> Xem hồ sơ công khai
                </button>   
            }
        >
            <div className={styles.pageLayout}>

                {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
                <div className={styles.leftCol}>
                    
                    {/* Avatar Card */}
                    <div className={styles.leftCard}>
                        <div className={styles.avatarWrap}>
                            {avatarPrev ? (
                                <img src={avatarPrev} alt="avatar" className={styles.avatarImg} />
                            ) : (
                                <div className={styles.avatarInitials}>{getInitials(form.full_name || 'Candidate')}</div>
                            )}
                            <button className={styles.avatarEditBtn} onClick={() => avatarInputRef.current?.click()} title="Thay đổi ảnh đại diện">
                                <span className="material-symbols-outlined">photo_camera</span>
                            </button>
                            <input ref={avatarInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
                        </div>
                        <h2 className={styles.avatarName}>{form.full_name || 'Tên của bạn'}</h2>
                        <p className={styles.avatarRole}>{form.desired_position || 'Vị trí mong muốn'}</p>
                        
                        <div className={styles.avatarDivider} />
                        
                        <div className={styles.quickInfo}>
                            <div className={styles.quickInfoRow}>
                                <span className="material-symbols-outlined">mail</span>
                                <span className={styles.quickInfoText}>{userEmail}</span>
                            </div>
                            <div className={styles.quickInfoRow}>
                                <span className="material-symbols-outlined">phone</span>
                                <span className={styles.quickInfoText}>{form.phone || 'Chưa cập nhật'}</span>
                            </div>
                            <div className={styles.quickInfoRow}>
                                <span className="material-symbols-outlined">cake</span>
                                <span className={styles.quickInfoText}>{form.date_of_birth || 'Chưa cập nhật'}</span>
                            </div>
                            <div className={styles.quickInfoRow}>
                                <span className="material-symbols-outlined">home</span>
                                <span className={styles.quickInfoText}>{form.address || 'Chưa cập nhật'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Completeness Card */}
                    <div className={styles.leftCard}>
                        <h3 className={styles.cardTitleSm}><span className="material-symbols-outlined">donut_large</span> Mức độ hoàn thiện</h3>
                        <div className={styles.comBarTop}>
                            <span>Hồ sơ của bạn</span>
                            <span className={styles.comPct}>{pct}%</span>
                        </div>
                        <div className={styles.comTrack}>
                            <div className={styles.comFill} style={{ width: `${pct}%` }} />
                        </div>
                        <div className={styles.checklist}>
                            {checks.map(c => (
                                <div key={c.label} className={styles.checkRow}>
                                    <span className={`${styles.checkIcon} ${c.done ? styles.checkDone : styles.checkTodo}`}>
                                        <span className="material-symbols-outlined">{c.done ? 'check' : 'circle'}</span>
                                    </span>
                                    <span style={{ color: c.done ? '#1e293b' : '#64748b' }}>{c.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CV Management Card */}
                    <div className={styles.leftCard}>
                        <h3 className={styles.cardTitleSm}><span className="material-symbols-outlined">description</span> Quản lý CV</h3>
                        {resumes.map(r => (
                            <div key={r.id} className={`${styles.cvCard} ${!r.is_primary ? styles.cvCardDim : ''}`}>
                                <span className="material-symbols-outlined cvIcon">picture_as_pdf</span>
                                <div className={styles.cvInfo}>
                                    <div className={styles.cvName}>{r.filename}</div>
                                    <div className={styles.cvMeta}>{r.size_label}</div>
                                </div>
                                <button className={styles.cvAction} onClick={() => window.open(r.cv_url, '_blank')}><span className="material-symbols-outlined">download</span></button>
                                <button className={`${styles.cvAction} ${styles.cvActionDanger}`} onClick={() => handleDeleteResume(r.id)}><span className="material-symbols-outlined">delete</span></button>
                            </div>
                        ))}
                        <button className={styles.uploadBtn} onClick={() => cvInputRef.current?.click()}>
                            <span className="material-symbols-outlined">upload</span> Tải CV mới lên (PDF)
                        </button>
                        <input ref={cvInputRef} type="file" accept=".pdf" className={styles.hiddenInput} onChange={handleCvUpload} />
                    </div>
                </div>

                {/* ══ RIGHT COLUMN ═════════════════════════════════════ */}
                <div className={styles.rightCol}>

                    {/* Block 1: Thông tin cá nhân */}
                    <div className={styles.formCard}>
                        <div className={styles.formCardHeader}>
                            <div className={styles.formCardIcon}><span className="material-symbols-outlined">person</span></div>
                            <div>
                                <h3 className={styles.formCardTitle}>Thông tin cá nhân</h3>
                                <p className={styles.formCardSub}>Thông tin liên hệ và định hướng cơ bản</p>
                            </div>
                        </div>
                        <div className={styles.formBody}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Họ và tên <span className={styles.req}>*</span></label>
                                    <input className={styles.input} value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="VD: Nguyễn Văn A" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email <span className={styles.readonlyBadge}><span className="material-symbols-outlined">lock</span> Cố định</span></label>
                                    <div className={styles.readonlyInput}><span className="material-symbols-outlined">mail</span><span>{userEmail}</span></div>
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Số điện thoại</label>
                                    <input className={styles.input} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="0912 345 678" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Ngày sinh</label>
                                    <input type="date" className={styles.input} value={form.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Địa chỉ</label>
                                    <input className={styles.input} value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Hà Nội, Việt Nam" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Số năm kinh nghiệm</label>
                                    <input className={styles.input} value={form.years_of_experience} onChange={e => setField('years_of_experience', e.target.value)} placeholder="2" />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>GitHub URL</label>
                                    <div className={styles.inputWrapper}>
                                        <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                                        </svg>
                                        <input type="url" className={`${styles.input} ${styles.inputWithIcon}`} value={form.github_url} onChange={e => setField('github_url', e.target.value)} placeholder="https://github.com/..." />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>LinkedIn URL</label>
                                    <div className={styles.inputWrapper}>
                                        <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                        </svg>
                                        <input type="url" className={`${styles.input} ${styles.inputWithIcon}`} value={form.linkedin_url} onChange={e => setField('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Vị trí mong muốn</label>
                                    <input className={styles.input} value={form.desired_position} onChange={e => setField('desired_position', e.target.value)} placeholder="Backend Developer" />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Giới thiệu bản thân</label>
                                <textarea className={styles.input} style={{ minHeight: '80px', paddingTop: '10px' }} value={form.about_me} onChange={e => setField('about_me', e.target.value)} placeholder="Mô tả ngắn về bản thân" />
                            </div>
                        </div>
                    </div>

                    {/* Block 2: Kỹ năng */}
                    <div className={styles.formCard}>
                        <div className={styles.formCardHeader}>
                            <div className={styles.formCardIcon}><span className="material-symbols-outlined">psychology</span></div>
                            <div>
                                <h3 className={styles.formCardTitle}>Kỹ năng chuyên môn</h3>
                                <p className={styles.formCardSub}>Kỹ năng mềm và kỹ thuật, nhấn Enter để thêm mới</p>
                            </div>
                        </div>
                        <div className={styles.formBody}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Kỹ năng kỹ thuật (Tech Skills)</label>
                                <SkillInput skills={form.tech_skills} onChange={v => setField('tech_skills', v)} placeholder="Nhập và nhấn Enter" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Kỹ năng mềm (Soft Skills)</label>
                                <SkillInput skills={form.soft_skills} onChange={v => setField('soft_skills', v)} variant="soft" placeholder="Nhập và nhấn Enter" />
                            </div>
                        </div>
                    </div>

                    {/* Block 3: Kinh nghiệm làm việc */}
                    <div className={styles.formCard}>
                        <div className={styles.formCardHeader}>
                            <div className={styles.formCardIcon}><span className="material-symbols-outlined">work</span></div>
                            <div>
                                <h3 className={styles.formCardTitle}>Kinh nghiệm làm việc</h3>
                                <p className={styles.formCardSub}>Quá trình công tác và làm việc thực tế</p>
                            </div>
                        </div>
                        <div className={styles.formBody}>
                            {form.work_experience.map(exp => (
                                <EditableCard key={exp.id} 
                                    onEdit={() => setModal(<ItemModal title="Chỉnh sửa kinh nghiệm" fields={[{ key: 'title', label: 'Chức danh' }, { key: 'org', label: 'Công ty' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={exp} onSave={d => { setField('work_experience', form.work_experience.map(x => x.id === exp.id ? { ...exp, ...d } : x)); }} onClose={() => setModal(null)} />)}
                                    onDelete={() => setField('work_experience', form.work_experience.filter(x => x.id !== exp.id))}
                                >
                                    <div className={styles.expTitle}>{exp.title}</div>
                                    <div className={styles.expOrg}>{exp.org}</div>
                                    <div className={styles.expPeriod}>{exp.period}</div>
                                    <div className={styles.expDesc}>{exp.desc}</div>
                                </EditableCard>
                            ))}
                            <button className={styles.addBtn} onClick={() => setModal(<ItemModal title="Thêm kinh nghiệm" fields={[{ key: 'title', label: 'Chức danh' }, { key: 'org', label: 'Công ty' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={{}} onSave={d => { setField('work_experience', [...form.work_experience, { id: uid(), ...d } as ExpItem]); }} onClose={() => setModal(null)} />)}>
                                <span className="material-symbols-outlined">add</span> Thêm kinh nghiệm làm việc
                            </button>
                        </div>
                    </div>

                    {/* Block 4: Học vấn & Chứng chỉ & Dự án */}
                    <div className={styles.formCard}>
                        <div className={styles.formCardHeader}>
                            <div className={styles.formCardIcon}><span className="material-symbols-outlined">school</span></div>
                            <div>
                                <h3 className={styles.formCardTitle}>Học vấn, Dự án & Chứng chỉ</h3>
                                <p className={styles.formCardSub}>Thông tin bổ sung củng cố hồ sơ của bạn</p>
                            </div>
                        </div>
                        <div className={styles.formBody}>
                            
                            {/* Học vấn */}
                            <label className={`${styles.label} ${styles.sectionLabel}`}>Học vấn</label>
                            {form.education.map(edu => (
                                <EditableCard key={edu.id} onEdit={() => setModal(<ItemModal title="Sửa học vấn" fields={[{ key: 'degree', label: 'Bằng cấp/Chuyên ngành' }, { key: 'school', label: 'Trường' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={edu} onSave={d => setField('education', form.education.map(x => x.id === edu.id ? { ...edu, ...d } : x))} onClose={() => setModal(null)} />)} onDelete={() => setField('education', form.education.filter(x => x.id !== edu.id))}>
                                    <div className={styles.expTitle}>{edu.degree}</div><div className={styles.expOrg}>{edu.school}</div><div className={styles.expPeriod}>{edu.period}</div>
                                </EditableCard>
                            ))}
                            <button className={styles.addBtn} onClick={() => setModal(<ItemModal title="Thêm học vấn" fields={[{ key: 'degree', label: 'Bằng cấp/Chuyên ngành' }, { key: 'school', label: 'Trường' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={{}} onSave={d => setField('education', [...form.education, { id: uid(), ...d } as EduItem])} onClose={() => setModal(null)} />)}><span className="material-symbols-outlined">add</span> Thêm học vấn</button>

                            <div className={styles.innerDivider} />

                            {/* Dự án */}
                            <label className={`${styles.label} ${styles.sectionLabel}`}>Dự án tiêu biểu</label>
                            {form.projects.map(proj => (
                                <EditableCard key={proj.id} onEdit={() => setModal(<ItemModal title="Sửa dự án" fields={[{ key: 'name', label: 'Tên dự án' }, { key: 'role', label: 'Vai trò' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'url', label: 'Link', type: 'url' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={proj} onSave={d => setField('projects', form.projects.map(x => x.id === proj.id ? { ...proj, ...d } : x))} onClose={() => setModal(null)} />)} onDelete={() => setField('projects', form.projects.filter(x => x.id !== proj.id))}>
                                    <div className={styles.expTitle}>{proj.name}</div><div className={styles.expOrg}>{proj.role}</div><div className={styles.expPeriod}>{proj.period}</div>
                                </EditableCard>
                            ))}
                            <button className={styles.addBtn} onClick={() => setModal(<ItemModal title="Thêm dự án" fields={[{ key: 'name', label: 'Tên dự án' }, { key: 'role', label: 'Vai trò' }, { key: 'period', label: 'Khoảng thời gian' }, { key: 'url', label: 'Link', type: 'url' }, { key: 'desc', label: 'Mô tả', multiline: true }]} initial={{}} onSave={d => setField('projects', [...form.projects, { id: uid(), ...d } as ProjectItem])} onClose={() => setModal(null)} />)}><span className="material-symbols-outlined">add</span> Thêm dự án</button>

                            <div className={styles.innerDivider} />

                            {/* Chứng chỉ */}
                            <label className={`${styles.label} ${styles.sectionLabel}`}>Chứng chỉ</label>
                            {form.certifications.map(cert => (
                                <EditableCard key={cert.id} onEdit={() => setModal(<ItemModal title="Sửa chứng chỉ" fields={[{ key: 'name', label: 'Tên chứng chỉ' }, { key: 'org', label: 'Tổ chức cấp' }, { key: 'date', label: 'Ngày cấp' }]} initial={cert} onSave={d => setField('certifications', form.certifications.map(x => x.id === cert.id ? { ...cert, ...d } : x))} onClose={() => setModal(null)} />)} onDelete={() => setField('certifications', form.certifications.filter(x => x.id !== cert.id))}>
                                    <div className={styles.expTitle}>{cert.name}</div><div className={styles.expOrg}>{cert.org}</div><div className={styles.expPeriod}>{cert.date}</div>
                                </EditableCard>
                            ))}
                            <button className={styles.addBtn} onClick={() => setModal(<ItemModal title="Thêm chứng chỉ" fields={[{ key: 'name', label: 'Tên chứng chỉ' }, { key: 'org', label: 'Tổ chức cấp' }, { key: 'date', label: 'Ngày cấp' }]} initial={{}} onSave={d => setField('certifications', [...form.certifications, { id: uid(), ...d } as CertItem])} onClose={() => setModal(null)} />)}><span className="material-symbols-outlined">add</span> Thêm chứng chỉ</button>
                            
                        </div>
                    </div>

                    {/* Save bar */}
                    {changedCount > 0 && (
                        <div className={styles.saveBar}>
                            <p className={styles.saveBarHint}>
                                <span className="material-symbols-outlined">edit</span> Bạn có {changedCount} phần thông tin chưa được lưu
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className={styles.btnReset} onClick={() => window.location.reload()}>Huỷ thay đổi</button>
                                <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                                    {saving ? <><span className={styles.spinner} />Đang lưu...</> : <><span className="material-symbols-outlined">check</span>Lưu hồ sơ</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal & Toast */}
            {modal}
            {toast && (
                <div className={`${styles.toast} ${toast.type === 'err' ? styles.toastErr : ''}`}>
                    <span className="material-symbols-outlined">{toast.type === 'ok' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}
        </CandidateLayout>
    );
};

export default CandidateProfile;