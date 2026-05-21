import React, { useState, useEffect } from 'react';
import styles from './HRDashboard.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ─────────────────────────────────────────────────── */
interface PipelineRow {
    job: string;
    partner: string;
    matchPct: number;
    matchCount: number;
    interviews: number;
    status: 'screening' | 'pending-ai' | 'interviewing' | 'offer-sent';
}

const STATUS_META = {
    'screening':    { label: 'Đang Sàng lọc',  cls: 'badgeGray' },
    'pending-ai':   { label: 'Chờ khớp AI',    cls: 'badgeAmber' },
    'interviewing': { label: 'Đang phỏng vấn', cls: 'badgeBlue' },
    'offer-sent':   { label: 'Đã gửi Offer',   cls: 'badgeGreen' },
} as const;

/* ─── Nav config: Dashboard là trang active ─────────────────── */
const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr', isActive: true }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs' },
            { icon: 'person_search', label: 'Ứng viên',         href: '/hr/candidates' },
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

/* ─── Sub-components ─────────────────────────────────────────── */
const DonutChart = ({ data, total }: { data: any[]; total: number }) => {
    const r = 70, cx = 90, cy = 90;
    const circ = 2 * Math.PI * r;
    let offset = 0;

    return (
        <svg viewBox="0 0 180 180" className={styles.donutSvg}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f2f4f6" strokeWidth={20} />
            {data.map((s) => {
                const dash = (s.pct / 100) * circ;
                const gap  = circ - dash;
                const el = (
                    <circle
                        key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
                        strokeWidth={20} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 1s ease' }}
                    />
                );
                offset += dash;
                return el;
            })}
            <text x={cx} y={cy - 8}  textAnchor="middle" className={styles.donutNumber}>{total}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" className={styles.donutLabel}>TỔNG CV</text>
        </svg>
    );
};

