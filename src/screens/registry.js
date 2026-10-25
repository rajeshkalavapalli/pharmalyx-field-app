// Every screen the app can open from the menu or another screen (stack screens), by route name.
// Menu items appear only for screens listed here (plus the tab screens in TAB_SCREENS).
import AddDoctor from './AddDoctor';
import Approvals from './Approvals';
import Allowance from './Allowance';
import ApplyLeave from './ApplyLeave';
import DoctorChange from './DoctorChange';
import DoctorDetail from './DoctorDetail';
import DoctorRequests from './DoctorRequests';
import Doctors from './Doctors';
import NewOrder from './NewOrder';
import Orders from './Orders';
import RequestDetail from './RequestDetail';
import VerificationDetail from './VerificationDetail';
import VerifyDoctor from './VerifyDoctor';
import Dcr from './Dcr';
import DcrDay from './DcrDay';
import Deviations from './Deviations';
import PreCall from './PreCall';
import Stp from './Stp';
import TourPlan from './TourPlan';
import VerifiedWork from './VerifiedWork';
import VisitDetail from './VisitDetail';
import Visits from './Visits';
import Accounts from './Accounts';
import DoctorBusiness from './DoctorBusiness';
import DoctorSpend from './DoctorSpend';
import Feedback from './Feedback';
import FieldLedger from './FieldLedger';
import Rcpa from './Rcpa';
import Secondary from './Secondary';
import Stock from './Stock';
import SupplyReports from './SupplyReports';
import { BusinessData, BusinessTracker } from './Business';
import { SalesBusiness, StockPosition } from './SalesScreens';
import Claims, { ClaimDetail, DayReport, Payments, RateCard } from './Claims';
import { Attendance, Leave, Activity, Appraisals } from './HR';
import { Report, Insights, InsightRules } from './Analytics';
import { DoctorPlan, SalesPlan } from './Planning';
import { Configuration, DataImport, Mapping, MasterList, Roles } from './Admin';
import Alerts from './Alerts';
import CheckIn from './CheckIn';
import Dashboard from './Dashboard';
import Menu, { MenuSection } from './Menu';
import MyDay from './MyDay';
import Visit from './Visit';

export const STACK_SCREENS = {
    Visit,
    Today: MyDay,
    Approvals,
    Dashboard,
    MenuSection,
    CheckIn,
    AddDoctor,
    NewOrder,
    ApplyLeave,
    DoctorDetail,
    DoctorChange,
    DoctorRequests,
    RequestDetail,
    VerifyDoctor,
    VerificationDetail,
    Orders,
    Allowance,
    Configuration,
    DataImport,
    Mapping,
    MasterList,
    Roles,
    Attendance,
    Leave,
    Activity,
    Appraisals,
    Report,
    Insights,
    InsightRules,
    DoctorPlan,
    SalesPlan,
    Claims,
    ClaimDetail,
    DayReport,
    Payments,
    RateCard,
    Accounts,
    DoctorBusiness,
    DoctorSpend,
    Feedback,
    FieldLedger,
    Rcpa,
    Secondary,
    Stock,
    SupplyReports,
    BusinessData,
    BusinessTracker,
    SalesBusiness,
    StockPosition,
    Dcr,
    DcrDay,
    Deviations,
    PreCall,
    Stp,
    TourPlan,
    VerifiedWork,
    VisitDetail,
    Visits,
};

// Bottom tabs (Home grid, Doctors, Alerts, Me); the center Check in button opens the CheckIn screen.
export const TAB_COMPONENTS = { Home: Menu, Doctors, Alerts };

export const TAB_SCREENS = ['Home', 'Doctors', 'Alerts', 'Me'];

export const BUILT = new Set([...Object.keys(STACK_SCREENS), ...TAB_SCREENS]);
