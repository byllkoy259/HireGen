import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, Spin, message } from 'antd';
import { SearchOutlined, EnvironmentOutlined } from '@ant-design/icons';
import axiosClient from '../../services/axiosClient';
import Header from '../../components/layouts/Header';
import Footer from '../../components/layouts/Footer';
import { getValidDashboardPath } from '../../utils/auth';

import styles from './LandingPage.module.css';

// Định nghĩa Interface khớp với JobResponse từ Backend (app/schemas/job.py)
interface Job {
    id: string;
    title: string;
    description_text: string;
    location?: string;
    salary_range?: string;
    deadline?: string | null;
    requirements_text?: string;
    benefits_text?: string;
    visibility?: string;
    itss_category?: string;
    itss_level?: number;
    status?: string;
    company_id: string;
    company_name?: string;
    company_logo_url?: string; // Tích hợp ánh xạ logo
    company_industry?: string; // Tích hợp ánh xạ industry
    created_at: string;
}

// Định nghĩa Interface khớp với CompanyResponse từ Backend (app/schemas/company.py)
interface Company {
    id: string;
    name: string;
    website?: string;
    industry?: string;
    logo_url?: string;
    hr_count?: number;
    jobs_count?: number; // Trường tự tính toán bổ sung ở Frontend
}

interface ChartItem {
    name: string;
    height: string;
    color: string;
}

