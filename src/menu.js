// The app menu for the Home grid. Same screens and permission codes as the web sidebar
// (pharmalyx-ui/src/screen/naviagation/Navigation.js); an item shows when the role holds at least one
// of its codes (no codes = everyone) and its screen is built. `badge` names a count from attention.js.

const APPROVALS = ['tourplan.approve', 'deviation.approve', 'dcr.approve', 'leave.approve', 'doctorrequests.approve', 'secondary.approve', 'doctorplan.approve', 'expenses.approve', 'expensefinance.approve', 'stp.approve'];
export const APPROVAL_PERMISSIONS = APPROVALS;

// tone: the soft tile tint of the section (theme `tileTones`).
export const SECTIONS = [
    {
        title: 'Daily Work',
        tone: 'teal',
        items: [
            { label: 'My Day', icon: 'sun', screen: 'Today', permission: ['verifiedwork.view', 'visits.create'] },
            { label: 'Visits', icon: 'map-pin', screen: 'Visits', permission: ['visits.view'] },
            { label: 'DCR', icon: 'file-text', screen: 'Dcr', permission: ['dcr.view'] },
            { label: 'Pre-call Planning', icon: 'clipboard', screen: 'PreCall', permission: ['visits.create'] },
            { label: 'Dashboard', icon: 'bar-chart-2', screen: 'Dashboard' },
            { label: 'Attendance', icon: 'clock', screen: 'Attendance', permission: ['attendance.view'] },
            { label: 'Leave', icon: 'sunset', screen: 'Leave', permission: ['leave.view'] },
            { label: 'Activity', icon: 'activity', screen: 'Activity', permission: ['activity.view'] },
        ],
    },
    {
        title: 'Planning',
        tone: 'blue',
        items: [
            { label: 'Tour Plan', icon: 'calendar', screen: 'TourPlan', permission: ['tourplan.view'], badge: 'TourPlan' },
            { label: 'Standard Tour Plan', icon: 'repeat', screen: 'Stp', permission: ['stp.view'] },
            { label: 'Plan Deviation', icon: 'shuffle', screen: 'Deviations', permission: ['deviation.view'] },
            { label: 'Doctor Business Plan', icon: 'target', screen: 'DoctorPlan', permission: ['doctorplan.view'] },
            { label: 'Sales Plan', icon: 'flag', screen: 'SalesPlan', permission: ['salesplan.view'] },
        ],
    },
    {
        title: 'Doctors',
        tone: 'purple',
        items: [
            { label: 'Doctors', icon: 'users', screen: 'Doctors', permission: ['doctors.view', 'masters.view'] },
            { label: 'Doctor Requests', icon: 'user-check', screen: 'DoctorRequests', permission: ['doctorrequests.create', 'doctorrequests.approve'], badge: 'DoctorRequests' },
            { label: 'Add Doctor', icon: 'user-plus', screen: 'AddDoctor', permission: ['doctorrequests.create'] },
            { label: 'Verification', icon: 'shield', screen: 'DoctorRequests', params: { tab: 'verification' }, permission: ['doctorrequests.create', 'doctorrequests.approve'], badge: 'Verification' },
            { label: 'RCPA', icon: 'percent', screen: 'Rcpa', permission: ['rcpa.view'] },
            { label: 'Samples', icon: 'package', screen: 'Stock', params: { kind: 'SAMPLE' }, permission: ['stock.view'] },
            { label: 'Gifts', icon: 'gift', screen: 'Stock', params: { kind: 'GIFT' }, permission: ['stock.view'] },
            { label: 'Feedback', icon: 'message-circle', screen: 'Feedback', permission: ['feedback.view'] },
            { label: 'Doctor Business', icon: 'trending-up', screen: 'DoctorBusiness', permission: ['doctors.view'] },
            { label: 'Doctor Spend', icon: 'dollar-sign', screen: 'DoctorSpend', permission: ['spend.view'] },
        ],
    },
    {
        title: 'Expenses',
        tone: 'orange',
        items: [
            { label: 'TA / DA', icon: 'credit-card', screen: 'Allowance', permission: ['expenses.view'], badge: 'Allowance' },
            { label: 'Claims', icon: 'file-plus', screen: 'Claims', permission: ['expenses.view'] },
            { label: 'Orders', icon: 'shopping-bag', screen: 'Orders', permission: ['orders.view'] },
            { label: 'Payments', icon: 'check-square', screen: 'Payments', permission: ['expensefinance.view'] },
            { label: 'Rate Card', icon: 'sliders', screen: 'RateCard', permission: ['expenserates.view'] },
        ],
    },
    {
        title: 'Sales & Distribution',
        tone: 'green',
        items: [
            { label: 'Retailers', icon: 'home', screen: 'Accounts', params: { kind: 'retailers' }, permission: ['retailers.view'] },
            { label: 'Stockists', icon: 'truck', screen: 'Accounts', params: { kind: 'stockists' }, permission: ['stockists.view'] },
            { label: 'Stock', icon: 'archive', screen: 'StockPosition', permission: ['inventory.view'] },
            { label: 'Secondary Sales', icon: 'bar-chart', screen: 'Secondary', permission: ['secondary.view'] },
            { label: 'Business', icon: 'briefcase', screen: 'SalesBusiness', permission: ['salesbusiness.view'] },
            { label: 'Business Tracker', icon: 'activity', screen: 'BusinessTracker', permission: ['business.view'] },
            { label: 'Business Data', icon: 'database', screen: 'BusinessData', permission: ['business.approve'] },
            { label: 'Field Stock & Dues', icon: 'book', screen: 'FieldLedger', permission: ['ledger.view'] },
            { label: 'Supply & Spend Reports', icon: 'pie-chart', screen: 'SupplyReports', permission: ['ledger.view'] },
        ],
    },
    {
        title: 'Team & Approvals',
        tone: 'teal',
        items: [
            { label: 'Approvals', icon: 'inbox', screen: 'Approvals', permission: APPROVALS, badge: 'Approvals' },
            { label: 'Verified Work', icon: 'shield', screen: 'VerifiedWork', permission: ['verifiedwork.view'] },
            { label: 'Appraisals', icon: 'award', screen: 'Appraisals', permission: ['appraisal.view'] },
        ],
    },
    {
        title: 'Reports',
        tone: 'blue',
        items: [
            { label: 'MIS Reports', icon: 'grid', screen: 'Report', params: { report: 'mis' }, permission: ['misreport.view'] },
            { label: 'Call Reports', icon: 'phone-call', screen: 'Report', params: { report: 'calls' }, permission: ['callreport.view'] },
            { label: 'Coverage', icon: 'crosshair', screen: 'Report', params: { report: 'coverage' }, permission: ['coveragereport.view'] },
            { label: 'KPI', icon: 'trending-up', screen: 'Report', params: { report: 'kpi' }, permission: ['kpireport.view'] },
            { label: 'Missed Visits', icon: 'user-x', screen: 'Report', params: { report: 'missed-visits' }, permission: ['missedreport.view'] },
            { label: 'POB Reports', icon: 'shopping-cart', screen: 'Report', params: { report: 'pob' }, permission: ['pobreport.view'] },
            { label: 'Sales Reports', icon: 'dollar-sign', screen: 'Report', params: { report: 'sales' }, permission: ['salesreport.view'] },
            { label: 'Graphical Reports', icon: 'bar-chart-2', screen: 'Report', params: { report: 'graphical' }, permission: ['graphreport.view'] },
        ],
    },
    {
        title: 'Insights',
        tone: 'purple',
        items: [
            { label: 'Performance', icon: 'zap', screen: 'Insights', params: { section: 'performance' }, permission: ['performanceinsights.view'] },
            { label: 'Field Intelligence', icon: 'compass', screen: 'Insights', params: { section: 'field' }, permission: ['fieldintel.view'] },
            { label: 'Risk & Alerts', icon: 'alert-triangle', screen: 'Insights', params: { section: 'alerts' }, permission: ['alerts.view'] },
            { label: 'Advanced Analytics', icon: 'cpu', screen: 'Insights', params: { section: 'analytics' }, permission: ['analytics.view'] },
            { label: 'Insight Rules', icon: 'tool', screen: 'InsightRules', permission: ['insightrules.view'] },
        ],
    },
    {
        title: 'Administration',
        tone: 'orange',
        items: [
            { label: 'Users', icon: 'user', screen: 'MasterList', params: { kind: 'users' }, permission: ['configuration.view'] },
            { label: 'Roles & Permissions', icon: 'lock', screen: 'Roles', permission: ['roles.view'] },
            { label: 'Configuration', icon: 'settings', screen: 'Configuration', permission: ['configuration.view'] },
            { label: 'Data Import', icon: 'upload', screen: 'DataImport', permission: ['dataimport.view'] },
        ],
    },
];

// The sections one person sees (only items their role allows and the app has built).
export const visibleSections = (permissions, built) =>
    SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => built.has(item.screen) && (!item.permission || permissions.any(item.permission))),
    })).filter((section) => section.items.length);
