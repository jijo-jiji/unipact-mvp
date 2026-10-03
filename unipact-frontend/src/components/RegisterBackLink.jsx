import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const MARKETING_URL = 'https://www.unipact.my';

/**
 * Registration is linked straight from the marketing site, so a Back link that
 * always points at /register strands those visitors inside the app. React Router
 * only assigns the key "default" to the first entry of a session, which means the
 * visitor arrived here directly rather than via the account-type chooser.
 */
export default function RegisterBackLink() {
  const location = useLocation();

  if (location.key === 'default') {
    return (
      <a href={MARKETING_URL} className="back-link mb-6">
        <ArrowLeft size={15} /> Back to unipact.my
      </a>
    );
  }

  return (
    <Link to="/register" className="back-link mb-6">
      <ArrowLeft size={15} /> Back
    </Link>
  );
}
