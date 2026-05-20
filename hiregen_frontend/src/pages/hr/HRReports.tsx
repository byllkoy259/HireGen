import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';
import styles from './HRReports.module.css';

type AppStatus = 'pending' | 'processed' | 'reviewing' | 'interviewing' | 'hired' | 'rejected';
type TimeFilter = '7d' | '30d' | 'month' | 'all';

interface ReportApplication {
    id: string;
    jobId: string;
    jobTitle: string;
    companyId: string;
    companyName: string;
    status: AppStatus;
    matchScore: number;
    hasAI: boolean;
    appliedAt: string;
}

interface JobReportRow {
    jobId: string;
    jobTitle: string;
    companyId: string;
    companyName: string;
    jobStatus: string;
    total: number;
    analyzed: number;
    avgMatch: number;
    interviewing: number;
    hired: number;
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
            { icon: 'auto_awesome', label: 'AI Matching', href: '/hr/ai-matching' },
            { icon: 'bar_chart', label: 'Báo cáo', href: '/hr/reports', isActive: true },
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

const STATUS_META: Record<AppStatus, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#64748b' },
    processed: { label: 'AI analyzed', color: '#1e4076' },
    reviewing: { label: 'Reviewing', color: '#7c3aed' },
    interviewing: { label: 'Interviewing', color: '#d97706' },
    hired: { label: 'Hired', color: '#16a34a' },
    rejected: { label: 'Rejected', color: '#dc2626' },
};

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
    { value: '7d', label: '7 ngày gần đây' },
    { value: '30d', label: '30 ngày gần đây' },
    { value: 'month', label: 'Tháng này' },
    { value: 'all', label: 'Tất cả thời gian' },
];

const normalizeScore = (score: unknown) => {
    const value = Number(score) || 0;
    if (value > 0 && value <= 1) return Math.round(value * 100);
    return Math.max(0, Math.min(100, Math.round(value)));
};

const isInTimeRange = (iso: string, filter: TimeFilter) => {
    if (filter === 'all') return true;
    const date = new Date(iso || Date.now());
    const now = new Date();

    if (filter === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }

    const days = filter === '7d' ? 7 : 30;
    const start = new Date(now);
    start.setDate(now.getDate() - days);
    return date >= start;
};

