import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Code2, Video, Calendar, Plus, Trash, ArrowLeft, Save, Upload, CheckCircle, Sparkles } from 'lucide-react';
import api from '../api/client';

const CreateCampaign = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Category: 'SOFTWARE_DEVELOPMENT' or 'DIGITAL_MARKETING'
  const [category, setCategory] = useState('SOFTWARE_DEVELOPMENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState(2500);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  // Software Dev Specific
  const [softwareSubType, setSoftwareSubType] = useState('CRM');
  const [techStack, setTechStack] = useState('React, Django, PostgreSQL');
  const [projectOutcome, setProjectOutcome] = useState('');

  // Digital Marketing Specific
  const [campaignObjective, setCampaignObjective] = useState('');
  const [targetPlatforms, setTargetPlatforms] = useState(['TikTok', 'Instagram Reels']);

  // Dynamic Deliverables
  const [deliverables, setDeliverables] = useState([
    'Clean GitHub Repository & CI/CD Documentation',
    'Live Deployed Staging URL with Test Accounts',
    'Technical Architecture & Handover PDF'
  ]);

  // Client Asset Upload
  const [assetFile, setAssetFile] = useState(null);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    if (newCat === 'SOFTWARE_DEVELOPMENT') {
      setDeliverables([
        'Clean GitHub Repository & CI/CD Documentation',
        'Live Deployed Staging URL with Test Accounts',
        'Technical Architecture & Handover PDF'
      ]);
    } else {
      setDeliverables([
        '3 Edited Short-Form Vertical Videos (9:16 MP4)',
        'Copywriting & Hashtag Strategy Document',
        'Performance Analytics Campaign Summary'
      ]);
    }
  };

  const addDeliverable = () => setDeliverables([...deliverables, '']);
  const removeDeliverable = (idx) => setDeliverables(deliverables.filter((_, i) => i !== idx));
  const handleDeliverableChange = (idx, val) => {
    const next = [...deliverables];
    next[idx] = val;
    setDeliverables(next);
  };

  const togglePlatform = (p) => {
    if (targetPlatforms.includes(p)) {
      setTargetPlatforms(targetPlatforms.filter(item => item !== p));
    } else {
      setTargetPlatforms([...targetPlatforms, p]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Please fill in title and description', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        type: category,
        budget: parseFloat(budget),
        deadline: deadline || null,
        requirements: deliverables.filter(d => d.trim() !== ''),
        software_sub_type: category === 'SOFTWARE_DEVELOPMENT' ? softwareSubType : null,
        required_skills: category === 'SOFTWARE_DEVELOPMENT' ? techStack.split(',').map(s => s.trim()) : [],
        project_outcome: category === 'SOFTWARE_DEVELOPMENT' ? projectOutcome : '',
        campaign_objective: category === 'DIGITAL_MARKETING' ? campaignObjective : '',
        target_platforms: category === 'DIGITAL_MARKETING' ? targetPlatforms : []
      };

      const res = await api.post('/campaigns/', payload);
      const newJobId = res.data.id;

      // Upload initial client asset if provided
      if (assetFile) {
        const formData = new FormData();
        formData.append('file', assetFile);
        formData.append('title', assetFile.name);
        formData.append('asset_type', category === 'DIGITAL_MARKETING' ? 'RAW_VIDEO' : 'DOCUMENT');
        await api.post(`/campaigns/${newJobId}/assets/`, formData);
      }

      showToast('Project Order posted! UniPact Admin is now curating talent matches.', 'success');
      navigate('/company/dashboard');
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to create job', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body p-6 md:p-10 selection:bg-[#00AEEF] selection:text-[#0A1748]">
      <div className="max-w-4xl mx-auto">
        {/* Navigation back */}
        <button
          onClick={() => navigate('/company/dashboard')}
          className="text-xs font-semibold text-[#5B6478] hover:text-[#0A1748] flex items-center gap-1.5 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <div className="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-8 sm:p-10 shadow-sm relative">
          {/* Header */}
          <div className="border-b border-[rgba(10,23,72,0.08)] pb-6 mb-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#00AEEF] mb-1">
              <Sparkles size={14} /> Curated Talent Marketplace Order
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A1748]">Post a New Project Order</h1>
            <p className="text-[#5B6478] text-xs mt-1">
              Specify your project requirements. UniPact Admin evaluates verified talent and curates the optimal student match.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. Category Selection */}
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-[#00AEEF] block mb-3">
                Step 1: Select Work Category (*)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => handleCategoryChange('SOFTWARE_DEVELOPMENT')}
                  className={`cursor-pointer p-4 rounded border transition-all flex items-start gap-3.5 ${
                    category === 'SOFTWARE_DEVELOPMENT'
                      ? 'border-[var(--text-gold)] bg-[var(--text-gold)]/10 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                      : 'border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] border-[rgba(10,23,72,0.12)] hover:border-[#00AEEF]'
                  }`}
                >
                  <Code2 className={`w-6 h-6 mt-0.5 ${category === 'SOFTWARE_DEVELOPMENT' ? 'text-[#00AEEF]' : 'text-[#5B6478]'}`} />
                  <div>
                    <h3 className="text-sm font-bold text-[#0A1748]">Software Development</h3>
                    <p className="text-xs text-[#5B6478] mt-0.5">Automation websites, CRM, ERP, HRMS, Landing Pages.</p>
                  </div>
                </div>

                <div
                  onClick={() => handleCategoryChange('DIGITAL_MARKETING')}
                  className={`cursor-pointer p-4 rounded border transition-all flex items-start gap-3.5 ${
                    category === 'DIGITAL_MARKETING'
                      ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                      : 'border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] border-[rgba(10,23,72,0.12)] hover:border-[#00AEEF]'
                  }`}
                >
                  <Video className={`w-6 h-6 mt-0.5 ${category === 'DIGITAL_MARKETING' ? 'text-cyan-400' : 'text-[#5B6478]'}`} />
                  <div>
                    <h3 className="text-sm font-bold text-[#0A1748]">Digital Marketing</h3>
                    <p className="text-xs text-[#5B6478] mt-0.5">Content campaigns, raw video editing, TikTok / Reels KPIs.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Category-Specific Fields */}
            {category === 'SOFTWARE_DEVELOPMENT' ? (
              <div className="p-5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-xl space-y-4">
                <span className="text-xs font-bold text-[#00AEEF] uppercase tracking-wider block">
                  Software Development Specifications (REQ-3.3.1)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#0A1748] block mb-1">Sub-Type (*)</label>
                    <select
                      value={softwareSubType}
                      onChange={(e) => setSoftwareSubType(e.target.value)}
                      className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-[var(--text-gold)] focus:outline-none"
                    >
                      <option value="Landing Page / Website">Landing Page / Website</option>
                      <option value="ERP">ERP (Enterprise Resource Planning)</option>
                      <option value="HRMS">HRMS (Human Resource Management)</option>
                      <option value="CRM">CRM (Customer Relationship Management)</option>
                      <option value="Other Automation Tool">Other Automation Tool</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#0A1748] block mb-1">Required Skills / Tech Stack (*)</label>
                    <input
                      type="text"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      placeholder="e.g. React, Django, PostgreSQL, Docker"
                      className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-[var(--text-gold)] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#0A1748] block mb-1">Project Outcome Description</label>
                  <textarea
                    rows={2}
                    value={projectOutcome}
                    onChange={(e) => setProjectOutcome(e.target.value)}
                    placeholder="Describe expected system outcomes, e.g. Lead ingestion pipeline with automated email notifications..."
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-[var(--text-gold)] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="p-5 bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-xl space-y-4">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  Digital Marketing Specifications (REQ-3.3.1)
                </span>
                <div>
                  <label className="text-xs text-[#0A1748] block mb-1">Campaign Objective (*)</label>
                  <input
                    type="text"
                    value={campaignObjective}
                    onChange={(e) => setCampaignObjective(e.target.value)}
                    placeholder="e.g. Brand awareness, App installs, Viral campus outreach"
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] p-2 text-xs rounded focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#0A1748] block mb-2">Target Platforms & Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'Xiaohongshu'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                          targetPlatforms.includes(p)
                            ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                            : 'border-slate-700 bg-[#F5F7FC] text-[#5B6478]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Common Project Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">Project Title (*)</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Enterprise CRM Pipeline Automation"
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748] p-2.5 text-sm rounded focus:border-[var(--text-gold)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#0A1748] block mb-1">Project Description (* Markdown)</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the technical or creative scope, user roles, integrations, and milestones..."
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748] p-2.5 text-sm rounded focus:border-[var(--text-gold)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#0A1748] block mb-1">Project Budget (MYR) (*)</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748] p-2.5 text-sm rounded focus:border-[var(--text-gold)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#0A1748] block mb-1">Matching & Delivery Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748] p-2.5 text-sm rounded focus:border-[var(--text-gold)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 4. Required Deliverables Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#0A1748]">Required Deliverables Checklist (*)</label>
                <button
                  type="button"
                  onClick={addDeliverable}
                  className="text-xs text-[#00AEEF] hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add Deliverable
                </button>
              </div>
              <div className="space-y-2">
                {deliverables.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleDeliverableChange(idx, e.target.value)}
                      placeholder="e.g. GitHub Repository, Deployed URL, Video clip"
                      className="flex-1 bg-[#F5F7FC] border border-[rgba(10,23,72,0.12)] text-[#0A1748] p-2 text-xs rounded focus:border-[var(--text-gold)] focus:outline-none"
                    />
                    {deliverables.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDeliverable(idx)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Client Asset Repository Upload */}
            <div>
              <label className="text-xs font-semibold text-[#0A1748] block mb-1">
                Client Asset Repository (Briefs, Brand Assets, Raw Footage per REQ-3.3.3)
              </label>
              <div className="border-2 border-dashed border-[rgba(10,23,72,0.12)] hover:border-[var(--text-gold)] rounded p-4 text-center cursor-pointer relative bg-black/20 transition-colors">
                <input
                  type="file"
                  onChange={(e) => e.target.files && setAssetFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="mx-auto text-[#00AEEF] mb-1.5 w-6 h-6" />
                {assetFile ? (
                  <div className="text-xs text-green-400 font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={14} /> {assetFile.name}
                  </div>
                ) : (
                  <div className="text-xs text-[#5B6478]">
                    <span className="text-[#00AEEF] font-semibold">Attach raw project assets</span> (PDF brief, brand guidelines, or raw footage)
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(10,23,72,0.12)]">
              <button
                type="button"
                onClick={() => navigate('/company/dashboard')}
                className="px-4 py-2.5 rounded text-xs text-[#5B6478] hover:text-[#0A1748] border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded bg-[var(--text-gold)] hover:bg-yellow-400 text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {loading ? 'Publishing Order...' : 'Publish Job Order (Free)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaign;
