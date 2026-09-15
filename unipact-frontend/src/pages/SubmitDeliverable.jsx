import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import WorkspaceNav from '../components/WorkspaceNav';
import { getErrorMessage } from '../utils/format';

const SubmitDeliverable = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/campaigns/application/${applicationId}/deliverable/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Deliverable uploaded. The company will review it.', 'success');
      navigate('/student/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-md mx-auto px-4 py-10">
        <Link to="/student/dashboard" className="back-link mb-6">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>

        <div className="card p-8 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#00AEEF]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="text-[#00AEEF]" size={28} />
            </div>
            <h1 className="font-heading text-2xl font-bold">Upload your deliverable</h1>
            <p className="text-sm text-[#5B6478] mt-1">Submit your finished work so the company can review and close the quest.</p>
          </div>

          {error && <div className="alert-error mb-4"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block border-2 border-dashed border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] rounded-lg p-8 text-center cursor-pointer bg-[#F5F7FC] transition-colors">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="sr-only" />
              {file ? (
                <span className="flex flex-col items-center gap-2">
                  <FileText className="text-[#00AEEF]" size={30} />
                  <span className="text-sm font-semibold break-all">{file.name}</span>
                  <span className="text-xs text-[#5B6478]">Click to choose a different file</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-2 text-[#5B6478]">
                  <UploadCloud size={30} />
                  <span className="text-sm"><span className="text-[#0090C6] font-semibold">Choose a file</span> to upload</span>
                </span>
              )}
            </label>

            <button type="submit" disabled={!file || uploading} className="btn-primary w-full py-3">
              {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Submit deliverable'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default SubmitDeliverable;
