import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CandidateSavedJobs.module.css';
import CandidateLayout from '../../layouts/candidate/CandidateLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
interface Job {
    id: string;
    company_id: string;
    title: string;
    company: string;
    companyInitials: string;
    companyColor: string;
    logo_url?: string;
    location: string;
    tags: string[];
    itssLevel: string;
    salary: string;
    postedAt: string;
    badge?: 'hot' | 'new';
    descriptionText: string;
    requirementsText: string;
    benefitsText: string;
    companyInfo: string;
    deadline?: string;
}

interface UserCV {
    id: string;
    name: string;
    date: string;
    size: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const getCompanyInitials = (name?: string) => {
    if (!name) return 'IT';
    return name.substring(0, 2).toUpperCase();
};

const formatSalary = (min?: number, max?: number, rangeStr?: string) => {
    if (rangeStr) return rangeStr;
    if (!min && !max) return 'Thỏa thuận';
    if (min && !max) return `Từ $${min}`;
    if (!min && max) return `Đến $${max}`;
    return `$${min} - $${max}`;
};

const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Vừa xong';
    const utcDateStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const diff = new Date().getTime() - new Date(utcDateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Vừa xong';
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
};

const formatDescLines = (desc?: string): string[] => {
    if (!desc) return ['Chưa có thông tin cập nhật.'];
    return desc
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.replace(/^[-•]\s*/, '').trim());
};

