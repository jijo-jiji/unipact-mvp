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



    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
    if (!campaign) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-void)] p-6">
            <div className="max-w-6xl mx-auto animate-fade-in">

                {/* Header */}
                <button
                    onClick={() => navigate('/company/dashboard')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors uppercase text-xs tracking-widest"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>

                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white uppercase">{campaign.title}</h1>
                        <p className="text-[var(--text-blue)] mt-1">Status: {campaign.status}</p>
                    </div>
                </div>

                {/* Applications List */}
                <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Users size={20} className="text-[#a020f0]" />
                        Applications ({campaign.applications?.length || 0})
                    </h2>

                    <div className="space-y-4">
                        {campaign.applications?.length === 0 ? (
                            <p className="text-gray-500 italic">No mercenaries have applied yet.</p>
                        ) : (
                            campaign.applications?.map((app) => (
                                <div key={app.id} className="bg-black/30 border border-white/10 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">

                                            <h3
                                                onClick={() => navigate(`/club/profile/${app.club_user_id}`)}
                                                className="text-white font-bold uppercase cursor-pointer hover:text-[var(--text-blue)] transition-colors"
                                            >
                                                {app.club_name}
                                            </h3>

                                            {/* Status Badges - Prioritize Campaign Status */}
                                            {(app.status === 'COMPLETED' || (campaign.status === 'COMPLETED' && ['AWARDED', 'SUBMITTED'].includes(app.status))) ? (
                                                <span className="text-xs bg-[#a020f0]/20 text-[#a020f0] px-2 py-0.5 rounded border border-[#a020f0]/30 font-bold uppercase">Mission Accomplished</span>
                                            ) : (
                                                <>
                                                    {app.status === 'AWARDED' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 font-bold uppercase">Winner</span>}
                                                    {app.status === 'SUBMITTED' && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30 font-bold uppercase animate-pulse">Under Review</span>}
                                                </>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-sm mt-1">"{app.message}"</p>
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
                                                    className="bg-[#a020f0] hover:bg-[#8e1cc1] text-white px-4 py-2 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                                >
                                                    <Trophy size={14} /> Award Contract
                                                </button>
                                            )
                                        }
                                        {
                                            app.status === 'NOT_SELECTED' && (
                                                <span className="text-gray-500 text-sm uppercase">Not Selected</span>
                                            )
                                        }

                                        {/* REVIEW PHASE - Visible for any Awarded/Submitted app */}
                                        {
                                            ['AWARDED', 'SUBMITTED'].includes(app.status) && (
                                                <div className="flex flex-col gap-2 items-end">
                                                    <div className="text-sm font-bold text-white mb-2">Deliverables:</div>
                                                    {app.deliverables && app.deliverables.length > 0 ? (
                                                        app.deliverables.map(del => (
                                                            <a
                                                                key={del.id}
                                                                href={del.file}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-2 text-[#a020f0] hover:text-white text-xs underline"
                                                            >
                                                                <CheckCircle size={10} /> View Submission ({new Date(del.uploaded_at).toLocaleDateString()})
                                                            </a>
                                                        ))
                                                    ) : (
                                                        <span className="text-gray-500 text-xs italic">No deliverables yet.</span>
                                                    )}

                                                    {/* Only show "Review & Complete" if campaign is IN PROGRESS and app is strictly SUBMITTED */}
                                                    {campaign.status === 'IN_PROGRESS' && app.status === 'SUBMITTED' && (
                                                        <button
                                                            onClick={handleOpenReview}
                                                            className="mt-4 bg-green-600 hover:bg-green-500 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
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
                        <h2 className="text-2xl font-display font-bold text-[var(--text-gold)] uppercase mb-2"> performance evaluation</h2>
                        <p className="text-sm text-gray-400 mb-6">Rate the performance of the mercenary club.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-[var(--text-blue)] block mb-2">Rank Assesment</label>
                                <div className="flex gap-2">
                                    {[
                                        { label: 'S', value: 5, color: 'text-yellow-400 border-yellow-400' },
                                        { label: 'A', value: 4, color: 'text-purple-400 border-purple-400' },
                                        { label: 'B', value: 3, color: 'text-blue-400 border-blue-400' },
                                        { label: 'C', value: 2, color: 'text-green-400 border-green-400' },
                                        { label: 'D', value: 1, color: 'text-gray-400 border-gray-400' },
                                    ].map((rank) => (
                                        <button
                                            key={rank.label}
                                            onClick={() => setReviewState(prev => ({ ...prev, rating: rank.value }))}
                                            className={`w-10 h-10 border font-bold flex items-center justify-center transition-all ${reviewState.rating === rank.value
                                                ? `bg-white/10 ${rank.color} shadow-[0_0_10px_currentColor]`
                                                : 'border-gray-700 text-gray-700 hover:border-white hover:text-white'
                                                }`}
                                        >
                                            {rank.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs uppercase font-bold text-[var(--text-blue)] block mb-2">Officer's Notes</label>
                                <textarea
                                    value={reviewState.comment}
                                    onChange={(e) => setReviewState(prev => ({ ...prev, comment: e.target.value }))}
                                    className="w-full bg-black/50 border border-gray-700 text-white p-3 text-sm focus:border-[var(--text-gold)] outline-none h-32"
                                    placeholder="Describe their performance..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setReviewState(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-3 border border-gray-600 text-gray-400 font-bold uppercase text-xs hover:bg-gray-800 transition-colors"
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