const ActivityFeed = ({ activities }: { activities: any[] }) => {
    if (!activities || activities.length === 0)
        return <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Chưa có hoạt động nào.</div>;

    return (
        <div className={styles.activityFeed}>
            {activities.map((act, i) => (
                <div key={i} className={styles.activityItem}>
                    <div className={`${styles.activityIcon} ${styles[`icon_${act.type}`]}`}>
                        <span className="material-symbols-outlined">{act.icon}</span>
                    </div>
                    <div className={styles.activityContent}>
                        <p className={styles.activityText}>{act.text}</p>
                        <p className={styles.activityTime}>{act.time}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

const StatCard = ({ icon, label, value, isHighlight = false }: any) => (
    <div className={`${styles.statCard} ${isHighlight ? styles.statCardHighlight : ''}`}>
        <div className={styles.statIconWrapper}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div className={styles.statInfo}>
            <p className={styles.statValue}>{value}</p>
            <p className={styles.statLabel}>{label}</p>
        </div>
    </div>
);

/* ─── HRDashboard ────────────────────────────────────────────── */
const HRDashboard: React.FC = () => {
    const [stats, setStats]           = useState({ jobs: 0, candidates: 0, newCvs: 0, avgScore: 0 });
    const [pipeline, setPipeline]     = useState<PipelineRow[]>([]);
    const [donutData, setDonutData]   = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const compRes = await axiosClient.get('/api/companies/me');
                const compList = compRes.data || [];
                const compMap: Record<string, string> = {};
                compList.forEach((c: any) => { compMap[c.id] = c.name; });

                const jobsRes = await axiosClient.get('/api/jobs/me');
                const jobs = jobsRes.data || [];

                let allApps: any[] = [];
                let pipelineRows: PipelineRow[] = [];
                let statusCounts = { pending: 0, reviewed: 0, hired: 0, rejected: 0 };
                let dynamicActivities: any[] = [];

                for (const job of jobs) {
                    try {
                        const appsRes = await axiosClient.get(`/api/hr/applications/job/${job.id}`);
                        const apps = appsRes.data || [];
                        allApps = [...allApps, ...apps];

                        // ĐÃ SỬA: So sánh trực tiếp với thang điểm 80
                        const aiMatched    = apps.filter((a: any) => (parseFloat(a.final_match_score ?? a.match_score) || 0) >= 80).length;
                        const interviewing = apps.filter((a: any) => a.status === 'interviewing').length;
                        const offerOrHired = apps.filter((a: any) => ['offer-sent', 'hired'].includes(a.status)).length;

                        apps.forEach((a: any) => {
                            const score = parseFloat(a.final_match_score ?? a.match_score) || 0;
                            dynamicActivities.push({
                                type: score >= 80 ? 'ai' : 'apply',
                                text: `${a.applicant_name || 'Một ứng viên'} đã nộp CV vào vị trí ${job.title}`,
                                time: new Date(a.applied_at || Date.now()).toLocaleDateString('vi-VN'),
                                icon: score >= 80 ? 'auto_awesome' : 'description',
                            });
                            if (statusCounts[a.status as keyof typeof statusCounts] !== undefined)
                                statusCounts[a.status as keyof typeof statusCounts]++;
                        });

                        const partnerName = compMap[job.company_id] || job.company_name || 'Đối tác chưa cập nhật';

                        let rowStatus: PipelineRow['status'] = 'screening';

                        if (apps.length > 0) {
                            if (offerOrHired > 0) {
                                rowStatus = 'offer-sent';
                            } else if (interviewing > 0) {
                                rowStatus = 'interviewing';
                            } else if (aiMatched > 0) {
                                rowStatus = 'screening';
                            } else {
                                rowStatus = 'pending-ai';
                            }
                        }

                        pipelineRows.push({
                            job:        job.title,
                            partner:    partnerName,
                            matchPct:   apps.length > 0 ? Math.round((aiMatched / apps.length) * 100) : 0,
                            matchCount: aiMatched,
                            interviews: interviewing,
                            status:     rowStatus,
                        });
                    } catch {
                        console.warn(`Không lấy được hồ sơ cho Job ${job.id}`);
                    }
                }

                const totalApps  = allApps.length;
                const totalScore = allApps.reduce((sum: number, a: any) => sum + (parseFloat(a.final_match_score ?? a.match_score) || 0), 0);
                // ĐÃ SỬA: Gỡ bỏ phép nhân 100 thừa thớt để trả về đúng % thực tế
                const avgScore   = totalApps > 0 ? Math.round(totalScore / totalApps) : 0;

                setStats({
                    jobs:       jobs.length,
                    candidates: totalApps,
                    newCvs:     allApps.filter(a => new Date(a.applied_at).toDateString() === new Date().toDateString()).length,
                    avgScore,
                });
                setPipeline(pipelineRows.slice(0, 5));
                setActivities(dynamicActivities.slice(0, 5));

                if (totalApps > 0) {
                    setDonutData([
                        { pct: Math.round((statusCounts.reviewed / totalApps) * 100) || 0, color: '#1e4076', label: 'Đã đánh giá' },
                        { pct: Math.round((statusCounts.pending  / totalApps) * 100) || 0, color: '#324257', label: 'Chờ khớp AI' },
                        { pct: Math.round((statusCounts.hired    / totalApps) * 100) || 0, color: '#c4c6d1', label: 'Đã tuyển' },
                    ]);
                }
            } catch (error: any) {
                console.error('Lỗi khi tải dữ liệu dashboard:', error.message);
                setStats({ jobs: 0, candidates: 0, newCvs: 0, avgScore: 0 });
                setPipeline([]);
                setDonutData([]);
                setActivities([]);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            headerActions={
                <button className={styles.btnOutline}>Xuất báo cáo</button>
            }
        >
            <div className={styles.statGrid}>
                <StatCard icon="assignment"     label="TỔNG JOB ĐANG MỞ"     value={stats.jobs.toString()} />
                <StatCard icon="person_search"  label="TỔNG SỐ ỨNG VIÊN"     value={stats.candidates.toString()} />
                <StatCard icon="description"    label="CV MỚI TRONG NGÀY"     value={stats.newCvs.toString()} />
                <StatCard icon="psychology_alt" label="AVG MATCH SCORE (AI)"  value={`${stats.avgScore}%`} isHighlight />
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.leftCol}>
                    <div className={styles.card} style={{ height: '100%' }}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Tiến độ tuyển dụng hiện tại</h2>
                            <button className={styles.linkBtn}>Xem tất cả</button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Công việc / Đối tác</th>
                                        <th>AI Match &gt;80%</th>
                                        <th>Phỏng vấn</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pipeline.length > 0 ? pipeline.map((row, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className={styles.jobName}>{row.job}</div>
                                                <div className={styles.jobPartner}>{row.partner}</div>
                                            </td>
                                            <td>
                                                <div className={styles.matchCell}>
                                                    <div className={styles.matchBar}>
                                                        <div className={styles.matchFill} style={{ width: `${row.matchPct}%` }} />
                                                    </div>
                                                    <span className={styles.matchNum}>{row.matchCount}</span>
                                                </div>
                                            </td>
                                            <td className={styles.interviewNum}>{row.interviews}</td>
                                            <td>
                                                <span className={`${styles.badge} ${styles[STATUS_META[row.status]?.cls || 'badgeGray']}`}>
                                                    {STATUS_META[row.status]?.label || 'Đang xử lý'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                                                Chưa có dữ liệu.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className={styles.rightCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Phân bổ Trạng thái CV</h2>
                        </div>
                        <div className={styles.donutContainer}>
                            {donutData.length > 0 ? (
                                <>
                                    <div className={styles.donutWrapper}>
                                        <DonutChart data={donutData} total={stats.candidates} />
                                    </div>
                                    <div className={styles.legendList}>
                                        {donutData.map((s) => (
                                            <div key={s.label} className={styles.legendRow}>
                                                <div className={styles.legendDot} style={{ background: s.color }} />
                                                <span className={styles.legendLabel}>{s.label}</span>
                                                <span className={styles.legendPct}>{s.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', width: '100%' }}>
                                    Chưa có dữ liệu CV
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.card} style={{ flex: 1 }}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Hoạt động gần đây</h2>
                        </div>
                        <div className={styles.activityInner}>
                            <ActivityFeed activities={activities} />
                        </div>
                    </div>
                </div>
            </div>
        </HRLayout>
    );
};

export default HRDashboard;
