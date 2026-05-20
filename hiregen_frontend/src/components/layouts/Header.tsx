import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import Logo from '../common/Logo';
import axiosClient from '../../services/axiosClient';
import {
    clearSession,
    getDashboardPath,
    getStoredRole,
    getTokenPayload,
    getValidDashboardPath,
    isTokenValid,
} from '../../utils/auth';

import styles from './Header.module.css';

const Header: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        avatarUrl: '',
        displayInitial: 'U',
    });

    const isActive = (path: string) => {
        return location.pathname === path ? styles.activeLink : '';
    };

    useEffect(() => {
        const loadUser = async () => {
            if (!isTokenValid()) {
                clearSession();
                setIsAuthenticated(false);
                return;
            }

            setIsAuthenticated(true);

            try {
                const res = await axiosClient.get('/api/auth/me');
                const email = res.data.email || '';
                const nameFromEmail = email ? email.split('@')[0] : 'Người dùng';
                const name = res.data.full_name || res.data.username || res.data.name || nameFromEmail;
                const avatarUrl = res.data.avatar_url || res.data.profile?.avatar_url || '';

                setUserData({
                    name,
                    email,
                    avatarUrl,
                    displayInitial: name ? name.charAt(0).toUpperCase() : 'U',
                });
            } catch {
                const payload = getTokenPayload();
                const email = payload?.email || '';
                const name = payload?.full_name || payload?.name || payload?.username || email.split('@')[0] || 'Người dùng';

                setUserData({
                    name,
                    email,
                    avatarUrl: payload?.avatar_url || '',
                    displayInitial: name ? name.charAt(0).toUpperCase() : 'U',
                });
            }
        };

        loadUser();
    }, [location.pathname]);

    const navigateAuthAware = (path: string) => {
        const dashboardPath = getValidDashboardPath();
        navigate(dashboardPath || path);
    };

    const handleLogout = () => {
        clearSession();
        setIsAuthenticated(false);
        navigate('/login');
    };

    const userMenu: MenuProps['items'] = [
        {
            key: 'dashboard',
            label: 'Dashboard',
            icon: <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>,
            onClick: () => navigate(getDashboardPath(getStoredRole())),
        },
        { type: 'divider' },
        {
            key: 'logout',
            label: <span style={{ color: '#dc2626', fontWeight: 600 }}>Đăng xuất</span>,
            icon: <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 18 }}>logout</span>,
            onClick: handleLogout,
        },
    ];

    return (
        <nav className={styles.navbar}>
            <div className={styles.navContainer}>
                <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <Logo size="sm" variant="dark" />
                </div>

                <div className={styles.navLinks}>
                    <a
                        onClick={() => navigate('/')}
                        className={isActive('/')}
                        style={{ cursor: 'pointer' }}
                    >
                        Trang chủ
                    </a>

                    <a
                        onClick={() => navigate('/jobs')}
                        className={isActive('/jobs')}
                        style={{ cursor: 'pointer' }}
                    >
                        Việc làm
                    </a>

                    <a
                        onClick={() => navigate('/guide')}
                        className={isActive('/guide')}
                        style={{ cursor: 'pointer' }}
                    >
                        Cẩm nang IT Nhật
                    </a>
                </div>

                <div className={styles.navActions}>
                    {isAuthenticated ? (
                        <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight" arrow>
                            <button type="button" className={styles.userTrigger}>
                                <span className={styles.userAvatar}>
                                    {userData.avatarUrl ? (
                                        <img src={userData.avatarUrl} alt={userData.name} />
                                    ) : (
                                        userData.displayInitial
                                    )}
                                </span>
                                <span className={styles.userName}>{userData.name}</span>
                                <span className="material-symbols-outlined">expand_more</span>
                            </button>
                        </Dropdown>
                    ) : (
                        <>
                            <Button
                                className={styles.btnOutline}
                                onClick={() => navigateAuthAware('/register')}
                            >
                                Đăng ký
                            </Button>

                            <Button
                                type="primary"
                                className={styles.btnPrimary}
                                onClick={() => navigateAuthAware('/login')}
                            >
                                Đăng nhập
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Header;
