import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './CandidateLayout.module.css';
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

export interface CandidateLayoutProps {
    /** Tiêu đề trang hiển thị ở topbar */
    pageTitle?: ReactNode;
    /** Dòng phụ dưới tiêu đề (mặc định: ngày hôm nay · Candidate) */
    pageSubtitle?: ReactNode;
    /**
     * Các nút/phần tử hiển thị ở góc phải topbar.
     */
    headerActions?: ReactNode;
    /** Nội dung trang (phần main bên phải sidebar) */
    children: ReactNode;
    /**
     * Cấu hình các section trong sidebar nav.
     */
    navSections?: NavSection[];
    notifCount?: number;
}

/* ─── Default Nav Config ─────────────────────────────────────── */
const CANDIDATE_NAV_SECTIONS: NavSection[] = [
    {
        title: 'CÁ NHÂN',
        items: [
            { icon: 'grid_view', label: 'Dashboard', href: '/candidate' },
            { icon: 'person', label: 'Hồ sơ & CV', href: '/candidate/profile' },
        ],
    },
    {
        title: 'VIỆC LÀM',
        items: [
            { icon: 'search', label: 'Tìm việc làm', href: '/candidate/jobs' },
            { icon: 'description', label: 'Đơn đã nộp', href: '/candidate/applications' },
            { icon: 'favorite', label: 'Việc đã lưu', href: '/candidate/saved' },
        ],
    },
    {
        title: 'HỖ TRỢ',
        items: [
            { icon: 'menu_book', label: 'Cẩm nang IT Nhật', href: '/candidate/guide' },
            { icon: 'help_outline', label: 'Trung tâm hỗ trợ', href: '/candidate/help' },
        ],
    },
];

/* ─── CandidateLayout ───────────────────────────────────────────────── */
const CandidateLayout: React.FC<CandidateLayoutProps> = ({
    pageTitle,
    pageSubtitle,
    headerActions,
    children,
    navSections = CANDIDATE_NAV_SECTIONS,
    notifCount = 0,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [userData, setUserData] = useState({ 
        name: 'Đang tải...', 
        email: '', 
        displayInitial: '',
        avatarUrl: '',
    });

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

                setUserData({ 
                    name, 
                    email, 
                    displayInitial: name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : 'C'),
                    avatarUrl 
                });
            } catch {
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        const pEmail = payload.email || '';
                        const fallbackName = payload.full_name || '';
                        setUserData({
                            name: fallbackName,
                            email: pEmail,
                            displayInitial: fallbackName ? fallbackName.charAt(0).toUpperCase() : (pEmail ? pEmail.charAt(0).toUpperCase() : 'C'),
                            avatarUrl: payload.avatar_url || ''
                        });
                    } catch { }
                } else {
                    setUserData({ name: 'Ứng viên', email: 'candidate@hiregen.com', displayInitial: 'C', avatarUrl: '' });
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
            onClick: () => navigate('/candidate/profile'),
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
                            {section.items.map((item) => {
                                const isActive = item.isActive !== undefined
                                    ? item.isActive
                                    : (item.href ? location.pathname === item.href : false);
                                return (
                                    <button
                                        key={item.label}
                                        className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
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
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="topLeft" arrow>
                        <div className={`${styles.userBlockSide} ${isSidebarCollapsed ? styles.userBlockCollapsed : ''}`} style={{ cursor: 'pointer' }}>
                            <div 
                                className={styles.userAvatarSide} 
                                style={{ overflow: 'hidden', padding: 0 }}
                            >
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
                            {pageSubtitle ?? `${todayStr} · Candidate`}
                        </p>
                    </div>
                    <div className={styles.topbarRight}>
                        <button className={styles.iconBtn} onClick={() => navigate('/candidate/notifications')}>
                            <span className="material-symbols-outlined">notifications</span>
                            {notifCount > 0 && <span className={styles.notifDot} />}
                        </button>
                        {/* Các nút action tuỳ theo từng trang */}
                        {headerActions ?? (
                            <button
                                className={styles.btnPrimary}
                                onClick={() => navigate('/candidate/jobs')}
                            >
                                <span className="material-symbols-outlined">search</span>
                                Tìm việc làm
                            </button>
                        )}
                    </div>
                </header>

                <main className={styles.mainContent}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default CandidateLayout;