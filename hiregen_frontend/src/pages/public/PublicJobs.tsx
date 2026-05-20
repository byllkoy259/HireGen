import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Spin, message, Select } from 'antd';
import { SearchOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Header from '../../components/layouts/Header';
import Footer from '../../components/layouts/Footer';
import axiosClient from '../../services/axiosClient';
import {
    ALL_ITSS_CATEGORIES_LABEL,
    ITSS_CATEGORIES,
    ITSS_LEVEL_FILTERS,
    matchesItssLevelFilter,
} from '../../constants/itss';

import styles from './PublicJobs.module.css';

interface RawJob {
    id: string;
    company_id: string;
    title?: string;
    description_text?: string;
    requirements_text?: string;
    benefits_text?: string;
    location?: string;
    salary_range?: string;
    salary_min?: number;
    salary_max?: number;
    deadline?: string | null;
    itss_category?: string;
    itss_level?: number;
    job_type?: string;
    company_name?: string;
    company_logo_url?: string;
    company_industry?: string;
    created_at?: string;
}

interface Company {
    id: string;
    name: string;
    industry?: string;
    logo_url?: string;
    description?: string;
    website?: string;
}

interface Job {
    id: string;
    companyId: string;
    title: string;
    company: string;
    companyInitials: string;
    logoUrl?: string;
    location: string;
    tags: string[];
    itssCategory: string;
    itssLevel: string;
    salary: string;
    postedAt: string;
    badge?: 'new' | 'hot';
    descriptionText: string;
    requirementsText: string;
    benefitsText: string;
    companyInfo: string;
    companyWebsite?: string;
    deadline?: string;
}


const LOCATIONS = [
    'Tất cả địa điểm',
    'Nhật Bản',
    'Hà Nội',
    'Đà Nẵng',
    'TP.HCM',
    'Remote',
    'Hybrid',
];

const getCompanyInitials = (name?: string) => {
    if (!name) return 'HG';

    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Gần đây';

    const utcDateStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const diff = new Date().getTime() - new Date(utcDateStr).getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Vừa xong';
    if (hours < 24) return `${hours} giờ trước`;

    return `${days} ngày trước`;
};

const getBadge = (dateString?: string): 'new' | undefined => {
    if (!dateString) return undefined;

    const diffDays =
        (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);

    return diffDays <= 3 ? 'new' : undefined;
};

const formatSalary = (min?: number, max?: number, salaryRange?: string) => {
    if (salaryRange && salaryRange.trim() !== '') return salaryRange;
    if (!min && !max) return 'Thỏa thuận';
    if (min && !max) return `Từ $${min}`;
    if (!min && max) return `Đến $${max}`;

    return `$${min} - $${max}`;
};

const formatDeadline = (deadline?: string | null) => {
    if (!deadline) return undefined;

    return new Date(deadline).toLocaleDateString('vi-VN');
};

const formatDescLines = (text?: string): string[] => {
    if (!text || text.trim() === '') {
        return ['Chưa có thông tin cập nhật.'];
    }

    return text
        .split('\n')
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);
};

const getExternalUrl = (url?: string) => {
    const trimmedUrl = url?.trim();
    if (!trimmedUrl) return '';

    return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
};