const LOCATIONS = [
    'T\u1ea5t c\u1ea3 \u0111\u1ecba \u0111i\u1ec3m',
    'Nh\u1eadt B\u1ea3n',
    'H\u00e0 N\u1ed9i',
    '\u0110\u00e0 N\u1eb5ng',
    'TP.HCM',
    'Remote',
    'Hybrid',
];

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTitle, setSearchTitle] = useState<string>('');
    const [searchLocation, setSearchLocation] = useState<string>('');

    // State lưu trữ dữ liệu thống kê và danh sách render
    const [stats, setStats] = useState({ totalJobs: 0, totalCompanies: 0, newJobs: 0 });
    const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
    const [topCompanies, setTopCompanies] = useState<Company[]>([]);
    const [chartData, setChartData] = useState<ChartItem[]>([]);

    // Hàm format thời gian hiển thị thân thiện
    const getTimeAgo = (dateString?: string) => {
        if (!dateString) return 'Gần đây';
        const diff = new Date().getTime() - new Date(dateString).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours < 1) return 'Vừa xong';
        if (hours < 24) return `${hours} giờ trước`;
        return `${days} ngày trước`;
    };

    // Hàm hiển thị mức lương từ chuỗi salary_range của backend
    const getDisplaySalary = (salaryRange?: string) => {
        if (!salaryRange || salaryRange.trim() === '') return 'Thỏa thuận';
        return salaryRange;
    };

    const getExternalUrl = (url?: string) => {
        const trimmedUrl = url?.trim();
        if (!trimmedUrl) return '';

        return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    };

    const handleCompanyClick = (company: Company) => {
        const website = getExternalUrl(company.website);

        if (website) {
            window.open(website, '_blank', 'noopener,noreferrer');
            return;
        }

        navigate(`/jobs?q=${encodeURIComponent(company.name)}`);
    };

    const navigateAuthAware = (path: string) => {
        const dashboardPath = getValidDashboardPath();
        navigate(dashboardPath || path);
    };

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                // Gọi song song API lấy Job mở và API lấy danh sách Công ty đối tác
                const [jobsRes, companiesRes] = await Promise.all([
                    axiosClient.get('/api/jobs/public'),
                    axiosClient.get('/api/companies/public')
                ]);

                const jobsData: Job[] = jobsRes.data;
                const companiesData: Company[] = companiesRes.data;


                // Tạo Map O(1) để ánh xạ nhanh thông tin đối tác nếu Backend chưa trả về trực tiếp trong JobResponse
                const compMap: Record<string, Company> = {};
                companiesData.forEach(comp => {
                    compMap[comp.id] = comp;
                });

                // 1. Tính toán Thống kê (Stats)
                const totalJobsCount = jobsData.length;
                const uniqueCompanies = new Set(jobsData.map(job => job.company_name || job.company_id));

                const now = new Date();
                const threeDaysAgo = new Date(now.setDate(now.getDate() - 3));
                const newJobsCount = jobsData.filter(job => new Date(job.created_at) >= threeDaysAgo).length;

                setStats({
                    totalJobs: totalJobsCount,
                    totalCompanies: Math.max(uniqueCompanies.size, companiesData.length),
                    newJobs: newJobsCount
                });

                // 2. Lấy danh sách việc làm mới nhất làm tiêu biểu (Top 6) và đính kèm logo thực tế
                const enrichedJobs = jobsData.map(job => {
                    const matchedComp = compMap[job.company_id];
                    return {
                        ...job,
                        company_logo_url: job.company_logo_url || matchedComp?.logo_url || '',
                        company_industry: job.company_industry || matchedComp?.industry || 'IT & Software'
                    };
                });

                const sortedJobs = [...enrichedJobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setFeaturedJobs(sortedJobs.slice(0, 6));

                // 3. Top Công ty hàng đầu (Tính toán linh động số lượng việc làm đang mở cho từng công ty)
                const jobCountsByCompanyId: Record<string, number> = {};
                jobsData.forEach(job => {
                    jobCountsByCompanyId[job.company_id] = (jobCountsByCompanyId[job.company_id] || 0) + 1;
                });

                const computedCompanies = companiesData.map(comp => ({
                    ...comp,
                    jobs_count: jobCountsByCompanyId[comp.id] || 0
                }));

                // Ưu tiên hiển thị những công ty có nhiều việc làm đang mở nhất
                const sortedCompanies = computedCompanies
                    .sort((a, b) => (b.jobs_count || 0) - (a.jobs_count || 0))
                    .slice(0, 5);

                setTopCompanies(sortedCompanies);

                // 4. Dữ liệu Biểu đồ thống kê theo chuẩn ITSS Category
                const categoryCounts: Record<string, number> = {};
                jobsData.forEach(job => {
                    const cat = job.itss_category || 'General IT';
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });

                const sortedCategories = Object.keys(categoryCounts)
                    .map(name => ({ name, count: categoryCounts[name] }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 4);

                const maxCount = sortedCategories.length > 0 ? sortedCategories[0].count : 1;
                const chartColors = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];

                const finalChartData = sortedCategories.map((item, index) => ({
                    name: item.name,
                    height: `${Math.max(20, Math.round((item.count / maxCount) * 85))}%`,
                    color: chartColors[index % chartColors.length]
                }));

                setChartData(finalChartData);

            } catch (error) {
                message.error('Không thể tải dữ liệu thị trường việc làm lúc này.');
            } finally {
                setLoading(false);
            }
        };

        fetchMarketData();
    }, []);

    // Hàm xử lý tìm kiếm trỏ người dùng sang trang danh sách việc làm
    const handleSearch = () => {
        const hasKeyword = searchTitle.trim() !== '';
        const hasLocation = searchLocation !== '' && searchLocation !== LOCATIONS[0];

        if (!hasKeyword && !hasLocation) {
            message.info('Vui l\u00f2ng nh\u1eadp t\u1eeb kh\u00f3a ho\u1eb7c \u0111\u1ecba \u0111i\u1ec3m t\u00ecm ki\u1ebfm.');
            return;
        }
        const params = new URLSearchParams();
        if (hasKeyword) params.set('q', searchTitle.trim());
        if (hasLocation) params.set('loc', searchLocation);

        navigate(`/jobs?${params.toString()}`);
    };

    return (
        <div className={styles.landingLayout}>
            {/* Top Navbar */}
            <Header />

            {/* Hero Section */}
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
                        Nền tảng tuyển dụng IT Nhật Bản #1
                    </div>

                    <h1 className={styles.heroHeadline}>
                        Mở lối cho thế hệ<br />
                        <span className={styles.heroHeadlineAccent}>bứt phá</span> HIREGEN
                    </h1>

                    <p className={styles.heroSubtext}>
                        Kết nối nhân tài Việt Nam với vô số cơ hội việc làm IT tại Nhật Bản chuẩn kỹ năng ITSS
                    </p>

                    {/* Search Bar */}
                    <div className={styles.searchBar}>
                        <div className={styles.searchInputWrapper}>
                            <SearchOutlined className={styles.searchIcon} />
                            <input
                                className={styles.searchInput}
                                placeholder={'V\u1ecb tr\u00ed, k\u1ef9 n\u0103ng, c\u00f4ng ty...'}
                                value={searchTitle}
                                onChange={e => setSearchTitle(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSearch();
                                    if (e.key === 'Escape') setSearchTitle('');
                                }}
                            />
                            {searchTitle && (
                                <button
                                    type="button"
                                    className={styles.searchClear}
                                    onClick={() => setSearchTitle('')}
                                >
                                    {'\u2715'}
                                </button>
                            )}
                        </div>
                        <div className={styles.searchDivider}></div>
                        <div className={styles.searchInputWrapper}>
                            <EnvironmentOutlined className={styles.searchIcon} />
                            <Select
                                variant="borderless"
                                className={styles.locationSelect}
                                value={searchLocation || undefined}
                                onChange={value => setSearchLocation(value)}
                                style={{ flex: 1, minWidth: 160 }}
                                popupMatchSelectWidth={false}
                                placeholder={'\u0110\u1ecba \u0111i\u1ec3m'}
                                options={LOCATIONS.map(item => ({ label: item, value: item }))}
                            />
                        </div>
                        <Button type="primary" size="large" className={styles.btnSearch} onClick={handleSearch}>
                            {'T\u00ecm ki\u1ebfm'}
                        </Button>
                    </div>

                    {/* Hero stats row */}
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>{loading ? '...' : stats.totalJobs}</span>
                            <span className={styles.heroStatLabel}>Việc làm mở</span>
                        </div>
                        <div className={styles.heroStatDivider}></div>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>{loading ? '...' : stats.totalCompanies}+</span>
                            <span className={styles.heroStatLabel}>Công ty đối tác</span>
                        </div>
                        <div className={styles.heroStatDivider}></div>
                        <div className={styles.heroStat}>
                            <span className={styles.heroStatNum}>+{loading ? '...' : stats.newJobs}</span>
                            <span className={styles.heroStatLabel}>Việc mới / 3 ngày</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Jobs */}
            <section className={styles.featuredSection}>
                <div className={styles.sectionHeader}>
                    <div>
                        <span className={styles.subtitle}>Cơ hội mới nhất</span>
                        <h2 className={styles.title}>Việc làm tiêu biểu</h2>
                    </div>
                    <a onClick={() => navigate('/jobs')} className={styles.viewAll} style={{ cursor: 'pointer' }}>
                        Xem tất cả việc làm →
                    </a>
                </div>

                <Spin spinning={loading}>
                    <div className={styles.jobGrid}>
                        {featuredJobs.length > 0 ? featuredJobs.map((job) => (
                            <div
                                key={job.id}
                                className={styles.jobCard}
                                onClick={() => navigate(`/jobs?jobId=${encodeURIComponent(job.id)}`)}
                            >
                                <div className={styles.jobCardContent}>
                                    <div className={styles.jobCardHeader}>
                                        {/* Hiển thị Logo động hoặc Fallback Initials */}
                                        <div className={styles.jobLogoContainer}>
                                            {job.company_logo_url ? (
                                                <img
                                                    src={job.company_logo_url}
                                                    alt={job.company_name || 'Logo'}
                                                    className={styles.compLogoImg}
                                                />
                                            ) : (
                                                <div className={styles.compLogoFallback}>
                                                    {(job.company_name || 'H').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <h3>{job.title}</h3>
                                    <p className={styles.companyName}>
                                        {job.company_name || 'HireGen Partner'}
                                        {job.company_industry && <span className={styles.industryBullet}> · {job.company_industry}</span>}
                                    </p>
                                    <div className={styles.tags}>
                                        <span className={styles.tag}>{job.location || 'Remote / Hybrid'}</span>
                                        {job.itss_category && (
                                            <span className={styles.tag}>{job.itss_category}</span>
                                        )}
                                        {job.itss_level && (
                                            <span className={styles.tag}>Level {job.itss_level}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Phần Footer chứa Lương và Thời gian được Flexbox neo chặt dưới cùng */}
                                <div className={styles.jobFooter}>
                                    <span className={styles.salary}>{getDisplaySalary(job.salary_range)}</span>
                                    <span className={styles.time}>{getTimeAgo(job.created_at)}</span>
                                </div>
                            </div>
                        )) : (
                            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#747781' }}>
                                Hiện tại chưa có công việc nào trên hệ thống.
                            </p>
                        )}
                    </div>
                </Spin>
            </section>

            {/* Top Companies */}
            <section className={styles.companiesSection}>
                <div className={styles.container}>
                    <h2 className={styles.centerTitle}>Top công ty hàng đầu</h2>
                    <Spin spinning={loading}>
                        <div className={styles.companyGrid}>
                            {topCompanies.length > 0 ? topCompanies.map((company) => (
                                <div key={company.id} className={styles.companyCard} onClick={() => handleCompanyClick(company)}>
                                    <div className={styles.companyLogoContainer}>
                                        {company.logo_url ? (
                                            <img src={company.logo_url} alt={company.name} className={styles.compLogoImg} />
                                        ) : (
                                            <div className={styles.compLogoFallback}>
                                                {company.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <h4>{company.name}</h4>
                                    {/* Hiển thị chính xác Ngành nghề hoạt động (Industry) từ DB */}
                                    <p className={styles.companyIndustryText}>{company.industry || 'IT & Software'}</p>
                                    <div className={styles.openJobs}>{company.jobs_count || 0} Vị trí mở</div>
                                </div>
                            )) : (
                                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#747781' }}>
                                    Đang cập nhật danh sách công ty đối tác.
                                </p>
                            )}
                        </div>
                    </Spin>
                </div>
            </section>

            {/* Job Market Data Section */}
            <section className={styles.marketSection}>
                <div className={styles.marketContainer}>
                    <div className={styles.marketStats}>
                        <h2>Thị trường việc làm IT Nhật</h2>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}><span className="material-symbols-outlined">trending_up</span></div>
                            <div>
                                <p>Việc làm mới 3 ngày qua</p>
                                <h3>+{loading ? '...' : stats.newJobs}</h3>
                            </div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}><span className="material-symbols-outlined">work</span></div>
                            <div>
                                <p>Tổng số việc làm hiện tại</p>
                                <h3>{loading ? '...' : stats.totalJobs}</h3>
                            </div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}><span className="material-symbols-outlined">business</span></div>
                            <div>
                                <p>Công ty đang tuyển dụng</p>
                                <h3>{loading ? '...' : stats.totalCompanies}+</h3>
                            </div>
                        </div>
                    </div>

                    <div className={styles.marketChart}>
                        <h3>Nhu cầu tuyển dụng theo vị trí (Top ITSS)</h3>
                        <div className={styles.chartBars}>
                            {chartData.length > 0 ? chartData.map((data, index) => (
                                <div key={index} className={styles.barWrapper}>
                                    <div className={styles.bar} style={{ height: data.height, backgroundColor: data.color }}></div>
                                    <span style={{ fontSize: '11px', textAlign: 'center', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={data.name}>
                                        {data.name}
                                    </span>
                                </div>
                            )) : (
                                <div style={{ color: 'rgba(255,255,255,0.5)', width: '100%', textAlign: 'center' }}>Chưa đủ dữ liệu biểu đồ</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className={styles.ctaSection}>
                <div className={styles.ctaGrid}>
                    <div className={styles.ctaCardCandidate}>
                        <div>
                            <h2>Upload CV - Tìm việc làm ngay</h2>
                            <p>Hàng trăm cơ hội việc làm IT tại Nhật Bản đang chờ đón bạn.</p>
                        </div>
                        <button className={styles.ctaBtnLight} onClick={() => navigateAuthAware('/register')}>Tạo hồ sơ miễn phí</button>
                    </div>
                    <div className={styles.ctaCardEmployer}>
                        <div>
                            <h2>Đăng tin tuyển dụng</h2>
                            <p>Tiếp cận nguồn nhân lực IT chất lượng cao, am hiểu văn hóa và tiếng Nhật.</p>
                        </div>
                        <button className={styles.ctaBtnPrimary} onClick={() => navigateAuthAware('/login?redirect=hr')}>Bắt đầu tuyển dụng</button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default LandingPage;

