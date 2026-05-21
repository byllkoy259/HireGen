import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './CandidateJobs.module.css';
import CandidateLayout from '../../layouts/candidate/CandidateLayout';
import axiosClient from '../../services/axiosClient';
import {
    ALL_ITSS_CATEGORIES_LABEL,
    ITSS_CATEGORIES,
    ITSS_LEVEL_FILTERS,
    matchesItssLevelFilter,
} from '../../constants/itss';

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
    itssCategory: string;
    itssLevel: string;
    salary: string;
    salarySortValue: number;
    postedAt: string;
    createdAt: number;
    badge?: 'hot' | 'new';
    descriptionText: string;
    requirementsText: string;
    benefitsText: string;
    companyInfo: string;
    companyWebsite?: string;
    deadline?: string;
}

interface UserCV {
    id: string;
    name: string;
    date: string;
    size: string;
}

type SortOrder = 'newest' | 'salary_high';

const LOCATIONS    = ['Tất cả địa điểm', 'Nhật Bản', 'Hà Nội', 'Đà Nẵng', 'TP.HCM', 'Remote', 'Hybrid'];

/* ─── Helpers ────────────────────────────────────────────────── */

const formatSalary = (min?: number, max?: number, rangeStr?: string) => {
    if (rangeStr) return rangeStr;
    if (!min && !max) return 'Thỏa thuận';
    if (min && !max) return `Từ $${min}`;
    if (!min && max) return `Đến $${max}`;
    return `$${min} - $${max}`;
};

const getSalarySortValue = (min?: number, max?: number, rangeStr?: string) => {
    if (typeof max === 'number' && max > 0) return max;
    if (typeof min === 'number' && min > 0) return min;

    const values = String(rangeStr || '')
        .match(/\d[\d.,]*/g)
        ?.map(value => Number(value.replace(/[.,]/g, '')))
        .filter(value => Number.isFinite(value)) || [];

    return values.length > 0 ? Math.max(...values) : 0;
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

/* Phân rã văn bản thành các gạch đầu dòng chi tiết */
const getExternalUrl = (url?: string) => {
    const trimmedUrl = url?.trim();
    if (!trimmedUrl) return '';

    return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
};

const formatDescLines = (desc?: string): string[] => {
    if (!desc) return ['Chưa có thông tin cập nhật.'];
    return desc
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.replace(/^[-•]\s*/, '').trim());
};

