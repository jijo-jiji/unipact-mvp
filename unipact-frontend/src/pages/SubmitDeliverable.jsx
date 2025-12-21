import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, UploadCloud, FileText, CheckCircle } from 'lucide-react';

const SubmitDeliverable = () => {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post(`/campaigns/application/${applicationId}/deliverable/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            alert("Mission Accomplished! Deliverable Uploaded.");
            navigate('/student/dashboard');
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload Failed: " + (error.response?.data?.detail || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-void)] p-6 flex flex-col items-center justify-center text-white">
            <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative animate-fade-in">

                <button
                    onClick={() => navigate('/student/dashboard')}
                    className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#a020f0]/20 border border-[#a020f0] rounded-full flex items-center justify-center mx-auto mb-4">
                        <UploadCloud className="text-[#a020f0]" size={32} />
                    </div>
                    <h1 className="text-2xl font-display font-bold uppercase tracking-wide">Upload Deliverables</h1>
                    <p className="text-gray-400 text-sm mt-2">Submit your proof of work to complete the mission.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="border-2 border-dashed border-gray-700 hover:border-[#a020f0] transition-colors p-8 text-center cursor-pointer relative">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileText className="text-white" size={32} />
                                <span className="text-sm font-bold text-[#a020f0]">{file.name}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                                <UploadCloud size={32} />
                                <span className="text-xs uppercase tracking-wider">Click or Drag File Here</span>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className={`w-full py-3 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${file && !uploading
                                ? 'bg-[#a020f0] hover:bg-[#8e1cc1] text-white shadow-[0_0_15px_#a020f0]'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {uploading ? 'Transmitting...' : 'Confirm Upload'}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default SubmitDeliverable;
