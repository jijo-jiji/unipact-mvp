import React from 'react';
import { Loader2 } from 'lucide-react';

const PageLoader = ({ message = 'Loading…' }) => (
  <div className="min-h-screen bg-[#F5F7FC] flex flex-col items-center justify-center gap-3 text-[#5B6478] text-sm font-body" role="status">
    <Loader2 size={28} className="animate-spin text-[#00AEEF]" />
    {message}
  </div>
);

export default PageLoader;
