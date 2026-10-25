// Doctor request / verification labels (same words and codes as the web app).

export const REQUEST_TYPE = {
    CREATE: { label: 'New doctor', tone: 'primary' },
    EDIT: { label: 'Edit', tone: 'info' },
    DELETE: { label: 'Remove', tone: 'error' },
};

export const REQUEST_STATUS = {
    PENDING: { label: 'Waiting for manager', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    REJECTED: { label: 'Rejected', tone: 'error' },
    CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const DUPLICATE_REASON = {
    REGISTRATION_NO: 'Same registration no.',
    PHONE: 'Same phone number',
    NAME_NEARBY: 'Similar name nearby',
    SAME_SPOT: 'Same GPS spot, other area',
};

export const WARNING_LABEL = {
    WEAK_GPS: 'Weak GPS when the clinic was pinned',
    CLINIC_MOVED: 'Clinic location changed',
    NO_SIGNBOARD_PHOTO: 'No signboard photo',
};

export const FIELD_LABEL = {
    DoctorName: 'Name',
    Qualification: 'Qualification',
    Speciality: 'Speciality',
    HospitalName: 'Clinic / hospital',
    MobileNumber: 'Phone',
    EmailId: 'Email',
    RegistrationNumber: 'Registration no.',
    Category: 'Category',
    VisitsPerMonth: 'Visits / month',
    TerritoryId: 'Territory',
    AreaId: 'Area',
    ClinicLatitude: 'Clinic latitude',
    ClinicLongitude: 'Clinic longitude',
    ClinicGpsAccuracy: 'GPS accuracy (m)',
    CountryId: 'Country',
    StateId: 'State',
    DateOfBirth: 'Date of birth',
    AnniversaryDate: 'Anniversary',
    IsActive: 'Active',
};

export const VERIFY_METHOD = {
    REGISTRATION_NO: 'Registration no.',
    PHONE: 'Phone',
    DOCUMENT: 'Pad / card photo',
    JOINT_VISIT: 'Joint visit',
};

export const VERIFY_STATUS = {
    PENDING: { label: 'Waiting for manager', tone: 'warning' },
    ACCEPTED: { label: 'Accepted', tone: 'success' },
    REJECTED: { label: 'Rejected', tone: 'error' },
};

export const VERIFICATION_STATE = {
    VERIFIED: { label: 'Verified', tone: 'success' },
    PROVISIONAL: { label: 'Not verified yet', tone: 'warning' },
};

// "12 days left" / "Due today" / "5 days overdue".
export const deadlineLabel = (daysLeft) => {
    if (daysLeft == null) return { label: 'No deadline', tone: 'neutral' };
    if (daysLeft < 0) return { label: `${-daysLeft} day(s) overdue`, tone: 'error' };
    if (daysLeft === 0) return { label: 'Due today', tone: 'error' };
    return { label: `${daysLeft} day(s) left`, tone: daysLeft <= 7 ? 'warning' : 'info' };
};

export const describeReason = (reason) => {
    const parts = [DUPLICATE_REASON[reason.reason] || reason.reason];
    if (reason.score != null) parts.push(`${Math.round(reason.score * 100)}% name match`);
    if (reason.distanceM != null) parts.push(reason.distanceM >= 1000 ? `${(reason.distanceM / 1000).toFixed(1)} km apart` : `${reason.distanceM} m apart`);
    return parts.join(' · ');
};

export const shortDate = (value) => (value ? new Date(String(value).length <= 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
