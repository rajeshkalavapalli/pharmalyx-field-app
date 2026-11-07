import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';

// App language: English (default) or Telugu. The English text is the key, so untranslated text simply stays English.
// Changing the language reloads the app so every screen picks it up.

const KEY = 'pharmalyx.lang';
let current = 'en';

export const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'te', label: 'తెలుగు' },
];

export const loadLanguage = async () => {
    try {
        current = (await SecureStore.getItemAsync(KEY)) || 'en';
    } catch {
        current = 'en';
    }
    return current;
};

export const language = () => current;

export const setLanguage = async (next) => {
    await SecureStore.setItemAsync(KEY, next);
    current = next;
    try {
        await Updates.reloadAsync();
    } catch {
        // Development builds can't reload this way; the change applies on the next start.
    }
};

const TE = {
    // Tabs and menu sections
    Home: 'హోమ్',
    Doctors: 'డాక్టర్లు',
    Alerts: 'అలర్ట్స్',
    Me: 'నేను',
    'Daily Work': 'రోజువారీ పని',
    Planning: 'ప్లానింగ్',
    'Sales & Distribution': 'సేల్స్ & డిస్ట్రిబ్యూషన్',
    Expenses: 'ఖర్చులు',
    'Team & Approvals': 'టీమ్ & అప్రూవల్స్',
    Reports: 'రిపోర్ట్స్',
    Insights: 'ఇన్‌సైట్స్',
    Administration: 'అడ్మినిస్ట్రేషన్',
    More: 'ఇంకా',
    'See all': 'అన్నీ చూడండి',

    // Menu items
    'My Day': 'నా రోజు',
    Visits: 'విజిట్స్',
    'Pre-call Planning': 'ప్రీ-కాల్ ప్లానింగ్',
    'Joint Work': 'జాయింట్ వర్క్',
    'Joint Audits': 'జాయింట్ ఆడిట్స్',
    Dashboard: 'డాష్‌బోర్డ్',
    Attendance: 'హాజరు',
    Leave: 'సెలవు',
    Activity: 'యాక్టివిటీ',
    'Tour Plan': 'టూర్ ప్లాన్',
    'Standard Tour Plan': 'స్టాండర్డ్ టూర్ ప్లాన్',
    'Plan Deviation': 'ప్లాన్ మార్పు',
    'Add Doctor': 'డాక్టర్‌ను జోడించండి',
    'Doctor Requests': 'డాక్టర్ రిక్వెస్ట్స్',
    Verification: 'వెరిఫికేషన్',
    Samples: 'శాంపిల్స్',
    Gifts: 'గిఫ్ట్స్',
    'Chemist Check': 'కెమిస్ట్ చెక్',
    Feedback: 'ఫీడ్‌బ్యాక్',
    'Doctor Business': 'డాక్టర్ బిజినెస్',
    Orders: 'ఆర్డర్లు',
    Stock: 'స్టాక్',
    Stockists: 'స్టాకిస్ట్‌లు',
    Retailers: 'రిటైలర్లు',
    'Secondary Sales': 'సెకండరీ సేల్స్',
    Claims: 'క్లెయిమ్స్',
    Approvals: 'అప్రూవల్స్',
    'Field Truth': 'ఫీల్డ్ ట్రూత్',
    'Verified Work': 'వెరిఫైడ్ వర్క్',
    'Missed Visits': 'మిస్ అయిన విజిట్స్',

    // My Day
    'Start my day': 'నా రోజు ప్రారంభించండి',
    "Today's plan": 'ఈ రోజు ప్లాన్',
    'Also due in your territory': 'మీ టెరిటరీలో ఇంకా కలవాల్సిన డాక్టర్లు',
    'No approval needed to visit them.': 'వీరిని కలవడానికి అనుమతి అవసరం లేదు.',
    "Today's visits": 'ఈ రోజు విజిట్స్',
    'No visits yet today': 'ఈ రోజు ఇంకా విజిట్స్ లేవు',
    'Check in': 'చెక్ ఇన్',
    'Add doctor': 'డాక్టర్ జోడించు',
    'Add a doctor': 'డాక్టర్‌ను జోడించండి',
    'New order': 'కొత్త ఆర్డర్',
    'Ordered by when each doctor is usually available.': 'డాక్టర్ సాధారణంగా అందుబాటులో ఉండే సమయం ప్రకారం.',
    'Nearest clinic first, from where you are now.': 'మీరు ఉన్న చోటు నుండి దగ్గరి క్లినిక్ ముందు.',
    'Usual time': 'సాధారణ సమయం',
    'Nearest first': 'దగ్గరివి ముందు',
    'No tour plan for today': 'ఈ రోజుకు టూర్ ప్లాన్ లేదు',
    'Nobody due in this patch today': 'ఈ ఏరియాలో ఈ రోజు ఎవరూ లేరు',
    'Next step': 'తదుపరి అడుగు',
    "Today's DA": 'ఈ రోజు DA',
    'DA earned for today': 'ఈ రోజు DA వచ్చింది',
    'Clinic not pinned': 'క్లినిక్ లొకేషన్ సేవ్ కాలేదు',
    'Show fewer': 'తక్కువ చూపించు',
    'Start your day first, then check in at each clinic.': 'ముందు మీ రోజు ప్రారంభించండి, తర్వాత ప్రతి క్లినిక్ వద్ద చెక్ ఇన్ చేయండి.',
    'I agree': 'నేను అంగీకరిస్తున్నాను',

    // Visit
    'How did it go?': 'విజిట్ ఎలా జరిగింది?',
    Positive: 'బాగుంది',
    Neutral: 'పర్వాలేదు',
    Negative: 'బాగాలేదు',
    'Samples & gifts given': 'ఇచ్చిన శాంపిల్స్ & గిఫ్ట్స్',
    'Notes (optional)': 'నోట్స్ (ఐచ్ఛికం)',
    'Save visit': 'విజిట్ సేవ్ చేయండి',
    'Saving…': 'సేవ్ అవుతోంది…',
    'Checking you in at the clinic…': 'క్లినిక్ వద్ద చెక్ ఇన్ చేస్తున్నాం…',
    'At the clinic for': 'క్లినిక్ వద్ద ఉన్న సమయం',
    'Visit saved': 'విజిట్ సేవ్ అయింది',
    'Back to My Day': 'నా రోజుకి తిరిగి',
    'Same as last visit': 'గత విజిట్ లాగే',
    'Try again': 'మళ్ళీ ప్రయత్నించండి',

    // Me
    'Attendance today': 'ఈ రోజు హాజరు',
    'My Field Truth Score': 'నా ఫీల్డ్ ట్రూత్ స్కోర్',
    'Sign out': 'సైన్ అవుట్',
    Language: 'భాష',
    'This month': 'ఈ నెల',
    'At the clinic': 'క్లినిక్ వద్ద',
    'Visit pattern': 'విజిట్ పద్ధతి',
    Audits: 'ఆడిట్స్',
    Prescriptions: 'ప్రిస్క్రిప్షన్స్',

    // Chemist check
    'Product availability': 'ప్రోడక్ట్ లభ్యత',
    Chemist: 'కెమిస్ట్',
};

export const t = (text) => (current === 'te' && TE[text]) || text;
