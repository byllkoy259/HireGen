import React, { useState, useMemo } from 'react';
import { Collapse } from 'antd';
import type { CollapseProps } from 'antd';
import CandidateLayout from '../../layouts/candidate/CandidateLayout';
import styles from './CandidateHelpCenter.module.css';

const CATEGORIES = [
    {
        id: 'cv-ai',
        icon: 'document_scanner',
        title: 'Hướng dẫn Tối ưu CV & Portfolio',
        desc: 'Cách trình bày kỹ năng, học vấn để hệ thống AI bóc tách chính xác. Bí kíp dùng từ khóa nâng cao Match Score.',
    },
    {
        id: 'itss',
        icon: 'schema',
        title: 'Hệ thống Chuẩn kỹ năng ITSS',
        desc: 'Giải thích trực quan 11 nhóm ngành nghề và thang 7 cấp độ tiêu chuẩn Nhật Bản giúp bạn định vị năng lực.',
    },
    {
        id: 'culture',
        icon: 'handshake',
        title: 'Văn hóa Doanh nghiệp & Kỹ năng mềm',
        desc: 'Cẩm nang thực chiến giao tiếp thương mại, quy tắc Ho-Ren-So, và cách trả lời phỏng vấn Gap Analysis.',
    },
    {
        id: 'platform',
        icon: 'laptop_mac',
        title: 'Hướng dẫn sử dụng Nền tảng',
        desc: 'Theo dõi tiến độ đơn ứng tuyển (Application Tracker) theo thời gian thực và quy trình nhận lời mời phỏng vấn.',
    },
];

const RAW_FAQS = [
    {
        key: '1',
        label: 'Hệ thống AI chấm điểm hồ sơ của tôi dựa trên những tiêu chí toán học nào?',
        content: 'AI của HireGen phân tích và đối chiếu các từ khóa kỹ năng (Tech Skills), số năm kinh nghiệm, cấp độ chuẩn ITSS và sự tương quan trong mô tả dự án của bạn với yêu cầu (JD) từ nhà tuyển dụng Nhật Bản để đưa ra điểm số Match Score chuẩn xác nhất.',
    },
    {
        key: '2',
        label: 'Tôi có thể cập nhật lại hồ sơ sau khi AI đã trích xuất thông tin không?',
        content: 'Hoàn toàn được. Hệ thống bóc tách tự động (Parsing) chỉ đóng vai trò nhập liệu ban đầu. Bạn có thể vào trang "Hồ sơ & CV" để chỉnh sửa, bổ sung kỹ năng, mô tả chi tiết từng dự án bất kỳ lúc nào.',
    },
    {
        key: '3',
        label: 'Dữ liệu cá nhân và CV gốc của tôi được bảo mật như thế nào?',
        content: 'Dữ liệu của bạn được mã hóa và lưu trữ an toàn trên hệ thống. CV gốc và thông tin liên hệ chi tiết chỉ được mở khóa cho nhà tuyển dụng hoặc Headhunter khi bạn chủ động nộp đơn ứng tuyển hoặc chấp nhận yêu cầu kết nối.',
    },
    {
        key: '4',
        label: 'Quy tắc Ho-Ren-So trong doanh nghiệp IT Nhật Bản là gì?',
        content: 'Ho-Ren-So là viết tắt của Báo cáo (Hokoku) - Liên lạc (Renraku) - Thảo luận (Sodan). Đây là nguyên tắc giao tiếp nền tảng giúp quy trình làm việc nhóm diễn ra minh bạch, tránh rủi ro phát sinh trong quá trình phát triển phần mềm.',
    },
];

const ARTICLES = [
    {
        id: 'art-1',
        thumb: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
        title: 'Bí kíp viết CV chuẩn ITSS chinh phục nhà tuyển dụng Tokyo',
        date: '10/05/2026',
        tag: 'Tối ưu CV',
    },
    {
        id: 'art-2',
        thumb: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=600&q=80',
        title: 'Giải mã Gap Analysis: Chuẩn bị gì cho vòng phỏng vấn kỹ thuật?',
        date: '02/05/2026',
        tag: 'Phỏng vấn',
    },
    {
        id: 'art-3',
        thumb: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80',
        title: 'Lộ trình từ Lập trình viên L2 lên Tech Lead L4 theo chuẩn ITSS',
        date: '18/04/2026',
        tag: 'Định hướng',
    },
];

const SUGGESTED_TAGS = ['chuẩn ITSS', 'tối ưu CV', 'quy tắc Ho-Ren-So', 'Match Score', 'bảo mật'];

