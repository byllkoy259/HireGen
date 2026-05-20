import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';
import styles from './HRAIMatching.module.css';

type AppStatus = 'pending' | 'processed' | 'reviewing' | 'interviewing' | 'rejected' | 'hired';

interface JobOption {
    id: string;
    title: string;
    companyId?: string;
    companyName: string;
    itssCategory: string;
    itssLevel: string;
    requirementsText: string;
    skills: string[];
}

interface MatchCandidate {
    id: string;
    applicationId: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
    initials: string;
    avatarColor: string;
    matchScore: number;
    itssCategory: string;
    itssLevel: string;
    candidateSkills: string[];
    missingSkills: string[];
    status: AppStatus;
    aiSummary?: string;
    radarData?: RadarPoint[];
}

interface RadarPoint {
    label: string;
    candidate: number;
    required?: number;
}

interface GapItem {
    skill: string;
    required?: number;
    actual?: number;
    note?: string;
}

interface ApplicationAIReport {
    application_id: string;
    match_score: number;
    ai_itss_predicted: string;
    ai_itss_level: string;
    ai_summary: string;
    radar_data: RadarPoint[];
    gaps: GapItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr' }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline', label: 'Quản lý việc làm', href: '/hr/jobs' },
            { icon: 'person_search', label: 'Ứng viên', href: '/hr/candidates' },
        ],
    },
    {
        title: 'CÔNG CỤ',
        items: [
            { icon: 'auto_awesome', label: 'AI Matching', href: '/hr/ai-matching', isActive: true },
            { icon: 'bar_chart', label: 'Báo cáo', href: '/hr/reports' },
        ],
    },
    {
        title: 'CÀI ĐẶT',
        items: [
            { icon: 'domain', label: 'Hồ sơ công ty', href: '/hr/companies' },
            { icon: 'settings', label: 'Cài đặt', href: '/hr/settings' },
        ],
    },
];

const STATUS_META: Record<AppStatus, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'statusPending' },
    processed: { label: 'AI analyzed', cls: 'statusReviewing' },
    reviewing: { label: 'Reviewing', cls: 'statusReviewing' },
    interviewing: { label: 'Interviewing', cls: 'statusInterviewing' },
    rejected: { label: 'Rejected', cls: 'statusRejected' },
    hired: { label: 'Hired', cls: 'statusHired' },
};

const ITSS_LEVELS = ['Tất cả level', 'ITSS L1', 'ITSS L2', 'ITSS L3', 'ITSS L4', 'ITSS L5+'];
const AVATAR_COLORS = ['#1e4076', '#be185d', '#0369a1', '#059669', '#7c3aed', '#b45309', '#db2777', '#0f766e'];

const toInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'U';
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(-2).map(word => word[0]).join('').toUpperCase();
};

const toColor = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const normalizeScore = (score: unknown) => {
    const value = Number(score) || 0;
    if (value > 0 && value <= 1) return Math.round(value * 100);
    return Math.max(0, Math.min(100, Math.round(value)));
};

const scoreColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#d97706';
    return '#dc2626';
};

const levelMatches = (candidateLevel: string, filter: string) => {
    if (filter === ITSS_LEVELS[0]) return true;
    if (filter === 'ITSS L5+') return ['ITSS L5', 'ITSS L6', 'ITSS L7'].includes(candidateLevel);
    return candidateLevel === filter;
};

const extractRequirementItems = (text?: string) => {
    const cleaned = (text || '')
        .split(/\r?\n|[;•]/)
        .map(item => item.replace(/^[-*+\d.)\s]+/, '').trim())
        .filter(Boolean)
        .map(item => item.length > 46 ? `${item.slice(0, 43).trim()}...` : item);

    if (cleaned.length > 1) return Array.from(new Set(cleaned)).slice(0, 8);

    return (text || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.length > 46 ? `${item.slice(0, 43).trim()}...` : item)
        .slice(0, 8);
};

const safeArray = (value: unknown): any[] => {
    return Array.isArray(value) ? value : [];
};

const getExtractedData = (app: any) => {
    const raw = app.extracted_data;
    if (!raw) return {};
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return raw;
};

