import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, uploadImage } from '../api';
import { doctorName, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, MultiSelect, Notice, Screen, SectionTitle, Select, StatGrid, Tag } from '../ui';

const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
// Old master endpoints answer with either an array or { something: [...] }.
const pickArray = (data) => (Array.isArray(data) ? data : Object.values(data || {}).find(Array.isArray) || []);
const lower = (v) => String(v || '').toLowerCase();
const yes = (v) => v === true || v === 1 || v === 'Yes' || v === 'yes';

// Lookups used by several forms.
function useLookups(need) {
    const divisions = useLoad(async () => (need.includes('divisions') ? pickArray((await api.get('/app/get-divisions')).data) : []), [], '');
    const territories = useLoad(async () => (need.includes('territories') ? pickArray((await api.get('/app/get-territories')).data) : []), [], '');
    const countries = useLoad(async () => (need.includes('countries') ? pickArray((await api.get('/app/getcountries')).data) : []), [], '');
    const designations = useLoad(async () => (need.includes('designations') ? pickArray((await api.get('/app/designation')).data) : []), [], '');
    const users = useLoad(async () => (need.includes('users') ? pickArray((await api.get('/app/get-users')).data) : []), [], '');
    return { divisions: divisions.data || [], territories: territories.data || [], countries: countries.data || [], designations: designations.data || [], users: users.data || [] };
}

function useStates(countryId) {
    const s = useLoad(async () => (countryId ? pickArray((await api.get(`/app/get-States/${countryId}`)).data) : []), [countryId], '');
    return s.data || [];
}
function useAreas(territoryId) {
    const s = useLoad(async () => (territoryId ? pickArray((await api.get(`/app/get-areas-by-territory/${territoryId}`)).data) : []), [territoryId], '');
    return s.data || [];
}

