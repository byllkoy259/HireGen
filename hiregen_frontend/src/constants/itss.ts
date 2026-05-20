export const ITSS_LEVEL_FILTERS = [
    'Tất cả',
    'ITSS L1',
    'ITSS L2',
    'ITSS L3',
    'ITSS L4',
    'ITSS L5+',
];

export const ITSS_CATEGORIES = [
    'Business Application Development',
    'System Development',
    'Project Management',
    'IT Strategy',
    'IT Service Management',
    'Network / Infrastructure',
];

export const ALL_ITSS_CATEGORIES_LABEL = 'Tất cả nhóm ngành';

export const matchesItssLevelFilter = (jobLevel: string, filter: string) => {
    if (filter === 'Tất cả') return true;
    if (filter === 'ITSS L5+') return ['ITSS L5', 'ITSS L6', 'ITSS L7'].includes(jobLevel);

    return jobLevel === filter;
};