const normalizeItssLevel = (level: unknown, fallback = 'Chưa đánh giá') => {
    if (level === null || level === undefined || level === '') return fallback;

    const raw = String(level).trim();
    if (raw.toUpperCase().startsWith('ITSS')) return raw;
    if (/^L\d+$/i.test(raw)) return `ITSS ${raw.toUpperCase()}`;
    if (/^\d+$/.test(raw)) return `ITSS L${raw}`;

    return fallback;
};

const getCandidateSkills = (app: any) => {
    const extracted = getExtractedData(app);
    const skills = safeArray(extracted.skills)
        .map(skill => String(skill).trim())
        .filter(Boolean);

    return Array.from(new Set(skills));
};

const getMissingSkillsFromAI = (app: any) => {
    const extracted = getExtractedData(app);
    const gaps = safeArray(extracted.ai_report?.gaps || extracted.gaps);

    return gaps
        .map(gap => typeof gap === 'string' ? gap : String(gap?.skill || gap?.name || '').trim())
        .filter(Boolean)
        .slice(0, 5);
};

const normalizeRadarData = (value: unknown): RadarPoint[] => {
    return safeArray(value)
        .map(item => ({
            label: String(item?.label || item?.name || item?.skill || '').trim(),
            candidate: Math.max(0, Math.min(100, Number(item?.candidate ?? item?.value ?? item?.score) || 0)),
            required: item?.required === undefined ? undefined : Math.max(0, Math.min(100, Number(item.required) || 0)),
        }))
        .filter(item => item.label);
};

