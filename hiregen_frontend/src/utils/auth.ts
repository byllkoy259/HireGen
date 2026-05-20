export type UserRole = 'Candidate' | 'HR' | 'Admin';

interface TokenPayload {
    exp?: number;
    email?: string;
    name?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
}

export const getTokenPayload = (): TokenPayload | null => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
};

export const isTokenValid = () => {
    const payload = getTokenPayload();
    if (!payload?.exp) return false;

    return payload.exp * 1000 > Date.now();
};

export const clearSession = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
};

export const getStoredRole = (): UserRole | null => {
    const role = localStorage.getItem('user_role') || getTokenPayload()?.role || '';
    if (role === 'HR' || role === 'Admin' || role === 'Candidate') return role;

    return null;
};

export const getDashboardPath = (role = getStoredRole()) => {
    if (role === 'HR') return '/hr';
    if (role === 'Admin') return '/admin';

    return '/candidate';
};

export const getValidDashboardPath = () => {
    if (!isTokenValid()) return null;

    return getDashboardPath();
};
