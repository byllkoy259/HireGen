import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HRLayout.module.css';
import Logo from '../../components/common/Logo';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import axiosClient from '../../services/axiosClient';

/* ─── Types ─────────────────────────────────────────────────── */
export interface NavItem {
    icon: string;
    label: string;
    href?: string;
    onClick?: () => void;
    isActive?: boolean;
}

export interface NavSection {
    title: string;
    items: NavItem[];
}

export interface HRLayoutProps {
    /** Tiêu đề trang hiển thị ở topbar */
    pageTitle?: string;
    /** Dòng phụ dưới tiêu đề (mặc định: ngày hôm nay · HireGen Co.) */
    pageSubtitle?: string;
    /**
     * Các nút/phần tử hiển thị ở góc phải topbar.
     * Ví dụ: <button>Xuất báo cáo</button> hoặc <button>Đăng tải job</button>
     * Nút chuông notifications đã được tích hợp sẵn, chỉ cần truyền thêm action buttons.
     */
    headerActions?: ReactNode;
    /** Nội dung trang (phần main bên phải sidebar) */
    children: ReactNode;
    /**
     * Cấu hình các section trong sidebar nav.
     * Nếu không truyền, sidebar dùng nav mặc định của HR module.
     */
    navSections?: NavSection[];
}

/* ─── Default Nav Config ─────────────────────────────────────── */
/**
 * href ở đây là route của React Router (frontend).
 * Mỗi trang frontend sẽ tự gọi API backend tương ứng:
 *   /hr/dashboard      → GET /api/jobs/me  +  GET /api/hr/applications/job/{id}
 *   /hr/jobs           → GET/POST /api/jobs/me
 *   /hr/candidates     → GET /api/hr/applications/job/{id}
 *   /hr/ai-matching    → (feature riêng, tùy backend)
 *   /hr/reports        → GET /api/jobs/me  (tổng hợp báo cáo)
 *   /hr/company        → GET/POST /api/companies/me
 *   /hr/settings       → GET /api/auth/me
 */
const DEFAULT_NAV_SECTIONS: NavSection[] = [
    {
        title: 'TỔNG QUAN',
        items: [
            { icon: 'grid_view', label: 'Dashboard', href: '/hr', isActive: false },
        ],
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
            { icon: 'bar_chart', label: 'Báo cáo', href: '/hr/reports' },
        ],
    },
    {
        title: 'CÀI ĐẶT',
        items: [
            { icon: 'domain', label: 'Hồ sơ công ty', href: '/hr/company' },
            { icon: 'settings', label: 'Cài đặt', href: '/hr/settings' },
        ],
    },
];

/* ─── HRLayout ───────────────────────────────────────────────── */
const HRLayout: React.FC<HRLayoutProps> = ({
    pageTitle,
    pageSubtitle,
    headerActions,
    children,
    navSections = DEFAULT_NAV_SECTIONS,
}) => {
    const navigate = useNavigate();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [userData, setUserData] = useState({ name: 'Đang tải...', email: '', displayInitial: '', avatarUrl: '' });

    const todayStr = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date());

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axiosClient.get('/api/auth/me');
                const email = res.data.email || '';
                const nameFromEmail = email ? email.split('@')[0] : 'Người dùng';
                const name = res.data.full_name || res.data.username || res.data.name || nameFromEmail;
                const avatarUrl = res.data.avatar_url || res.data.profile?.avatar_url || '';

                setUserData({ name, email, displayInitial: name.charAt(0).toUpperCase(), avatarUrl });
            } catch {
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const fallbackName = payload.name || payload.username || payload.email?.split('@')[0] || 'Người dùng';
                        setUserData({
                            name: fallbackName,
                            email: payload.email || '',
                            displayInitial: fallbackName.charAt(0).toUpperCase(),
                            avatarUrl: payload.avatar_url || ''
                        });
                    } catch { }
                } else {
                    setUserData({ name: 'Người dùng', email: '', displayInitial: 'U', avatarUrl: '' });
                }
            }
        };
        fetchUser();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        navigate('/login');
    };

    const userMenu: MenuProps['items'] = [
        {
            key: 'profile',
            label: 'Hồ sơ cá nhân',
            icon: <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>person</span>,
            onClick: () => navigate('/hr/profile'),
        },
        { type: 'divider' },
        {
            key: 'logout',
            label: <span style={{ color: '#dc2626', fontWeight: 500 }}>Đăng xuất</span>,
            icon: <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 18, verticalAlign: 'middle' }}>logout</span>,
            onClick: handleLogout,
        },
    ];

    return (
        <div className={styles.shell}>
            {/* ── Sidebar ── */}
            <aside className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
                <div className={styles.sidebarBrand}>
                    <Logo size="sm" variant="light" />
                </div>

                <button
                    className={styles.collapseBtn}
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                    <span className="material-symbols-outlined">
                        {isSidebarCollapsed ? 'chevron_right' : 'chevron_left'}
                    </span>
                </button>

                <nav className={styles.sidebarNav}>
                    {navSections.map((section) => (
                        <div key={section.title} className={styles.navSection}>
                            <p className={styles.navSectionTitle}>
                                {!isSidebarCollapsed && section.title}
                            </p>
                            {section.items.map((item) => (
                                <button
                                    key={item.label}
                                    className={`${styles.navItem} ${item.isActive ? styles.navItemActive : ''}`}
                                    onClick={() => {
                                        if (item.onClick) {
                                            item.onClick();
                                        } else if (item.href) {
                                            navigate(item.href);
                                        }
                                    }}
                                >
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                    {!isSidebarCollapsed && item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="topLeft" arrow>
                        <div className={`${styles.userBlockSide} ${isSidebarCollapsed ? styles.userBlockCollapsed : ''}`} style={{ cursor: 'pointer' }}>
                            <div className={styles.userAvatarSide} style={{ overflow: 'hidden', padding: 0 }}>
                                {userData.avatarUrl ? (
                                    <img 
                                        src={userData.avatarUrl} 
                                        alt={userData.name} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    userData.displayInitial
                                )}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className={styles.userTextSide}>
                                    <span className={styles.userNameSide} title={userData.name}>{userData.name}</span>
                                    <span className={styles.userRoleSide} title={userData.email}>{userData.email}</span>
                                </div>
                            )}
                        </div>
                    </Dropdown>
                </div>
            </aside>

            {/* ── Main Area ── */}
            <div className={styles.mainArea}>
                <header className={styles.topbar}>
                    <div>
                        <h1 className={styles.headerTitle}>
                            {pageTitle ?? `Xin chào, ${userData.name}`}
                        </h1>
                        <p className={styles.headerSub}>
                            {pageSubtitle ?? `${todayStr} · HireGen Co.`}
                        </p>
                    </div>
                    <div className={styles.topbarRight}>
                        <button className={styles.iconBtn}>
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        {/* Các nút action tuỳ theo từng trang */}
                        {headerActions}
                    </div>
                </header>

                <main className={styles.mainContent}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default HRLayout;