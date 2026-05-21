import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './HRCandidateDetail.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Nav: "Ứng viên" là active ─────────────────────────────── */
const NAV_SECTIONS: NavSection[] = [
    { title: 'TỔNG QUAN', items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr' }] },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs' },
            { icon: 'person_search', label: 'Ứng viên', href: '/hr/candidates', isActive: true },
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
// ĐÃ SỬA: Bổ sung thêm 'processed' và 'withdrawn' vào type
type AppStatus = 'pending' | 'processed' | 'reviewing' | 'interviewing' | 'rejected' | 'hired' | 'accepted' | 'withdrawn';

interface GapItem {
    skill: string;
    required: number;   // 0-5
    actual: number;     // 0-5
    note: string;
}

interface RadarPoint {
    label: string;
    candidate: number;  // 0-100
    required: number;   // 0-100
}

interface AIQuestion {
    category: string;
    question: string;
    intent: string;
}

interface CandidateDetail {
    application_id: string;
    applicant_name: string;
    applicant_email: string;
    birth_year: number;
    location: string;
    avatar_color: string;
    initials: string;
    job_title: string;
    partner_name: string;
    match_score: number;
    itss_category: string;
    itss_level: string;
    status: AppStatus;
    applied_at: string;
    has_linkedin: boolean;
    portfolio_url?: string;
    cv_url?: string;
    ai_itss_predicted: string;
    ai_itss_level: string;
    ai_summary: string;
    radar_data: RadarPoint[];
    gaps: GapItem[];
    ai_questions: AIQuestion[];
}

// ĐÃ SỬA: Mapping đầy đủ các trạng thái để giao diện tra cứu an toàn
const STATUS_META: Record<AppStatus, { label: string; cls: string }> = {
    pending:      { label: 'Mới nộp',        cls: 'sPending' },
    processed:    { label: 'Đã phân tích AI', cls: 'sReviewing' },
    reviewing:    { label: 'Đang đánh giá',  cls: 'sReviewing' },
    interviewing: { label: 'Hẹn phỏng vấn',  cls: 'sInterviewing' },
    rejected:     { label: 'Từ chối',        cls: 'sRejected' },
    hired:        { label: 'Đã tuyển',       cls: 'sHired' },
    accepted:     { label: 'Đã chấp nhận',   cls: 'sHired' },
    withdrawn:    { label: 'Đã rút hồ sơ',   cls: 'sRejected' },
};

const pct = (s: number) => Math.round(s);
const matchColor = (s: number) => s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626';
const fmtDateTime = (iso: string) => {
    try {
        const d = new Date(iso);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} · ${d.toLocaleDateString('vi-VN')}`;
    } catch { return iso; }
};

/* ─── Radar Chart (pure SVG) ─────────────────────────────────── */
const RadarChart: React.FC<{ data: RadarPoint[] }> = ({ data }) => {
    const cx = 180, cy = 180, r = 100;
    const n = data.length;
    const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pt = (val: number, i: number) => ({
        x: cx + r * (val / 100) * Math.cos(angle(i)),
        y: cy + r * (val / 100) * Math.sin(angle(i)),
    });
    const polyPts = (vals: number[]) => vals.map((v, i) => `${pt(v, i).x},${pt(v, i).y}`).join(' ');

    return (
        <svg viewBox="0 0 360 350" style={{ width: '100%', maxWidth: 350 }}>
            {[20, 40, 60, 80, 100].map(ring => (
                <polygon key={ring}
                    points={Array.from({ length: n }, (_, i) => {
                        const p = pt(ring, i); return `${p.x},${p.y}`;
                    }).join(' ')}
                    fill="none" stroke="#e2e8f0" strokeWidth="1"
                />
            ))}
            {data.map((_, i) => {
                const p = pt(100, i);
                return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />;
            })}
            <polygon
                points={polyPts(data.map(d => d.required))}
                fill="rgba(30,64,118,0.08)" stroke="#1e4076" strokeWidth="1.5" strokeDasharray="4 3"
            />
            <polygon
                points={polyPts(data.map(d => d.candidate))}
                fill="rgba(22,163,74,0.12)" stroke="#16a34a" strokeWidth="2"
            />
            {data.map((d, i) => {
                const cp = pt(d.candidate, i);
                return <circle key={i} cx={cp.x} cy={cp.y} r={4} fill="#16a34a" stroke="white" strokeWidth="1.5" />;
            })}
            {data.map((d, i) => {
                const p = pt(118, i);
                const dx = Math.cos(angle(i));
                const dy = Math.sin(angle(i));
                return (
                    <text key={i}
                        x={p.x + dx * 6} y={p.y + dy * 6}
                        textAnchor={Math.abs(dx) < 0.1 ? 'middle' : dx > 0 ? 'start' : 'end'}
                        dominantBaseline="middle"
                        fontSize="9.5" fontFamily="Manrope,sans-serif" fontWeight="700" fill="#64748b"
                    >
                        {d.label}
                    </text>
                );
            })}
        </svg>
    );
};

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
const HRCandidateDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>(); 
    const navigate = useNavigate();
    const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [cvExpanded, setCvExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [actionLoading, setActionLoading] = useState<'invite' | 'reject' | null>(null);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const res = await axiosClient.get(`/api/hr/applications/${id}/ai-report`); 
                setCandidate(res.data);
            } catch {
                setCandidate(null);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const handleInvite = async () => {
        if (!candidate) return;
        setActionLoading('invite');
        try {
            await axiosClient.put(`/api/hr/applications/${candidate.application_id}/status`, { status: 'interviewing' });
            setCandidate({ ...candidate, status: 'interviewing' });
        } catch {
            alert('Không thể mời phỏng vấn. Vui lòng thử lại.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!candidate || !window.confirm(`Từ chối ứng viên ${candidate.applicant_name}?`)) return;
        setActionLoading('reject');
        try {
            await axiosClient.put(`/api/hr/applications/${candidate.application_id}/status`, { status: 'rejected' });
            navigate('/hr/candidates');
        } catch {
            alert('Không thể từ chối. Vui lòng thử lại.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleShareLink = () => {
        const link = `${window.location.origin}/report/${candidate?.application_id}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (loading) {
        return (
            <HRLayout navSections={NAV_SECTIONS} pageTitle="Chi tiết ứng viên">
                <div className={styles.loadingState}>
                    <span className="material-symbols-outlined">hourglass_top</span>
                    <p>Đang tải báo cáo AI…</p>
                </div>
            </HRLayout>
        );
    }

    if (!candidate) {
        return (
            <HRLayout navSections={NAV_SECTIONS} pageTitle="Không tìm thấy ứng viên">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', gap: '16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1' }}>search_off</span>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: '15px', fontWeight: 600 }}>Không thể tải báo cáo AI cho ứng viên này.</p>
                    <button onClick={() => navigate('/hr/candidates')} style={{ background: '#1e4076', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Manrope', sans-serif", fontWeight: 700 }}>
                        Quay lại danh sách
                    </button>
                </div>
            </HRLayout>
        );
    }

    // ĐÃ SỬA: Lớp bảo vệ Fallback tuyệt đối. Nếu biến candidate.status bị lạ, gán ngay giá trị an toàn
    const sm = STATUS_META[candidate.status] || { label: candidate.status || 'Đang xử lý', cls: 'sPending' };
    const mc = matchColor(candidate.match_score);
    const score = pct(candidate.match_score);

    return (
        <HRLayout
            navSections={NAV_SECTIONS}
            pageTitle={candidate.applicant_name}
            pageSubtitle={`${candidate.job_title} · ${candidate.partner_name}`}
            headerActions={
                <>
                    <button className={styles.btnShare} onClick={handleShareLink}>
                        <span className="material-symbols-outlined">{copied ? 'check' : 'share'}</span>
                        {copied ? 'Đã sao chép!' : 'Chia sẻ báo cáo'}
                    </button>
                    <button className={styles.btnViewCV} onClick={() => setCvExpanded(true)}>
                        <span className="material-symbols-outlined">open_in_full</span>
                        Xem CV gốc
                    </button>
                </>
            }
        >
            <div className={styles.breadcrumb}>
                <button className={styles.breadcrumbBack} onClick={() => navigate('/hr/candidates')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Ứng viên
                </button>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c4c6d1' }}>chevron_right</span>
                <span className={styles.breadcrumbCurrent}>{candidate.applicant_name}</span>
            </div>

            <div className={styles.mainGrid}>
                <div className={styles.leftCol}>
                    <div className={styles.profileCard}>
                        <div className={styles.avatarLg} style={{ background: candidate.avatar_color }}>
                            {candidate.initials}
                        </div>
                        <h2 className={styles.candidateName}>{candidate.applicant_name}</h2>
                        <p className={styles.birthYear}>{candidate.birth_year}</p>
                        {/* Gọi an toàn sm.cls nhờ cơ chế Fallback */}
                        <span className={`${styles.statusBadge} ${styles[sm.cls]}`}>{sm.label}</span>

                        <div className={styles.divider} />

                        <p className={styles.sectionLabel}>ỨNG TUYỂN VỊ TRÍ</p>
                        <p className={styles.jobTitle}>{candidate.job_title}</p>
                        <p className={styles.partnerName}>
                            {candidate.partner_name}
                            <span className={styles.dot2}>·</span>
                            {candidate.location.split('·')[1]?.trim() || 'Vietnam'}
                        </p>
                        <p className={styles.appliedAt}>
                            <span className="material-symbols-outlined">schedule</span>
                            Nộp lúc: {fmtDateTime(candidate.applied_at)}
                        </p>

                        {candidate.has_linkedin && (
                            <div className={styles.profileLinks}>
                                <span className={styles.linkedinTag}>in</span>
                                <span className={styles.linkText}>LinkedIn</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.pdfPanel}>
                        <div className={styles.pdfHeader}>
                            <span className="material-symbols-outlined">description</span>
                            <span className={styles.pdfTitle}>CV Gốc</span>
                            <button className={styles.pdfExpandBtn} onClick={() => setCvExpanded(true)}>
                                <span className="material-symbols-outlined">open_in_full</span>
                            </button>
                        </div>
                        <div className={styles.pdfBody}>
                            {candidate.cv_url ? (
                                <iframe
                                    src={`${candidate.cv_url}#toolbar=0`}
                                    title="CV PDF"
                                    className={styles.pdfFrame}
                                />
                            ) : (
                                <div className={styles.pdfPlaceholder}>
                                    <span className="material-symbols-outlined">picture_as_pdf</span>
                                    <p>CV PDF sẽ hiển thị tại đây</p>
                                    <p className={styles.pdfSub}>Sau khi backend trả về cv_url</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.rightCol}>
                    <div className={styles.row2}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className="material-symbols-outlined">query_stats</span>
                                <span>Điểm tương quan & ITSS</span>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.scoreRing}>
                                    <svg viewBox="0 0 120 120" className={styles.ringsvg}>
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="#e8ecf0" strokeWidth="8" />
                                        <circle cx="60" cy="60" r="50" fill="none"
                                            stroke={mc} strokeWidth="8"
                                            strokeDasharray={`${2 * Math.PI * 50 * score / 100} ${2 * Math.PI * 50 * (1 - score / 100)}`}
                                            strokeLinecap="round"
                                            transform="rotate(-90 60 60)"
                                        />
                                        <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fontFamily="Manrope" fill={mc}>{score}%</text>
                                        <text x="60" y="72" textAnchor="middle" fontSize="9" fontFamily="Manrope" fill="#94a3b8" fontWeight="600">Match Score</text>
                                    </svg>
                                </div>

                                <div className={styles.itssBlock}>
                                    <p className={styles.itssLabel}>AI Predicted ITSS</p>
                                    <div className={styles.itssBadgeLg}>{candidate.ai_itss_predicted}</div>
                                    <div className={styles.itssLevelBadge}>{candidate.ai_itss_level}</div>
                                </div>

                                <div className={styles.summaryBox}>
                                    <p className={styles.summaryLabel}>
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        Tóm tắt AI
                                    </p>
                                    <p className={styles.summaryText}>{candidate.ai_summary}</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className="material-symbols-outlined">radar</span>
                                <span>Biểu đồ Năng lực</span>
                            </div>
                            <div className={`${styles.cardBody} ${styles.radarBody}`}>
                                <RadarChart data={candidate.radar_data} />
                                <div className={styles.radarLegend}>
                                    <div className={styles.legendItem}>
                                        <span className={styles.legendLine} style={{ background: '#16a34a' }} />
                                        <span>Ứng viên</span>
                                    </div>
                                    <div className={styles.legendItem}>
                                        <span className={styles.legendDash} />
                                        <span>Yêu cầu JD</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.row2}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className="material-symbols-outlined">difference</span>
                                <span>Phân tích Lỗ hổng năng lực</span>
                                <span className={styles.gapCount}>{candidate.gaps?.length || 0} kỹ năng cần chú ý</span>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.gapList}>
                                    {candidate.gaps?.map((g, i) => (
                                        <div key={i} className={styles.gapItem}>
                                            <div className={styles.gapTop}>
                                                <span className={styles.gapSkill}>{g.skill}</span>
                                                <div className={styles.gapLevels}>
                                                    {[1,2,3,4,5].map(lv => (
                                                        <span key={lv} className={`${styles.gapDot} ${lv <= g.actual ? styles.gapDotFilled : ''} ${lv > g.actual && lv <= g.required ? styles.gapDotMissing : ''}`} />
                                                    ))}
                                                    <span className={styles.gapDelta}>−{g.required - g.actual}</span>
                                                </div>
                                            </div>
                                            <p className={styles.gapNote}>{g.note}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className="material-symbols-outlined">psychology</span>
                                <span>Câu hỏi Phỏng vấn đề xuất</span>
                                <span className={styles.aiTag}>AI Generated</span>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.questionList}>
                                    {candidate.ai_questions?.map((q, i) => (
                                        <div key={i} className={styles.questionItem}>
                                            <div className={styles.questionTop}>
                                                <span className={styles.qCategory}>{q.category}</span>
                                                <span className={styles.qNum}>Q{i + 1}</span>
                                            </div>
                                            <p className={styles.qText}>{q.question}</p>
                                            <p className={styles.qIntent}>
                                                <span className="material-symbols-outlined">lightbulb</span>
                                                {q.intent}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.actionBar}>
                <button className={styles.btnBack} onClick={() => navigate('/hr/candidates')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Quay về
                </button>
                <div className={styles.actionRight}>
                    <button
                        className={styles.btnReject}
                        onClick={handleReject}
                        disabled={actionLoading === 'reject'}
                    >
                        <span className="material-symbols-outlined">close</span>
                        {actionLoading === 'reject' ? 'Đang xử lý…' : 'Từ chối'}
                    </button>
                    <button
                        className={styles.btnInvite}
                        onClick={handleInvite}
                        disabled={actionLoading === 'invite'}
                    >
                        {actionLoading === 'invite' ? 'Đang xử lý…' : 'Mời phỏng vấn'}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>

            {cvExpanded && (
                <div className={styles.cvModal} onClick={() => setCvExpanded(false)}>
                    <div className={styles.cvModalInner} onClick={e => e.stopPropagation()}>
                        <div className={styles.cvModalHeader}>
                            <span>CV gốc — {candidate.applicant_name}</span>
                            <button className={styles.cvModalClose} onClick={() => setCvExpanded(false)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className={styles.cvModalBody}>
                            {candidate.cv_url ? (
                                <iframe src={candidate.cv_url} title="CV Fullscreen" className={styles.cvModalFrame} />
                            ) : (
                                <div className={styles.pdfPlaceholder} style={{ height: '100%' }}>
                                    <span className="material-symbols-outlined">picture_as_pdf</span>
                                    <p>Chưa có file CV</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </HRLayout>
    );
};

export default HRCandidateDetail;