/* ═══════════════════════════════════════════════════════════════
   CandidateHelp Component
═══════════════════════════════════════════════════════════════ */
const CandidateHelpCenter: React.FC = () => {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [ticketData, setTicketData] = useState({ subject: '', category: 'Tư vấn định hướng sự nghiệp', message: '' });
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /* ── Lọc FAQ tự động theo từ khóa tìm kiếm ── */
    const filteredFaqs = useMemo(() => {
        if (!search.trim()) return RAW_FAQS;
        const q = search.toLowerCase();
        return RAW_FAQS.filter(
            item => item.label.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
        );
    }, [search]);

    /* Chuyển đổi dữ liệu FAQ sang format của Ant Design v5 */
    const faqItems: CollapseProps['items'] = filteredFaqs.map(item => ({
        key: item.key,
        label: <span className={styles.faqTitle}>{item.label}</span>,
        children: <p className={styles.faqAnswer}>{item.content}</p>,
    }));

    /* ── Xử lý gửi Ticket hỗ trợ ── */
    const handleSendTicket = () => {
        if (!ticketData.subject.trim() || !ticketData.message.trim()) {
            showToast('Vui lòng điền đầy đủ tiêu đề và nội dung cần hỗ trợ.', 'error');
            return;
        }
        setSubmitting(true);
        // Giả lập gọi API gửi ticket
        setTimeout(() => {
            setSubmitting(false);
            setIsModalOpen(false);
            setTicketData({ subject: '', category: 'Tư vấn định hướng sự nghiệp', message: '' });
            showToast('Đã gửi yêu cầu hỗ trợ! Chuyên viên HireGen sẽ liên hệ qua Email của bạn.');
        }, 1000);
    };

    return (
        <CandidateLayout
            pageTitle="Trung tâm hỗ trợ"
            pageSubtitle="Trạm dẫn đường giúp ứng viên vượt qua các rào cản tiêu chuẩn và văn hóa Nhật Bản"
            headerActions={<></>}
        >
            <div className={styles.container}>
                
                {/* ══ KHỐI A: BANNER & SMART SEARCH (Redesigned) ═════════════════════════ */}
                <div className={styles.headerBanner}>
                    <h1 className={styles.bannerTitle}>
                        Trung tâm hỗ trợ & Cẩm nang phát triển sự nghiệp IT Nhật Bản
                    </h1>
                    <p className={styles.bannerSub}>
                        Tìm kiếm nhanh hướng dẫn, quy chuẩn kỹ năng hoặc kết nối trực tiếp với chuyên gia tư vấn
                    </p>
                    
                    <div className={styles.searchTopbar}>
                        <div className={styles.searchWrap}>
                            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
                            <input
                                className={styles.searchInput}
                                placeholder="Gõ thắc mắc của bạn (VD: chuẩn ITSS, cách tối ưu CV, quy tắc Ho-Ren-So...)"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Escape' && setSearch('')}
                            />
                            {search && (
                                <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
                            )}
                        </div>
                        <button className={styles.searchBtn} onClick={() => {}}>
                            Tìm kiếm
                        </button>
                    </div>

                    <div className={styles.tagCloud}>
                        <span className={styles.tagLabel}>Gợi ý phổ biến:</span>
                        {SUGGESTED_TAGS.map(tag => (
                            <button
                                key={tag}
                                className={styles.chipBtn}
                                onClick={() => setSearch(tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ══ KHỐI 1: CHỦ ĐỀ HỖ TRỢ TRỌNG ĐIỂM (CATEGORY GRIDS) ═══ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Các chủ đề hỗ trợ trọng điểm</h2>
                    <p className={styles.sectionSub}>Chọn danh mục để khám phá cẩm nang hướng dẫn chi tiết</p>
                    
                    <div className={styles.categoryGrid}>
                        {CATEGORIES.map(cat => (
                            <div key={cat.id} className={styles.categoryCard}>
                                <div className={styles.catIconWrap}>
                                    <span className="material-symbols-outlined">{cat.icon}</span>
                                </div>
                                <h3 className={styles.catTitle}>{cat.title}</h3>
                                <p className={styles.catDesc}>{cat.desc}</p>
                                <button 
                                    className={styles.catLinkBtn}
                                    onClick={() => setSearch(cat.title.split(' ')[2] || 'ITSS')}
                                >
                                    Xem chi tiết →
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══ KHỐI 2: CÂU HỎI THƯỜNG GẶP (FAQ SECTION) ════════════ */}
                <div className={styles.section}>
                    <div className={styles.sectionHeaderFlex}>
                        <div>
                            <h2 className={styles.sectionTitle}>Câu hỏi thường gặp (FAQ)</h2>
                            <p className={styles.sectionSub}>Các vướng mắc phổ biến nhất của ứng viên trên hệ thống</p>
                        </div>
                        {search && (
                            <button className={styles.clearSearchBtn} onClick={() => setSearch('')}>
                                Hiển thị tất cả FAQ
                            </button>
                        )}
                    </div>

                    <div className={styles.faqWrapper}>
                        {faqItems.length > 0 ? (
                            <Collapse 
                                accordion 
                                items={faqItems} 
                                bordered={false}
                                defaultActiveKey={['1']}
                                className={styles.customCollapse}
                            />
                        ) : (
                            <div className={styles.emptyFaq}>
                                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--text-muted)' }}>search_off</span>
                                <p>Không tìm thấy câu hỏi nào khớp với từ khóa "{search}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ KHỐI 3: CẨM NANG & BÀI VIẾT CHUYÊN SÂU ══════════════ */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Cẩm nang & Bài viết chuyên sâu</h2>
                    <p className={styles.sectionSub}>Kinh nghiệm thực chiến từ các Senior Tech Lead và Headhunter thị trường Nhật</p>
                    
                    <div className={styles.articlesGrid}>
                        {ARTICLES.map(art => (
                            <div key={art.id} className={styles.articleCard}>
                                <div className={styles.artThumbWrap}>
                                    <img src={art.thumb} alt={art.title} className={styles.artThumb} />
                                    <span className={styles.artTag}>{art.tag}</span>
                                </div>
                                <div className={styles.artBody}>
                                    <span className={styles.artDate}>{art.date}</span>
                                    <h4 className={styles.artTitle}>{art.title}</h4>
                                    <button className={styles.readMoreBtn} onClick={() => showToast('Tính năng đọc bài viết chi tiết đang được hoàn thiện.', 'success')}>
                                        Đọc bài viết
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══ KHỐI 4: SUPPORT CTA & CONTACT ═══════════════════════ */}
                <div className={styles.ctaBox}>
                    <div className={styles.ctaContent}>
                        <h3 className={styles.ctaTitle}>Bạn vẫn còn câu hỏi hoặc cần tư vấn định hướng sự nghiệp riêng?</h3>
                        <p className={styles.ctaDesc}>
                            Đội ngũ chuyên viên tuyển dụng và Mentor của chúng tôi luôn sẵn sàng lắng nghe và đồng hành cùng bạn trên con đường chinh phục thị trường IT Nhật Bản.
                        </p>
                        <div className={styles.ctaButtonGroup}>
                            <button className={styles.btnCtaPrimary} onClick={() => setIsModalOpen(true)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>support_agent</span>
                                Gửi yêu cầu hỗ trợ
                            </button>
                            <button className={styles.btnCtaSecondary} onClick={() => showToast('Hệ thống Live Chat đang được hoàn thiện.', 'success')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>forum</span>
                                Chat với chuyên viên
                            </button>
                        </div>
                    </div>
                    <div className={styles.ctaDecoration}>
                        <span className="material-symbols-outlined" style={{ fontSize: 160, color: 'rgba(255,255,255,0.05)' }}>public</span>
                    </div>
                </div>

            </div>

            {/* ── MODAL: GỬI YÊU CẦU HỖ TRỢ (SUPPORT TICKET - ĐỒNG BỘ NATIVE STYLE) ── */}
            {isModalOpen && (
                <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
                    <div className={styles.modalBox}>
                        <div className={styles.modalTop}>
                            <h3 className={styles.modalHeading}>Gửi Ticket Hỗ Trợ Mới</h3>
                            <button className={styles.btnCloseModal} onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <div className={styles.modalContent}>
                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Nhóm vấn đề</label>
                                <select 
                                    className={styles.formInput} 
                                    value={ticketData.category}
                                    onChange={e => setTicketData({...ticketData, category: e.target.value})}
                                >
                                    <option>Tư vấn định hướng sự nghiệp</option>
                                    <option>Vướng mắc tiêu chuẩn hồ sơ ITSS</option>
                                    <option>Hỗ trợ quy trình phỏng vấn</option>
                                    <option>Lỗi kỹ thuật trên nền tảng</option>
                                </select>
                            </div>

                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Tiêu đề cần hỗ trợ <span style={{color: '#dc2626'}}>*</span></label>
                                <input 
                                    type="text" 
                                    className={styles.formInput} 
                                    placeholder="Tóm tắt vấn đề của bạn..." 
                                    value={ticketData.subject}
                                    onChange={e => setTicketData({...ticketData, subject: e.target.value})}
                                />
                            </div>

                            <div className={styles.fieldWrapper}>
                                <label className={styles.fieldLabel}>Nội dung chi tiết <span style={{color: '#dc2626'}}>*</span></label>
                                <textarea 
                                    className={styles.formTextarea} 
                                    rows={4} 
                                    placeholder="Mô tả cụ thể thắc mắc hoặc khó khăn bạn đang gặp phải để chuyên viên hỗ trợ chính xác nhất..."
                                    value={ticketData.message}
                                    onChange={e => setTicketData({...ticketData, message: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className={styles.modalBottom}>
                            <button className={styles.btnCancelModal} onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
                            <button 
                                className={styles.btnConfirmModal} 
                                onClick={handleSendTicket}
                                disabled={submitting}
                            >
                                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thông báo Toast */}
            {toast && (
                <div className={`${styles.toastPopup} ${toast.type === 'error' ? styles.toastError : ''}`}>
                    {toast.msg}
                </div>
            )}
        </CandidateLayout>
    );
};

export default CandidateHelpCenter;