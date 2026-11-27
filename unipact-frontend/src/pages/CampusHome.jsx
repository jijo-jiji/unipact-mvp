import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, ClipboardCheck, Newspaper, PlusCircle, Settings2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InstallAppCard from '../components/InstallAppCard';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, CampusPage, Empty, ErrorNote, Loading, formatDate, useLoad } from '../components/campus/CampusUI';

const Tile = ({ to, icon, title, text, badge }) => (
  <Link
    to={to}
    className="card p-5 bg-white border border-[rgba(10,23,72,0.1)] hover:border-[#00AEEF] transition-colors flex gap-4 items-start"
  >
    <span className="w-10 h-10 rounded-lg bg-[#00AEEF]/10 text-[#00729F] flex items-center justify-center shrink-0">
      {React.createElement(icon, { size: 20, 'aria-hidden': true })}
    </span>
    <span className="min-w-0">
      <span className="font-heading font-bold text-lg flex items-center gap-2">
        {title}
        {badge > 0 && <span className="badge bg-[#00AEEF] text-[#0A1748] border-[#00AEEF]">{badge}</span>}
      </span>
      <span className="block text-sm text-[#5B6478] mt-0.5">{text}</span>
    </span>
  </Link>
);

const UpcomingActivities = () => {
  const { data } = useLoad('/campus/activities/', { scope: 'mine' });
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <h2 className="font-heading font-bold text-xl">Coming up</h2>
      <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-2">
        {data.slice(0, 6).map((a) => (
          <li key={a.id}>
            <Link to={`/campus/activities/${a.id}`} className="py-3 flex items-center gap-3 hover:bg-[#F5F7FC] -mx-2 px-2 rounded">
              <CalendarDays size={18} className="text-[#00AEEF] shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-semibold truncate">{a.title}</span>
                <span className="block text-sm text-[#5B6478]">{a.club_detail.name} · {formatDate(a.starts_at)} · {a.venue}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};

// UniPact Campus home: the person's roles, and the way into clubs, news and approvals.
const CampusHome = () => {
  usePageTitle('Campus');
  const { user } = useAuth();
  const { data, error, loading } = useLoad('/campus/me/');
  const assignments = data?.assignments || [];
  const isStudent = user?.role === 'STUDENT';

  return (
    <CampusPage title="Campus" intro="Clubs, activity approvals and GHOCS points for your campus. Your roles below decide what you can do.">
      {loading && !data && <Loading />}
      <ErrorNote>{error}</ErrorNote>
      {data && (
        <>
          <InstallAppCard />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Tile to="/campus/clubs" icon={Users} title="Clubs" text="Browse clubs, join one, or open the clubs you belong to." />
            <Tile to="/campus/news" icon={Newspaper} title="News" text="Campus news and activities, including GHOCS-claimable ones." />
            <Tile
              to="/campus/approvals"
              icon={ClipboardCheck}
              title="Approvals"
              badge={data.pending_approvals}
              text={data.pending_approvals ? 'Requests are waiting for your signature.' : 'Requests waiting for you, and the ones you sent.'}
            />
            {isStudent && (
              <Tile to="/campus/clubs/propose" icon={PlusCircle} title="Start a club" text="Propose a new club. Your advisor, the Head of Section and the Deputy Dean approve it." />
            )}
            {data.can_manage_structure && (
              <Tile to="/campus/manage" icon={Settings2} title="Manage campus" text="Clubs, staff, roles and semesters." />
            )}
          </div>

          <UpcomingActivities />

          <Card>
            <h2 className="font-heading font-bold text-xl">Your roles</h2>
            {data.is_platform_admin && (
              <p className="text-sm text-[#5B6478] mt-1">You are a UniPact admin, so you can manage every campus.</p>
            )}
            {assignments.length === 0 && !data.is_platform_admin && (
              <Empty icon={Building2} title="No campus role yet">
                {isStudent ? 'Join a club to become a member, or start one.' : 'Your campus office gives staff their roles.'}
              </Empty>
            )}
            {assignments.length > 0 && (
              <ul className="divide-y divide-[rgba(10,23,72,0.08)] mt-3 border-t border-[rgba(10,23,72,0.08)]">
                {assignments.map((a) => (
                  <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="font-semibold">{a.position ? `${a.position} · ` : ''}{a.role_label}</p>
                      <p className="text-sm text-[#5B6478]">
                        {a.unit.kind === 'CLUB'
                          ? <Link className="hover:text-[#00729F] underline-offset-2 hover:underline" to={`/campus/clubs/${a.unit.id}`}>{a.unit.name}</Link>
                          : a.unit.name}
                        {a.campus && a.campus.id !== a.unit.id ? ` · ${a.campus.short_name || a.campus.name}` : ''}
                      </p>
                    </div>
                    {a.session && <span className="text-xs text-[#5B6478]">{a.session}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </CampusPage>
  );
};

export default CampusHome;