const nameOfUser = (u) => titleCase([u.FirstName, u.LastName].filter(Boolean).join(' ') || u.UserName);
const CATEGORIES = [
    { value: '', label: 'Not set' },
    { value: 'A', label: 'Class A' },
    { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' },
];

// =========================================================
// MASTER DEFINITIONS (same endpoints and fields as the web Configuration screens)
// =========================================================

const MASTERS = {
    divisions: {
        title: 'Divisions',
        icon: 'layers',
        list: '/app/get-divisions',
        id: 'DivisionId',
        name: (r) => r.DivisionName,
        caption: (r) => r.Description,
        create: (v) => api.post('/app/create-division', v),
        update: (id, v) => api.put(`/app/update-division/${id}`, v),
        remove: (id) => api.delete(`/app/delete-division/${id}`),
        fields: [
            { key: 'DivisionName', label: 'Division name', required: true },
            { key: 'Description', label: 'Description', multiline: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true },
        ],
    },
    territories: {
        title: 'Territories',
        icon: 'map',
        list: '/app/get-territories',
        id: 'TerritoryId',
        name: (r) => r.TerritoryName,
        caption: (r) => [r.StateName, r.CountryName].filter(Boolean).join(', '),
        create: (v) => api.post('/app/create-Territory', v),
        update: (id, v) => api.put(`/app/update-territory/${id}`, v),
        remove: (id) => api.delete(`/app/delete-territory/${id}`),
        needs: ['countries'],
        fields: [
            { key: 'TerritoryName', label: 'Territory name', required: true },
            { key: 'CountryId', label: 'Country', type: 'country', required: true },
            { key: 'StateId', label: 'State', type: 'state', required: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true },
        ],
    },
    areas: {
        title: 'Areas',
        icon: 'map-pin',
        list: '/app/get-areas-code',
        id: 'AreaId',
        name: (r) => r.AreaName,
        caption: (r) => [r.AreaCode, r.TerritoryName].filter(Boolean).join(' · '),
        create: async (v) => {
            const preview = await api.get(`/app/preview-area-code/${v.TerritoryId}/${encodeURIComponent(v.AreaName)}`).catch(() => null);
            const code = preview?.data?.AreaCode || preview?.data?.areaCode || preview?.data?.code;
            return api.post('/app/create-Area', { ...v, AreaCode: v.AreaCode || code });
        },
        update: (id, v) => api.put(`/app/update-area/${id}`, v),
        remove: (id) => api.delete(`/app/delete-area/${id}`),
        needs: ['territories'],
        fields: [
            { key: 'TerritoryId', label: 'Territory', type: 'territory', required: true },
            { key: 'AreaName', label: 'Area name', required: true },
            { key: 'AreaCode', label: 'Area code (blank = automatic)' },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true },
        ],
    },
    pharmacies: {
        title: 'Pharmacies',
        icon: 'home',
        list: '/app/get-Pharmacies',
        id: 'PharmacyId',
        name: (r) => r.PharmacyName,
        caption: (r) => [r.OwnerName, r.AreaName, r.ContactNumber].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/create-Pharmacy', v),
        update: (id, v) => api.put(`/app/update-Pharmacy/${id}`, v),
        remove: (id) => api.delete(`/app/delete-Pharmacy/${id}`),
        needs: ['countries', 'territories'],
        fields: [
            { key: 'PharmacyName', label: 'Pharmacy name', required: true },
            { key: 'OwnerName', label: 'Owner' },
            { key: 'ContactNumber', label: 'Phone', keyboardType: 'phone-pad' },
            { key: 'EmailId', label: 'Email', keyboardType: 'email-address' },
            { key: 'DrugLicenceNumber', label: 'Drug licence no.' },
            { key: 'GSTIN', label: 'GSTIN' },
            { key: 'CountryId', label: 'Country', type: 'country' },
            { key: 'StateId', label: 'State', type: 'state' },
            { key: 'TerritoryId', label: 'Territory', type: 'territory', required: true },
            { key: 'AreaId', label: 'Area', type: 'area', required: true },
            { key: 'Address', label: 'Address', multiline: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true, yesNo: true },
        ],
    },
    stockists: {
        title: 'Stockists & retailers',
        icon: 'truck',
        list: '/app/get-stockists',
        id: 'StockistId',
        name: (r) => r.StockistName,
        caption: (r) => [r.OwnerName, r.AreaName, r.ContactNumber].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/create-stockist', v),
        update: (id, v) => api.put(`/app/update-stockist/${id}`, v),
        remove: (id) => api.delete(`/app/delete-stockist/${id}`),
        needs: ['countries', 'territories'],
        fields: [
            { key: 'StockistName', label: 'Name', required: true },
            { key: 'OwnerName', label: 'Owner' },
            { key: 'ContactNumber', label: 'Phone', keyboardType: 'phone-pad' },
            { key: 'EmailId', label: 'Email', keyboardType: 'email-address' },
            { key: 'DrugLicenceNumber', label: 'Drug licence no.' },
            { key: 'GSTIN', label: 'GSTIN' },
            { key: 'CountryId', label: 'Country', type: 'country' },
            { key: 'StateId', label: 'State', type: 'state' },
            { key: 'TerritoryId', label: 'Territory', type: 'territory', required: true },
            { key: 'AreaId', label: 'Area', type: 'area' },
            { key: 'Address', label: 'Address', multiline: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true, yesNo: true },
        ],
    },
    doctors: {
        title: 'Doctors',
        icon: 'users',
        list: '/app/get-doctors',
        id: 'DoctorId',
        name: (r) => doctorName(r.DoctorName),
        caption: (r) => [r.Speciality, r.AreaName, r.Category && `Class ${r.Category}`, r.ApprovalStatus && r.ApprovalStatus !== 'APPROVED' && r.ApprovalStatus].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/create-doctor', v),
        update: (id, v) => api.put(`/app/update-doctor/${id}`, v),
        remove: (id) => api.delete(`/app/delete-doctor/${id}`),
        needs: ['countries', 'territories'],
        fields: [
            { key: 'DoctorName', label: 'Doctor name', required: true },
            { key: 'Speciality', label: 'Speciality', required: true },
            { key: 'Qualification', label: 'Qualification' },
            { key: 'HospitalName', label: 'Clinic / hospital' },
            { key: 'ClinicAddress', label: 'Clinic address', multiline: true },
            { key: 'MobileNumber', label: 'Phone', keyboardType: 'phone-pad' },
            { key: 'EmailId', label: 'Email', keyboardType: 'email-address' },
            { key: 'Category', label: 'Category', type: 'chips', options: CATEGORIES },
            { key: 'VisitsPerMonth', label: 'Visits / month', keyboardType: 'number-pad', number: true },
            { key: 'CountryId', label: 'Country', type: 'country' },
            { key: 'StateId', label: 'State', type: 'state' },
            { key: 'TerritoryId', label: 'Territory', type: 'territory', required: true, upper: true },
            { key: 'AreaId', label: 'Area', type: 'area', required: true, upper: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true, yesNo: true },
        ],
    },
    users: {
        title: 'Users',
        icon: 'user',
        list: '/app/get-users',
        id: 'UserId',
        name: nameOfUser,
        caption: (r) => [r.UserName, r.EmailId, r.ManagerName && `reports to ${titleCase(r.ManagerName)}`].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/create-user', v),
        update: (id, v) => api.put('/app/update-user', { UserId: id, ...v }),
        remove: (id) => api.delete(`/app/delete-user/${id}`),
        needs: ['countries', 'territories', 'divisions', 'designations', 'users'],
        fields: [
            { key: 'UserName', label: 'Username', required: true },
            { key: 'FirstName', label: 'First name' },
            { key: 'LastName', label: 'Last name' },
            { key: 'EmailId', label: 'Email', keyboardType: 'email-address' },
            { key: 'CountryCode', label: 'Country code', default: '+91' },
            { key: 'MobileNumber', label: 'Mobile', keyboardType: 'phone-pad' },
            { key: 'password', label: 'Password (new users; blank keeps the current one)', secure: true },
            { key: 'DesignationId', label: 'Designation', type: 'designation' },
            { key: 'DivisionId', label: 'Division', type: 'division', required: true },
            { key: 'ManagerId', label: 'Reporting manager', type: 'manager' },
            { key: 'CountryId', label: 'Country', type: 'country' },
            { key: 'StateIds', label: 'States', type: 'states', required: true },
            { key: 'TerritoryIds', label: 'Territories', type: 'territories', required: true },
        ],
    },
    products: {
        title: 'Products',
        icon: 'package',
        list: '/app/catalogue/products',
        id: 'ProductId',
        name: (r) => r.ProductName,
        caption: (r) => [r.PackSize, r.UnitPrice != null && `₹${r.UnitPrice}`, r.Therapy, !yes(r.IsActive) && 'inactive'].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/catalogue/products', v),
        update: (id, v) => api.put(`/app/catalogue/products/${id}`, v),
        fields: [
            { key: 'ProductName', label: 'Product name', required: true },
            { key: 'Composition', label: 'Composition' },
            { key: 'Therapy', label: 'Therapy area' },
            { key: 'PackSize', label: 'Pack size' },
            { key: 'UnitPrice', label: 'Unit price (₹)', keyboardType: 'decimal-pad', number: true },
            { key: 'IsSample', label: 'Also a sample', type: 'switch' },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true },
        ],
    },
    gifts: {
        title: 'Gifts',
        icon: 'gift',
        list: '/app/catalogue/gifts',
        id: 'GiftId',
        name: (r) => r.GiftName,
        caption: (r) => [r.Description, r.UnitValue != null && `₹${r.UnitValue}`, !yes(r.IsActive) && 'inactive'].filter(Boolean).join(' · '),
        create: (v) => api.post('/app/catalogue/gifts', v),
        update: (id, v) => api.put(`/app/catalogue/gifts/${id}`, v),
        fields: [
            { key: 'GiftName', label: 'Gift name', required: true },
            { key: 'Description', label: 'Description' },
            { key: 'UnitValue', label: 'Unit value (₹)', keyboardType: 'decimal-pad', number: true },
            { key: 'IsActive', label: 'Active', type: 'switch', default: true },
        ],
    },
};

