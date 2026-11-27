import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import { Card, CampusPage, ErrorNote, Loading, formatDate, useLoad } from '../components/campus/CampusUI';

// Where the activity's QR code leads: the student confirms and is marked present.
const CampusCheckIn = () => {
  const { code } = useParams();
  usePageTitle('Check in');
  const { data, error, loading, setData } = useLoad(`/campus/checkin/${code}/`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const checkIn = async () => {
    setBusy(true);
    setFailure('');
    try {
      const res = await api.post(`/campus/checkin/${code}/`);
      setData({ ...data, checked_in: res.data });
    } catch (err) {
      setFailure(err?.response?.data?.detail || getErrorMessage(err, "We couldn't check you in."));
    } finally { setBusy(false); }
  };

  return (
    <CampusPage title="Check in" back={{ to: '/campus', label: 'Campus' }}>
      {loading && !data && <Loading />}
      <ErrorNote>{error && 'This check-in link is not valid. Ask the committee to show the QR code again.'}</ErrorNote>
      {data && (
        <Card className="max-w-lg mx-auto w-full text-center space-y-4">
          <p className="eyebrow justify-center"><span className="eyebrow-dot" /> {data.activity.club}</p>
          <h2 className="font-heading font-extrabold text-2xl">{data.activity.title}</h2>
          <div className="text-sm text-[#5B6478] space-y-1">
            <p className="flex justify-center gap-2"><CalendarDays size={16} className="text-[#00AEEF]" aria-hidden="true" />{formatDate(data.activity.starts_at)}</p>
            <p className="flex justify-center gap-2"><MapPin size={16} className="text-[#00AEEF]" aria-hidden="true" />{data.activity.venue}</p>
          </div>
          {data.checked_in ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} aria-hidden="true" />
              <p className="font-heading font-bold text-lg mt-2">You're checked in</p>
              <p className="text-sm text-[#5B6478]">As {data.checked_in.role_label.toLowerCase()}. It counts towards your GHOCS record.</p>
            </div>
          ) : !data.can_check_in ? (
            <p className="text-sm text-[#5B6478]">Check-in is for students.</p>
          ) : !data.checkin_open ? (
            <p className="text-sm text-[#5B6478]">Check-in isn't open yet. Ask the committee to open it, then scan again.</p>
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base" disabled={busy} onClick={checkIn}>{busy ? 'Checking in…' : 'Check in'}</button>
          )}
          <ErrorNote>{failure}</ErrorNote>
          <Link to={`/campus/activities/${data.activity.id}`} className="text-sm font-semibold text-[#00729F]">About this activity</Link>
        </Card>
      )}
    </CampusPage>
  );
};

export default CampusCheckIn;