const HRAIMatching: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [jobs, setJobs] = useState<JobOption[]>([]);
    const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [selectedCandidateId, setSelectedCandidateId] = useState('');
    const [levelFilter, setLevelFilter] = useState(ITSS_LEVELS[0]);
    const [skillQuery, setSkillQuery] = useState('');
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [matching, setMatching] = useState(false);
    const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
    const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
    const [updatingId, setUpdatingId] = useState('');
    const [aiReports, setAiReports] = useState<Record<string, ApplicationAIReport>>({});
    const [loadingInsight, setLoadingInsight] = useState(false);

    const selectedJob = jobs.find(job => job.id === selectedJobId);

    useEffect(() => {
        const loadJobs = async () => {
            setLoadingJobs(true);
            try {
                const [jobsRes, companiesRes] = await Promise.all([
                    axiosClient.get('/api/jobs/me'),
                    axiosClient.get('/api/companies/me'),
                ]);

                const companyMap: Record<string, string> = {};
                (companiesRes.data || []).forEach((company: any) => {
                    companyMap[company.id] = company.name;
                });

                const mappedJobs: JobOption[] = (jobsRes.data || []).map((job: any) => {
                    const level = job.itss_level ? `ITSS L${job.itss_level}` : 'ITSS L2';
                    return {
                        id: String(job.id),
                        title: job.title || 'Vị trí tuyển dụng',
                        companyId: job.company_id,
                        companyName: companyMap[job.company_id] || job.company_name || 'Công ty đối tác',
                        itssCategory: job.itss_category || 'Business Application Development',
                        itssLevel: level,
                        requirementsText: job.requirements_text || '',
                        skills: extractRequirementItems(job.requirements_text || ''),
                    };
                });

                const queryJobId = searchParams.get('jobId');
                setJobs(mappedJobs);
                setSelectedJobId(prev =>
                    prev ||
                    (queryJobId && mappedJobs.some(job => job.id === queryJobId) ? queryJobId : '') ||
                    mappedJobs[0]?.id ||
                    '',
                );
            } catch {
                setJobs([]);
            } finally {
                setLoadingJobs(false);
            }
        };

        loadJobs();
    }, [searchParams]);

    const loadMatching = async (jobId = selectedJobId) => {
        if (!jobId) {
            setCandidates([]);
            return;
        }

        setMatching(true);
        try {
            const res = await axiosClient.get(`/api/hr/applications/job/${jobId}`);
            const job = jobs.find(item => item.id === jobId);

            const applications: any[] = res.data || [];
            const mapped: MatchCandidate[] = applications.map((app: any) => {
                const candidate = app.candidate || {};
                const user = app.user || {};
                const extracted = getExtractedData(app);
                const personalInfo = extracted.personal_info || {};
                const itssPrediction = extracted.itss_prediction || {};
                const aiReport = extracted.ai_report || {};
                const name =
                    candidate.full_name ||
                    user.full_name ||
                    personalInfo.full_name ||
                    app.applicant_name ||
                    'Ứng viên chưa cập nhật';
                const score = normalizeScore(app.match_score);
                const candidateSkills = getCandidateSkills(app);
                const missingSkills = getMissingSkillsFromAI(app);

                return {
                    id: String(candidate.id || user.id || app.id),
                    applicationId: String(app.id),
                    name,
                    email:
                        user.email ||
                        personalInfo.email ||
                        app.applicant_email ||
                        '',
                    role:
                        candidate.current_position ||
                        candidate.headline ||
                        safeArray(extracted.experience)[0]?.position ||
                        'Ứng viên IT',
                    avatarUrl: user.avatar_url || candidate.avatar_url || '',
                    initials: toInitials(name),
                    avatarColor: toColor(String(app.id)),
                    matchScore: score,
                    itssCategory:
                        app.itss_category ||
                        itssPrediction.category ||
                        job?.itssCategory ||
                        'Chưa đánh giá',
                    itssLevel: normalizeItssLevel(
                        app.itss_level || itssPrediction.level,
                        job?.itssLevel || 'Chưa đánh giá',
                    ),
                    candidateSkills,
                    missingSkills,
                    status: app.status || 'pending',
                    aiSummary: aiReport.ai_summary || extracted.ai_summary || '',
                    radarData: normalizeRadarData(aiReport.radar_data || extracted.radar_data),
                };
            }).sort((a: MatchCandidate, b: MatchCandidate) => b.matchScore - a.matchScore);

            setCandidates(mapped);
            setSelectedCandidateId(prev => mapped.some(item => item.applicationId === prev) ? prev : mapped[0]?.applicationId || '');
            setLastRunAt(new Date());
        } catch {
            setCandidates([]);
            setSelectedCandidateId('');
        } finally {
            setMatching(false);
        }
    };

    const triggerAiMatching = async () => {
        if (!selectedJobId) return;

        setMatching(true);
        try {
            await axiosClient.post(`/api/ai/match/job/${selectedJobId}`);
        } catch (error) {
            console.info('AI matching endpoint is unavailable; refreshing existing AI results instead.', error);
        } finally {
            await loadMatching(selectedJobId);
        }
    };

    useEffect(() => {
        if (selectedJobId && jobs.length > 0) {
            loadMatching(selectedJobId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedJobId, jobs.length]);

    const filteredCandidates = useMemo(() => {
        const skills = skillQuery
            .split(',')
            .map(item => item.trim().toLowerCase())
            .filter(Boolean);

        return candidates.filter(candidate => {
            const matchLevel = levelMatches(candidate.itssLevel, levelFilter);
            const haystack = [
                candidate.name,
                candidate.itssCategory,
                candidate.itssLevel,
                ...candidate.candidateSkills,
                ...candidate.missingSkills,
            ].join(' ').toLowerCase();
            const matchSkills = skills.length === 0 || skills.every(skill => haystack.includes(skill));
            return matchLevel && matchSkills;
        });
    }, [candidates, levelFilter, skillQuery]);

    const selectedCandidate =
        filteredCandidates.find(candidate => candidate.applicationId === selectedCandidateId) ||
        filteredCandidates[0];
    const selectedReport = selectedCandidate ? aiReports[selectedCandidate.applicationId] : undefined;
    const insightScore = selectedReport ? normalizeScore(selectedReport.match_score) : selectedCandidate?.matchScore || 0;

    useEffect(() => {
        if (!selectedCandidate?.applicationId) return;
        if (aiReports[selectedCandidate.applicationId]) return;

        let mounted = true;
        const loadAiReport = async () => {
            setLoadingInsight(true);
            try {
                const res = await axiosClient.get(`/api/hr/applications/${selectedCandidate.applicationId}/ai-report`);
                if (!mounted) return;
                setAiReports(prev => ({
                    ...prev,
                    [selectedCandidate.applicationId]: {
                        ...res.data,
                        application_id: String(res.data.application_id),
                        match_score: normalizeScore(res.data.match_score),
                        radar_data: normalizeRadarData(res.data.radar_data),
                        gaps: safeArray(res.data.gaps),
                    },
                }));
            } catch {
                if (!mounted) return;
                setAiReports(prev => ({
                    ...prev,
                    [selectedCandidate.applicationId]: {
                        application_id: selectedCandidate.applicationId,
                        match_score: selectedCandidate.matchScore,
                        ai_itss_predicted: selectedCandidate.itssCategory,
                        ai_itss_level: selectedCandidate.itssLevel,
                        ai_summary: '',
                        radar_data: [],
                        gaps: [],
                    },
                }));
            } finally {
                if (mounted) setLoadingInsight(false);
            }
        };

        loadAiReport();
        return () => {
            mounted = false;
        };
    }, [selectedCandidate?.applicationId, aiReports, selectedCandidate]);

    const analyzedCount = candidates.filter(candidate => candidate.matchScore > 0).length;
    const avgScore = analyzedCount > 0
        ? Math.round(candidates.reduce((total, candidate) => total + candidate.matchScore, 0) / analyzedCount)
        : 0;
    const highPriorityCount = candidates.filter(candidate => candidate.matchScore >= 80).length;

    const toggleShortlist = async (applicationId: string) => {
        const wasShortlisted = shortlistedIds.has(applicationId);
        setShortlistedIds(prev => {
            const next = new Set(prev);
            if (next.has(applicationId)) next.delete(applicationId);
            else next.add(applicationId);
            return next;
        });

        if (wasShortlisted) return;

        setUpdatingId(applicationId);
        setCandidates(prev => prev.map(candidate =>
            candidate.applicationId === applicationId
                ? { ...candidate, status: 'reviewing' }
                : candidate,
        ));

        try {
            await axiosClient.put(`/api/hr/applications/${applicationId}/status`, { status: 'reviewing' });
        } catch {
            setCandidates(prev => prev.map(candidate =>
                candidate.applicationId === applicationId
                    ? { ...candidate, status: 'pending' }
                    : candidate,
            ));
            setShortlistedIds(prev => {
                const next = new Set(prev);
                next.delete(applicationId);
                return next;
            });
        } finally {
            setUpdatingId('');
        }
    };

    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            pageTitle="AI Matching"
            pageSubtitle="Tìm ứng viên phù hợp nhất cho từng vị trí tuyển dụng bằng AI"
            headerActions={
                <button className={styles.btnOutline} onClick={() => loadMatching()} disabled={matching || !selectedJobId}>
                    <span className="material-symbols-outlined">refresh</span>
                    Làm mới kết quả
                </button>
            }
        >
            <section className={styles.controlBar}>
                <div className={styles.fieldGroup}>
                    <label>Chọn công việc</label>
                    <select value={selectedJobId} onChange={event => setSelectedJobId(event.target.value)} disabled={loadingJobs}>
                        {jobs.length === 0 ? (
                            <option value="">Chưa có công việc</option>
                        ) : jobs.map(job => (
                            <option key={job.id} value={job.id}>
                                {job.title} - {job.companyName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.fieldGroupSmall}>
                    <label>ITSS Level</label>
                    <select value={levelFilter} onChange={event => setLevelFilter(event.target.value)}>
                        {ITSS_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                    </select>
                </div>

                <div className={styles.fieldGroup}>
                    <label>Lọc theo kỹ năng</label>
                    <input
                        value={skillQuery}
                        onChange={event => setSkillQuery(event.target.value)}
                        placeholder="Nhập kỹ năng để lọc..."
                    />
                </div>

                <button className={styles.btnPrimary} onClick={triggerAiMatching} disabled={matching || !selectedJobId}>
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {matching ? 'Đang kiểm tra...' : 'Chấm bổ sung AI'}
                </button>
            </section>

            <section className={styles.jobSummary}>
                <div className={styles.jobCard}>
                    <div>
                        <span className={styles.kicker}>Job</span>
                        <h2>{selectedJob?.title || 'Chọn một công việc để bắt đầu'}</h2>
                        <p>
                            {selectedJob
                                ? `${selectedJob.companyName} · ${selectedJob.itssCategory} · ${selectedJob.itssLevel}`
                                : 'AI sẽ phân tích ứng viên theo yêu cầu tuyển dụng và ITSS.'}
                        </p>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <span className={styles.statValue}>{candidates.length}</span>
                    <span className={styles.statLabel}>Ứng viên đã ứng tuyển</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{analyzedCount}</span>
                    <span className={styles.statLabel}>Đã phân tích AI</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{avgScore}%</span>
                    <span className={styles.statLabel}>Match trung bình</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{highPriorityCount}</span>
                    <span className={styles.statLabel}>Ưu tiên liên hệ</span>
                </div>
            </section>

            <section className={styles.workspace}>
                <div className={styles.resultsCard}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3>Bảng xếp hạng ứng viên</h3>
                            <p>
                                {filteredCandidates.length} ứng viên phù hợp
                                {lastRunAt ? ` · Cập nhật ${lastRunAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Ứng viên</th>
                                    <th>Match Score</th>
                                    <th>ITSS</th>
                                    <th>Kỹ năng CV</th>
                                    <th>Gap AI</th>
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCandidates.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className={styles.emptyCell}>
                                            <span className="material-symbols-outlined">search_off</span>
                                            Chưa có ứng viên phù hợp với bộ lọc hiện tại.
                                        </td>
                                    </tr>
                                ) : filteredCandidates.map(candidate => {
                                    const active = selectedCandidate?.applicationId === candidate.applicationId;
                                    const statusMeta = STATUS_META[candidate.status] || STATUS_META.pending;
                                    return (
                                        <tr
                                            key={candidate.applicationId}
                                            className={active ? styles.activeRow : ''}
                                            onClick={() => setSelectedCandidateId(candidate.applicationId)}
                                        >
                                            <td>
                                                <div className={styles.candidateCell}>
                                                    {candidate.avatarUrl ? (
                                                        <img src={candidate.avatarUrl} alt={candidate.name} className={styles.avatarImg} />
                                                    ) : (
                                                        <div className={styles.avatar} style={{ background: candidate.avatarColor }}>
                                                            {candidate.initials}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <strong>{candidate.name}</strong>
                                                        <span>{candidate.role}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.scoreCell}>
                                                    <strong style={{ color: scoreColor(candidate.matchScore) }}>{candidate.matchScore}%</strong>
                                                    <div className={styles.progressTrack}>
                                                        <div
                                                            className={styles.progressFill}
                                                            style={{ width: `${candidate.matchScore}%`, background: scoreColor(candidate.matchScore) }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.itssBadge}>{candidate.itssCategory}</span>
                                                <span className={styles.levelBadge}>{candidate.itssLevel}</span>
                                            </td>
                                            <td>
                                                <div className={styles.tagList}>
                                                    {candidate.candidateSkills.length > 0 ? (
                                                        candidate.candidateSkills.slice(0, 3).map(skill => (
                                                            <span className={styles.goodTag} key={skill}>{skill}</span>
                                                        ))
                                                    ) : (
                                                        <span className={styles.mutedTag}>AI chưa trích xuất</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.tagList}>
                                                    {candidate.missingSkills.length > 0 ? (
                                                        candidate.missingSkills.slice(0, 3).map(skill => (
                                                            <span className={styles.gapTag} key={skill}>{skill}</span>
                                                        ))
                                                    ) : (
                                                        <span className={styles.mutedTag}>Không có dữ liệu riêng</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles[statusMeta.cls]}`}>{statusMeta.label}</span>
                                            </td>
                                            <td>
                                                <div className={styles.actions}>
                                                    <button onClick={(event) => { event.stopPropagation(); navigate(`/hr/candidates/${candidate.applicationId}`); }}>
                                                        Chi tiết
                                                    </button>
                                                    <button
                                                        disabled={updatingId === candidate.applicationId}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            toggleShortlist(candidate.applicationId);
                                                        }}
                                                    >
                                                        {shortlistedIds.has(candidate.applicationId) ? 'Đã shortlist' : 'Shortlist'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className={styles.insightPanel}>
                    {selectedCandidate ? (
                        <>
                            <div className={styles.insightHeader}>
                                <div>
                                    <span className={styles.aiTag}>AI Generated</span>
                                    <h3>AI Insight</h3>
                                    <p>{selectedCandidate.name}</p>
                                </div>
                                <div
                                    className={styles.scoreRing}
                                    style={{ background: `conic-gradient(${scoreColor(insightScore)} ${insightScore * 3.6}deg, #e2e8f0 0deg)` }}
                                >
                                    <span>{insightScore}%</span>
                                </div>
                            </div>

                            {loadingInsight && !selectedReport ? (
                                <p className={styles.insightSummary}>Đang tải báo cáo AI theo cùng dữ liệu của trang chi tiết...</p>
                            ) : (
                                <p className={styles.insightSummary}>
                                    {selectedReport?.ai_summary ||
                                        selectedCandidate.aiSummary ||
                                        (selectedCandidate.matchScore > 0
                                            ? `Ứng viên đạt mức tương quan ${selectedCandidate.matchScore}% với vị trí ${selectedJob?.title || 'đang chọn'}.`
                                            : 'Hồ sơ này chưa có kết quả phân tích AI. Hãy dùng nút chấm bổ sung để đưa hồ sơ vào hàng đợi xử lý.')}
                                </p>
                            )}

                            <div className={styles.insightBlock}>
                                <h4>ITSS dự đoán</h4>
                                {selectedReport || selectedCandidate.matchScore > 0 ? (
                                    <div className={styles.itssInsight}>
                                        <span className={styles.itssBadge}>{selectedReport?.ai_itss_predicted || selectedCandidate.itssCategory}</span>
                                        <span className={styles.levelBadge}>{selectedReport?.ai_itss_level || selectedCandidate.itssLevel}</span>
                                    </div>
                                ) : (
                                    <p className={styles.emptyText}>Chưa có dự đoán ITSS từ AI.</p>
                                )}
                            </div>

                            <div className={styles.insightBlock}>
                                <h4>Phân tích lỗ hổng năng lực</h4>
                                {selectedReport?.gaps && selectedReport.gaps.length > 0 ? (
                                    <div className={styles.gapList}>
                                        {selectedReport.gaps.slice(0, 3).map((gap, index) => (
                                            <div className={styles.gapItem} key={`${gap.skill}-${index}`}>
                                                <div>
                                                    <strong>{gap.skill}</strong>
                                                    {gap.note && <p>{gap.note}</p>}
                                                </div>
                                                {gap.required !== undefined && gap.actual !== undefined && (
                                                    <span>{gap.actual}/{gap.required}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : selectedCandidate.missingSkills.length > 0 ? (
                                    <div className={styles.tagList}>
                                        {selectedCandidate.missingSkills.slice(0, 3).map(skill => (
                                            <span className={styles.gapTag} key={skill}>{skill}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={styles.emptyText}>Báo cáo AI chưa ghi nhận gap kỹ năng cụ thể.</p>
                                )}
                            </div>

                            <div className={styles.radarBox}>
                                <h4>So sánh năng lực</h4>
                                <div className={styles.radarRows}>
                                    {(selectedReport?.radar_data || selectedCandidate.radarData || []).length > 0 ? (
                                        (selectedReport?.radar_data || selectedCandidate.radarData || []).map(item => (
                                            <div className={styles.radarRow} key={item.label}>
                                                <span>{item.label}</span>
                                                <div><i style={{ width: `${item.candidate}%` }} /></div>
                                                <strong>{Math.round(item.candidate)}%</strong>
                                            </div>
                                        ))
                                    ) : (
                                        <p className={styles.emptyText}>Chưa có radar data từ AI.</p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.recommendBox}>
                                <span className="material-symbols-outlined">tips_and_updates</span>
                                <p>
                                    {selectedCandidate.matchScore >= 80
                                        ? 'Nên đưa vào danh sách phỏng vấn vòng đầu.'
                                        : selectedCandidate.matchScore >= 60
                                            ? 'Nên review CV thủ công trước khi liên hệ.'
                                            : 'Chưa nên ưu tiên liên hệ nếu còn ứng viên điểm cao hơn.'}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyInsight}>
                            <span className="material-symbols-outlined">auto_awesome</span>
                            <p>Chọn một ứng viên trong bảng để xem nhận xét AI.</p>
                        </div>
                    )}
                </aside>
            </section>
        </HRLayout>
    );
};

export default HRAIMatching;
