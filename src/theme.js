// Pharmalyx "Ink & Jade · Vivid" design tokens for the field app (same brand as the web app).
// Every colour, size and radius used by the screens comes from here.

export const colors = {
    ink: '#0A1628',
    inkSoft: '#1C2B42',
    inkMuted: '#4B5768',
    inkFaint: '#97A1AE',

    jade: '#0F766E',
    jadeDark: '#0B5C56',
    jadeBright: '#0D9488',
    jadeLively: '#14B8A6',
    jadeGlow: '#2DD4BF',
    jadeMist: '#E7F4F2',
    jadeWash: '#F2F9F8',

    bg: '#F3F6F9',
    paper: '#FFFFFF',
    line: '#E2E8F0',
    lineSoft: '#EDF1F5',
    lineStrong: '#CBD5E1',

    success: '#16A34A',
    successDark: '#15803D',
    successSoft: '#DCFCE7',
    warning: '#D97706',
    warningDark: '#B45309',
    warningSoft: '#FEF3C7',
    error: '#DC2626',
    errorDark: '#B91C1C',
    errorSoft: '#FEE2E2',
    info: '#2563EB',
    infoDark: '#1D4ED8',
    infoSoft: '#DBEAFE',
    white: '#FFFFFF',
};

export const gradients = {
    brand: [colors.jade, colors.jadeBright, colors.jadeLively],
    ink: [colors.inkSoft, colors.ink],
    success: [colors.success, '#4ADE80'],
    warning: [colors.warning, '#FBBF24'],
    info: [colors.info, '#60A5FA'],
    error: [colors.error, '#F87171'],
};

export const fonts = {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    heavy: 'PlusJakartaSans_800ExtraBold',
    display: 'Fraunces_600SemiBold',
};

export const space = (n) => n * 8;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const text = {
    display: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.4 },
    title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: colors.ink },
    subtitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
    small: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
    overline: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.jade },
    metric: { fontFamily: fonts.heavy, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.5 },
};

export const shadow = {
    card: { shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    glow: { shadowColor: colors.jadeBright, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
};

// Soft tile tints for the Home grid sections (icon colour on a light background).
export const tileTones = {
    teal: { bg: '#E3F5F2', fg: '#0F766E' },
    blue: { bg: '#E6EEFD', fg: '#2563EB' },
    orange: { bg: '#FDEFE3', fg: '#C2410C' },
    purple: { bg: '#F0EAFD', fg: '#7C3AED' },
    green: { bg: '#E5F6EA', fg: '#15803D' },
};

// Tag colours by meaning.
export const tones = {
    success: { bg: colors.successSoft, fg: colors.successDark },
    warning: { bg: colors.warningSoft, fg: colors.warningDark },
    error: { bg: colors.errorSoft, fg: colors.errorDark },
    info: { bg: colors.infoSoft, fg: colors.infoDark },
    primary: { bg: colors.jadeMist, fg: colors.jadeDark },
    neutral: { bg: colors.lineSoft, fg: colors.inkSoft },
};
