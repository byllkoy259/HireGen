import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collapse, Tabs, Progress, Tooltip, Tag, Button } from 'antd';
import type { CollapseProps } from 'antd';
import {
    InfoCircleOutlined,
    RocketOutlined,
    FileTextOutlined,
    InteractionOutlined,
    TeamOutlined,
    BulbOutlined,
    CheckSquareOutlined
} from '@ant-design/icons';

import Header from '../../components/layouts/Header';
import Footer from '../../components/layouts/Footer';
import styles from './Guide.module.css';

const ITSS_LEVELS_DATA = [
    { level: 'Level 1', title: 'Entry Level · Nhận thức cơ bản', desc: 'Có kiến thức nền tảng tối thiểu, làm việc dưới sự hướng dẫn chi tiết của tiền bối.', salary: '$500 - $800', color: 'default' },
    { level: 'Level 2', title: 'Basic Practitioner · Thực hành cơ bản', desc: 'Có thể tự giải quyết các tác vụ lập trình thông thường theo quy trình chuẩn.', salary: '$800 - $1,200', color: 'cyan' },
    { level: 'Level 3', title: 'Independent Professional · Làm việc độc lập', desc: 'Ngưỡng tuyển dụng phổ biến nhất. Tự phân tích, thiết kế và giải quyết bài toán độc lập mà không cần giám sát.', salary: '$1,500 - $2,500', color: 'blue' },
    { level: 'Level 4', title: 'Advanced Specialist · Chuyên gia / Leader', desc: 'Ngưỡng tuyển dụng chất lượng cao. Dẫn dắt đội ngũ, làm chủ công nghệ lõi và giải quyết vấn đề kỹ thuật phức tạp.', salary: '$2,500 - $4,000', color: 'geekblue' },
    { level: 'Level 5', title: 'Principal / Project Leader · Leader cấp dự án', desc: 'Chủ đạo thiết kế kiến trúc toàn hệ thống, định hướng công nghệ và quản lý rủi ro kỹ thuật cấp dự án lớn.', salary: '$4,000 - $6,000', color: 'gold' },
    { level: 'Level 6', title: 'Industry Expert · Chuyên gia cấp ngành', desc: 'Chuyên gia hàng đầu, dẫn dắt các xu hướng công nghệ mới, có tầm ảnh hưởng và đóng góp lớn trong toàn ngành IT.', salary: '$6,000 - $8,000+', color: 'volcano' },
    { level: 'Level 7', title: 'World-class Innovator · Tầm vóc thế giới', desc: 'Những nhà sáng lập xu hướng, nghiên cứu đột phá mang tầm vóc quốc tế, thay đổi toàn bộ cục diện công nghệ.', salary: 'Thỏa thuận (Cấp cao)', color: 'red' },
];

const INIT_CHECKLIST = [
    { id: 'c1', label: 'Trình bày kinh nghiệm theo gạch đầu dòng rõ ràng (Tránh viết đoạn văn dài).', done: false },
    { id: 'c2', label: 'Tích hợp từ khóa (Keywords) công nghệ chuyên ngành xác thực.', done: false },
    { id: 'c3', label: 'Bổ sung phần mô tả dự án (Project Description) và vai trò cụ thể.', done: false },
    { id: 'c4', label: 'Sử dụng cấu trúc chuẩn Harvard Resume Template dễ bóc tách.', done: false },
    { id: 'c5', label: 'Nêu rõ các quy trình Methodology đã áp dụng (Agile/Scrum, CI/CD).', done: false },
];

