import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  ArrowLeft,
  Shield,
  Coins,
  Clock,
  FileText,
  CheckCircle,
  Upload,
  Send
} from 'lucide-react';

const QuestDetails = () => {
  const { id } = useParams();
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState('');
  const navigate = useNavigate();

  // 1. Fetch Quest Details
  useEffect(() => {
    const fetchQuest = async () => {
      try {
        const response = await api.get(`/campaigns/${id}/`);
        setQuest(response.data);
      } catch (error) {
        console.error("Failed to fetch quest", error);
        // Alert might be annoying if it's just a refresh issue, let's show UI error instead
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchQuest();
  }, [id]);

  // 2. Handle Application
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAccept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/campaigns/${id}/apply/`, {
        message: pitch
      });
      setShowSuccess(true);
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/student/dashboard');
      }, 2000);
    } catch (error) {
      console.error("Application failed", error);
      alert("Transmission Failed: " + (error.response?.data?.detail || "Unknown Error"));
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Intel...</div>;

  if (!quest) return (
    <div className="min-h-screen bg-[var(--bg-void)] text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-red-500 mb-4">Transmission Error</h1>
      <p className="text-gray-400 mb-6">Unable to retrieve Mission Intel. The contract may have been pulled or network is down.</p>
      <button onClick={() => navigate('/student/dashboard')} className="text-[var(--text-blue)] border border-[var(--text-blue)] px-4 py-2 hover:bg-[var(--text-blue)] hover:text-black transition-colors uppercase text-xs tracking-widest cursor-pointer z-50">
        Return to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center text-white relative">

      {/* SUCCESS MODAL */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle size={40} className="text-black" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-wider">Mission Accepted</h2>
            <p className="text-green-400 uppercase tracking-widest text-sm mb-8">Proposal Transmitted Successfully</p>
            <p className="text-gray-500 text-xs">Redirecting to Dashboard...</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl animate-fade-in">

        {/* 1. HEADER */}
        <div className="relative z-50 mb-6">
          <button
            onClick={() => {
              console.log("Abort clicked");
              navigate('/student/dashboard');
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors uppercase text-xs tracking-widest cursor-pointer"
          >
            <ArrowLeft size={14} /> Abort / Return to Terminal
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">

          {/* 2. MISSION INTEL (Left Panel) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header Card */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 uppercase border-l border-b border-green-500/30">
                Open Contract
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center">
                  <Shield size={32} className="text-[var(--text-blue)]" />
                </div>
                <div>
                  <h1 className="text-3xl font-display font-bold uppercase tracking-wide">
                    {quest.title}
                  </h1>
                  <p className="text-[var(--text-blue)] text-sm mt-1">
                    Client: <span className="text-white font-bold">{quest.company_name}</span>
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex gap-2 mb-6">
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] uppercase tracking-wider border border-blue-500/20">
                  {quest.type}
                </span>
              </div>

              {/* Description */}
              <div className="space-y-4 text-gray-300 text-sm leading-relaxed border-t border-[var(--border-tech)] pt-6">
                <p>
                  <strong className="text-white block mb-2 uppercase text-xs tracking-widest">Mission Objective:</strong>
                  {quest.description}
                </p>
              </div>
            </div>

            {/* Victory Conditions (Deliverables) */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">
              <h3 className="text-[var(--text-blue)] font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                <CheckCircle size={16} /> Victory Conditions
              </h3>
              <ul className="space-y-3">
                {(Array.isArray(quest.requirements) ? quest.requirements : []).map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300 bg-black/20 p-3 border border-white/5">
                    <div className="w-1.5 h-1.5 bg-[#a020f0] rounded-full"></div>
                    {item}
                  </li>
                ))}
                {(!quest.requirements || quest.requirements.length === 0) && (
                  <li className="text-gray-500 italic">No specific conditions listed.</li>
                )}
              </ul>
            </div>

          </div>

          {/* 3. ACCEPTANCE FORM (Right Panel) */}
          <div className="space-y-6">

            {/* Loot Card */}
            <div className="bg-[#a020f0]/5 border border-[#a020f0]/30 p-6 text-center">
              <div className="text-[var(--text-blue)] text-xs uppercase tracking-widest mb-1">Bounty Pool</div>
              <div className="text-4xl font-display font-bold text-white flex justify-center items-center gap-2">
                <Coins className="text-[#a020f0]" /> RM {quest.budget}
              </div>
              <div className="mt-4 flex justify-center items-center gap-2 text-xs text-gray-400">
                <Clock size={12} /> Deadline: {quest.deadline || 'TBA'}
              </div>
            </div>

            {/* Proposal Input OR Status Card */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">

              {quest.my_application ? (
                <div className="text-center py-8 animate-fade-in">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
                    <Shield size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2 uppercase tracking-wider">
                    Application Transmitted
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Current Status: <span className="text-[var(--text-gold)] uppercase font-bold">{quest.my_application.status}</span>
                  </p>
                  <button
                    onClick={() => navigate('/student/dashboard')}
                    className="w-full bg-black border border-[var(--border-tech)] text-[var(--text-blue)] py-3 uppercase tracking-widest hover:bg-[var(--text-blue)] hover:text-black transition-colors"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4">
                    Tactical Proposal
                  </h3>

                  <form onSubmit={handleAccept} className="space-y-4">

                    {/* Cover Letter */}
                    <div>
                      <label className="text-[var(--text-blue)] text-xs uppercase block mb-2">
                        Strategy Brief (Cover Letter)
                      </label>
                      <textarea
                        rows="6"
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        placeholder="Explain why your guild is fit for this operation..."
                        className="w-full bg-black/30 border border-[var(--border-tech)] text-white p-3 text-sm focus:border-[#a020f0] focus:outline-none transition-colors"
                        required
                      ></textarea>
                    </div>

                    {/* Upload */}
                    <div className="border border-dashed border-gray-600 hover:border-[#a020f0] p-6 text-center cursor-pointer transition-colors group">
                      <Upload className="mx-auto text-gray-500 group-hover:text-[#a020f0] mb-2" size={20} />
                      <div className="text-xs text-gray-400">Upload Deck (PDF)</div>
                      <div className="text-[10px] text-gray-600 mt-1">(Optional for Initial Bid)</div>
                    </div>

                    <div className="h-px bg-[var(--border-tech)] my-4"></div>

                    <div className="text-[10px] text-gray-500 mb-4">
                      By accepting this mission, you agree to the Guild Code of Conduct and the specified deliverables.
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[#a020f0] text-white font-bold py-4 uppercase tracking-widest hover:bg-[#8a1ccf] hover:shadow-[0_0_20px_#a020f0] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                    >
                      {submitting ? 'Transmitting...' : <><Send size={16} /> Transmit Proposal</>}
                    </button>

                  </form>
                </>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default QuestDetails;