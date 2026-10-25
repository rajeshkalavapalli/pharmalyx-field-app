import { api, currentSession } from './api';
import { titleCase } from './format';
import useLoad from './useLoad';
import { Select } from './ui';

// The people I can view (me + everyone below me), from /app/work/people (the same scope the server enforces).
export function usePeople() {
    const state = useLoad(async () => (await api.get('/app/work/people')).data, [], "Couldn't load your team.");
    const users = state.data?.users || [];
    const meId = String(currentSession()?.user?.UserId || '').toLowerCase();
    return { users, meId, hasTeam: users.length > 1 };
}

// "Showing: <person>" picker; hidden when the person has no team. value '' = me.
export function PersonPicker({ people, value, onChange, label = 'Showing' }) {
    if (!people.hasTeam) return null;
    const options = people.users.map((u) => ({
        value: String(u.UserId).toLowerCase() === people.meId ? '' : u.UserId,
        label: String(u.UserId).toLowerCase() === people.meId ? `${titleCase(u.Name)} (me)` : titleCase(u.Name),
        detail: [u.RoleName, u.ManagerName && `reports to ${titleCase(u.ManagerName)}`].filter(Boolean).join(' · '),
    }));
    return <Select label={label} value={value} options={options} onChange={onChange} icon="user" searchable={options.length > 6} />;
}