const MAPPINGS = {
    'map-areas': { title: 'User areas', icon: 'map', list: '/app/get-areas-code', mappings: '/app/get-user-area-mappings', id: 'AreaId', name: (r) => r.AreaName, caption: (r) => r.TerritoryName, item: (r) => ({ territoryId: r.TerritoryId, areaId: r.AreaId }), save: (p) => api.post('/app/create-user-area-mapping', p) },
    'map-doctors': { title: 'User doctors', icon: 'users', list: '/app/get-doctors', mappings: '/app/get-user-doctor-mappings', id: 'DoctorId', name: (r) => doctorName(r.DoctorName), caption: (r) => [r.Speciality, r.AreaName].filter(Boolean).join(' · '), filter: (r) => !r.ApprovalStatus || r.ApprovalStatus === 'APPROVED', item: (r) => ({ doctorId: r.DoctorId }), save: (p) => api.post('/app/create-user-doctor-mapping', p) },
    'map-pharmacies': { title: 'User pharmacies', icon: 'home', list: '/app/get-Pharmacies', mappings: '/app/get-user-pharmacy-mappings', id: 'PharmacyId', name: (r) => titleCase(r.PharmacyName), caption: (r) => r.AreaName, item: (r) => ({ pharmacyId: r.PharmacyId }), save: (p) => api.post('/app/create-user-pharmacy-mapping', p) },
    'map-stockists': { title: 'User stockists', icon: 'truck', list: '/app/get-stockists', mappings: '/app/get-user-stockist-mappings', id: 'StockistId', name: (r) => titleCase(r.StockistName), caption: (r) => r.AreaName, item: (r) => ({ stockistId: r.StockistId }), save: (p) => api.post('/app/create-user-stockist-mapping', p) },
};

// =========================================================
// MASTER FORM
// =========================================================

const initialValues = (def, row) =>
    Object.fromEntries(
        def.fields.map((f) => {
            const v = row?.[f.key];
            if (f.type === 'switch') return [f.key, row ? yes(v) : f.default === true];
            if (f.type === 'states' || f.type === 'territories') return [f.key, Array.isArray(v) ? v.map(String) : String(v || '').split(',').filter(Boolean)];
            if (f.key === 'password') return [f.key, ''];
            return [f.key, v == null ? f.default || '' : String(v)];
        })
    );

