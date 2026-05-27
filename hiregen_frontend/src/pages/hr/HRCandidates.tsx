import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HRCandidates.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Nav: "Ứng viên" là active ─────────────────────────────── */
const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr' }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs' },
            { icon: 'person_search', label: 'Ứng viên',         href: '/hr/candidates', isActive: true  },
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
            { icon: 'domain',   label: 'Hồ sơ công ty', href: '/hr/companies' },
            { icon: 'settings', label: 'Cài đặt',       href: '/hr/settings' },
        ],
    },
];

/* ─── Types ──────────────────────────────────────────────────── */
type AppStatus = 'pending' | 'processed' | 'reviewing' | 'shortlisted' | 'interviewing' | 'rejected' | 'hired' | 'accepted';
type FilterTab = 'all' | 'ai80' | 'pending' | 'interviewing' | 'rejected';
type SortKey   = 'match_score' | 'applied_at' | 'applicant_name';

interface Candidate {
    id: string;
    applicant_name: string;
    applicant_email: string;
    location: string;
    avatar_url?: string;
    avatar_color: string;
    initials: string;
    job_title: string;
    company_name: string;
    match_score: number;
    itss_category?: string;
    itss_level?: string;
    status: AppStatus;
    applied_at: string;
    has_linkedin: boolean;
    portfolio_url?: string;
    job_id: string;
    application_id: string;
}

/* ─── Status meta ────────────────────────────────────────────── */
const STATUS_META: Record<AppStatus, { label: string; cls: string }> = {
    pending:      { label: 'Mới nộp',       cls: 'sPending' },
    processed:    { label: 'Đang đánh giá', cls: 'sReviewing' },
    reviewing:    { label: 'Đang đánh giá', cls: 'sReviewing' },
    shortlisted:  { label: 'Đạt sơ tuyển',  cls: 'sShortlisted' },
    interviewing: { label: 'Hẹn phỏng vấn', cls: 'sInterviewing' },
    rejected:     { label: 'Từ chối',       cls: 'sRejected' },
    hired:        { label: 'Đã tuyển',      cls: 'sHired' },
    accepted:     { label: 'Đã tuyển',      cls: 'sHired' },
};

const ACTION_STATUSES: AppStatus[] = ['pending', 'reviewing', 'shortlisted', 'interviewing', 'rejected', 'hired'];

const normalizeStatus = (status?: string): AppStatus => {
    if (status === 'processed') return 'reviewing';
    if (status === 'accepted') return 'hired';
    if (status === 'shortlisted') return 'shortlisted';
    if (status === 'interviewing' || status === 'rejected' || status === 'hired' || status === 'reviewing' || status === 'pending') return status;
    return 'pending';
};

/* ─── Helpers ────────────────────────────────────────────────── */
const AVATAR_COLORS = [
    '#1e4076','#be185d','#0369a1','#059669',
    '#7c3aed','#b45309','#db2777','#0f766e',
    '#dc2626','#9333ea','#0284c7','#16a34a',
];
const toColor = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

// Sửa lại hàm lấy Initials: Lấy chữ cái đầu của từ cuối cùng (Tên) hoặc 2 từ cuối
const toInitials = (name: string) => {
    if (!name || name === 'Ứng viên') return 'U';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(-2).map(w => w[0]).join('').toUpperCase();
};