const Guide: React.FC = () => {
    const navigate = useNavigate();
    const [checklist, setChecklist] = useState(INIT_CHECKLIST);
    const [activeTab, setActiveTab] = useState('all');
    const [activeSection, setActiveSection] = useState('section-itss');

    const completedCount = checklist.filter(item => item.done).length;
    const progressPercent = Math.round((completedCount / checklist.length) * 100);

    const toggleChecklistItem = (id: string) => {
        setChecklist(prev =>
            prev.map(item =>
                item.id === id ? { ...item, done: !item.done } : item
            )
        );
    };

    const shouldShow = (categories: string[]) => {
        if (activeTab === 'all') return true;
        return categories.includes(activeTab);
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);

        const element = document.getElementById(id);

        if (!element) return;

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    const itssCollapseItems: CollapseProps['items'] = ITSS_LEVELS_DATA.map((item, idx) => ({
        key: String(idx),
        label: (
            <div className={styles.collapseHeader}>
                <Tag color={item.color} className={styles.levelBadgeTag}>
                    {item.level}
                </Tag>

                <span className={styles.levelTitle}>{item.title}</span>

                {item.level === 'Level 3' || item.level === 'Level 4' ? (
                    <Tag color="blue" style={{ marginLeft: 'auto' }}>
                        ★ Ngưỡng tuyển dụng
                    </Tag>
                ) : null}
            </div>
        ),
        children: (
            <div className={styles.collapseContent}>
                <p>{item.desc}</p>
                <div className={styles.salaryExpectation}>
                    <strong>Mức lương kỳ vọng: </strong>
                    <span className={styles.salaryText}>{item.salary}</span>
                </div>
            </div>
        ),
    }));

    return (
        <div className={styles.layoutContainer}>
            <Header />

            <div className={styles.heroSection}>
                <div className={styles.heroContent}>
                    <h1>Cẩm Nang Phát Triển Sự Nghiệp IT Nhật Bản</h1>
                    <p>
                        Khung kiến thức nền tảng giúp bạn tối ưu hóa hồ sơ và chinh phục tiêu chuẩn ITSS.
                    </p>

                    <div className={styles.heroCta}>
                        <Button type="primary" size="large" onClick={() => navigate('/register')}>
                            Tạo hồ sơ ngay
                        </Button>
                    </div>
                </div>
            </div>

            <main className={styles.contentMain}>
                <div className={styles.guideContainer}>
                    <div className={styles.mainContentArea}>
                        <div className={styles.tabsWrapper}>
                            <Tabs
                                activeKey={activeTab}
                                onChange={setActiveTab}
                                items={[
                                    { key: 'all', label: 'Toàn bộ Cẩm nang' },
                                    { key: 'dev', label: 'Cho Developer' },
                                    { key: 'brse', label: 'Cho BrSE / Kỹ sư cầu nối' },
                                    { key: 'culture', label: 'Văn hóa Nhật Bản' },
                                ]}
                            />
                        </div>

                        {shouldShow(['dev', 'brse']) && (
                            <section id="section-itss" className={styles.sectionBlock}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>01</span>
                                    <h2 className={styles.sectionTitle}>
                                        <InfoCircleOutlined className={styles.headingIcon} />
                                        Tổng quan về chuẩn ITSS
                                    </h2>
                                </div>

                                <p className={styles.leadParagraph}>
                                    ITSS (Information Technology Skill Standards) là "linh hồn" của hệ thống đánh giá HireGen.
                                    Đây là bộ tiêu chuẩn do Bộ Kinh tế, Thương mại và Công nghiệp Nhật Bản (METI) và IPA ban hành,
                                    quy định rõ ma trận năng lực gồm <strong>11 nhóm ngành nghề (Job Categories)</strong> và
                                    <strong> 7 cấp độ kỹ năng (Skill Levels)</strong> được phân định cực kỳ khắt khe.
                                </p>

                                <div className={styles.interactiveBlock}>
                                    <h3 className={styles.subTitle}>
                                        <RocketOutlined className={styles.headingIcon} />
                                        Ma trận 7 Cấp độ & Kỳ vọng tuyển dụng
                                    </h3>

                                    <p className={styles.instructionText}>
                                        Bấm vào từng cấp độ bên dưới để xem chi tiết yêu cầu năng lực chuẩn IPA và dải lương tương ứng:
                                    </p>

                                    <Collapse accordion items={itssCollapseItems} defaultActiveKey={['2']} />
                                </div>
                            </section>
                        )}

                        {shouldShow(['dev', 'brse']) && (
                            <section id="section-skills" className={styles.sectionBlock}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>02</span>
                                    <h2 className={styles.sectionTitle}>
                                        <InteractionOutlined className={styles.headingIcon} />
                                        Ba trục kỹ năng AI bóc tách trong hồ sơ
                                    </h2>
                                </div>

                                <p className={styles.leadParagraph}>
                                    Hệ thống AI Core của chúng tôi phân tích và đánh giá ứng viên dựa trên 3 trụ cột kỹ năng.
                                    Để tối ưu hóa điểm số, CV của bạn cần làm nổi bật:
                                </p>

                                <div className={styles.pillarsGrid}>
                                    <div className={styles.pillarCard}>
                                        <div className={styles.pillarIcon} style={{ background: '#eef4fc', color: '#0066cc' }}>
                                            <span className="material-symbols-outlined">code</span>
                                        </div>
                                        <h4>Technology Skills</h4>
                                        <p>
                                            Không chỉ liệt kê ngôn ngữ lập trình, bạn cần nêu rõ mức độ thành thạo và các framework/thư viện chuyên sâu đã trực tiếp áp dụng.
                                        </p>
                                    </div>

                                    <div className={styles.pillarCard}>
                                        <div className={styles.pillarIcon} style={{ background: '#f5f3ff', color: '#5b21b6' }}>
                                            <span className="material-symbols-outlined">architecture</span>
                                        </div>
                                        <h4>Methodology & Engineering</h4>
                                        <p>
                                            Đưa vào Agile/Scrum, CI/CD Pipelines, TDD, Unit Test để AI nhận diện tư duy hệ thống tốt hơn.
                                        </p>
                                    </div>

                                    <div className={styles.pillarCard}>
                                        <div className={styles.pillarIcon} style={{ background: '#fffbeb', color: '#b45309' }}>
                                            <span className="material-symbols-outlined">psychology</span>
                                        </div>
                                        <h4>Business & Human Skills</h4>
                                        <p>
                                            Nhấn mạnh khả năng giao tiếp, thương lượng, thấu hiểu nghiệp vụ và tuân thủ nguyên tắc báo cáo chuyên nghiệp.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {shouldShow(['dev']) && (
                            <section id="section-rag" className={styles.sectionBlock}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>03</span>
                                    <h2 className={styles.sectionTitle}>
                                        <FileTextOutlined className={styles.headingIcon} />
                                        Tối ưu hóa CV cho hệ thống AI (RAG Pipeline)
                                    </h2>
                                </div>

                                <p className={styles.leadParagraph}>
                                    Do hệ thống sử dụng công nghệ RAG để đọc và trích xuất ngữ cảnh, bạn cần lưu ý các quy tắc định dạng cốt lõi:
                                </p>

                                <ul className={styles.standardList}>
                                    <li>
                                        <strong>Cấu trúc gạch đầu dòng:</strong> Trình bày rõ trách nhiệm công việc và thành tựu bằng bullet points.
                                    </li>
                                    <li>
                                        <strong>Tối ưu hóa từ khóa:</strong> Đưa vào các từ khóa chuyên ngành sát với JD mục tiêu để tăng Match Score.
                                    </li>
                                    <li>
                                        <strong>Tính trung thực tuyệt đối:</strong> Tránh nhồi nhét từ khóa rác vì AI có thể phân tích mâu thuẫn trong hồ sơ.
                                    </li>
                                </ul>

                                <div className={styles.interactiveToolBox}>
                                    <div className={styles.toolHeader}>
                                        <h3>
                                            <CheckSquareOutlined style={{ marginRight: 8 }} />
                                            Checklist Chuẩn hóa CV Trước khi Nộp
                                        </h3>
                                        <span className={styles.progressStatus}>
                                            {completedCount} / {checklist.length} hoàn thành
                                        </span>
                                    </div>

                                    <Progress percent={progressPercent} strokeColor="#0066cc" />

                                    <div className={styles.checklistItems}>
                                        {checklist.map(item => (
                                            <div
                                                key={item.id}
                                                className={`${styles.checkItem} ${item.done ? styles.checkItemDone : ''}`}
                                                onClick={() => toggleChecklistItem(item.id)}
                                            >
                                                <div className={styles.checkboxSquare}>
                                                    {item.done ? '✓' : ''}
                                                </div>
                                                <span>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {shouldShow(['culture']) && (
                            <section id="section-agency" className={styles.sectionBlock}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>04</span>
                                    <h2 className={styles.sectionTitle}>
                                        <TeamOutlined className={styles.headingIcon} />
                                        Quy trình Tuyển dụng & Mô hình Agency
                                    </h2>
                                </div>

                                <p className={styles.leadParagraph}>
                                    HireGen đóng vai trò là cầu nối chuẩn hóa dữ liệu giữa ứng viên và các doanh nghiệp Nhật Bản.
                                </p>

                                <div className={styles.agencyInfoBox}>
                                    <h4>Chuẩn bị cho Văn hóa Phỏng vấn AI</h4>
                                    <p>
                                        Dựa trên báo cáo Gap Analysis do AI trích xuất từ CV, hệ thống có thể sinh ra câu hỏi phỏng vấn cá nhân hóa.
                                        Hãy chuẩn bị để giải thích chi tiết về các công nghệ bạn ghi trong hồ sơ.
                                    </p>
                                </div>
                            </section>
                        )}

                        {shouldShow(['brse', 'culture']) && (
                            <section id="section-culture" className={styles.sectionBlock}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>05</span>
                                    <h2 className={styles.sectionTitle}>
                                        <BulbOutlined className={styles.headingIcon} />
                                        Văn hóa Làm việc & Kỹ năng Đặc thù (Ho-Ren-So)
                                    </h2>
                                </div>

                                <p className={styles.leadParagraph}>
                                    Thị trường công nghệ Nhật Bản đề cao tính kỷ luật, sự cam kết và quy trình làm việc minh bạch.
                                    Nắm vững nguyên tắc <strong>Ho-Ren-So</strong> là chìa khóa vàng cho sự nghiệp của bạn:
                                </p>

                                <div className={styles.horensoGrid}>
                                    <div className={styles.hrsCard}>
                                        <div className={styles.hrsHeader}>HO <span>(Hokoku · Báo cáo)</span></div>
                                        <p>Chủ động báo cáo định kỳ về tiến độ công việc, ngay cả khi không được hỏi.</p>
                                    </div>

                                    <div className={styles.hrsCard}>
                                        <div className={styles.hrsHeader}>REN <span>(Renraku · Liên lạc)</span></div>
                                        <p>Thông tin đầy đủ, kịp thời và chính xác đến các thành viên liên quan.</p>
                                    </div>

                                    <div className={styles.hrsCard}>
                                        <div className={styles.hrsHeader}>SO <span>(Sodan · Thảo luận)</span></div>
                                        <p>Khi gặp bài toán khó, cần chủ động thảo luận và xin ý kiến từ Leader.</p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <div className={styles.sideNavigationArea}>
                        <div className={styles.anchorStickyBox}>
                            <h3 className={styles.anchorTitle}>Nội dung Cẩm nang</h3>

                            <div className={styles.customAnchor}>
                                <button
                                    className={
                                        activeSection === 'section-itss'
                                            ? styles.anchorActive
                                            : ''
                                    }
                                    onClick={() => scrollToSection('section-itss')}
                                >
                                    1. Tổng quan chuẩn ITSS
                                </button>

                                <button
                                    className={
                                        activeSection === 'section-skills'
                                            ? styles.anchorActive
                                            : ''
                                    }
                                    onClick={() => scrollToSection('section-skills')}
                                >
                                    2. Ba trục kỹ năng AI
                                </button>

                                <button
                                    className={
                                        activeSection === 'section-rag'
                                            ? styles.anchorActive
                                            : ''
                                    }
                                    onClick={() => scrollToSection('section-rag')}
                                >
                                    3. Tối ưu CV cho RAG
                                </button>

                                <button
                                    className={
                                        activeSection === 'section-agency'
                                            ? styles.anchorActive
                                            : ''
                                    }
                                    onClick={() => scrollToSection('section-agency')}
                                >
                                    4. Quy trình & Agency
                                </button>

                                <button
                                    className={
                                        activeSection === 'section-culture'
                                            ? styles.anchorActive
                                            : ''
                                    }
                                    onClick={() => scrollToSection('section-culture')}
                                >
                                    5. Văn hóa Ho-Ren-So
                                </button>
                            </div>

                            <div className={styles.quickHelpBox}>
                                <h4 className={styles.quickHelpTitle}>Sơ đồ Cấp độ Nhanh</h4>

                                <p>Di chuột vào các mốc để xem phân tích kỳ vọng từ hệ thống:</p>

                                <div className={styles.levelPillsContainer}>
                                    {ITSS_LEVELS_DATA.map(item => (
                                        <Tooltip
                                            key={item.level}
                                            title={`${item.title} (${item.salary})`}
                                            placement="left"
                                        >
                                            <Tag color={item.color} style={{ cursor: 'pointer', marginBottom: 6 }}>
                                                {item.level}
                                            </Tag>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Guide;