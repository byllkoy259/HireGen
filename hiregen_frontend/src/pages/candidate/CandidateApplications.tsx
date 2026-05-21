import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CandidateApplications.module.css';
import CandidateLayout from '../../layouts/candidate/CandidateLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ──────────────────────────────────────────────────── */
type AppStage = 'pending' | 'reviewing' | 'interviewing' | 'rejected' | 'hired';

interface ApplicationDetail {
    id: string;
    job_id: string;
    job_title: string;
    company: string;
    companyInitials: string;
    companyColor: string;
    logo_url?: string;
    location: string;
    stage: AppStage;
    applied_at: string;
    updated_at: string;
    resume_name: string;
    cover_letter?: string;
    interview_date?: string;
    interview_link?: string;
    hr_note?: string;
}

/* ─── Cấu hình Trạng thái (Stage Meta) ───────────────────────── */
const STAGE_CONFIG: Record<AppStage, { label: string; cls: string; icon: string; color: string }> = {
    pending:   { label: 'Đã nộp · Chờ phản hồi', cls: 'stageNew',   icon: 'send',         color: '#0066cc' },
    reviewing: { label: 'HR đang xem xét',        cls: 'stageReview', icon: 'visibility',   color: '#5b21b6' },
    interviewing: { label: 'Lịch phỏng vấn',         cls: 'stageInterview', icon: 'event',        color: '#0f6e68' },
    hired:     { label: 'Đã nhận việc',              cls: 'stageOffer',     icon: 'celebration',  color: '#008a4b' },
    rejected:  { label: 'Không phù hợp',           cls: 'stageRejected',  icon: 'close',        color: '#808080' },
};

const FILTER_TABS: { key: 'all' | AppStage; label: string }[] = [
    { key: 'all',       label: 'Tất cả đơn' },
    { key: 'pending',       label: 'Đã nộp' },
    { key: 'reviewing',    label: 'Đang xem xét' },
    { key: 'interviewing', label: 'Phỏng vấn' },
    { key: 'hired',     label: 'Đã nhận' },
    { key: 'rejected',  label: 'Đã từ chối' },
];