const pct        = (s: number) => Math.round(s);
const fmtDate    = (iso: string) => { try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; } };
const matchColor = (s: number) => s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626';
const matchTag   = (s: number) => s >= 80 ? 'PHÙ HỢP CAO' : s >= 60 ? 'TIỀM NĂNG' : s >= 35 ? 'THẤP - CHUYỂN HƯỚNG' : 'THẤP';
const matchCls   = (s: number) => s >= 80 ? styles.tagGreen : s >= 35 ? styles.tagAmber : styles.tagRed;
const PAGE_SIZE  = 8;
const safeJson = (value: any) => {
    if (!value) return {};
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return {}; }
    }
    return value;
};
const formatItssLevel = (level: any) => {
    if (level === null || level === undefined || level === '') return undefined;
    const levelText = String(level);
    return levelText.toLowerCase().startsWith('level') ? levelText : `Level ${levelText}`;
};

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
const HRCandidates: React.FC = () => {
    const [candidates,   setCandidates]   = useState<Candidate[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [filterTab,    setFilterTab]    = useState<FilterTab>('all');
    const [jobFilter,    setJobFilter]    = useState('all');
    const [search,       setSearch]       = useState('');
    const [sortKey,      setSortKey]      = useState<SortKey>('match_score');
    const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
    const [page,         setPage]         = useState(1);
    const [refreshKey,   setRefreshKey]   = useState(0);
    
    // State quản lý Dropdown Fixed
    const [openMenuId,   setOpenMenuId]   = useState<string | null>(null);
    const [menuPos,      setMenuPos]      = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    
    const navigate                        = useNavigate();
    const tableWrapperRef                 = useRef<HTMLDivElement>(null);

    /* Fetch dữ liệu */
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Lấy danh sách jobs của HR
                const jobsRes = await axiosClient.get('/api/jobs/me');
                const jobs    = jobsRes.data || [];
                const companyRes = await axiosClient.get('/api/companies/me');
                const companies = companyRes.data || [];
                const companyMap: Record<string, string> = {};
                companies.forEach((c: any) => {
                    companyMap[c.id] = c.name;
                });

                // Lấy danh sách ứng viên           
                const all: Candidate[] = [];

                for (const job of jobs) {
                    try {
                        const res  = await axiosClient.get(`/api/hr/applications/job/${job.id}`);
                        const apps = res.data || [];
                        
                        apps.forEach((a: any) => {

                            const candidateObj = a.candidate || {};
                            const userObj = a.user || {};
                            const jobObj = a.job || {};

                            const rawScore = parseFloat(a.final_match_score ?? a.match_score) || 0;
                            const matchScore = rawScore <= 1 && rawScore > 0 ? rawScore * 100 : rawScore;
                            const evaluation = safeJson(a.evaluation_result);
                            const extracted = safeJson(a.extracted_data);
                            const itssPrediction = safeJson(extracted.itss_prediction);
                            const predictedCategory =
                                itssPrediction.category ||
                                evaluation.itss_category ||
                                a.itss_category;
                            const predictedLevel = formatItssLevel(
                                itssPrediction.level ??
                                evaluation.itss_level ??
                                a.itss_level
                            );

                            // Name
                            const name =
                                candidateObj.full_name ||
                                userObj.full_name ||
                                a.applicant_name ||
                                'Chưa cập nhật';

                            // Location
                            const location =
                                candidateObj.address ||
                                candidateObj.location ||
                                userObj.address ||
                                userObj.location ||
                                'Chưa cập nhật';

                            // Company
                            const companyName =
                                companyMap[job.company_id] ||
                                companyMap[jobObj.company_id] ||
                                'Công ty chưa cập nhật';

                            all.push({
                                id: a.id,

                                application_id: a.id,

                                applicant_name: name,

                                applicant_email:
                                    userObj.email ||
                                    a.applicant_email ||
                                    '',

                                location,

                                avatar_url:
                                    userObj.avatar_url ||
                                    candidateObj.avatar_url,

                                avatar_color: toColor(a.id),

                                initials: toInitials(name),

                                job_title:
                                    job.title ||
                                    jobObj.title ||
                                    'Chưa có tiêu đề',

                                company_name: companyName,

                                match_score: matchScore,

                                itss_category:
                                    matchScore > 0
                                        ? predictedCategory
                                        : undefined,

                                itss_level:
                                    matchScore > 0
                                        ? predictedLevel
                                        : undefined,

                                status: normalizeStatus(a.status),

                                applied_at:
                                    a.applied_at ||
                                    new Date().toISOString(),

                                has_linkedin: !!(
                                    candidateObj.linkedin_url ||
                                    userObj.linkedin_url
                                ),

                                portfolio_url:
                                    candidateObj.portfolio_url,

                                job_id:
                                    a.job_id ||
                                    job.id,
                            });
                        });
                    } catch {}
                }
                setCandidates(all);
            } catch {
                setCandidates([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [refreshKey]);

    /* Xử lý click mở Menu Dropdown (Hiển thị Fixed để không bị che) */
    const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>, appId: string) => {
        e.stopPropagation();
        if (openMenuId === appId) {
            setOpenMenuId(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({
            top: rect.bottom + window.scrollY + 4,
            left: rect.right + window.scrollX - 200 // Chiều rộng dropdown khoảng 200px
        });
        setOpenMenuId(appId);
    };

    // Đóng menu khi click ra ngoài hoặc scroll
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        const handleScroll = () => setOpenMenuId(null);
        
        const wrapper = tableWrapperRef.current;
        if (openMenuId !== null) {
            window.addEventListener('click', handleClickOutside);
            window.addEventListener('scroll', handleScroll);
            if (wrapper) wrapper.addEventListener('scroll', handleScroll);
        }
        return () => {
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', handleScroll);
            if (wrapper) wrapper.removeEventListener('scroll', handleScroll);
        };
    }, [openMenuId]);

    /* Stats */
    const total          = candidates.length;
    const ai80Count      = candidates.filter(c => c.match_score >= 80).length;
    const interviewCount = candidates.filter(c => c.status === 'interviewing').length;
    const uniqueJobs     = Array.from(new Set(candidates.map(c => c.job_title)));

    /* Filter + sort + paginate */
    const filtered = useMemo(() => {
        let list = [...candidates];
        if (filterTab === 'ai80')          list = list.filter(c => c.match_score >= 80);
        else if (filterTab === 'pending')  list = list.filter(c => c.status === 'pending');
        else if (filterTab === 'interviewing') list = list.filter(c => c.status === 'interviewing');
        else if (filterTab === 'rejected') list = list.filter(c => c.status === 'rejected');
        if (jobFilter !== 'all') list = list.filter(c => c.job_title === jobFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c => 
                c.applicant_name.toLowerCase().includes(q) || 
                c.job_title.toLowerCase().includes(q) || 
                (c.itss_category && c.itss_category.toLowerCase().includes(q))
            );
        }
        list.sort((a, b) => {
            let va: number | string = 0, vb: number | string = 0;
            if (sortKey === 'match_score')     { va = a.match_score;    vb = b.match_score; }
            else if (sortKey === 'applied_at') { va = a.applied_at;     vb = b.applied_at; }
            else                               { va = a.applicant_name; vb = b.applicant_name; }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1  : -1;
            return 0;
        });
        return list;
    }, [candidates, filterTab, jobFilter, search, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleSort = (k: SortKey) => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
        setPage(1);
    };
    const setTab = (t: FilterTab) => { setFilterTab(t); setPage(1); };

    const updateStatus = async (appId: string, newStatus: AppStatus) => {
        setCandidates(prev => prev.map(c => c.application_id === appId ? { ...c, status: newStatus } : c));
        setOpenMenuId(null);
        try { 
            await axiosClient.put(`/api/hr/applications/${appId}/status`, { status: newStatus }); 
        } catch (err) {
            console.error("Lỗi cập nhật trạng thái:", err);
        }
    };

    const Arrow = ({ k }: { k: SortKey }) => (
        <span className={`${styles.sortArrow} ${sortKey === k ? styles.sortActive : ''}`}>
            {sortKey === k && sortDir === 'asc' ? '↑' : '↓'}
        </span>
    );

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            pageTitle="Danh sách ứng viên"
            pageSubtitle={`${total} ứng viên · ${ai80Count} đạt AI Match ≥ 80% · ${interviewCount} chờ phỏng vấn`}
            headerActions={<>
                <button className={styles.btnOutline} onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>
                    <span className="material-symbols-outlined">refresh</span>
                    Làm mới
                </button>
                <button className={styles.btnOutline}>
                    <span className="material-symbols-outlined">download</span>
                    Xuất Excel
                </button>
            </>}
        >
            {/* Summary chips */}
            <div className={styles.summaryStrip}>
                <button className={`${styles.chip} ${filterTab === 'all' ? styles.chipActive : ''}`} onClick={() => setTab('all')}>
                    <span className="material-symbols-outlined">groups</span>{total} ứng viên
                </button>
                <button className={`${styles.chip} ${filterTab === 'ai80' ? styles.chipActive : ''}`} onClick={() => setTab('ai80')}>
                    <span className="material-symbols-outlined">auto_awesome</span>{ai80Count} đạt AI Match ≥ 80%
                </button>
                <button className={`${styles.chip} ${filterTab === 'interviewing' ? styles.chipActive : ''}`} onClick={() => setTab('interviewing')}>
                    <span className="material-symbols-outlined">event</span>{interviewCount} chờ phỏng vấn
                </button>
            </div>

            {/* Filter bar */}
            <div className={styles.filterBar}>
                <div className={styles.filterLeft}>
                    <select className={styles.filterSelect} value={jobFilter} onChange={e => { setJobFilter(e.target.value); setPage(1); }}>
                        <option value="all">Tất cả Job</option>
                        {uniqueJobs.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>

                    <div className={styles.searchBox}>
                        <span className="material-symbols-outlined">search</span>
                        <input className={styles.searchInput} placeholder="Tìm ứng viên, vị trí..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    </div>

                    <div className={styles.tabGroup}>
                        {([
                            { key: 'all',          label: 'Tất cả' },
                            { key: 'ai80',         label: 'AI ≥ 80%' },
                            { key: 'pending',      label: 'Mới nộp' },
                            { key: 'interviewing', label: 'Phỏng vấn' },
                            { key: 'rejected',     label: 'Đã từ chối' },
                        ] as { key: FilterTab; label: string }[]).map(t => (
                            <button key={t.key} className={`${styles.tab} ${filterTab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button className={styles.sortBtn} onClick={() => toggleSort(sortKey)}>
                    <span className="material-symbols-outlined">swap_vert</span>Sắp xếp
                </button>
            </div>

            {/* Table card */}
            <div className={styles.card}>
                {loading ? (
                    <div className={styles.emptyState}>
                        <span className="material-symbols-outlined">hourglass_top</span>Đang tải dữ liệu...
                    </div>
                ) : (
                    <div className={styles.tableWrapper} ref={tableWrapperRef}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('applicant_name')} className={styles.thSort}>Tên ứng viên <Arrow k="applicant_name" /></th>
                                    <th>Vị trí ứng tuyển</th>
                                    <th onClick={() => toggleSort('match_score')} className={styles.thSort}>Điểm AI <Arrow k="match_score" /></th>
                                    <th>ITSS dự đoán</th>
                                    <th>Trạng thái</th>
                                    <th onClick={() => toggleSort('applied_at')} className={styles.thSort}>Ngày nộp <Arrow k="applied_at" /></th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.length === 0 ? (
                                    <tr><td colSpan={7} className={styles.emptyRow}><span className="material-symbols-outlined">search_off</span>Không tìm thấy ứng viên</td></tr>
                                ) : paged.map(c => {
                                    const sm = STATUS_META[c.status] || { label: c.status || 'Đang xử lý', cls: 'sPending' };
                                    const mc = matchColor(c.match_score);
                                    const hasAI = c.match_score > 0;
                                    return (
                                        <tr key={c.application_id} className={styles.tr}>
                                            {/* Name & Avatar */}
                                            <td>
                                                <div className={styles.nameCell}>
                                                    {c.avatar_url ? (
                                                        <img src={c.avatar_url} alt={c.applicant_name} className={styles.avatarImg} />
                                                    ) : (
                                                        <div className={styles.avatar} style={{ background: c.avatar_color }}>
                                                            {c.initials}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className={styles.cName} style={{ cursor: 'pointer' }} onClick={() => navigate(`/hr/candidates/${c.application_id}`)}>
                                                            {c.applicant_name}
                                                            {c.has_linkedin && <span className={styles.liTag} title="LinkedIn">in</span>}
                                                            {c.portfolio_url && (
                                                                <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer" className={styles.pfLink} onClick={e => e.stopPropagation()}>
                                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className={styles.cLoc}><span className="material-symbols-outlined">location_on</span>{c.location}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Job & Company */}
                                            <td>
                                                <div className={styles.jobTitle}>{c.job_title}</div>
                                                <div className={styles.partnerName}>{c.company_name}</div>
                                            </td>

                                            {/* Match Score */}
                                            <td>
                                                {hasAI ? (
                                                    <>
                                                        <div className={styles.matchRow}>
                                                            <span className={styles.matchPct} style={{ color: mc }}>{pct(c.match_score)}%</span>
                                                            <span className={`${styles.matchTag} ${matchCls(c.match_score)}`}>{matchTag(c.match_score)}</span>
                                                        </div>
                                                        <div className={styles.barOuter}>
                                                            <div className={styles.barInner} style={{ width: `${pct(c.match_score)}%`, background: mc }} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className={styles.notEvalText}>Chưa đánh giá</span>
                                                )}
                                            </td>

                                            {/* ITSS (Ẩn nếu chưa có AI) */}
                                            <td>
                                                {hasAI && c.itss_category ? (
                                                    <>
                                                        <span className={styles.itssBadge}>{c.itss_category}</span>
                                                        <span className={styles.itssLvl}>{c.itss_level}</span>
                                                    </>
                                                ) : (
                                                    <span className={styles.notEvalText}>-</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td><span className={`${styles.statusBadge} ${styles[sm.cls]}`}>{sm.label}</span></td>

                                            {/* Date */}
                                            <td className={styles.dateCell}>{fmtDate(c.applied_at)}</td>

                                            {/* Actions */}
                                            <td>
                                                <div className={styles.actionsCell}>
                                                    <button className={styles.btnAI} onClick={() => navigate(`/hr/candidates/${c.application_id}`)}>
                                                        <span className="material-symbols-outlined">psychology</span>Báo cáo AI
                                                    </button>
                                                    <div className={styles.menuWrap}>
                                                        <button className={styles.menuBtn} onClick={(e) => handleActionClick(e, c.application_id)}>
                                                            <span className="material-symbols-outlined">more_vert</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Dropdown Portal Fixed (Bên ngoài cấu trúc bảng) */}
                {openMenuId !== null && (
                    <div 
                        className={styles.fixedDropdown} 
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className={styles.dropLabel}>Cập nhật trạng thái</p>
                        {ACTION_STATUSES.map(s => {
                            const currentApp = candidates.find(c => c.application_id === openMenuId);
                            const isActive = normalizeStatus(currentApp?.status) === s;
                            return (
                                <button 
                                    key={s} 
                                    className={`${styles.dropItem} ${isActive ? styles.dropItemActive : ''}`} 
                                    onClick={() => updateStatus(openMenuId, s)}
                                >
                                    <span className={`${styles.dot} ${styles[STATUS_META[s].cls + 'Dot']}`} />
                                    {STATUS_META[s].label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                <div className={styles.pagination}>
                    <span className={styles.pgInfo}>Trang {page} / {totalPages} · {filtered.length} ứng viên</span>
                    <div className={styles.pgControls}>
                        <button className={`${styles.pgBtn} ${page === 1 ? styles.pgDisabled : ''}`} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                            <span className="material-symbols-outlined">arrow_back</span>Trước
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(pg => (
                            <button key={pg} className={`${styles.pgNum} ${page === pg ? styles.pgNumActive : ''}`} onClick={() => setPage(pg)}>{pg}</button>
                        ))}
                        {totalPages > 7 && <span className={styles.pgEllipsis}>…</span>}
                        {totalPages > 7 && (
                            <button className={`${styles.pgNum} ${page === totalPages ? styles.pgNumActive : ''}`} onClick={() => setPage(totalPages)}>{totalPages}</button>
                        )}
                        <button className={`${styles.pgBtn} ${page === totalPages ? styles.pgDisabled : ''}`} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                            Sau<span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        </HRLayout>
    );
};

export default HRCandidates;
