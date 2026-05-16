import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message, Button, DatePicker } from 'antd';
import dayjs from 'dayjs';
import styles from './HRJobs.module.css';
import HRLayout from '../../layouts/hr/HRLayout';
import type { NavSection } from '../../layouts/hr/HRLayout';
import axiosClient from '../../services/axiosClient';

/* ─── Types ─────────────────────────────────────────────────── */
type JobStatus = 'active' | 'pending' | 'draft' | 'closed';

interface JobCard {
    id: string;
    company_id: string;
    title: string;
    company: string;
    companyInitial: string;
    companyColor: string;
    logo_url?: string;
    itssCategory: string;
    itssLevel: string;
    location: string;
    salaryRange: string;
    deadline: string;
    description_text: string;
    requirements_text: string;
    benefits_text: string;
    visibility: string;
    totalApplicants: number;
    aiFiltered: number;
    interviews: number;
    avgMatchScore: number;
    daysLeft: number;
    status: JobStatus;
}

interface CompanyOption {
    id: string;
    name: string;
    logo_url?: string;
}

/* ─── Nav — "Quản lý việc làm" là trang active ──────────────── */
const NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [{ icon: 'grid_view', label: 'Dashboard', href: '/hr' }],
    },
    {
        title: 'TUYỂN DỤNG',
        items: [
            { icon: 'work_outline',  label: 'Quản lý việc làm', href: '/hr/jobs',       isActive: true },
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

/* ─── Helpers ────────────────────────────────────────────────── */
const STATUS_TABS = [
    { key: 'all',     label: 'Tất cả'  },
    { key: 'active',  label: 'Active'  },
    { key: 'pending', label: 'Pending' },
    { key: 'draft',   label: 'Draft'   },
    { key: 'closed',  label: 'Đã đóng' },
] as const;

type TabKey = typeof STATUS_TABS[number]['key'];

const MATCH_COLOR = (score: number) =>
    score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';

/* ─── Job Card ───────────────────────────────────────────────── */
interface JobCardElProps {
    job: JobCard;
    onEdit: (job: JobCard) => void;
    onToggleStatus: (id: string, currentStatus: JobStatus) => void;
}

const JobCardEl: React.FC<JobCardElProps> = ({ job, onEdit, onToggleStatus }) => {
    const matchColor   = MATCH_COLOR(job.avgMatchScore);
    const isExpiring   = job.daysLeft > 0 && job.daysLeft <= 7;
    const isClosed     = job.status === 'closed';

    return (
        <div className={`${styles.jobCard} ${isClosed ? styles.jobCardClosed : ''}`}>
            {/* Top: logo + match badge */}
            <div className={styles.cardTop}>
                {job.logo_url ? (
                    <img src={job.logo_url} alt={job.company} className={styles.companyLogo} />
                ) : (
                    <div className={styles.companyLogo} style={{ background: job.companyColor }}>
                        {job.companyInitial}
                    </div>
                )}
                <div className={styles.matchBadge} style={{ borderColor: matchColor, color: matchColor }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
                    {job.avgMatchScore}%
                </div>
            </div>

            {/* ITSS tag */}
            <div className={styles.itssBadge}>{job.itssLevel} · {job.itssCategory}</div>

            {/* Title */}
            <h3 className={styles.jobTitle}>{job.title}</h3>

            {/* Meta */}
            <div className={styles.metaRow}>
                <span className={styles.metaItem}>
                    <span className="material-symbols-outlined">location_on</span>
                    {job.location}
                </span>
                <span className={styles.metaDot}>·</span>
                <span className={styles.metaItem}>
                    <span className="material-symbols-outlined">payments</span>
                    {job.salaryRange}
                </span>
            </div>

            <div className={styles.divider} />

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statItem}>
                    <span className={styles.statNum}>{job.totalApplicants}</span>
                    <span className={styles.statLabel}>Ứng tuyển</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <span className={styles.statNum} style={{ color: '#1e4076' }}>{job.aiFiltered}</span>
                    <span className={styles.statLabel}>AI &gt;80%</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <span className={styles.statNum}>{job.interviews}</span>
                    <span className={styles.statLabel}>Phỏng vấn</span>
                </div>
            </div>

            {/* Footer */}
            <div className={styles.cardFooter}>
                {isClosed ? (
                    <span className={styles.closedTag}>Đã đóng</span>
                ) : (
                    <span className={`${styles.expiry} ${isExpiring ? styles.expiryUrgent : ''}`}>
                        <span className="material-symbols-outlined">schedule</span>
                        {isExpiring ? `⚠ ${job.daysLeft} ngày` : `${job.daysLeft} ngày còn lại`}
                    </span>
                )}
                <a href="/hr/candidates" className={styles.viewLink}>Xem ứng viên</a>
            </div>

            {/* Hover quick actions (Đã gỡ nút Danh sách) */}
            <div className={styles.quickActions}>
                {/* Nút Sửa: Vô hiệu hóa hoàn toàn nếu Job đã đóng */}
                <button 
                    className={`${styles.qaBtn} ${styles.qaBtnOutline}`}
                    onClick={() => !isClosed && onEdit(job)}
                    disabled={isClosed}
                    style={{ opacity: isClosed ? 0.4 : 1, cursor: isClosed ? 'not-allowed' : 'pointer' }}
                >
                    <span className="material-symbols-outlined">edit</span>Sửa
                </button>
                
                {/* Nút Đóng/Mở: Tự động chuyển đổi text và action dựa vào trạng thái */}
                <button 
                    className={`${styles.qaBtn} ${isClosed ? styles.qaBtnPrimary : styles.qaBtnDanger}`}
                    onClick={() => onToggleStatus(job.id, job.status)}
                >
                    <span className="material-symbols-outlined">
                        {isClosed ? 'lock_open' : 'lock'}
                    </span>
                    {isClosed ? 'Mở lại' : 'Đóng'}
                </button>
            </div>
        </div>
    );
};

/* ─── Add Card ───────────────────────────────────────────────── */
const AddJobCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className={styles.addCard} onClick={onClick}>
        <div className={styles.addIcon}>
            <span className="material-symbols-outlined">add</span>
        </div>
        <p className={styles.addLabel}>Đăng job mới</p>
    </div>
);

/* ─── Main Page ──────────────────────────────────────────────── */
const HRJobs: React.FC = () => {
    const [jobs, setJobs]             = useState<JobCard[]>([]);
    const [companies, setCompanies]   = useState<CompanyOption[]>([]);
    const [activeTab, setActiveTab]   = useState<TabKey>('all');
    const [search, setSearch]         = useState('');
    const [sortOrder, setSortOrder]   = useState('newest');
    const [loading, setLoading]       = useState(true);

    /* States quản lý Modal Ant Design */
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [submitting, setSubmitting]         = useState(false);
    const [editingJob, setEditingJob]         = useState<JobCard | null>(null);
    const [form]                              = Form.useForm();

    /* Nạp danh sách việc làm và đối tác với O(1) mapping */
    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Lấy danh sách công ty
            const compRes = await axiosClient.get('/api/companies/me');
            const compList: CompanyOption[] = compRes.data || [];
            setCompanies(compList);

            const compMap: Record<string, string> = {};
            const compLogoMap: Record<string, string> = {};
            compList.forEach(c => { 
                compMap[c.id] = c.name; 
                if (c.logo_url) {
                    compLogoMap[c.id] = c.logo_url;
                }
            });

            // 2. Lấy danh sách việc làm
            const jobRes = await axiosClient.get('/api/jobs/me');
            const rawJobs = jobRes.data || [];

            const mapped: JobCard[] = await Promise.all(
                rawJobs.map(async (j: any) => {
                    let totalApplicants = 0;
                    let aiFiltered      = 0;
                    let interviews      = 0;
                    let totalScore      = 0;

                    try {
                        const appsRes = await axiosClient.get(`/api/hr/applications/job/${j.id}`);
                        const apps    = appsRes.data || [];
                        totalApplicants = apps.length;
                        aiFiltered      = apps.filter((a: any) => (parseFloat(a.match_score) || 0) >= 80).length;
                        interviews      = apps.filter((a: any) => a.status === 'interviewing').length;
                        totalScore      = apps.reduce((sum: number, a: any) => sum + (parseFloat(a.match_score) || 0), 0);
                    } catch {}

                    const companyName: string = compMap[j.company_id] || j.company_name || 'Company';
                    const initial = companyName.charAt(0).toUpperCase();

                    let daysLeft = 30;
                    if (j.deadline) {
                        const diff = Math.ceil((new Date(j.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        daysLeft = Math.max(0, diff);
                    }

                    const statusMap: Record<string, JobStatus> = {
                        open:   'active',
                        draft:  'draft',
                        closed: 'closed',
                    };

                    return {
                        id:                String(j.id),
                        company_id:        j.company_id,
                        title:             j.title || 'Chưa có tiêu đề',
                        company:           companyName,
                        companyInitial:    initial,
                        companyColor:      '#1e4076',
                        logo_url:          j.logo_url || compLogoMap[j.company_id] || '',
                        itssCategory:      j.itss_category || 'General',
                        itssLevel:         j.itss_level ? `Level ${j.itss_level}` : 'Level 3',
                        location:          j.location || '',
                        salaryRange:       j.salary_range || '',
                        deadline:          j.deadline || '',
                        description_text:  j.description_text || '',
                        requirements_text: j.requirements_text || '',
                        benefits_text:     j.benefits_text || '',
                        visibility:        j.visibility || 'public',
                        totalApplicants,
                        aiFiltered,
                        interviews,
                        avgMatchScore:     totalApplicants > 0 ? Math.round(totalScore / totalApplicants) : 0,
                        daysLeft,
                        status:            statusMap[j.status] ?? 'pending',
                    } satisfies JobCard;
                })
            );

            setJobs(mapped);
        } catch (err) {
            console.error('Lỗi khi tải danh sách Job:', err);
            message.error('Không thể tải danh sách công việc.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    /* Mở Modal Đăng mới */
    const handleOpenCreate = () => {
        setEditingJob(null);
        form.resetFields();
        form.setFieldsValue({
            visibility: 'public',
            status: 'open',
            itss_level: '3',
            itss_category: 'Business Application Development',
        });
        setIsModalVisible(true);
    };

    /* Mở Modal Sửa (Nạp tự động dữ liệu cũ vào Form Ant Design) */
    const handleOpenEdit = (job: JobCard) => {
        if (job.status === 'closed') {
            message.warning('Không thể sửa tin tuyển dụng đã đóng!');
            return;
        }
        setEditingJob(job);
        form.resetFields();
        form.setFieldsValue({
            company_id:        job.company_id,
            title:             job.title,
            salary_range:      job.salaryRange,
            location:          job.location,
            itss_category:     job.itssCategory,
            itss_level:        String(job.itssLevel).replace(/\D/g, '') || '3',
            requirements_text: job.requirements_text,
            benefits_text:     job.benefits_text,
            description_text:  job.description_text,
            deadline:          job.deadline ? dayjs(job.deadline) : null,
            status:            job.status === 'active' ? 'open' : job.status,
        });
        setIsModalVisible(true);
    };

    /* Xử lý POST (Tạo mới) hoặc PUT (Cập nhật) */
    const handleSaveJob = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = {
                company_id:        values.company_id,
                title:             values.title,
                description_text:  values.description_text,
                location:          values.location,
                salary_range:      values.salary_range,
                deadline:          values.deadline ? values.deadline.format('YYYY-MM-DD') : null,
                requirements_text: values.requirements_text,
                benefits_text:     values.benefits_text,
                visibility:        values.visibility || 'public',
                itss_category:     values.itss_category,
                itss_level:        parseInt(values.itss_level, 10),
                status:            values.status || 'open',
            };

            if (editingJob) {
                await axiosClient.put(`/api/jobs/${editingJob.id}`, payload);
                message.success('Cập nhật tin tuyển dụng thành công!');
            } else {
                await axiosClient.post('/api/jobs/', payload);
                message.success('Đăng bài tuyển dụng mới thành công!');
            }
            
            setIsModalVisible(false);
            form.resetFields();
            loadData();
        } catch (err: any) {
            console.error('Lỗi khi lưu Job:', err);
            message.error(err.response?.data?.detail || 'Có lỗi xảy ra khi lưu thông tin.');
        } finally {
            setSubmitting(false);
        }
    };

    /* Xử lý Đảo trạng thái Đóng / Mở lại Job */
    const handleToggleStatus = async (id: string, currentStatus: JobStatus) => {
        const isClosed = currentStatus === 'closed';
        const newStatus = isClosed ? 'open' : 'closed';
        const confirmMsg = isClosed 
            ? 'Bạn muốn mở lại vị trí này? Ứng viên sẽ có thể tiếp tục nộp hồ sơ.'
            : 'Bạn muốn đóng vị trí này? Ứng viên sẽ không thể nộp thêm hồ sơ và tin sẽ bị khóa sửa.';

        if (!window.confirm(confirmMsg)) return;

        try {
            await axiosClient.put(`/api/jobs/${id}`, { status: newStatus });
            message.success(`Đã ${isClosed ? 'mở lại' : 'đóng'} việc làm thành công!`);
            loadData();
        } catch {
            message.error('Không thể thay đổi trạng thái việc làm này!');
        }
    };

    /* Derived counts cho tabs */
    const tabCounts = {
        all:     jobs.length,
        active:  jobs.filter(j => j.status === 'active').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        draft:   jobs.filter(j => j.status === 'draft').length,
        closed:  jobs.filter(j => j.status === 'closed').length,
    };

    const filtered = jobs
        .filter(j => {
            const matchTab    = activeTab === 'all' || j.status === activeTab;
            const matchSearch = j.title.toLowerCase().includes(search.toLowerCase())
                || j.company.toLowerCase().includes(search.toLowerCase());
            return matchTab && matchSearch;
        })
        .sort((a, b) => {
            if (sortOrder === 'match-high')  return b.avgMatchScore - a.avgMatchScore;
            if (sortOrder === 'applicants')  return b.totalApplicants - a.totalApplicants;
            if (sortOrder === 'expiry')      return a.daysLeft - b.daysLeft;
            return 0;
        });

    const subtitle = `${tabCounts.active} active · ${tabCounts.pending} pending · ${tabCounts.draft} draft · ${tabCounts.closed} đã đóng`;

    return (
        <HRLayout
            pageTitle="Quản lý việc làm"
            pageSubtitle={`${jobs.length} vị trí · ${subtitle}`}
            navSections={NAV_SECTIONS}
            headerActions={
                <button className={styles.btnPrimary} onClick={handleOpenCreate}>
                    <span className="material-symbols-outlined">add</span>
                    Đăng job mới
                </button>
            }
        >
            <div className={styles.filterRow}>
                <div className={styles.tabs}>
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            <span className={`${styles.tabCount} ${activeTab === tab.key ? styles.tabCountActive : ''}`}>
                                {tabCounts[tab.key]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className={styles.filterRight}>
                    <div className={styles.searchBox}>
                        <span className="material-symbols-outlined">search</span>
                        <input
                            className={styles.searchInput}
                            placeholder="Tìm vị trí..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className={styles.sortBox}>
                        <span className="material-symbols-outlined">swap_vert</span>
                        <select className={styles.sortSelect} value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                            <option value="newest">Sắp xếp</option>
                            <option value="match-high">Match cao nhất</option>
                            <option value="applicants">Nhiều ứng viên</option>
                            <option value="expiry">Sắp hết hạn</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingState}>
                    <span className="material-symbols-outlined">hourglass_empty</span>
                    Đang tải dữ liệu...
                </div>
            ) : (
                <div className={styles.jobGrid}>
                    {filtered.map(job => (
                        <JobCardEl 
                            key={job.id} 
                            job={job} 
                            onEdit={handleOpenEdit}
                            onToggleStatus={handleToggleStatus}
                        />
                    ))}
                    <AddJobCard onClick={handleOpenCreate} />
                </div>
            )}

            {/* ── Modal Đăng/Sửa Job (Thiết kế chuẩn Ant Design ban đầu) ── */}
            <Modal
                title={editingJob ? "Cập nhật tin tuyển dụng" : "Đăng tin tuyển dụng mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                destroyOnHidden
                width={650}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveJob}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        label="Công ty khách hàng"
                        name="company_id"
                        rules={[{ required: true, message: 'Vui lòng chọn công ty!' }]}
                    >
                        <Select placeholder="Chọn công ty bạn phụ trách tuyển dụng">
                            {companies.map(c => (
                                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Tiêu đề công việc"
                        name="title"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề!' }]}
                    >
                        <Input placeholder="VD: Senior ReactJS Developer (ITSS Level 4)" />
                    </Form.Item>

                    {/* Dùng Flexbox thuần thay cho Grid để đảm bảo an toàn tuyệt đối, không đè trường */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item style={{ flex: 1 }} label="Mức lương" name="salary_range">
                            <Input placeholder="VD: ¥6M – 9M/năm" />
                        </Form.Item>

                        <Form.Item style={{ flex: 1 }} label="Địa điểm làm việc" name="location">
                            <Input placeholder="VD: Hybrid · Tokyo" />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            style={{ flex: 1 }}
                            label="Nhóm ngành ITSS"
                            name="itss_category"
                            rules={[{ required: true, message: 'Vui lòng chọn nhóm ngành!' }]}
                        >
                            <Select placeholder="Chọn nhóm ngành ITSS" optionLabelProp="label" style={{ width: '100%' }}>
                                <Select.Option value="Business Application Development" label="Business Application Development">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>Business Application Development</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Phát triển phần mềm nghiệp vụ</span>
                                    </div>
                                </Select.Option>

                                <Select.Option value="System Development" label="System Development">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>System Development</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Phần mềm hệ thống, hệ điều hành & nhúng</span>
                                    </div>
                                </Select.Option>

                                <Select.Option value="Project Management" label="Project Management">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>Project Management</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Quản lý tiến độ, chất lượng & nguồn lực dự án</span>
                                    </div>
                                </Select.Option>

                                <Select.Option value="IT Strategy" label="IT Strategy">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>IT Strategy</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Hoạch định chiến lược & kiến trúc hệ thống</span>
                                    </div>
                                </Select.Option>

                                <Select.Option value="IT Service Management" label="IT Service Management">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>IT Service Management</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Vận hành, bảo trì & hỗ trợ dịch vụ hệ thống</span>
                                    </div>
                                </Select.Option>

                                <Select.Option value="Network / Infrastructure" label="Network / Infrastructure">
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '14px' }}>Network / Infrastructure</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Hạ tầng mạng, Cloud & bảo mật thông tin</span>
                                    </div>
                                </Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            style={{ flex: 1 }}
                            label="Cấp độ ITSS (Skill Level)"
                            name="itss_level"
                            rules={[{ required: true, message: 'Vui lòng chọn cấp độ!' }]}
                        >
                            <Select placeholder="Chọn cấp độ ITSS">
                                <Select.Option value="1">Level 1 (Entry / Trainee)</Select.Option>
                                <Select.Option value="2">Level 2 (Junior / Cần hướng dẫn)</Select.Option>
                                <Select.Option value="3">Level 3 (Independent / Độc lập)</Select.Option>
                                <Select.Option value="4">Level 4 (Professional / Chuyên nghiệp)</Select.Option>
                                <Select.Option value="5">Level 5 (Lead / Chuyên gia)</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item label="Yêu cầu kỹ năng" name="requirements_text">
                        <Input.TextArea rows={3} placeholder="Mỗi yêu cầu một dòng..." />
                    </Form.Item>

                    <Form.Item label="Quyền lợi ứng viên" name="benefits_text">
                        <Input.TextArea rows={3} placeholder="Chế độ bảo hiểm, lương thưởng..." />
                    </Form.Item>

                    <Form.Item
                        label="Mô tả công việc (JD)"
                        name="description_text"
                        rules={[{ required: true, message: 'Vui lòng nhập chi tiết công việc!' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Nhập đầy đủ chi tiết trách nhiệm công việc..." />
                    </Form.Item>

                    <Form.Item label="Hạn cuối nhận hồ sơ" name="deadline">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>

                    <Form.Item label="Trạng thái ban đầu" name="status">
                        <Select>
                            <Select.Option value="open">Đăng công khai (Open)</Select.Option>
                            <Select.Option value="draft">Lưu nháp (Draft)</Select.Option>
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                        <Button onClick={() => setIsModalVisible(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#1e4076' }}>
                            {editingJob ? 'Lưu thay đổi' : 'Tạo công việc'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </HRLayout>
    );
};

export default HRJobs;