const HRReports: React.FC = () => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<ReportApplication[]>([]);
    const [jobRows, setJobRows] = useState<JobReportRow[]>([]);
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [jobs, setJobs] = useState<{ id: string; title: string; companyId: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [jobFilter, setJobFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | AppStatus>('all');

    const loadReports = async () => {
        setLoading(true);
        try {
            const [jobsRes, companiesRes] = await Promise.all([
                axiosClient.get('/api/jobs/me'),
                axiosClient.get('/api/companies/me'),
            ]);

            const companyList = companiesRes.data || [];
            const companyMap: Record<string, string> = {};
            companyList.forEach((company: any) => {
                companyMap[String(company.id)] = company.name || 'Công ty chưa cập nhật';
            });

            const rawJobs = jobsRes.data || [];
            const nextApplications: ReportApplication[] = [];
            const nextRows: JobReportRow[] = [];

            for (const job of rawJobs) {
                const jobId = String(job.id);
                const companyId = String(job.company_id || '');
                const companyName = companyMap[companyId] || job.company_name || 'Công ty chưa cập nhật';
                let apps: any[] = [];

                try {
                    const appsRes = await axiosClient.get(`/api/hr/applications/job/${jobId}`);
                    apps = appsRes.data || [];
                } catch {
                    apps = [];
                }

                const mappedApps = apps.map((app: any) => {
                    const score = normalizeScore(app.match_score);
                    const hasAI = score > 0 || Boolean(app.extracted_data);
                    const status = (app.status || 'pending') as AppStatus;

                    return {
                        id: String(app.id),
                        jobId,
                        jobTitle: job.title || 'Chưa có tiêu đề',
                        companyId,
                        companyName,
                        status,
                        matchScore: score,
                        hasAI,
                        appliedAt: app.applied_at || new Date().toISOString(),
                    } satisfies ReportApplication;
                });

                nextApplications.push(...mappedApps);

                const analyzedApps = mappedApps.filter(app => app.hasAI);
                const avgMatch = analyzedApps.length > 0
                    ? Math.round(analyzedApps.reduce((sum, app) => sum + app.matchScore, 0) / analyzedApps.length)
                    : 0;

                nextRows.push({
                    jobId,
                    jobTitle: job.title || 'Chưa có tiêu đề',
                    companyId,
                    companyName,
                    jobStatus: job.status || 'open',
                    total: mappedApps.length,
                    analyzed: analyzedApps.length,
                    avgMatch,
                    interviewing: mappedApps.filter(app => app.status === 'interviewing').length,
                    hired: mappedApps.filter(app => app.status === 'hired').length,
                });
            }

            setCompanies(companyList.map((company: any) => ({
                id: String(company.id),
                name: company.name || 'Công ty chưa cập nhật',
            })));
            setJobs(rawJobs.map((job: any) => ({
                id: String(job.id),
                title: job.title || 'Chưa có tiêu đề',
                companyId: String(job.company_id || ''),
            })));
            setApplications(nextApplications);
            setJobRows(nextRows);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchTime = isInTimeRange(app.appliedAt, timeFilter);
            const matchCompany = companyFilter === 'all' || app.companyId === companyFilter;
            const matchJob = jobFilter === 'all' || app.jobId === jobFilter;
            const matchStatus = statusFilter === 'all' || app.status === statusFilter;
            return matchTime && matchCompany && matchJob && matchStatus;
        });
    }, [applications, timeFilter, companyFilter, jobFilter, statusFilter]);

    const filteredRows = useMemo(() => {
        const appMap = filteredApps.reduce<Record<string, ReportApplication[]>>((acc, app) => {
            acc[app.jobId] = acc[app.jobId] || [];
            acc[app.jobId].push(app);
            return acc;
        }, {});

        return jobRows
            .filter(row => companyFilter === 'all' || row.companyId === companyFilter)
            .filter(row => jobFilter === 'all' || row.jobId === jobFilter)
            .map(row => {
                const apps = appMap[row.jobId] || [];
                const analyzed = apps.filter(app => app.hasAI);
                return {
                    ...row,
                    total: apps.length,
                    analyzed: analyzed.length,
                    avgMatch: analyzed.length > 0
                        ? Math.round(analyzed.reduce((sum, app) => sum + app.matchScore, 0) / analyzed.length)
                        : 0,
                    interviewing: apps.filter(app => app.status === 'interviewing').length,
                    hired: apps.filter(app => app.status === 'hired').length,
                };
            })
            .filter(row => row.total > 0 || statusFilter === 'all');
    }, [filteredApps, jobRows, companyFilter, jobFilter, statusFilter]);

    const stats = useMemo(() => {
        const analyzed = filteredApps.filter(app => app.hasAI);
        return {
            total: filteredApps.length,
            analyzed: analyzed.length,
            avgMatch: analyzed.length > 0
                ? Math.round(analyzed.reduce((sum, app) => sum + app.matchScore, 0) / analyzed.length)
                : 0,
            hired: filteredApps.filter(app => app.status === 'hired').length,
        };
    }, [filteredApps]);

    const statusRows = useMemo(() => {
        const total = Math.max(filteredApps.length, 1);
        return (Object.keys(STATUS_META) as AppStatus[]).map(status => {
            const count = filteredApps.filter(app => app.status === status).length;
            return {
                status,
                count,
                pct: Math.round((count / total) * 100),
                ...STATUS_META[status],
            };
        });
    }, [filteredApps]);

    const matchQuality = useMemo(() => {
        const analyzed = filteredApps.filter(app => app.hasAI);
        const total = Math.max(analyzed.length, 1);
        const groups = [
            { label: 'Excellent ≥ 80%', count: analyzed.filter(app => app.matchScore >= 80).length, color: '#16a34a' },
            { label: 'Potential 60-79%', count: analyzed.filter(app => app.matchScore >= 60 && app.matchScore < 80).length, color: '#d97706' },
            { label: 'Low < 60%', count: analyzed.filter(app => app.matchScore < 60).length, color: '#dc2626' },
        ];
        return groups.map(group => ({ ...group, pct: Math.round((group.count / total) * 100) }));
    }, [filteredApps]);

    const alerts = useMemo(() => {
        const today = Date.now();
        const pendingOld = filteredApps.filter(app => {
            const age = (today - new Date(app.appliedAt).getTime()) / (1000 * 60 * 60 * 24);
            return app.status === 'pending' && age > 7;
        });

        const items = filteredRows.flatMap(row => {
            const missingAI = row.total - row.analyzed;
            const rowAlerts = [];
            if (missingAI > 0) {
                rowAlerts.push({
                    title: `${row.jobTitle} - ${row.companyName}`,
                    detail: `${missingAI} ứng viên chưa được AI phân tích`,
                    score: missingAI + 20,
                });
            }
            if (row.total > 0 && row.avgMatch > 0 && row.avgMatch < 60) {
                rowAlerts.push({
                    title: `${row.jobTitle} - ${row.companyName}`,
                    detail: `Match trung bình thấp: ${row.avgMatch}%`,
                    score: 15,
                });
            }
            return rowAlerts;
        });

        if (pendingOld.length > 0) {
            items.push({
                title: 'Ứng viên pending quá 7 ngày',
                detail: `${pendingOld.length} hồ sơ cần được xử lý`,
                score: pendingOld.length + 10,
            });
        }

        return items.sort((a, b) => b.score - a.score).slice(0, 3);
    }, [filteredApps, filteredRows]);

    const visibleJobs = companyFilter === 'all'
        ? jobs
        : jobs.filter(job => job.companyId === companyFilter);

    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            pageTitle="Báo cáo tuyển dụng"
            pageSubtitle="Theo dõi hiệu quả tuyển dụng, trạng thái ứng viên và chất lượng matching theo từng vị trí."
            headerActions={
                <div className={styles.headerActions}>
                    <button className={styles.btnOutline} onClick={() => alert('Chức năng xuất báo cáo sẽ được bổ sung sau.')}>
                        <span className="material-symbols-outlined">download</span>
                        Xuất báo cáo
                    </button>
                    <button className={styles.btnOutline} onClick={loadReports} disabled={loading}>
                        <span className="material-symbols-outlined">refresh</span>
                        Làm mới
                    </button>
                </div>
            }
        >
            <section className={styles.filterBar}>
                <div className={styles.fieldGroup}>
                    <label>Khoảng thời gian</label>
                    <select value={timeFilter} onChange={event => setTimeFilter(event.target.value as TimeFilter)}>
                        {TIME_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.fieldGroup}>
                    <label>Công ty</label>
                    <select value={companyFilter} onChange={event => { setCompanyFilter(event.target.value); setJobFilter('all'); }}>
                        <option value="all">Tất cả công ty</option>
                        {companies.map(company => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.fieldGroup}>
                    <label>Công việc</label>
                    <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
                        <option value="all">Tất cả công việc</option>
                        {visibleJobs.map(job => (
                            <option key={job.id} value={job.id}>{job.title}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.fieldGroup}>
                    <label>Trạng thái ứng viên</label>
                    <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | AppStatus)}>
                        <option value="all">Tất cả trạng thái</option>
                        {(Object.keys(STATUS_META) as AppStatus[]).map(status => (
                            <option key={status} value={status}>{STATUS_META[status].label}</option>
                        ))}
                    </select>
                </div>
            </section>

            {loading ? (
                <div className={styles.loadingState}>
                    <span className="material-symbols-outlined">hourglass_top</span>
                    Đang tải dữ liệu báo cáo...
                </div>
            ) : filteredApps.length === 0 ? (
                <div className={styles.emptyState}>
                    <span className="material-symbols-outlined">bar_chart</span>
                    <h3>Chưa có dữ liệu báo cáo</h3>
                    <p>Hãy tạo công việc tuyển dụng và chờ ứng viên nộp CV để hệ thống tạo báo cáo.</p>
                    <button onClick={() => navigate('/hr/jobs')}>Tạo việc làm mới</button>
                </div>
            ) : (
                <>
                    <section className={styles.statGrid}>
                        <div className={styles.statCard}>
                            <span className="material-symbols-outlined">groups</span>
                            <strong>{stats.total}</strong>
                            <p>Tổng ứng viên</p>
                        </div>
                        <div className={styles.statCard}>
                            <span className="material-symbols-outlined">psychology</span>
                            <strong>{stats.analyzed}</strong>
                            <p>Đã phân tích AI</p>
                        </div>
                        <div className={styles.statCard}>
                            <span className="material-symbols-outlined">speed</span>
                            <strong>{stats.avgMatch}%</strong>
                            <p>Match trung bình</p>
                        </div>
                        <div className={styles.statCard}>
                            <span className="material-symbols-outlined">workspace_premium</span>
                            <strong>{stats.hired}</strong>
                            <p>Đã tuyển</p>
                        </div>
                    </section>

                    <section className={styles.chartGrid}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3>Phân bố trạng thái ứng viên</h3>
                                <p>Pipeline tuyển dụng trong phạm vi lọc</p>
                            </div>
                            <div className={styles.statusList}>
                                {statusRows.map(row => (
                                    <div className={styles.metricRow} key={row.status}>
                                        <div className={styles.metricTop}>
                                            <span>{row.label}</span>
                                            <strong>{row.count}</strong>
                                        </div>
                                        <div className={styles.barTrack}>
                                            <i style={{ width: `${row.pct}%`, background: row.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3>Chất lượng matching</h3>
                                <p>Phân nhóm theo match score AI</p>
                            </div>
                            <div className={styles.matchList}>
                                {matchQuality.map(group => (
                                    <div className={styles.matchQuality} key={group.label}>
                                        <div>
                                            <span className={styles.qualityDot} style={{ background: group.color }} />
                                            <strong>{group.label}</strong>
                                        </div>
                                        <p>{group.count} ứng viên</p>
                                        <div className={styles.barTrack}>
                                            <i style={{ width: `${group.pct}%`, background: group.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className={styles.mainGrid}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3>Báo cáo theo vị trí tuyển dụng</h3>
                                <p>Click một dòng để mở AI Matching theo job</p>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Công việc</th>
                                            <th>Công ty</th>
                                            <th>Ứng viên</th>
                                            <th>Đã AI phân tích</th>
                                            <th>Match TB</th>
                                            <th>Interviewing</th>
                                            <th>Hired</th>
                                            <th>Trạng thái job</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.map(row => (
                                            <tr key={row.jobId} onClick={() => navigate(`/hr/ai-matching?jobId=${row.jobId}`)}>
                                                <td><strong>{row.jobTitle}</strong></td>
                                                <td>{row.companyName}</td>
                                                <td>{row.total}</td>
                                                <td>{row.analyzed}</td>
                                                <td><span className={styles.scoreText}>{row.avgMatch}%</span></td>
                                                <td>{row.interviewing}</td>
                                                <td>{row.hired}</td>
                                                <td>
                                                    <span className={row.jobStatus === 'open' ? styles.openBadge : styles.closedBadge}>
                                                        {row.jobStatus === 'open' ? 'Open' : 'Closed'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <aside className={styles.alertCard}>
                            <div className={styles.cardHeader}>
                                <h3>Vị trí cần chú ý</h3>
                                <p>Gợi ý ưu tiên xử lý cho HR</p>
                            </div>
                            {alerts.length > 0 ? (
                                <div className={styles.alertList}>
                                    {alerts.map((item, index) => (
                                        <div className={styles.alertItem} key={`${item.title}-${index}`}>
                                            <span>{index + 1}</span>
                                            <div>
                                                <strong>{item.title}</strong>
                                                <p>{item.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.noAlert}>
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <p>Không có vị trí cần chú ý trong phạm vi lọc.</p>
                                </div>
                            )}
                        </aside>
                    </section>
                </>
            )}
        </HRLayout>
    );
};

export default HRReports;