/* ═══════════════════════════════════════════════════════════════
   CandidateApplications Component
═══════════════════════════════════════════════════════════════ */
const CandidateApplications: React.FC = () => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<ApplicationDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    
    /* State bộ lọc & tìm kiếm */
    const [activeTab, setActiveTab] = useState<'all' | AppStage>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedApp, setSelectedApp] = useState<ApplicationDetail | null>(null);

    /* ── Nạp dữ liệu ứng tuyển từ API ────────────────────────── */
    useEffect(() => {
        const fetchApplications = async () => {
            setLoading(true);
            try {
                const res = await axiosClient.get('/api/candidate/applications');
                const rawData = res.data || [];
                
                const loadedApps: ApplicationDetail[] = rawData.map((app: any) => {
                    let stage: AppStage = 'pending';
                    if (app.status === 'reviewing') stage = 'reviewing';
                    else if (app.status === 'interviewing') stage = 'interviewing';
                    else if (app.status === 'hired' || app.status === 'offered') stage = 'hired';
                    else if (app.status === 'rejected') stage = 'rejected';
                    else if (app.status === 'pending') stage = 'pending';

                    const companyName = app.job?.company?.name;
                    const initial = companyName.charAt(0).toUpperCase();

                    return {
                        id:             String(app.id),
                        job_id:         app.job_id || app.job?.id,
                        job_title:      app.job?.title,
                        company:        companyName,
                        companyInitials: initial,
                        companyColor:   '#1e4076',
                        logo_url:       app.job?.company?.logo_url || app.job?.logo_url || '',
                        location:       app.job?.location,
                        stage,
                        applied_at:     new Date(app.applied_at || Date.now()).toLocaleDateString('vi-VN'),
                        updated_at:     new Date(app.updated_at || app.applied_at || Date.now()).toLocaleDateString('vi-VN'),
                        resume_name:    app.resume?.cv_url ? app.resume.cv_url.split('/').pop() : 'Hồ sơ đính kèm.pdf',
                        cover_letter:   app.cover_letter || 'Không có thư giới thiệu đính kèm.',
                        interview_date: app.interview_time ? new Date(app.interview_time).toLocaleString('vi-VN') : undefined,
                        interview_link: app.interview_url,
                        hr_note:        app.hr_feedback
                    };
                });

                setApplications(loadedApps);
                if (loadedApps.length > 0) {
                    setSelectedApp(loadedApps[0]);
                }
            } catch (err) {
                console.warn('Lỗi khi tải danh sách đơn đã nộp:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, [refreshKey]);

    /* ── Logic Lọc & Tìm kiếm ────────────────────────────────── */
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchTab = activeTab === 'all' || app.stage === activeTab;
            const matchQuery = searchQuery === '' || 
                app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.company.toLowerCase().includes(searchQuery.toLowerCase());
            return matchTab && matchQuery;
        });
    }, [applications, activeTab, searchQuery]);

    // Lấy ký tự đầu làm Logo placeholder
    const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : 'IT';

    return (
        <CandidateLayout
            pageTitle="Đơn đã nộp"
            pageSubtitle="Theo dõi toàn bộ lịch sử và tiến trình ứng tuyển của bạn"
            headerActions={<>
                <button
                    className={styles.btnRefreshHeader}
                    onClick={() => setRefreshKey(key => key + 1)}
                    disabled={loading}
                >
                    <span className="material-symbols-outlined">refresh</span>
                    Làm mới
                </button>
                <button className={styles.btnExplorePrimary} onClick={() => navigate('/candidate/jobs')}>
                    <span className="material-symbols-outlined">add_circle</span>
                    Ứng tuyển thêm
                </button>
            </>}
        >
            {/* Thanh Tìm kiếm & Bộ lọc Tabs */}
            <div className={styles.filterTopbar}>
                <div className={styles.searchWrap}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>search</span>
                    <input
                        className={styles.searchInput}
                        placeholder="Tìm theo tên vị trí, công ty..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>

                <div className={styles.tabsContainer}>
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
                            onClick={() => {
                                setActiveTab(tab.key);
                                setSelectedApp(null); // Reset detail view
                            }}
                        >
                            {tab.label}
                            <span className={styles.tabCountBadge}>
                                {tab.key === 'all' 
                                    ? applications.length 
                                    : applications.filter(a => a.stage === tab.key).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Khung chính: Danh sách bên trái & Chi tiết tiến trình bên phải */}
            <div className={styles.mainContainer}>
                
                {/* ── CỘT TRÁI: DANH SÁCH ĐƠN ── */}
                <div className={styles.leftListPanel}>
                    {loading ? (
                        <div className={styles.emptyState}>
                            <div className={styles.spinner}></div>
                            <p>Đang tải danh sách đơn ứng tuyển...</p>
                        </div>
                    ) : filteredApps.length > 0 ? (
                        filteredApps.map(app => {
                            const stageMeta = STAGE_CONFIG[app.stage];
                            const isSelected = selectedApp?.id === app.id;

                            return (
                                <div
                                    key={app.id}
                                    className={`${styles.appCardItem} ${isSelected ? styles.appCardSelected : ''}`}
                                    onClick={() => setSelectedApp(app)}
                                >
                                    {isSelected && <div className={styles.activeIndicator} />}
                                    
                                    <div className={styles.cardHeader}>
                                        {app.logo_url ? (
                                            <img src={app.logo_url} alt={app.company} className={styles.logoBox} style={{ objectFit: 'cover' }} />
                                        ) : (
                                            <div className={styles.logoBox} style={{ background: app.companyColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {app.companyInitials}
                                            </div>
                                        )}
                                        <div className={styles.headerInfo}>
                                            <h4 className={styles.jobTitle} title={app.job_title}>{app.job_title}</h4>
                                            <p className={styles.companyName}>{app.company}</p>
                                        </div>
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <span className={`${styles.stageBadge} ${styles[stageMeta.cls]}`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{stageMeta.icon}</span>
                                            {stageMeta.label}
                                        </span>
                                        <span className={styles.timeText}>Nộp: {app.applied_at}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className={styles.emptyState}>
                            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--border-color)' }}>inbox</span>
                            <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: '8px 0 4px' }}>Không có đơn ứng tuyển nào</p>
                            <p style={{ fontSize: 13 }}>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái phía trên.</p>
                        </div>
                    )}
                </div>

                {/* ── CỘT PHẢI: CHI TIẾT TIẾN TRÌNH & HỒ SƠ ── */}
                <div className={styles.rightDetailPanel}>
                    {selectedApp ? (
                        <div className={styles.detailWrapper}>
                            {/* Khối Header Chi tiết */}
                            <div className={styles.detailHeader}>
                                <div className={styles.detailTopRow}>
                                    <span className={styles.locationPill}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>place</span>
                                        {selectedApp.location}
                                    </span>
                                    <button 
                                        className={styles.btnViewJD} 
                                        onClick={() => navigate(`/candidate/jobs`)}
                                        title="Xem lại chi tiết tin tuyển dụng"
                                    >
                                        Xem lại JD <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                                    </button>
                                </div>
                                <h2 className={styles.detailJobTitle}>{selectedApp.job_title}</h2>
                                <p className={styles.detailCompany}>{selectedApp.company}</p>
                            </div>

                            {/* Khối Timeline / Tiến trình xử lý */}
                            <div className={styles.sectionBlock}>
                                <h3 className={styles.sectionTitle}>Tiến trình ứng tuyển</h3>
                                <div className={styles.timelineBox}>
                                    
                                    {/* Bước 1: Đã nộp */}
                                    <div className={styles.timelineItem}>
                                        <div className={`${styles.timelineDot} ${styles.timelineDotDone}`}>✓</div>
                                        <div className={styles.timelineLine}></div>
                                        <div className={styles.timelineContent}>
                                            <p className={styles.timelineStatus}>Gửi hồ sơ thành công</p>
                                            <p className={styles.timelineDate}>{selectedApp.applied_at}</p>
                                        </div>
                                    </div>

                                    {/* Bước 2: Xem xét */}
                                    <div className={styles.timelineItem}>
                                        <div className={`${styles.timelineDot} ${selectedApp.stage !== 'pending' ? styles.timelineDotDone : styles.timelineDotPending}`}>
                                            {selectedApp.stage !== 'pending' ? '✓' : '•'}
                                        </div>
                                        <div className={styles.timelineLine}></div>
                                        <div className={styles.timelineContent}>
                                            <p className={styles.timelineStatus}>Nhà tuyển dụng tiếp nhận & Xem xét</p>
                                            <p className={styles.timelineDate}>
                                                {selectedApp.stage !== 'pending' ? selectedApp.updated_at : 'Đang chờ xử lý'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bước 3: Phỏng vấn hoặc Kết quả */}
                                    <div className={styles.timelineItem}>
                                        <div className={`${styles.timelineDot} ${
                                            selectedApp.stage === 'interviewing' ? styles.timelineDotActive : 
                                            selectedApp.stage === 'hired' ? styles.timelineDotDone :
                                            selectedApp.stage === 'rejected' ? styles.timelineDotRejected : styles.timelineDotPending
                                        }`}>
                                            {selectedApp.stage === 'hired' ? '✓' : selectedApp.stage === 'rejected' ? '✕' : '•'}
                                        </div>
                                        <div className={styles.timelineContent}>
                                            <p className={styles.timelineStatus}>
                                                {selectedApp.stage === 'hired' ? 'Chúc mừng! Bạn đã nhận việc' :
                                                 selectedApp.stage === 'rejected' ? 'Hồ sơ chưa phù hợp ở hiện tại' :
                                                 selectedApp.stage === 'interviewing' ? 'Đã lên lịch Phỏng vấn' : 'Vòng phỏng vấn / Đánh giá'}
                                            </p>
                                            
                                            {selectedApp.stage === 'interviewing' && selectedApp.interview_date && (
                                                <div className={styles.interviewAlertBox}>
                                                    <p className={styles.interviewTime}>
                                                        <span className="material-symbols-outlined">schedule</span>
                                                        {selectedApp.interview_date}
                                                    </p>
                                                    {selectedApp.interview_link && (
                                                        <a href={selectedApp.interview_link} target="_blank" rel="noreferrer" className={styles.btnMeetingLink}>
                                                            Tham gia phòng họp trực tuyến
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {selectedApp.hr_note && (
                                                <div className={styles.hrFeedbackBox}>
                                                    <strong>Phản hồi từ HR:</strong>
                                                    <p>{selectedApp.hr_note}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Khối đính kèm: CV và Thư giới thiệu */}
                            <div className={styles.sectionBlock}>
                                <h3 className={styles.sectionTitle}>Hồ sơ ứng tuyển của bạn</h3>
                                
                                <div className={styles.cvAttachmentCard}>
                                    <div className={styles.cvIcon}>PDF</div>
                                    <div className={styles.cvMeta}>
                                        <p className={styles.cvFileName}>{selectedApp.resume_name}</p>
                                        <p className={styles.cvSub}>Đã gửi lúc ứng tuyển</p>
                                    </div>
                                    <span className={styles.cvStatusTag}>Đính kèm</span>
                                </div>

                                <div className={styles.coverLetterBox}>
                                    <span className={styles.clLabel}>Thư giới thiệu (Cover Letter):</span>
                                    <p className={styles.clText}>{selectedApp.cover_letter}</p>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className={styles.emptyDetailState}>
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--border-color)' }}>touch_app</span>
                            <p>Chọn một đơn ứng tuyển bên trái để xem tiến trình chi tiết.</p>
                        </div>
                    )}
                </div>

            </div>
        </CandidateLayout>
    );
};

export default CandidateApplications;