function MasterForm({ kind, row, onBack }) {
    const def = MASTERS[kind];
    const look = useLookups(def.needs || []);
    const [v, setV] = useState(() => initialValues(def, row));
    const [busy, setBusy] = useState(false);
    const set = (patch) => setV((s) => ({ ...s, ...patch }));
    const states = useStates(v.CountryId);
    const areas = useAreas(v.TerritoryId);
    const userStateIds = v.StateIds || [];

    const missing = def.fields.filter((f) => f.required && (Array.isArray(v[f.key]) ? !v[f.key].length : !String(v[f.key] ?? '').trim())).map((f) => f.label);
    if (kind === 'users' && !row && !v.password) missing.push('password');

    const save = async () => {
        setBusy(true);
        try {
            const body = {};
            def.fields.forEach((f) => {
                let value = v[f.key];
                if (f.type === 'switch') value = f.yesNo ? (value ? 'Yes' : 'No') : value;
                else if (f.number) value = value === '' ? null : Number(value);
                else if (typeof value === 'string') value = value.trim() === '' ? null : value.trim();
                if (f.upper && value) value = String(value).toUpperCase();
                body[f.key] = value;
            });
            if (kind === 'users' && row && !v.password) delete body.password;
            const r = row ? await def.update(row[def.id], body) : await def.create(body);
            toast(r?.data?.message || (row ? 'Saved' : 'Created'));
            onBack(true);
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = () =>
        Alert.alert('Delete?', `${def.name(row)} will be removed. This can't be undone.`, [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await def.remove(row[def.id]);
                        toast('Deleted');
                        onBack(true);
                    } catch (err) {
                        toast(errorMessage(err), 'error');
                    }
                },
            },
        ]);

    const field = (f) => {
        const opt = (list, id, name) => list.map((x) => ({ value: String(x[id]), label: titleCase(x[name]) }));
        switch (f.type) {
            case 'switch':
                return (
                    <View key={f.key} style={styles.switchRow}>
                        <Text style={[text.subtitle, { flex: 1 }]}>{f.label}</Text>
                        <Switch value={Boolean(v[f.key])} onValueChange={(x) => set({ [f.key]: x })} trackColor={{ true: colors.jadeBright }} thumbColor={colors.paper} />
                    </View>
                );
            case 'chips':
                return (
                    <View key={f.key}>
                        <Text style={styles.label}>{f.label}</Text>
                        <Chips options={f.options} value={v[f.key]} onChange={(x) => set({ [f.key]: x })} />
                    </View>
                );
            case 'country':
                return <Select key={f.key} label={f.label} value={v.CountryId} options={opt(look.countries, 'CountryId', 'CountryName')} onChange={(x) => set({ CountryId: x, StateId: '', StateIds: [] })} />;
            case 'state':
                return <Select key={f.key} label={f.label} value={v.StateId} options={opt(states, 'StateId', 'StateName')} onChange={(x) => set({ StateId: x })} disabled={!v.CountryId} />;
            case 'states':
                return <MultiSelect key={f.key} label={f.label} value={userStateIds} options={opt(states, 'StateId', 'StateName')} onChange={(x) => set({ StateIds: x })} placeholder={v.CountryId ? 'Choose states' : 'Choose the country first'} />;
            case 'territory':
                return <Select key={f.key} label={f.label} value={v.TerritoryId} options={opt(look.territories, 'TerritoryId', 'TerritoryName')} onChange={(x) => set({ TerritoryId: x, AreaId: '' })} searchable />;
            case 'territories':
                return <MultiSelect key={f.key} label={f.label} value={v.TerritoryIds} options={opt(look.territories, 'TerritoryId', 'TerritoryName')} onChange={(x) => set({ TerritoryIds: x })} />;
            case 'area':
                return <Select key={f.key} label={f.label} value={v.AreaId} options={opt(areas, 'AreaId', 'AreaName')} onChange={(x) => set({ AreaId: x })} disabled={!v.TerritoryId} />;
            case 'division':
                return <Select key={f.key} label={f.label} value={v.DivisionId} options={opt(look.divisions, 'DivisionId', 'DivisionName')} onChange={(x) => set({ DivisionId: x })} />;
            case 'designation':
                return <Select key={f.key} label={f.label} value={v.DesignationId} options={look.designations.map((d) => ({ value: String(d.SystemLovDetailId || d.DesignationId), label: d.SldName || d.SystemLovDetailName || d.DesignationName }))} onChange={(x) => set({ DesignationId: x })} />;
            case 'manager':
                return (
                    <Select
                        key={f.key}
                        label={f.label}
                        value={v.ManagerId}
                        options={[{ value: '', label: 'No manager' }, ...look.users.filter((u) => lower(u.UserId || u.userId) !== lower(row?.UserId)).map((u) => ({ value: String(u.UserId || u.userId), label: nameOfUser(u), detail: u.UserName }))]}
                        onChange={(x) => set({ ManagerId: x })}
                        searchable
                    />
                );
            default:
                return <Field key={f.key} label={f.required ? `${f.label} *` : f.label} value={v[f.key]} onChangeText={(x) => set({ [f.key]: x })} keyboardType={f.keyboardType} multiline={f.multiline} secure={f.secure} autoCapitalize={f.keyboardType ? 'none' : 'sentences'} />;
        }
    };

    return (
        <Screen
            footer={
                <>
                    {missing.length ? <Text style={[text.small, { marginBottom: space(1) }]}>{`Still needed: ${missing.join(', ')}.`}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: space(1) }}>
                        {row && def.remove ? <Button title="Delete" variant="danger" onPress={remove} style={{ flex: 1 }} /> : null}
                        <Button title={row ? 'Save' : 'Create'} icon="check" onPress={save} busy={busy} disabled={missing.length > 0} style={{ flex: 2 }} />
                    </View>
                </>
            }
        >
            <Header overline={def.title} title={row ? def.name(row) || 'Edit' : `New ${def.title.toLowerCase().replace(/s$/, '')}`} onBack={() => onBack(false)} />
            {kind === 'users' && row ? <Text style={[text.small, { marginTop: -space(1.5), marginBottom: space(1.5) }]}>A password you set here is temporary; the person chooses their own at the next sign-in.</Text> : null}
            <Card>{def.fields.map(field)}</Card>
        </Screen>
    );
}

