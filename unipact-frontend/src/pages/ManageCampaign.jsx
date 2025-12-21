import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Users, Trophy, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const ManageCampaign = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCampaign = async () => {
            try {
                const response = await api.get(`/campaigns/${id}/`);
                setCampaign(response.data);
            } catch (error) {
                console.error("Failed to fetch campaign", error);
                alert("Failed to load campaign data.");
            } finally {
                setLoading(false);
            }
        };
        fetchCampaign();
    }, [id]);

    const handleAward = async (applicationId, clubName) => {
        if (!window.confirm(`Are you sure you want to award the contract to ${clubName}? This action is irreversible.`)) {
            return;
        }

        try {
            await api.post(`/campaigns/application/${applicationId}/award/`);
            alert("Contract Awarded Successfully!");
            // Refresh data
            const response = await api.get(`/campaigns/${id}/`);
            setCampaign(response.data);
        } catch (error) {
            console.error("Failed to award", error);
            alert("Awarding Failed: " + (error.response?.data?.error || "Unknown Error"));
        }
    };

    const handleComplete = async () => {
        if (!window.confirm("Confirm Mission Completion? This will release funds and close the project.")) {
            return;
        }

        try {
            await api.post(`/campaigns/${id}/complete/`);
            alert("Mission Accomplished! Report Generated.");
            // Refresh data
            const response = await api.get(`/campaigns/${id}/`);
            setCampaign(response.data);
        } catch (error) {
            console.error("Completion failed", error);
            alert("Failed to complete campaign: " + (error.response?.data?.error || "Unknown Error"));
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
                                            <h3 className="text-lg font-bold text-white">{app.club_name}</h3>
                                            {app.status === 'AWARDED' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 font-bold uppercase">Winner</span>}
                                        </div>
                                        <p className="text-gray-400 text-sm mt-1">"{app.message}"</p>
                                        <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
                                            <Clock size={12} /> Applied on: {new Date(app.submitted_at).toLocaleDateString()}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div>
                                        {/* AWARDING PHASE */}
                                        {campaign.status === 'OPEN' && app.status === 'PENDING' && (
                                            <button
                                                onClick={() => handleAward(app.id, app.club_name)}
                                                className="bg-[#a020f0] hover:bg-[#8e1cc1] text-white px-4 py-2 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                            >
                                                <Trophy size={14} /> Award Contract
                                            </button>
                                        )}
                                        {app.status === 'NOT_SELECTED' && (
                                            <span className="text-gray-500 text-sm uppercase">Not Selected</span>
                                        )}

                                        {/* REVIEW PHASE */}
                                        {campaign.status === 'IN_PROGRESS' && app.status === 'AWARDED' && (
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="text-sm font-bold text-white mb-2">Deliverables for Review:</div>
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

                                                <button
                                                    onClick={handleComplete}
                                                    className="mt-4 bg-green-600 hover:bg-green-500 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                                >
                                                    <CheckCircle size={14} /> Approve & Complete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ManageCampaign;