/* ═══════════════════════════════════════════════════════════════
   CandidateJobs Component
═══════════════════════════════════════════════════════════════ */
const CandidateJobs: React.FC = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [userCvs, setUserCvs] = useState<UserCV[]>([]);
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
    
    const [search, setSearch] = useState('');
    const [location, setLocation] = useState('Tất cả địa điểm');
    const [activeFilter, setActiveFilter] = useState(ITSS_LEVEL_FILTERS[0]);
    const [activeCategory, setActiveCategory] = useState(ALL_ITSS_CATEGORIES_LABEL);
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    
    /* State Loading & Modal */
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [modalJob, setModalJob] = useState<Job | null>(null);
    const [selectedCvId, setSelectedCvId] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
    const detailRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /* ── NẠP DỮ LIỆU TỪ HỆ THỐNG API THẬT VỚI O(1) MAPPING ──────────────────── */
    useEffect(() => {
        const loadJobDashboardData = async () => {
            setLoading(true);
            try {
                // 1. Quét danh sách toàn bộ công ty đối tác trước để lấy thông tin mapping O(1)
                let compMap: Record<string, { name: string; desc: string; logo_url?: string; website?: string}> = {};
                try {
                    // Cần mở 1 endpoint GET /api/companies/public ở Backend nếu chưa có, hoặc fallback
                    const compRes = await axiosClient.get('/api/companies/public');
                    const compList = compRes.data || [];
                    compList.forEach((c: any) => {
                        compMap[c.id] = { 
                            name: c.name, 
                            desc: c.description || 'Doanh nghiệp đối tác tuyển dụng uy tín tại thị trường Nhật Bản.' ,
                            logo_url: c.logo_url || '',
                            website: c.website || ''
                        };
                    });
                } catch (e) {
                    console.warn('Chưa nạp được danh mục công ty công khai.');
                }

                // 2. Quét danh sách việc làm mở từ API
                const jobsRes = await axiosClient.get('/api/jobs/public');
                const rawJobs = jobsRes.data || [];

                const loadedJobs: Job[] = rawJobs.map((j: any) => {
                    // ÁNH XẠ CHUẨN XÁC: Ưu tiên lấy từ compMap, nếu không có mới fallback
                    const compObj  = compMap[j.company_id] || {};
                    const compName = compObj.name || j.company_name || j.company?.name || 'Công ty đối tác';
                    const compInitials  = compName.charAt(0).toUpperCase();
                    const compLogo = j.logo_url || compObj.logo_url || j.company?.logo_url || ''; 
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
                        logo_url:         compLogo,
                        location:         j.location || 'Hà Nội, Việt Nam',
                        tags,
                        itssCategory:     j.itss_category || 'ITSS',
                        itssLevel:        j.itss_level ? `ITSS L${j.itss_level}` : 'ITSS L3',
                        salary:           formatSalary(j.salary_min, j.salary_max, j.salary_range),
                        salarySortValue:  getSalarySortValue(j.salary_min, j.salary_max, j.salary_range),
                        postedAt:         getTimeAgo(j.created_at),
                        createdAt:         j.created_at ? new Date(j.created_at).getTime() : 0,
                        badge,
                        descriptionText:  j.description_text  || '',
                        requirementsText: j.requirements_text || '',
                        benefitsText:     j.benefits_text     || '',
                        companyInfo:      compDesc,
                        companyWebsite:   compObj.website || j.company?.website || '',
                        deadline:         deadlineStr
                    };
                });

                setJobs(loadedJobs);

                // 3. Nạp kho CV cá nhân của ứng viên
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

                // 4. Quét lịch sử nộp đơn để đồng bộ trạng thái "Đã nộp"
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

                // 5. Khôi phục danh sách việc làm đã lưu
                const localSaved = localStorage.getItem('hiregen_candidate_saved_jobs');
                if (localSaved) {
                    setSavedIds(new Set(JSON.parse(localSaved)));
                }

            } catch (error) {
                showToast('Không thể kết nối đến máy chủ việc làm.', 'error');
            } finally {
                setLoading(false);
            }
        };

        loadJobDashboardData();
    }, [refreshKey]);

    /* ── Bộ lọc & Logic tìm kiếm ───────────────────────────── */
    const filtered = useMemo(() => {
        let list = [...jobs];
        
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(j =>
                j.title.toLowerCase().includes(q) ||
                j.company.toLowerCase().includes(q) ||
                j.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        
        if (location !== 'Tất cả địa điểm') {
            const locQuery = location.split(',')[0].toLowerCase().trim();
            list = list.filter(j => j.location.toLowerCase().includes(locQuery));
        }
        
        list = list.filter(j => matchesItssLevelFilter(j.itssLevel, activeFilter));

        if (activeCategory !== ALL_ITSS_CATEGORIES_LABEL) {
            list = list.filter(j => j.itssCategory === activeCategory || j.tags.includes(activeCategory));
        }

        list.sort((a, b) => {
            if (sortOrder === 'salary_high') {
                return b.salarySortValue - a.salarySortValue || b.createdAt - a.createdAt;
            }

            return b.createdAt - a.createdAt;
        });
        
        return list;
    }, [jobs, search, location, activeFilter, activeCategory, sortOrder]);

    const isSplit = activeJob !== null && filtered.length > 0;

    /* ── Handlers ──────────────────────────────────────────── */
    const handleSelectJob = (job: Job) => {
        setActiveJob(job);
        setTimeout(() => detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    };

    const handleBack = () => setActiveJob(null);

    const toggleSave = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSavedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { 
                next.delete(id); 
                showToast('Đã bỏ lưu việc làm', 'info'); 
            } else { 
                next.add(id); 
                showToast('Đã lưu việc làm thành công', 'success'); 
            }
            localStorage.setItem('hiregen_candidate_saved_jobs', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const handleShare = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href);
            showToast('Đã sao chép đường dẫn việc làm!', 'info');
        }
    };

    const openApplyModal = (job: Job) => {
        if (appliedIds.has(job.id)) return;
        setModalJob(job);
        setCoverLetter('');
        setShowModal(true);
    };

    /* XỬ LÝ NỘP ĐƠN VỚI API THẬT */
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
                application_type: 'applied',
                cover_letter:     coverLetter.trim() || null,
            });
            
            setAppliedIds(prev => new Set([...prev, modalJob.id]));
            setShowModal(false);
            setCoverLetter('');
            showToast('Ứng tuyển thành công! Hồ sơ đã được chuyển đến nhà tuyển dụng.', 'success');
        } catch (err: any) {
            let safeMsg = 'Hồ sơ chưa gửi được hoặc bạn đã ứng tuyển vị trí này.';
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                safeMsg = typeof detail === 'string' 
                    ? detail 
                    : 'Dữ liệu gửi lên không hợp lệ (Lỗi 422 Unprocessable Content).';
            }
            showToast(safeMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const currentSelectedCv = useMemo(() => {
        return userCvs.find(c => c.id === selectedCvId) || userCvs[0];
    }, [selectedCvId, userCvs]);

    /* ── Job Card (Grid Mode) ──────────────────────────────── */
    const GridCard = ({ job }: { job: Job }) => {
        const applied = appliedIds.has(job.id);
        return (
            <div className={styles.gridCard} onClick={() => handleSelectJob(job)}>
                <div className={styles.gcCardContent}>
                    <div>
                        <div className={styles.gcTop}>
                            <div className={styles.gcLogoPlaceholder}>
                                {job.logo_url ? (
                                    <img src={job.logo_url} alt={job.company} className={styles.gcLogoPlaceholder} style={{ objectFit: 'cover' }} />
                                ) : (
                                    <div className={styles.gcLogoPlaceholder} style={{ background: job.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {job.companyInitials}
                                    </div>
                                )}
                            </div>
                            <div className={styles.gcBadges}>
                                {applied && <span className={styles.badgeApplied}>Đã nộp</span>}
                                {!applied && job.badge === 'hot' && <span className={styles.badgeHot}>HOT</span>}
                                {!applied && job.badge === 'new' && <span className={styles.badgeNew}>MỚI</span>}
                            </div>
                        </div>
                        <h3 className={styles.gcTitle}>{job.title}</h3>
                        <p className={styles.gcCompany}>{job.company} · <span>{job.location}</span></p>
                        
                        <div className={styles.gcTags}>
                            {job.tags.map(t => <span key={t} className={styles.gcTag}>{t}</span>)}
                            <span className={`${styles.gcTag} ${styles.gcTagLevel}`}>{job.itssLevel}</span>
                        </div>
                    </div>

                    <div className={styles.gcFooter}>
                        <span className={styles.gcPosted}>{job.postedAt}</span>
                        <span className={styles.gcSalary}>{job.salary}</span>
                    </div>
                </div>
            </div>
        );
    };

    /* ── List Item (Split Mode) ────────────────────────────── */
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
                        <img src={job.logo_url} alt={job.company} className={styles.liLogo} style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className={styles.liLogo} style={{ background: job.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {job.companyInitials}
                        </div>
                    )}
                </div>
                <div className={styles.liInfo}>
                    <div className={styles.liHeaderRow}>
                        <p className={styles.liTitle}>{job.title}</p>
                        {applied && <span className={styles.badgeAppliedMini}>Đã nộp</span>}
                    </div>
                    <p className={styles.liCompany}>{job.company}</p>
                    <div className={styles.liMeta}>
                        <span className={styles.liLevelPill}>{job.itssLevel}</span>
                        <span className={styles.liSalary}>{job.salary}</span>
                    </div>
                </div>
            </div>
        );
    };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <CandidateLayout 
            pageTitle="Tìm việc làm" 
            pageSubtitle="Khám phá cơ hội nghề nghiệp chuẩn ITSS Nhật Bản"
            headerActions={
                <button
                    className={styles.refreshBtn}
                    onClick={() => setRefreshKey(key => key + 1)}
                    disabled={loading}
                >
                    <span className="material-symbols-outlined">refresh</span>
                    Làm mới
                </button>
            }
        >

            {/* Thanh Search & Filter chính */}
            <div className={styles.searchTopbar}>
                <div className={styles.searchWrap}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>search</span>
                    <input
                        className={styles.searchInput}
                        placeholder="Tên vị trí, kỹ năng, công ty..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setSearch('')}
                    />
                    {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
                </div>
                <select
                    className={styles.locSelect}
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                >
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
                <button className={styles.searchBtn}>Tìm kiếm</button>
            </div>

            {/* Khung chứa nội dung chính */}
            <div className={`${styles.bodyLayout} ${isSplit ? styles.bodyLayoutSplit : ''}`}>

                {/* ── Cột trái: Danh sách việc làm ── */}
                <div className={`${styles.leftPanel} ${isSplit ? styles.leftPanelSplit : ''}`}>
                    
                    <div className={styles.filterBar}>
                        <div className={styles.filterGroup}>
                            {ITSS_LEVEL_FILTERS.map(f => (
                                <button
                                    key={f}
                                    className={`${styles.filterChip} ${activeFilter === f ? styles.filterChipActive : ''}`}
                                    onClick={() => setActiveFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <select
                            className={styles.categorySelect}
                            value={activeCategory}
                            onChange={e => setActiveCategory(e.target.value)}
                        >
                            {[ALL_ITSS_CATEGORIES_LABEL, ...ITSS_CATEGORIES].map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.listMeta}>
                        <span className={styles.metaTxt}>
                            {loading ? 'Đang quét hệ thống...' : `Tìm thấy ${filtered.length} việc làm phù hợp`}
                        </span>
                        <select
                            className={styles.sortSelect}
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as SortOrder)}
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="salary_high">Lương cao nhất</option>
                        </select>
                    </div>

                    {/* Màn hình nạp dữ liệu */}
                    {loading ? (
                        <div className={styles.emptyContainer}>
                            <div className={styles.emptyCircle}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.spinner}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                            </div>
                            <p className={styles.emptyTitle}>Đang nạp dữ liệu thị trường...</p>
                        </div>
                    ) : filtered.length > 0 ? (
                        !isSplit ? (
                            <div className={styles.gridContainer}>
                                {filtered.map(job => <GridCard key={job.id} job={job} />)}
                            </div>
                        ) : (
                            <div className={styles.listContainer}>
                                {filtered.map(job => <ListItem key={job.id} job={job} />)}
                            </div>
                        )
                    ) : (
                        <div className={styles.emptyContainer}>
                            <div className={styles.emptyCircle}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                            <p className={styles.emptyTitle}>Không tìm thấy công việc phù hợp</p>
                            <p className={styles.emptyDesc}>Hãy thử điều chỉnh lại từ khóa hoặc bộ lọc ITSS để quét thêm kết quả từ hệ thống.</p>
                            <button className={styles.btnResetFilter} onClick={() => { setSearch(''); setActiveFilter(ITSS_LEVEL_FILTERS[0]); setActiveCategory(ALL_ITSS_CATEGORIES_LABEL); setLocation(LOCATIONS[0]); }}>
                                Xóa toàn bộ lọc
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Cột phải: Chi tiết công việc (Chỉ hiện khi Split) ──── */}
                {isSplit && activeJob && (
                    <div className={styles.detailPanel} ref={detailRef}>
                        <div className={styles.detailHeader}>
                            <button className={styles.backBtn} onClick={handleBack}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                Quay lại danh sách
                            </button>

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
                                    <button className={styles.actionBtnSecondary} onClick={handleShare}>
                                        Chia sẻ
                                    </button>
                                    <button
                                        className={`${styles.actionBtnSecondary} ${savedIds.has(activeJob.id) ? styles.actionBtnSaved : ''}`}
                                        onClick={() => toggleSave(activeJob.id)}
                                    >
                                        {savedIds.has(activeJob.id) ? 'Đã lưu' : 'Lưu tin'}
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

                        {/* NÂNG CẤP BỔ SUNG ĐẦY ĐỦ 3 KHỐI JD CỐT LÕI */}
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
                                    {activeJob.companyWebsite && (
                                        <a
                                            href={getExternalUrl(activeJob.companyWebsite)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.companyWebsiteLink}
                                        >
                                            <span className="material-symbols-outlined">language</span>
                                            Website công ty
                                        </a>
                                    )}
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
                                                <p className={styles.cvFileDetail}>Cập nhật gần nhất: {currentSelectedCv?.date} · {currentSelectedCv?.size}</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.cvAttachmentBox} style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
                                        <div className={styles.cvFileIcon} style={{ background: '#ef4444', color: 'white' }}>!</div>
                                        <div className={styles.cvFileInfo}>
                                            <p className={styles.cvFileName} style={{ color: '#991b1b' }}>Hộp tài liệu trống</p>
                                            <p className={styles.cvFileDetail} style={{ color: '#b91c1c' }}>Bạn chưa tải lên CV nào. Hãy vào trang Hồ sơ & CV để upload file trước khi ứng tuyển.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Thư giới thiệu / Lời nhắn (Cover Letter)</label>
                                <textarea
                                    className={styles.textareaInput}
                                    rows={4}
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
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

export default CandidateJobs;