// =========================================================
// MASTER LIST
// =========================================================

export function MasterList({ navigation, route }) {
    const kind = route.params?.kind;
    const def = MASTERS[kind];
    const permissions = usePermissions();
    const canEdit = permissions.any(['masters.edit', 'masters.create', 'users.edit', 'configuration.edit']);
    const state = useLoad(async () => pickArray((await api.get(def.list)).data), [kind], `Couldn't load ${def.title.toLowerCase()}.`);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null); // row, or {} for new

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (state.data || []).filter((r) => !q || `${def.name(r)} ${def.caption(r) || ''}`.toLowerCase().includes(q));
    }, [state.data, query, def]);

    if (editing)
        return (
            <MasterForm
                kind={kind}
                row={editing.__new ? null : editing}
                onBack={(changed) => {
                    setEditing(null);
                    if (changed) state.reload();
                }}
            />
        );

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Configuration" title={def.title} onBack={() => navigation.goBack()} right={canEdit ? <Button title="Add" icon="plus" small onPress={() => setEditing({ __new: true })} /> : null} />
            <View style={styles.search}>
                <Feather name="search" size={16} color={colors.inkMuted} />
                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
            </View>
            <Loadable state={state} rows={8}>
                {(rows) => (
                    <>
                        <Text style={[text.small, { marginBottom: space(1) }]}>{`${shown.length} of ${rows.length}`}</Text>
                        {shown.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {shown.slice(0, 200).map((r, i) => (
                                    <View key={String(r[def.id] || i)} style={i > 0 && line}>
                                        <ListRow
                                            title={def.name(r) || '—'}
                                            caption={def.caption(r)}
                                            right={r.IsActive != null && !yes(r.IsActive) ? <Tag label="Inactive" tone="neutral" /> : null}
                                            onPress={canEdit ? () => setEditing(r) : undefined}
                                            chevron={canEdit}
                                        />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon={def.icon} title={query ? 'No match' : `No ${def.title.toLowerCase()} yet`} />
                            </Card>
                        )}
                        {shown.length > 200 ? <Text style={[text.small, { marginTop: space(1) }]}>Showing the first 200. Search to narrow down.</Text> : null}
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

// =========================================================
// MAPPINGS (user → areas / doctors / pharmacies / stockists)
// =========================================================

export function Mapping({ navigation, route }) {
    const kind = route.params?.kind;
    const def = MAPPINGS[kind];
    const users = useLoad(async () => pickArray((await api.get('/app/get-users')).data), [], "Couldn't load users.");
    const items = useLoad(async () => pickArray((await api.get(def.list)).data).filter(def.filter || (() => true)), [kind], "Couldn't load the list.");
    const mappings = useLoad(async () => pickArray((await api.get(def.mappings)).data), [kind], "Couldn't load mappings.");
    const [userId, setUserId] = useState('');
    const [chosen, setChosen] = useState(null);
    const [query, setQuery] = useState('');
    const [onlyMine, setOnlyMine] = useState(false);
    const [busy, setBusy] = useState(false);

    const current = useMemo(() => (mappings.data || []).filter((m) => lower(m.UserId) === lower(userId)).map((m) => lower(m[def.id])), [mappings.data, userId, def.id]);
    const selected = chosen ?? current;
    const shown = (items.data || []).filter((r) => (!onlyMine || selected.includes(lower(r[def.id]))) && (!query.trim() || `${def.name(r)} ${def.caption(r) || ''}`.toLowerCase().includes(query.trim().toLowerCase())));

    const toggle = (id) => setChosen((c) => {
        const base = c ?? current;
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
    const save = async () => {
        setBusy(true);
        try {
            const rows = (items.data || []).filter((r) => selected.includes(lower(r[def.id])));
            const r = await def.save({ userId, mappings: rows.map(def.item) });
            toast(r?.data?.message || 'Mapping saved');
            setChosen(null);
            mappings.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen footer={userId && chosen ? <Button title={`Save · ${selected.length} selected`} icon="check" onPress={save} busy={busy} /> : null}>
            <Header overline="Configuration" title={def.title} onBack={() => navigation.goBack()} />
            <Select
                label="User"
                value={userId}
                options={(users.data || []).map((u) => ({ value: u.UserId || u.userId, label: nameOfUser(u), detail: u.UserName }))}
                onChange={(x) => {
                    setUserId(x);
                    setChosen(null);
                }}
                icon="user"
                searchable
            />
            {!userId ? (
                <Card>
                    <Empty icon={def.icon} title="Choose a user" caption="Then tick what they cover. Saving replaces their list." />
                </Card>
            ) : (
                <Loadable state={items} rows={8}>
                    {() => (
                        <>
                            <View style={styles.search}>
                                <Feather name="search" size={16} color={colors.inkMuted} />
                                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
                            </View>
                            <Chips
                                options={[
                                    { value: false, label: `All ${items.data.length}` },
                                    { value: true, label: `Selected ${selected.length}` },
                                ]}
                                value={onlyMine}
                                onChange={setOnlyMine}
                            />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {shown.slice(0, 300).map((r, i) => {
                                    const id = lower(r[def.id]);
                                    const on = selected.includes(id);
                                    return (
                                        <Pressable key={id} onPress={() => toggle(id)} style={[styles.pickRow, i > 0 && line, on && { backgroundColor: colors.jadeWash }]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                                            <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? colors.jade : colors.inkMuted} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={text.subtitle} numberOfLines={1}>
                                                    {def.name(r)}
                                                </Text>
                                                {def.caption(r) ? <Text style={text.small}>{titleCase(def.caption(r))}</Text> : null}
                                            </View>
                                        </Pressable>
                                    );
                                })}
                                {!shown.length ? <Empty icon="search" title="Nothing matches" /> : null}
                            </Card>
                        </>
                    )}
                </Loadable>
            )}
        </Screen>
    );
}

// =========================================================
// CONFIGURATION HUB
// =========================================================

const GROUPS = [
    { title: 'Organisation', items: [['divisions', 'Divisions'], ['territories', 'Territories'], ['areas', 'Areas'], ['users', 'Users']] },
    { title: 'Customers', items: [['doctors', 'Doctors'], ['pharmacies', 'Pharmacies'], ['stockists', 'Stockists & retailers']] },
    { title: 'Assignments', items: [['map-areas', 'User areas'], ['map-doctors', 'User doctors'], ['map-pharmacies', 'User pharmacies'], ['map-stockists', 'User stockists']] },
    { title: 'Catalogue', items: [['products', 'Products'], ['gifts', 'Gifts']] },
];

export function Configuration({ navigation }) {
    const summary = useLoad(async () => (await api.get('/app/configuration/summary')).data.summary, [], '');
    const count = (key) => {
        const s = summary.data || {};
        const v = s[key] ?? s[titleCase(key)] ?? s[`${key}Count`];
        return typeof v === 'number' ? `${v}` : typeof v === 'object' && v ? `${v.total ?? v.count ?? ''}` : '';
    };
    return (
        <Screen refreshControl={summary.refreshControl}>
            <Header overline="Administration" title="Configuration" onBack={() => navigation.goBack()} />
            {GROUPS.map((g) => (
                <View key={g.title} style={{ marginBottom: space(2) }}>
                    <Text style={[text.overline, { color: colors.inkMuted, marginBottom: space(1) }]}>{g.title}</Text>
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {g.items.map(([kind, label], i) => {
                            const isMap = kind.startsWith('map-');
                            const icon = isMap ? MAPPINGS[kind].icon : MASTERS[kind].icon;
                            const n = isMap ? '' : count(kind);
                            return (
                                <View key={kind} style={i > 0 && line}>
                                    <ListRow icon={icon} title={label} right={n ? <Tag label={n} tone="neutral" /> : null} onPress={() => navigation.navigate(isMap ? 'Mapping' : 'MasterList', { kind })} />
                                </View>
                            );
                        })}
                    </Card>
                </View>
            ))}
        </Screen>
    );
}

// =========================================================
// ROLES & PERMISSIONS
// =========================================================

export function Roles({ navigation }) {
    const permissions = usePermissions();
    const canEdit = permissions.has('roles.edit');
    const [tab, setTab] = useState('roles');
    const roles = useLoad(async () => (await api.get('/app/roles')).data.roles, [], "Couldn't load roles.");
    const users = useLoad(async () => (tab === 'users' ? (await api.get('/app/roles/users')).data.users : null), [tab], "Couldn't load users.");
    const [roleId, setRoleId] = useState(null);
    const detail = useLoad(async () => (roleId ? (await api.get(`/app/roles/${roleId}/permissions`)).data : null), [roleId], "Couldn't load permissions.");
    const [changes, setChanges] = useState({});
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('');

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.put(`/app/roles/${roleId}/permissions`, { permissions: Object.entries(changes).map(([PermissionCode, IsAllowed]) => ({ PermissionCode, IsAllowed })) })).data;
            toast(r?.message || 'Permissions saved');
            setChanges({});
            detail.reload();
            roles.reload();
            permissions.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };
    const assign = async (userId, newRole) => {
        try {
            const r = (await api.put(`/app/roles/users/${userId}`, { RoleId: newRole })).data;
            toast(r?.message || 'Role changed');
            users.reload();
            roles.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    if (roleId) {
        const perms = detail.data?.permissions || [];
        const q = query.trim().toLowerCase();
        const modules = [...new Set(perms.map((p) => p.ModuleName))];
        const allowed = (p) => (p.PermissionCode in changes ? changes[p.PermissionCode] : Boolean(p.IsAllowed));
        return (
            <Screen footer={canEdit && Object.keys(changes).length ? <Button title={`Save ${Object.keys(changes).length} change(s)`} icon="check" onPress={save} busy={busy} /> : null}>
                <Header overline="Role" title={detail.data?.role?.RoleName || '…'} onBack={() => { setRoleId(null); setChanges({}); }} />
                <View style={styles.search}>
                    <Feather name="search" size={16} color={colors.inkMuted} />
                    <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search permissions" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
                </View>
                <Loadable state={detail} rows={8}>
                    {() =>
                        modules.map((m) => {
                            const list = perms.filter((p) => p.ModuleName === m && (!q || `${p.FeatureName} ${p.PermissionName} ${p.PermissionCode}`.toLowerCase().includes(q)));
                            if (!list.length) return null;
                            return (
                                <View key={m}>
                                    <SectionTitle title={m} />
                                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                                        {list.map((p, i) => (
                                            <View key={p.PermissionCode} style={[styles.switchRow, styles.pad, i > 0 && line]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={text.subtitle}>{`${p.FeatureName} · ${p.PermissionName}`}</Text>
                                                    <Text style={text.small}>{p.Description || p.PermissionCode}</Text>
                                                </View>
                                                <Switch value={allowed(p)} disabled={!canEdit} onValueChange={(x) => setChanges((c) => ({ ...c, [p.PermissionCode]: x }))} trackColor={{ true: colors.jadeBright }} thumbColor={colors.paper} />
                                            </View>
                                        ))}
                                    </Card>
                                </View>
                            );
                        })
                    }
                </Loadable>
            </Screen>
        );
    }

    const roleOptions = (roles.data || []).map((r) => ({ value: r.RoleId, label: r.RoleName }));
    return (
        <Screen refreshControl={roles.refreshControl}>
            <Header overline="Administration" title="Roles & permissions" onBack={() => navigation.goBack()} />
            <Chips
                options={[
                    { value: 'roles', label: 'Roles' },
                    { value: 'users', label: 'People' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'roles' ? (
                <Loadable state={roles}>
                    {(rows) => (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((r, i) => (
                                <View key={r.RoleId} style={i > 0 && line}>
                                    <ListRow icon="lock" title={r.RoleName} caption={`${r.ActiveUsers} people · ${r.AllowedPermissions} permissions${r.Description ? ` · ${r.Description}` : ''}`} onPress={() => setRoleId(r.RoleId)} />
                                </View>
                            ))}
                        </Card>
                    )}
                </Loadable>
            ) : (
                <Loadable state={users}>
                    {(rows) => (
                        <View style={{ gap: space(1) }}>
                            {rows.map((u) => (
                                <Card key={u.UserId} style={{ padding: space(1.5) }}>
                                    <Text style={text.subtitle}>{titleCase(u.Name || u.UserName)}</Text>
                                    {canEdit ? <Select value={u.RoleId} options={roleOptions} onChange={(x) => assign(u.UserId, x)} placeholder="No role" /> : <Text style={text.small}>{u.RoleName || 'No role'}</Text>}
                                </Card>
                            ))}
                        </View>
                    )}
                </Loadable>
            )}
        </Screen>
    );
}

// =========================================================
// DATA IMPORT
// =========================================================

function ImportBatch({ batchId, onBack }) {
    const state = useLoad(async () => (await api.get(`/app/imports/batches/${batchId}`)).data, [batchId], "Couldn't load the import.");
    const [check, setCheck] = useState(null);
    const [busy, setBusy] = useState(false);
    const run = async (action, done) => {
        setBusy(true);
        try {
            const r = (await api.post(`/app/imports/batches/${batchId}/${action}`, action === 'check' ? {} : undefined)).data;
            if (action === 'check') setCheck(r);
            else toast(r?.message || done);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };
    const b = state.data;
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Data import" title={b?.fileName || 'Import'} onBack={onBack} />
            <Loadable state={state}>
                {() => (
                    <>
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue rows={[['Type', b.entityType], ['Status', titleCase(b.status)], ['Rows', b.totalRows], ['Source', b.sourceSystem], ['Columns', (b.headers || []).length]]} />
                        </Card>
                        {b.summary ? (
                            <>
                                <SectionTitle title="Summary" />
                                <StatGrid items={Object.entries(typeof b.summary === 'string' ? JSON.parse(b.summary) : b.summary).filter(([, x]) => typeof x === 'number').slice(0, 6).map(([k, x]) => ({ icon: 'file-text', label: titleCase(k), value: `${x}` }))} />
                            </>
                        ) : null}
                        {check ? (
                            <>
                                <SectionTitle title="Check result" />
                                {(check.notices || []).map((n, i) => (
                                    <Notice key={i} tone="info">
                                        {typeof n === 'string' ? n : n.text || n.message || JSON.stringify(n)}
                                    </Notice>
                                ))}
                                {check.issues?.length ? (
                                    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                                        {check.issues.slice(0, 50).map((r, i) => (
                                            <View key={i} style={i > 0 && line}>
                                                <ListRow title={`Row ${r.rowNumber}`} caption={(r.errors || r.problems || r.messages || []).map((e) => (typeof e === 'string' ? e : e.message)).join('; ')} chevron={false} />
                                            </View>
                                        ))}
                                    </Card>
                                ) : (
                                    <Notice tone="success">No problems found.</Notice>
                                )}
                            </>
                        ) : null}
                        <Text style={[text.small, { marginBottom: space(1.5) }]}>Column matching and value mapping are adjusted on the web. Here you can check, import, undo or cancel.</Text>
                        <View style={{ gap: space(1) }}>
                            {['UPLOADED', 'CHECKED', 'MAPPED'].includes(b.status) ? <Button title="Check file" icon="search" variant="outline" onPress={() => run('check')} busy={busy} /> : null}
                            {b.status === 'CHECKED' ? <Button title="Import now" icon="upload" onPress={() => run('commit', 'Imported')} busy={busy} /> : null}
                            {b.status === 'IMPORTED' ? <Button title="Undo import" icon="rotate-ccw" variant="danger" onPress={() => run('undo', 'Import undone')} busy={busy} /> : null}
                            {!['IMPORTED', 'CANCELLED', 'UNDONE'].includes(b.status) ? <Button title="Cancel" variant="ghost" onPress={() => run('cancel', 'Cancelled')} busy={busy} /> : null}
                        </View>
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

export function DataImport({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/imports')).data, [], "Couldn't load imports.");
    const [batchId, setBatchId] = useState(null);
    const [busy, setBusy] = useState(null);

    const upload = async (type) => {
        try {
            const pick = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true });
            if (pick.canceled || !pick.assets?.length) return;
            setBusy(type);
            const file = pick.assets[0];
            const r = await uploadImage(`/app/imports/${type}/upload`, file.uri, file.mimeType || 'text/csv', { 'x-file-name': encodeURIComponent(file.name || 'upload.csv') });
            toast('File uploaded. Check it next.');
            setBatchId(r?.batchId);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(null);
        }
    };

    if (batchId) return <ImportBatch batchId={batchId} onBack={() => setBatchId(null)} />;

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Administration" title="Data import" onBack={() => navigation.goBack()} />
            <Text style={[text.small, { marginBottom: space(1.5) }]}>Bring customer data from the old app: upload a CSV / Excel file per type, check it, then import. Every import can be undone.</Text>
            <Loadable state={state}>
                {(d) => (
                    <>
                        <View style={{ gap: space(1.25) }}>
                            {d.types
                                .slice()
                                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                .map((t) => (
                                    <Card key={t.type} style={{ padding: space(1.5) }}>
                                        <View style={styles.switchRow}>
                                            <Text style={[text.subtitle, { flex: 1 }]}>{t.label}</Text>
                                            {t.importedRows ? <Tag label={`${t.importedRows} imported`} tone="success" /> : null}
                                        </View>
                                        {t.description ? <Text style={text.small}>{t.description}</Text> : null}
                                        {t.dependsOn?.length ? <Text style={text.small}>{`Import first: ${t.dependsOn.join(', ')}`}</Text> : null}
                                        <Button title="Upload file" icon="upload" small variant="outline" onPress={() => upload(t.type)} busy={busy === t.type} style={{ marginTop: space(1), alignSelf: 'flex-start' }} />
                                    </Card>
                                ))}
                        </View>
                        {d.history?.length ? (
                            <>
                                <SectionTitle title="Recent imports" />
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {d.history.slice(0, 20).map((b, i) => (
                                        <View key={b.BatchId} style={i > 0 && line}>
                                            <ListRow title={b.FileName || b.EntityType} caption={[b.EntityType, titleCase(b.Status), b.TotalRows != null && `${b.TotalRows} rows`].filter(Boolean).join(' · ')} onPress={() => setBatchId(b.BatchId)} />
                                        </View>
                                    ))}
                                </Card>
                            </>
                        ) : null}
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 46, marginBottom: space(1.5) },
    searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, paddingVertical: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginBottom: space(1.5) },
    pad: { paddingHorizontal: space(1.75), paddingTop: space(1.25), marginBottom: 0, paddingBottom: space(1.25) },
    label: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    pickRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(1.75), paddingVertical: space(1.25) },
});