const PublicJobs: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const detailRef = useRef<HTMLDivElement>(null);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [location, setLocation] = useState(searchParams.get('loc') || LOCATIONS[0]);
    const [activeFilter, setActiveFilter] = useState(searchParams.get('level') || ITSS_LEVEL_FILTERS[0]);
    const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || ALL_ITSS_CATEGORIES_LABEL);

    useEffect(() => {
        const fetchJobs = async () => {
            setLoading(true);

            try {
                const [jobsRes, companiesRes] = await Promise.all([
                    axiosClient.get('/api/jobs/public'),
                    axiosClient.get('/api/companies/public'),
                ]);

                const rawJobs: RawJob[] = jobsRes.data || [];
                const rawCompanies: Company[] = companiesRes.data || [];

                const companyMap: Record<string, Company> = {};
                rawCompanies.forEach(company => {
                    companyMap[company.id] = company;
                });

                const mappedJobs: Job[] = rawJobs.map(job => {
                    const company = companyMap[job.company_id];

                    const companyName =
                        job.company_name ||
                        company?.name ||
                        'Công ty đối tác';

                    const tags: string[] = [];

                    if (job.itss_category) tags.push(job.itss_category);
                    if (job.job_type) tags.push(job.job_type);
                    if (!job.itss_category && !job.job_type) tags.push('ITSS');

                    return {
                        id: String(job.id),
                        companyId: job.company_id,
                        title: job.title || 'Vị trí tuyển dụng',
                        company: companyName,
                        companyInitials: getCompanyInitials(companyName),
                        logoUrl:
                            job.company_logo_url ||
                            company?.logo_url ||
                            '',
                        location: job.location || 'Đang cập nhật',
                        tags,
                        itssCategory: job.itss_category || 'ITSS',
                        itssLevel: job.itss_level
                            ? `ITSS L${job.itss_level}`
                            : 'ITSS L3',
                        salary: formatSalary(
                            job.salary_min,
                            job.salary_max,
                            job.salary_range,
                        ),
                        postedAt: getTimeAgo(job.created_at),
                        badge: getBadge(job.created_at),
                        descriptionText:
                            job.description_text ||
                            'Chưa có mô tả chi tiết cho vị trí này.',
                        requirementsText:
                            job.requirements_text ||
                            'Chưa cập nhật yêu cầu cụ thể.',
                        benefitsText:
                            job.benefits_text ||
                            'Chưa cập nhật quyền lợi.',
                        companyInfo:
                            company?.description ||
                            'Doanh nghiệp đối tác tuyển dụng uy tín tại thị trường Nhật Bản.',
                        companyWebsite: company?.website || '',
                        deadline: formatDeadline(job.deadline),
                    };
                });

                const sortedJobs = mappedJobs.sort((a, b) => {
                    if (a.badge === 'new' && b.badge !== 'new') return -1;
                    if (a.badge !== 'new' && b.badge === 'new') return 1;
                    return 0;
                });

                setJobs(sortedJobs);
                // Do not auto-select a job by default to keep grid view
                // setActiveJob(sortedJobs[0] || null);
            } catch (error) {
                message.error('Không thể tải danh sách việc làm lúc này.');
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const filteredJobs = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return jobs.filter(job => {
            const matchKeyword =
                !keyword ||
                job.title.toLowerCase().includes(keyword) ||
                job.company.toLowerCase().includes(keyword) ||
                job.location.toLowerCase().includes(keyword) ||
                job.tags.some(tag => tag.toLowerCase().includes(keyword)) ||
                job.descriptionText.toLowerCase().includes(keyword);

            const matchLocation =
                location === 'Tất cả địa điểm' ||
                job.location.toLowerCase().includes(location.toLowerCase());

            const matchLevel = matchesItssLevelFilter(job.itssLevel, activeFilter);

            const matchCategory =
                activeCategory === ALL_ITSS_CATEGORIES_LABEL ||
                job.itssCategory === activeCategory ||
                job.tags.includes(activeCategory);

            return matchKeyword && matchLocation && matchLevel && matchCategory;
        });
    }, [jobs, search, location, activeFilter, activeCategory]);

    useEffect(() => {
        setSearch(searchParams.get('q') || '');
        setLocation(searchParams.get('loc') || LOCATIONS[0]);
        setActiveFilter(searchParams.get('level') || ITSS_LEVEL_FILTERS[0]);
        setActiveCategory(searchParams.get('category') || ALL_ITSS_CATEGORIES_LABEL);
    }, [searchParams]);

    useEffect(() => {
        const jobId = searchParams.get('jobId');
        if (!jobId || jobs.length === 0) return;

        const matchedJob = jobs.find(job => job.id === jobId);
        if (matchedJob) {
            setActiveJob(matchedJob);
            setTimeout(() => {
                detailRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }, 80);
        }
    }, [jobs, searchParams]);

    useEffect(() => {
        if (
            activeJob &&
            filteredJobs.length > 0 &&
            !filteredJobs.some(job => job.id === activeJob.id)
        ) {
            setActiveJob(null);
        }

        if (filteredJobs.length === 0) {
            setActiveJob(null);
        }
    }, [filteredJobs, activeJob]);

    const isSplit = activeJob !== null && filteredJobs.length > 0;

    const GridCard = ({ job }: { job: Job }) => (
        <div className={styles.gridCard} onClick={() => handleSelectJob(job)}>
            <div className={styles.gcCardContent}>
                <div>
                    <div className={styles.gcTop}>
                        <div className={styles.gcLogoPlaceholder} style={{ background: job.logoUrl ? 'transparent' : '#f1f5f9', overflow: 'hidden' }}>
                            {job.logoUrl ? (
                                <img src={job.logoUrl} alt={job.company} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                            ) : (
                                <span style={{ color: '#1e4076', fontSize: '15px', fontWeight: 800 }}>{job.companyInitials}</span>
                            )}
                        </div>
                        <div className={styles.gcBadges}>
                            {job.badge === 'new' && <span className={styles.badgeNew}>MỚI</span>}
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

    const handleSelectJob = (job: Job) => {
        setActiveJob(job);
        const params = new URLSearchParams(searchParams);
        params.set('jobId', job.id);
        if (search.trim()) params.set('q', search.trim());
        else params.delete('q');
        if (location && location !== LOCATIONS[0]) params.set('loc', location);
        else params.delete('loc');
        if (activeFilter && activeFilter !== ITSS_LEVEL_FILTERS[0]) params.set('level', activeFilter);
        else params.delete('level');
        if (activeCategory && activeCategory !== ALL_ITSS_CATEGORIES_LABEL) params.set('category', activeCategory);
        else params.delete('category');
        setSearchParams(params, { replace: true });

        if (window.innerWidth <= 900) {
            setTimeout(() => {
                detailRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }, 80);
        }
    };

    const handleSearch = () => {
        setActiveJob(null);
    };

    return (
        <div className={styles.layoutContainer}>
            <Header />

            <section className={styles.heroSection}>
                <div className={styles.heroBg}>
                    <div className={styles.heroBgGrid}></div>
                    <div className={styles.heroBgCircle1}></div>
                    <div className={styles.heroBgCircle2}></div>
                    <div className={styles.heroBgLine1}></div>
                    <div className={styles.heroBgLine2}></div>
                    <div className={styles.heroBgDot1}></div>
                    <div className={styles.heroBgDot2}></div>
                </div>

                <div className={styles.heroContent}>
                    <div className={styles.heroLabel}>
                        <span className={styles.heroBadgeDot}></span>
                        Cơ hội việc làm tại thị trường Nhật Bản
                    </div>

                    <h1 className={styles.heroHeadline}>
                        Khám phá công việc<br />
                        <span className={styles.heroHeadlineAccent}>
                            phù hợp chuẩn ITSS
                        </span>
                    </h1>

                    <p className={styles.heroSubtext}>
                        Khám phá thông tin việc làm chuẩn ITSS tại thị trường Nhật Bản
                    </p>

                    <div className={styles.searchBar}>
                        <div className={styles.searchInputWrapper}>
                            <SearchOutlined className={styles.searchIcon} />
                            <input
                                className={styles.searchInput}
                                placeholder="Vị trí, kỹ năng, công ty..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSearch();
                                    if (e.key === 'Escape') setSearch('');
                                }}
                            />
                            {search && (
                                <button
                                    type="button"
                                    className={styles.searchClear}
                                    onClick={() => setSearch('')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className={styles.searchDivider}></div>

                        <div className={styles.searchInputWrapper}>
                            <EnvironmentOutlined className={styles.searchIcon} />
                            <Select
                                variant="borderless"
                                className={styles.locationSelect}
                                value={location}
                                onChange={value => setLocation(value)}
                                style={{ flex: 1, minWidth: 160 }}
                                popupMatchSelectWidth={false}
                                options={LOCATIONS.map(item => ({ label: item, value: item }))}
                            />
                        </div>

                        <Button
                            type="primary"
                            size="large"
                            className={styles.btnSearch}
                            onClick={handleSearch}
                        >
                            Tìm kiếm
                        </Button>
                    </div>

                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>
                                {loading ? '...' : jobs.length}
                            </span>
                            <span className={styles.heroStatLabel}>Việc làm mở</span>
                        </div>

                        <div className={styles.heroStatDivider}></div>

                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>
                                {loading
                                    ? '...'
                                    : jobs.filter(job => job.badge === 'new').length}
                            </span>
                            <span className={styles.heroStatLabel}>Việc mới</span>
                        </div>

                        <div className={styles.heroStatDivider}></div>

                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>
                                {loading ? '...' : filteredJobs.length}
                            </span>
                            <span className={styles.heroStatLabel}>Phù hợp bộ lọc</span>
                        </div>
                    </div>
                </div>
            </section>

            <main className={styles.contentMain}>
                <div className={styles.container}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <span className={styles.subtitle}>Danh sách công việc</span>
                            <h2 className={styles.title}>Việc làm đang tuyển</h2>
                            <p className={styles.sectionDesc}>
                                Hiển thị {filteredJobs.length} / {jobs.length} vị trí.
                                Bấm vào từng công việc để xem chi tiết.
                            </p>
                        </div>
                    </div>

                    <Spin spinning={loading}>
                        <div className={`${styles.bodyLayout} ${isSplit ? styles.bodyLayoutSplit : ''}`}>
                            <div className={`${styles.leftPanel} ${isSplit ? styles.leftPanelSplit : ''}`}>
                                <div className={styles.filterBar}>
                                    <div className={styles.filterGroup}>
                                        {ITSS_LEVEL_FILTERS.map(filter => (
                                            <button
                                                key={filter}
                                                type="button"
                                                className={`${styles.filterChip} ${
                                                    activeFilter === filter
                                                        ? styles.filterChipActive
                                                        : ''
                                                }`}
                                                onClick={() => setActiveFilter(filter)}
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>

                                    <Select
                                        className={styles.categoryFilter}
                                        value={activeCategory}
                                        onChange={value => setActiveCategory(value)}
                                        options={[
                                            ALL_ITSS_CATEGORIES_LABEL,
                                            ...ITSS_CATEGORIES,
                                        ].map(item => ({ label: item, value: item }))}
                                    />
                                </div>

                                <div className={styles.listMeta}>
                                    <span>
                                        {filteredJobs.length} việc làm phù hợp
                                    </span>
                                    <span>Public Preview</span>
                                </div>

                                {filteredJobs.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <Empty description="Không tìm thấy việc làm phù hợp" />
                                    </div>
                                ) : (
                                    !isSplit ? (
                                        <div className={styles.gridContainer}>
                                            {filteredJobs.map(job => (
                                                <GridCard key={job.id} job={job} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={styles.listContainer}>
                                            {filteredJobs.map(job => {
                                            const selected = activeJob?.id === job.id;

                                            return (
                                                <div
                                                    key={job.id}
                                                    className={`${styles.listItem} ${
                                                        selected
                                                            ? styles.listItemActive
                                                            : ''
                                                    }`}
                                                    onClick={() => handleSelectJob(job)}
                                                >
                                                    {selected && (
                                                        <div
                                                            className={
                                                                styles.listActiveLine
                                                            }
                                                        />
                                                    )}

                                                    <div className={styles.liLogoBox}>
                                                        {job.logoUrl ? (
                                                            <img
                                                                src={job.logoUrl}
                                                                alt={job.company}
                                                            />
                                                        ) : (
                                                            <span>
                                                                {job.companyInitials}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className={styles.liInfo}>
                                                        <div
                                                            className={
                                                                styles.liHeaderRow
                                                            }
                                                        >
                                                            <p
                                                                className={
                                                                    styles.liTitle
                                                                }
                                                            >
                                                                {job.title}
                                                            </p>

                                                            {job.badge === 'new' && (
                                                                <span
                                                                    className={
                                                                        styles.badgeNew
                                                                    }
                                                                >
                                                                    MỚI
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className={styles.liCompany}>
                                                            {job.company}
                                                        </p>

                                                        <div className={styles.liMeta}>
                                                            <span
                                                                className={
                                                                    styles.liLevelPill
                                                                }
                                                            >
                                                                {job.itssLevel}
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.liSalary
                                                                }
                                                            >
                                                                {job.salary}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>

                            {isSplit && activeJob && (
                                <div className={styles.detailPanel} ref={detailRef}>
                                    <div className={styles.detailHeader}>
                                        <button className={styles.backBtn} onClick={() => setActiveJob(null)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                            Quay lại danh sách
                                        </button>
                                        <div className={styles.detailHeaderTop}>
                                            <div className={styles.detailLogoBox}>
                                                {activeJob.logoUrl ? (
                                                    <img
                                                        src={activeJob.logoUrl}
                                                        alt={activeJob.company}
                                                    />
                                                ) : (
                                                    <span>
                                                        {activeJob.companyInitials}
                                                    </span>
                                                )}
                                            </div>

                                            <div className={styles.detailHeading}>
                                                <div className={styles.detailTitleRow}>
                                                    <h2>{activeJob.title}</h2>
                                                    {activeJob.badge === 'new' && (
                                                        <span className={styles.badgeNew}>
                                                            MỚI
                                                        </span>
                                                    )}
                                                </div>

                                                <p>
                                                    {activeJob.company} ·{' '}
                                                    {activeJob.location}
                                                </p>

                                                <div className={styles.detailTags}>
                                                    {activeJob.tags.map(tag => (
                                                        <span key={tag}>{tag}</span>
                                                    ))}
                                                    <span className={styles.tagLevel}>
                                                        {activeJob.itssLevel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.detailSummary}>
                                            <div>
                                                <span>Mức lương</span>
                                                <strong>{activeJob.salary}</strong>
                                            </div>

                                            <div>
                                                <span>Đăng tuyển</span>
                                                <strong>{activeJob.postedAt}</strong>
                                            </div>

                                            <div>
                                                <span>Hạn ứng tuyển</span>
                                                <strong>
                                                    {activeJob.deadline ||
                                                        'Đang cập nhật'}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className={styles.detailContent}>
                                            <section className={styles.sectionBlock}>
                                                <h4>Mô tả công việc</h4>
                                                <ul className={styles.contentList}>
                                                    {formatDescLines(
                                                        activeJob.descriptionText,
                                                    ).map((line, index) => (
                                                        <li key={index}>{line}</li>
                                                    ))}
                                                </ul>
                                            </section>

                                            <section className={styles.sectionBlock}>
                                                <h4>Yêu cầu ứng viên</h4>
                                                <ul className={styles.contentList}>
                                                    {formatDescLines(
                                                        activeJob.requirementsText,
                                                    ).map((line, index) => (
                                                        <li key={index}>{line}</li>
                                                    ))}
                                                </ul>
                                            </section>

                                            <section className={styles.sectionBlock}>
                                                <h4>Quyền lợi & chế độ</h4>
                                                <ul className={styles.contentList}>
                                                    {formatDescLines(
                                                        activeJob.benefitsText,
                                                    ).map((line, index) => (
                                                        <li key={index}>{line}</li>
                                                    ))}
                                                </ul>
                                            </section>

                                            <section className={styles.sectionBlock}>
                                                <h4>Về doanh nghiệp</h4>
                                                <p className={styles.paragraphText}>
                                                    {activeJob.companyInfo}
                                                </p>
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
                                            </section>
                                        </div>

                                        <div className={styles.detailFooter}>
                                            <div className={styles.dfLeft}>
                                                <span className={styles.dfActionNote}>
                                                    Bạn muốn ứng tuyển vị trí này?
                                                </span>
                                                <span className={styles.dfDeadlineNote}>
                                                    Đăng nhập để có thể nộp CV ứng tuyển.
                                                </span>
                                            </div>
                                            <div className={styles.footerActions}>
                                                <Button
                                                    type="default"
                                                    className={styles.btnOutline}
                                                    onClick={() => navigate('/register')}
                                                >
                                                    Đăng ký
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    className={styles.btnApplyPrimary}
                                                    onClick={() => navigate('/login')}
                                                >
                                                    Đăng nhập để ứng tuyển
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Spin>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default PublicJobs;