/* ═══════════════════════════════════════════════════════════════
   CandidateSavedJobs Component
═══════════════════════════════════════════════════════════════ */
const CandidateSavedJobs: React.FC = () => {
    const navigate = useNavigate();
    const [savedJobs, setSavedJobs] = useState<Job[]>([]);
    const [userCvs, setUserCvs] = useState<UserCV[]>([]);
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
    
    /* State Tìm kiếm & Lọc trong danh sách đã lưu */
    const [searchQuery, setSearchQuery] = useState('');
    
    /* State Loading & Modal */
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalJob, setModalJob] = useState<Job | null>(null);
    const [selectedCvId, setSelectedCvId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
    const detailRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /* ── NẠP DỮ LIỆU VIỆC LÀM ĐÃ LƯU ────────────────────────────── */
    useEffect(() => {
        const loadSavedJobsData = async () => {
            setLoading(true);
            try {
                // 1. Đọc ID các job đã lưu từ LocalStorage (Đồng bộ với CandidateJobs)
                const localSaved = localStorage.getItem('hiregen_candidate_saved_jobs');
                const savedIdsArray: string[] = localSaved ? JSON.parse(localSaved) : [];

                if (savedIdsArray.length === 0) {
                    setSavedJobs([]);
                    setLoading(false);
                    return;
                }

                // 2. Tải danh mục công ty để map tên/mô tả
                let compMap: Record<string, { name: string; desc: string; logo_url?: string}> = {};
                try {
                    const compRes = await axiosClient.get('/api/companies/public');
                    const compList = compRes.data || [];
                    compList.forEach((c: any) => {
                        compMap[c.id] = { 
                            name: c.name, 
                            desc: c.description || 'Doanh nghiệp đối tác tuyển dụng uy tín tại thị trường Nhật Bản.',
                            logo_url: c.logo_url
                        };
                    });
                } catch (e) {
                    console.warn('Chưa nạp được danh mục công ty công khai.');
                }

                // 3. Tải danh sách việc làm và lọc ra những job khớp ID đã lưu
                const jobsRes = await axiosClient.get('/api/jobs/public');
                const rawJobs = jobsRes.data || [];

                const filteredRawJobs = rawJobs.filter((j: any) => savedIdsArray.includes(String(j.id)));

                const loadedSavedJobs: Job[] = filteredRawJobs.map((j: any) => {
                    const compObj  = compMap[j.company_id] || {};
                    const compName = compObj.name || j.company_name || j.company?.name || 'Công ty đối tác';
                    const compInitials = compName.charAt(0).toUpperCase();
                    const logoUrl = compObj.logo_url || j.logo_url || j.company?.logo_url || '';
                    const compDesc = compObj.desc || j.company?.description || 'Chưa có thông tin giới thiệu chi tiết về doanh nghiệp này.';
                    
                    const tags: string[] = [];
                    if (j.itss_category) tags.push(j.itss_category);
                    if (j.job_type) tags.push(j.job_type);
                    if (tags.length === 0) tags.push('ITSS');

                    let badge: 'new' | 'hot' | undefined = undefined;
                    if (j.created_at) {
                        const daysOld = (Date.now() - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24);
                        if (daysOld <= 3) badge = 'new';
                    }

                    let deadlineStr = undefined;
                    if (j.deadline) {
                        deadlineStr = new Date(j.deadline).toLocaleDateString('vi-VN');
                    }

                    return {
                        id:               String(j.id),
                        company_id:       j.company_id,
                        title:            j.title || 'Vị trí tuyển dụng',
                        company:          compName,
                        companyInitials:  compInitials,
                        companyColor:     '#1e4076',
                        logo_url:         logoUrl,
                        location:         j.location || 'Hà Nội, Việt Nam',
                        tags,
                        itssLevel:        j.itss_level ? `ITSS L${j.itss_level}` : 'ITSS L3',
                        salary:           formatSalary(j.salary_min, j.salary_max, j.salary_range),
                        postedAt:         getTimeAgo(j.created_at),
                        badge,
                        descriptionText:  j.description_text  || '',
                        requirementsText: j.requirements_text || '',
                        benefitsText:     j.benefits_text     || '',
                        companyInfo:      compDesc,
                        deadline:         deadlineStr
                    };
                });

                setSavedJobs(loadedSavedJobs);
                if (loadedSavedJobs.length > 0) {
                    setActiveJob(loadedSavedJobs[0]);
                }

                // 4. Nạp kho CV cá nhân
                try {
                    const cvRes = await axiosClient.get('/api/candidate/resumes');
                    const rawCvs = cvRes.data || [];
                    const loadedCvs: UserCV[] = rawCvs.map((c: any) => ({
                        id:   String(c.id),
                        name: c.cv_url?.split('/').pop() || 'Hồ sơ đính kèm.pdf',
                        date: new Date(c.created_at || c.uploaded_at || Date.now()).toLocaleDateString('vi-VN'),
                        size: c.file_size || 'PDF Document'
                    }));
                    
                    setUserCvs(loadedCvs);
                    if (loadedCvs.length > 0) {
                        setSelectedCvId(loadedCvs[0].id);
                    }
                } catch (cvErr) {
                    console.warn('Không thể tải kho CV cá nhân.');
                }

                // 5. Quét danh sách đã ứng tuyển
                try {
                    const appRes = await axiosClient.get('/api/candidate/applications');
                    const rawApps = appRes.data || [];
                    const appliedSet = new Set<string>();
                    rawApps.forEach((app: any) => {
                        if (app.job_id) appliedSet.add(String(app.job_id));
                    });
                    setAppliedIds(appliedSet);
                } catch (appErr) {
                    console.warn('Không thể quét lịch sử ứng tuyển.');
                }

            } catch (error) {
                showToast('Không thể tải danh sách việc làm đã lưu.', 'error');
            } finally {
                setLoading(false);
            }
        };

        loadSavedJobsData();
    }, []);

    /* ── Tìm kiếm nội bộ ───────────────────────────────────── */
    const filteredJobs = useMemo(() => {
        if (!searchQuery.trim()) return savedJobs;
        const q = searchQuery.toLowerCase();
        return savedJobs.filter(j =>
            j.title.toLowerCase().includes(q) ||
            j.company.toLowerCase().includes(q) ||
            j.tags.some(t => t.toLowerCase().includes(q))
        );
    }, [savedJobs, searchQuery]);

    const isSplit = activeJob !== null && filteredJobs.length > 0;

    /* ── Handlers ──────────────────────────────────────────── */
    const handleSelectJob = (job: Job) => {
        setActiveJob(job);
        setTimeout(() => detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    };

    const handleRemoveSaved = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSavedJobs(prev => {
            const updated = prev.filter(item => item.id !== id);
            const updatedIds = updated.map(item => item.id);
            localStorage.setItem('hiregen_candidate_saved_jobs', JSON.stringify(updatedIds));
            
            // Xử lý activeJob nếu job đang mở bị xóa
            if (activeJob?.id === id) {
                setActiveJob(updated.length > 0 ? updated[0] : null);
            }
            return updated;
        });
        showToast('Đã bỏ lưu việc làm', 'info');
    };

    const openApplyModal = (job: Job) => {
        if (appliedIds.has(job.id)) return;
        setModalJob(job);
        setShowModal(true);
    };

    const handleSubmitApply = async () => {
        if (!modalJob) return;
        if (!selectedCvId) {
            showToast('Vui lòng chọn một hồ sơ CV để ứng tuyển.', 'error');
            return;
        }
        
        setSubmitting(true);
        try {
            await axiosClient.post(`/api/candidate/applications`, { 
                job_id:           modalJob.id, 
                resume_id:        selectedCvId,
                application_type: 'applied'
            });
            
            setAppliedIds(prev => new Set([...prev, modalJob.id]));
            setShowModal(false);
            showToast('Ứng tuyển thành công! Hồ sơ đã được chuyển đến nhà tuyển dụng.', 'success');
        } catch (err: any) {
            let safeMsg = 'Hồ sơ chưa gửi được hoặc bạn đã ứng tuyển vị trí này.';
            if (err.response?.data?.detail) {
                safeMsg = typeof err.response.data.detail === 'string' 
                    ? err.response.data.detail 
                    : 'Dữ liệu gửi lên không hợp lệ.';
            }
            showToast(safeMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const currentSelectedCv = useMemo(() => {
        return userCvs.find(c => c.id === selectedCvId) || userCvs[0];
    }, [selectedCvId, userCvs]);

    /* ── List Item (Split View Mode) ───────────────────────── */
    const ListItem = ({ job }: { job: Job }) => {
        const selected = activeJob?.id === job.id;
        const applied  = appliedIds.has(job.id);
        return (
            <div
                className={`${styles.listItem} ${selected ? styles.listItemActive : ''}`}
                onClick={() => handleSelectJob(job)}
            >
                {selected && <div className={styles.listActiveLine} />}
                <div className={styles.liLogoPlaceholder}>
                    {job.logo_url ? (
                        <img src={job.logo_url} alt={job.company} className={styles.liLogoPlaceholder} style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className={styles.liLogoPlaceholder} style={{ background: job.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {job.companyInitials}
                        </div>
                    )}
                </div>
                <div className={styles.liInfo}>
                    <div className={styles.liHeaderRow}>
                        <p className={styles.liTitle} title={job.title}>{job.title}</p>
                        <button 
                            className={styles.btnRemoveIcon} 
                            onClick={(e) => handleRemoveSaved(job.id, e)}
                            title="Bỏ lưu tin này"
                        >
                            ✕
                        </button>
                    </div>
                    <p className={styles.liCompany}>{job.company}</p>
                    <div className={styles.liMeta}>
                        <div className={styles.liBadges}>
                            <span className={styles.liLevelPill}>{job.itssLevel}</span>
                            {applied && <span className={styles.badgeAppliedMini}>Đã nộp</span>}
                        </div>
                        <span className={styles.liSalary}>{job.salary}</span>
                    </div>
                </div>
            </div>
        );
    };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <CandidateLayout 
            pageTitle="Việc đã lưu" 
            pageSubtitle="Quản lý và theo dõi các cơ hội nghề nghiệp bạn đang quan tâm"
            headerActions={
                <button className={styles.btnExplorePrimary} onClick={() => navigate('/candidate/jobs')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                    Tìm thêm việc làm
                </button>
            }
        >

            {/* Thanh Tìm kiếm nội bộ */}
            <div className={styles.searchTopbar}>
                <div className={styles.searchWrap}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>search</span>
                    <input
                        className={styles.searchInput}
                        placeholder="Tìm trong danh sách đã lưu (tên vị trí, công ty)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className={styles.searchClear} onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>
                <div className={styles.metaCountBadge}>
                    <span>{savedJobs.length} việc làm đã lưu</span>
                </div>
            </div>

            {/* Khung chứa nội dung chính Split Layout */}
            <div className={`${styles.bodyLayout} ${isSplit ? styles.bodyLayoutSplit : ''}`}>

                {/* ── Cột trái: Danh sách việc làm ── */}
                <div className={`${styles.leftPanel} ${isSplit ? styles.leftPanelSplit : ''}`}>
                    {loading ? (
                        <div className={styles.emptyContainer}>
                            <div className={styles.emptyCircle}>
                                <div className={styles.spinner}></div>
                            </div>
                            <p className={styles.emptyTitle}>Đang tải danh sách đã lưu...</p>
                        </div>
                    ) : filteredJobs.length > 0 ? (
                        <div className={styles.listContainer}>
                            {filteredJobs.map(job => <ListItem key={job.id} job={job} />)}
                        </div>
                    ) : (
                        <div className={styles.emptyContainer}>
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--border-color)', marginBottom: 12 }}>favorite_border</span>
                            <p className={styles.emptyTitle}>Danh sách lưu trống</p>
                            <p className={styles.emptyDesc}>
                                {searchQuery 
                                    ? 'Không tìm thấy việc làm nào khớp với từ khóa tìm kiếm của bạn.' 
                                    : 'Bạn chưa lưu việc làm nào. Hãy lướt tìm và bấm "Lưu tin" để theo dõi những vị trí tốt nhất.'}
                            </p>
                            <button className={styles.btnResetFilter} onClick={() => navigate('/candidate/jobs')}>
                                Khám phá việc làm ngay
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Cột phải: Chi tiết công việc ──── */}
                {isSplit && activeJob && (
                    <div className={styles.detailPanel} ref={detailRef}>
                        <div className={styles.detailHeader}>
                            <div className={styles.dhTopRow}>
                                <div className={styles.dhLogoBox}>
                                    {activeJob.logo_url ? (
                                        <img src={activeJob.logo_url} alt={activeJob.company} className={styles.dhLogoBox} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <div className={styles.dhLogoBox} style={{ background: activeJob.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' }}>
                                            {activeJob.companyInitials}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.dhActionGroup}>
                                    <button 
                                        className={styles.actionBtnRemove} 
                                        onClick={() => handleRemoveSaved(activeJob.id)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                        Bỏ lưu tin
                                    </button>
                                </div>
                            </div>

                            <h2 className={styles.dhTitle}>{activeJob.title}</h2>
                            <p className={styles.dhCompanyInfo}>
                                <span className={styles.dhCompanyName}>{activeJob.company}</span>
                                <span className={styles.dhBullet}>•</span>
                                <span>{activeJob.location}</span>
                            </p>

                            <div className={styles.dhOverviewGrid}>
                                <div className={styles.overviewItem}>
                                    <span className={styles.overviewLabel}>Mức lương</span>
                                    <span className={styles.overviewValSalary}>{activeJob.salary}</span>
                                </div>
                                <div className={styles.overviewItem}>
                                    <span className={styles.overviewLabel}>Cấp độ ITSS</span>
                                    <span className={styles.overviewVal}>{activeJob.itssLevel}</span>
                                </div>
                                {activeJob.deadline && (
                                    <div className={styles.overviewItem}>
                                        <span className={styles.overviewLabel}>Hạn ứng tuyển</span>
                                        <span className={styles.overviewVal}>{activeJob.deadline}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CHI TIẾT NỘI DUNG JD */}
                        <div className={styles.detailBody}>
                            <div className={styles.sectionBlock}>
                                <h4 className={styles.sectionHeading}>Nhóm ngành & Kỹ năng</h4>
                                <div className={styles.detailTagsWrapper}>
                                    {activeJob.tags.map(t => (
                                        <span key={t} className={styles.detailSkillTag}>{t}</span>
                                    ))}
                                    <span className={`${styles.detailSkillTag} ${styles.detailSkillTagPrimary}`}>{activeJob.itssLevel}</span>
                                </div>
                            </div>

                            <div className={styles.sectionBlock}>
                                <h4 className={styles.sectionHeading}>Mô tả công việc</h4>
                                <ul className={styles.contentList}>
                                    {formatDescLines(activeJob.descriptionText).map((line, idx) => (
                                        <li key={idx}>{line}</li>
                                    ))}
                                </ul>
                            </div>

                            {activeJob.requirementsText && (
                                <div className={styles.sectionBlock}>
                                    <h4 className={styles.sectionHeading}>Yêu cầu ứng viên</h4>
                                    <ul className={styles.contentList}>
                                        {formatDescLines(activeJob.requirementsText).map((line, idx) => (
                                            <li key={idx}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {activeJob.benefitsText && (
                                <div className={styles.sectionBlock}>
                                    <h4 className={styles.sectionHeading}>Quyền lợi & Chế độ</h4>
                                    <ul className={styles.contentList}>
                                        {formatDescLines(activeJob.benefitsText).map((line, idx) => (
                                            <li key={idx}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {activeJob.companyInfo && (
                                <div className={styles.sectionBlock}>
                                    <h4 className={styles.sectionHeading}>Về doanh nghiệp</h4>
                                    <p className={styles.paragraphText}>{activeJob.companyInfo}</p>
                                </div>
                            )}
                        </div>

                        <div className={styles.detailFooter}>
                            {appliedIds.has(activeJob.id) ? (
                                <div className={styles.appliedAlertBlock}>
                                    <span>✓ Hồ sơ của bạn đã được gửi đến nhà tuyển dụng</span>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.dfLeft}>
                                        <span className={styles.dfActionNote}>Sẵn sàng gia nhập?</span>
                                        {activeJob.deadline && <span className={styles.dfDeadlineNote}>Hạn chót: {activeJob.deadline}</span>}
                                    </div>
                                    <button className={styles.btnApplyPrimary} onClick={() => openApplyModal(activeJob)}>
                                        Ứng tuyển ngay
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal nộp đơn ứng tuyển ──── */}
            {showModal && modalJob && (
                <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className={styles.modalBox}>
                        <div className={styles.modalTop}>
                            <h3 className={styles.modalHeading}>Xác nhận gửi hồ sơ</h3>
                            <button className={styles.btnCloseModal} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.targetJobSummary}>
                                <div className={styles.targetJobLogo}>
                                    {modalJob.logo_url ? (
                                        <img src={modalJob.logo_url} alt={modalJob.company} className={styles.targetJobLogo} style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <div className={styles.targetJobLogo} style={{ background: modalJob.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {modalJob.companyInitials}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.targetJobDetails}>
                                    <p className={styles.targetJobTitle}>{modalJob.title}</p>
                                    <p className={styles.targetJobSub}>{modalJob.company} · {modalJob.location}</p>
                                </div>
                            </div>

                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Chọn hồ sơ ứng tuyển (Từ kho CV của bạn)</label>
                                
                                {userCvs.length > 0 ? (
                                    <>
                                        <select 
                                            className={styles.cvSelectDropdown}
                                            value={selectedCvId}
                                            onChange={e => setSelectedCvId(e.target.value)}
                                        >
                                            {userCvs.map(cv => (
                                                <option key={cv.id} value={cv.id}>
                                                    {cv.name} (Cập nhật: {cv.date})
                                                </option>
                                            ))}
                                        </select>
                                        <div className={styles.cvAttachmentBox}>
                                            <div className={styles.cvFileIcon}>PDF</div>
                                            <div className={styles.cvFileInfo}>
                                                <p className={styles.cvFileName}>{currentSelectedCv?.name}</p>
                                                <p className={styles.cvFileDetail}>Cập nhật: {currentSelectedCv?.date} · {currentSelectedCv?.size}</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.cvAttachmentBox} style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
                                        <div className={styles.cvFileIcon} style={{ background: '#ef4444', color: 'white' }}>!</div>
                                        <div className={styles.cvFileInfo}>
                                            <p className={styles.cvFileName} style={{ color: '#991b1b' }}>Hộp tài liệu trống</p>
                                            <p className={styles.cvFileDetail} style={{ color: '#b91c1c' }}>Bạn chưa tải lên CV nào. Hãy upload file trước khi ứng tuyển.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Thư giới thiệu / Lời nhắn (Cover Letter)</label>
                                <textarea
                                    className={styles.textareaInput}
                                    rows={4}
                                    placeholder="Viết một vài câu giới thiệu điểm mạnh của bạn phù hợp với văn hóa công ty Nhật Bản..."
                                />
                            </div>
                        </div>
                        <div className={styles.modalBottom}>
                            <button className={styles.btnCancelModal} onClick={() => setShowModal(false)}>Hủy bỏ</button>
                            <button 
                                className={styles.btnConfirmModal} 
                                onClick={handleSubmitApply} 
                                disabled={submitting || userCvs.length === 0}
                            >
                                {submitting ? 'Đang xử lý...' : 'Xác nhận nộp đơn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`${styles.toastPopup} ${toast.type === 'error' ? styles.toastError : ''}`}>
                    {toast.msg}
                </div>
            )}
        </CandidateLayout>
    );
};

export default CandidateSavedJobs;