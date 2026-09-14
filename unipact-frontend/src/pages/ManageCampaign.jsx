import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { ArrowLeft, Users, Trophy, Clock, CheckCircle } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';

import ConfirmationModal from '../components/ConfirmationModal';

const ManageCampaign = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [pendingAwardId, setPendingAwardId] = useState(null);

    // Confirmation State
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDanger: false
    });

    useEffect(() => {
        const fetchCampaign = async () => {
            try {
                const response = await api.get(`/campaigns/${id}/`);
                setCampaign(response.data);
            } catch (error) {
                console.error("Failed to fetch campaign", error);
                showToast("Failed to load campaign data.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchCampaign();
    }, [id]);

    const executeAward = async (applicationId, clubName) => {
        try {
            await api.post(`/campaigns/application/${applicationId}/award/`);
            showToast("Contract Awarded Successfully!", "success");
            // Refresh data
            const response = await api.get(`/campaigns/${id}/`);
            setCampaign(response.data);
        } catch (error) {
            if (error.response?.status === 402) {
                // Payment Required - Trigger Custom Confirmation
                setConfirmState({
                    isOpen: true,
                    title: 'Payment Required',
                    message: "A Finder's Fee (RM 100) is required to award this contract. Proceed to payment?",
                    confirmText: 'Procure Funds',
                    cancelText: 'Abort',
                    isDanger: false,
                    onConfirm: () => {
                        setPendingAwardId({ applicationId, clubName });
                        setPaymentModalOpen(true);
                    }
                });
            } else {
                console.error("Failed to award", error);
                showToast("Awarding Failed: " + (error.response?.data?.error || "Unknown Error"), "error");
            }
        }
    };

    const handleAwardClick = (applicationId, clubName) => {
        setConfirmState({
            isOpen: true,
            title: 'Confirm Contract Award',
            message: `Are you sure you want to award the contract to ${clubName}? This action is irreversible.`,
            confirmText: 'Award Contract',
            isDanger: false,
            onConfirm: () => executeAward(applicationId, clubName)
        });
    };

    const handlePaymentSuccess = () => {
        if (pendingAwardId) {
            // Retry award after payment
            executeAward(pendingAwardId.applicationId, pendingAwardId.clubName);
            setPendingAwardId(null);
        }
    };

    // Review State
    const [reviewState, setReviewState] = useState({
        isOpen: false,
        rating: 5, // Default S
        comment: ''
    });

    const handleOpenReview = () => {
        setReviewState({
            isOpen: true,
            rating: 5,
            comment: ''
        });
    };

    const submitReviewAndComplete = async () => {
        try {
            await api.post(`/campaigns/${id}/complete/`, {
                rating: reviewState.rating,
                feedback: reviewState.comment
            });
            showToast("Mission Accomplished! Review Submitted & Contract Closed.", "success");
            setReviewState(prev => ({ ...prev, isOpen: false }));
            // Refresh data
            const response = await api.get(`/campaigns/${id}/`);
            setCampaign(response.data);
        } catch (error) {
            console.error("Completion failed", error);
            showToast("Failed to complete: " + (error.response?.data?.error || "Unknown Error"), "error");
        }
    };



    if (loading) return <div className="min-h-screen bg-black text-[#0A1748] flex items-center justify-center">Loading...</div>;
    if (!campaign) return null;

    return (
        <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body p-6 md:p-10 selection:bg-[#00AEEF] selection:text-[#0A1748]">
            <div className="max-w-6xl mx-auto animate-fade-in">

                {/* Header */}
                <button
                    onClick={() => navigate('/company/dashboard')}
                    className="flex items-center gap-2 text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] mb-6 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>

                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-[#0A1748] uppercase">{campaign.title}</h1>
                        <p className="text-[#5B6478] mt-1">Status: {campaign.status}</p>
                    </div>
                </div>

                                {/* V3.0 ASSIGNED STUDENT SQUAD SECTION */}
                {campaign.assigned_students_details && campaign.assigned_students_details.length > 0 && (
                    <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-heading text-lg font-bold text-[#0A1748] flex items-center gap-2">
                                <Users size={18} className="text-[#00AEEF]" />
                                Matched Student Talent Squad ({campaign.assigned_students_details.length})
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Curated Match Bound
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                            {campaign.assigned_students_details.map(s => (
                                <div key={s.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-3 text-xs">
                                    <div className="font-bold text-[#0A1748] mb-0.5">{s.full_name}</div>
                                    <div className="text-[11px] text-[#5B6478]">{s.university} &bull; {s.major}</div>
                                    <div className="mt-1 text-amber-600 font-bold">{s.rating} ★</div>
                                </div>
                            ))}
                        </div>

                        {/* Student Deliverables */}
                        {campaign.student_deliverables && campaign.student_deliverables.length > 0 && (
                            <div className="pt-4 border-t border-[rgba(10,23,72,0.08)]">
                                <h3 className="font-heading text-sm font-bold text-[#0A1748] mb-3">
                                    Submitted Project Deliverables ({campaign.student_deliverables.length})
                                </h3>
                                <div className="space-y-3">
                                    {campaign.student_deliverables.map(del => (
                                        <div key={del.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 text-xs">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-bold text-[#0A1748] text-sm">{del.title}</div>
                                                <span className="text-[11px] text-[#5B6478]">{new Date(del.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-[#5B6478] mb-2">Role: <strong className="text-[#0A1748]">{del.contribution_role}</strong> by {del.student_name}</div>
                                            {del.contribution_summary && (
                                                <p className="text-[#0A1748] bg-white p-3 rounded border border-[rgba(10,23,72,0.06)] mb-2 italic">
                                                    "{del.contribution_summary}"
                                                </p>
                                            )}
                                            {del.external_url && (
                                                <a href={del.external_url} target="_blank" rel="noreferrer" className="text-[#00AEEF] hover:underline font-semibold block mb-1">
                                                    &rarr; Staging / Repository URL: {del.external_url}
                                                </a>
                                            )}
                                            {del.file && (
                                                <a href={del.file} target="_blank" rel="noreferrer" className="text-[#00AEEF] hover:underline font-semibold block">
                                                    &rarr; Download Deliverable File
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {campaign.status === 'IN_PROGRESS' && (
                                    <button
                                        onClick={handleOpenReview}
                                        className="mt-4 px-5 py-2.5 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
                                    >
                                        Approve Deliverables & Complete Project
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

{/* Applications List (V2.2.1 Coexistence) */}
                <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 sm:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-[#0A1748] mb-6 flex items-center gap-2">
                        <Users size={20} className="text-[#0090C6]" />
                        Applications ({campaign.applications?.length || 0})
                    </h2>

                    <div className="space-y-4">
                        {campaign.applications?.length === 0 ? (
                            <p className="text-[#5B6478] italic">No mercenaries have applied yet.</p>
                        ) : (
                            campaign.applications?.map((app) => (
                                <div key={app.id} className="bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">

                                            <h3
                                                onClick={() => navigate(`/club/profile/${app.club_user_id}`)}
                                                className="text-[#0A1748] font-bold uppercase cursor-pointer hover:text-[#5B6478] transition-colors"
                                            >
                                                {app.club_name}
                                            </h3>

                                            {/* Status Badges - Prioritize Campaign Status */}
                                            {(app.status === 'COMPLETED' || (campaign.status === 'COMPLETED' && ['AWARDED', 'SUBMITTED'].includes(app.status))) ? (
                                                <span className="text-xs bg-[#00AEEF]/20 text-[#0090C6] px-2 py-0.5 rounded border border-[#a020f0]/30 font-bold uppercase">Mission Accomplished</span>
                                            ) : (
                                                <>
                                                    {app.status === 'AWARDED' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 font-bold uppercase">Winner</span>}
                                                    {app.status === 'SUBMITTED' && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30 font-bold uppercase animate-pulse">Under Review</span>}
                                                </>
                                            )}
                                        </div>
                                        <p className="text-[#5B6478] text-sm mt-1">"{app.message}"</p>
                                        <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
                                            <Clock size={12} /> Applied on: {new Date(app.submitted_at).toLocaleDateString()}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    < div >
                                        {/* AWARDING PHASE */}
                                        {
                                            campaign.status === 'OPEN' && app.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleAwardClick(app.id, app.club_name)}
                                                    className="bg-[#00AEEF] hover:bg-[#0090C6] text-[#0A1748] px-4 py-2 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                                >
                                                    <Trophy size={14} /> Award Contract
                                                </button>
                                            )
                                        }
                                        {
                                            app.status === 'NOT_SELECTED' && (
                                                <span className="text-[#5B6478] text-sm uppercase">Not Selected</span>
                                            )
                                        }

                                        {/* REVIEW PHASE - Visible for any Awarded/Submitted app */}
                                        {
                                            ['AWARDED', 'SUBMITTED'].includes(app.status) && (
                                                <div className="flex flex-col gap-2 items-end">
                                                    <div className="text-sm font-bold text-[#0A1748] mb-2">Deliverables:</div>
                                                    {app.deliverables && app.deliverables.length > 0 ? (
                                                        app.deliverables.map(del => (
                                                            <a
                                                                key={del.id}
                                                                href={del.file}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-2 text-[#0090C6] hover:text-[#0A1748] text-xs underline"
                                                            >
                                                                <CheckCircle size={10} /> View Submission ({new Date(del.uploaded_at).toLocaleDateString()})
                                                            </a>
                                                        ))
                                                    ) : (
                                                        <span className="text-[#5B6478] text-xs italic">No deliverables yet.</span>
                                                    )}

                                                    {/* Only show "Review & Complete" if campaign is IN PROGRESS and app is strictly SUBMITTED */}
                                                    {campaign.status === 'IN_PROGRESS' && app.status === 'SUBMITTED' && (
                                                        <button
                                                            onClick={handleOpenReview}
                                                            className="mt-4 bg-green-600 hover:bg-green-500 text-[#0A1748] px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                                        >
                                                            <CheckCircle size={14} /> Review & Complete
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        }
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div >

            {/* REVIEW MODAL */}
            {reviewState.isOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-[var(--bg-panel)] border border-[var(--text-gold)] p-8 max-w-md w-full relative">
                        <h2 className="text-2xl font-display font-bold text-[#00AEEF] uppercase mb-2"> performance evaluation</h2>
                        <p className="text-sm text-[#5B6478] mb-6">Rate the performance of the mercenary club.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-[#5B6478] block mb-2">Rank Assesment</label>
                                <div className="flex gap-2">
                                    {[
                                        { label: 'S', value: 5, color: 'text-yellow-400 border-yellow-400' },
                                        { label: 'A', value: 4, color: 'text-purple-400 border-purple-400' },
                                        { label: 'B', value: 3, color: 'text-blue-400 border-blue-400' },
                                        { label: 'C', value: 2, color: 'text-green-400 border-green-400' },
                                        { label: 'D', value: 1, color: 'text-[#5B6478] border-gray-400' },
                                    ].map((rank) => (
                                        <button
                                            key={rank.label}
                                            onClick={() => setReviewState(prev => ({ ...prev, rating: rank.value }))}
                                            className={`w-10 h-10 border font-bold flex items-center justify-center transition-all ${reviewState.rating === rank.value
                                                ? `bg-white/10 ${rank.color} shadow-[0_0_10px_currentColor]`
                                                : 'border-gray-700 text-gray-700 hover:border-white hover:text-[#0A1748]'
                                                }`}
                                        >
                                            {rank.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs uppercase font-bold text-[#5B6478] block mb-2">Officer's Notes</label>
                                <textarea
                                    value={reviewState.comment}
                                    onChange={(e) => setReviewState(prev => ({ ...prev, comment: e.target.value }))}
                                    className="w-full bg-black/50 border border-gray-700 text-[#0A1748] p-3 text-sm focus:border-[var(--text-gold)] outline-none h-32"
                                    placeholder="Describe their performance..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setReviewState(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-3 border border-gray-600 text-[#5B6478] font-bold uppercase text-xs hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReviewAndComplete}
                                className="flex-1 py-3 bg-[var(--text-gold)] text-black font-bold uppercase text-xs hover:bg-white transition-colors"
                            >
                                Confirm Evaluation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                amount={100}
                description={`Finder's Fee for ${campaign.title}`}
                onSuccess={handlePaymentSuccess}
                campaignId={campaign.id}
            />

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                isDanger={confirmState.isDanger}
            />
        </div >
    );
};

export default ManageCampaign;
