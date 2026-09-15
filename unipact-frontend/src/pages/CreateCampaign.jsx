import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Code2, Video, Plus, Trash2, ArrowLeft, Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/client';
import WorkspaceNav from '../components/WorkspaceNav';
import { getErrorMessage } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const DEFAULT_DELIVERABLES = {
  SOFTWARE_DEVELOPMENT: [
    'Clean GitHub repository with setup documentation',
    'Live staging URL with test accounts',
    'Technical architecture & handover PDF',
  ],
  DIGITAL_MARKETING: [
    '3 edited short-form vertical videos (9:16 MP4)',
    'Copywriting & hashtag strategy document',
    'Campaign performance summary',
  ],
};

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'Xiaohongshu'];

const StepHeading = ({ number, title, description }) => (
  <div className="flex items-start gap-3 mb-4">
    <span className="w-7 h-7 rounded-full bg-[#0B1E63] text-white text-xs font-bold flex items-center justify-center shrink-0">{number}</span>
    <div>
      <h2 className="font-heading font-bold text-lg">{title}</h2>
      {description && <p className="text-sm text-[#5B6478]">{description}</p>}
    </div>
  </div>
);

const today = () => new Date().toISOString().split('T')[0];

const CreateCampaign = () => {
  usePageTitle('Post a project');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [category, setCategory] = useState('SOFTWARE_DEVELOPMENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState(2500);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [softwareSubType, setSoftwareSubType] = useState('Landing Page / Website');
  const [techStack, setTechStack] = useState('React, Django, PostgreSQL');
  const [projectOutcome, setProjectOutcome] = useState('');

  const [campaignObjective, setCampaignObjective] = useState('');
  const [targetPlatforms, setTargetPlatforms] = useState(['TikTok', 'Instagram Reels']);

  const [deliverables, setDeliverables] = useState(DEFAULT_DELIVERABLES.SOFTWARE_DEVELOPMENT);
  const [assetFile, setAssetFile] = useState(null);

  const isDev = category === 'SOFTWARE_DEVELOPMENT';

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setDeliverables(DEFAULT_DELIVERABLES[newCat]);
  };

  const updateDeliverable = (idx, val) => setDeliverables(deliverables.map((d, i) => (i === idx ? val : d)));

  const togglePlatform = (p) =>
    setTargetPlatforms(targetPlatforms.includes(p) ? targetPlatforms.filter((x) => x !== p) : [...targetPlatforms, p]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const requirements = deliverables.map((d) => d.trim()).filter(Boolean);
    const skills = techStack.split(',').map((s) => s.trim()).filter(Boolean);
    if (isDev && skills.length === 0) return setError('List at least one required skill.');
    if (!isDev && !campaignObjective.trim()) return setError('Please describe the campaign objective.');
    if (requirements.length === 0) return setError('Add at least one deliverable so students know what to hand in.');
    if (Number(budget) < 100) return setError('The minimum project budget is RM 100.');

    setLoading(true);
    try {
      const res = await api.post('/campaigns/', {
        title: title.trim(),
        description: description.trim(),
        type: category,
        budget: parseFloat(budget),
        deadline: deadline || null,
        requirements,
        software_sub_type: isDev ? softwareSubType : null,
        required_skills: isDev ? skills : [],
        project_outcome: isDev ? projectOutcome : '',
        campaign_objective: isDev ? '' : campaignObjective,
        target_platforms: isDev ? [] : targetPlatforms,
      });

      if (assetFile) {
        const formData = new FormData();
        formData.append('file', assetFile);
        formData.append('title', assetFile.name);
        formData.append('asset_type', isDev ? 'DOCUMENT' : 'RAW_VIDEO');
        try {
          await api.post(`/campaigns/${res.data.id}/assets/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch {
          showToast('Project posted, but the file failed to upload. You can add it from the project page.', 'error');
          navigate(`/manage-campaign/${res.data.id}`);
          return;
        }
      }

      showToast('Project posted! A UniPact admin will now match the right students.', 'success');
      navigate(`/manage-campaign/${res.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not post the project.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const categoryCard = (value, Icon, heading, text) => {
    const selected = category === value;
    return (
      <button
        type="button"
        onClick={() => handleCategoryChange(value)}
        aria-pressed={selected}
        className={`text-left p-4 rounded-lg border-2 transition-all flex items-start gap-3.5 ${
          selected ? 'border-[#00AEEF] bg-[#00AEEF]/5 shadow-sm' : 'border-[rgba(10,23,72,0.12)] bg-[#F5F7FC] hover:border-[#00AEEF]/50'
        }`}
      >
        <Icon className={`w-6 h-6 mt-0.5 shrink-0 ${selected ? 'text-[#00AEEF]' : 'text-[#5B6478]'}`} />
        <div>
          <h3 className="text-base font-bold">{heading}</h3>
          <p className="text-sm text-[#5B6478] mt-0.5">{text}</p>
        </div>
        {selected && <CheckCircle2 size={18} className="text-[#00AEEF] ml-auto shrink-0" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body">
      <WorkspaceNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <Link to="/company/dashboard" className="back-link mb-6">
          <ArrowLeft size={15} /> Back to projects
        </Link>

        <div className="mb-6">
          <p className="eyebrow mb-1"><span className="eyebrow-dot" /> Free to post</p>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Post a new project</h1>
          <p className="text-[#5B6478] text-sm mt-1">Tell us what you need. A UniPact admin reviews verified students and proposes the best match for you to confirm.</p>
        </div>

        {error && (
          <div className="alert-error mb-6" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span></div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="card p-6 sm:p-8">
            <StepHeading number={1} title="Choose a category" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryCard('SOFTWARE_DEVELOPMENT', Code2, 'Software development', 'Websites, CRM, ERP, HR systems, automation tools.')}
              {categoryCard('DIGITAL_MARKETING', Video, 'Digital marketing', 'Content campaigns, video editing, TikTok & Reels.')}
            </div>
          </section>

          <section className="card p-6 sm:p-8 space-y-4">
            <StepHeading number={2} title="Describe the project" />
            <div>
              <label className="field-label" htmlFor="title">Project title</label>
              <input id="title" required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isDev ? 'e.g. Customer CRM with lead pipeline' : 'e.g. Campus launch campaign on TikTok'} className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="description">Description</label>
              <textarea id="description" rows={5} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the scope, who will use it, any integrations and the result you're after." className="input" />
            </div>

            {isDev ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="field-label" htmlFor="subtype">Project type</label>
                  <select id="subtype" value={softwareSubType} onChange={(e) => setSoftwareSubType(e.target.value)} className="input">
                    <option value="Landing Page / Website">Landing page / website</option>
                    <option value="ERP">ERP (enterprise resource planning)</option>
                    <option value="HRMS">HRMS (HR management)</option>
                    <option value="CRM">CRM (customer relationship management)</option>
                    <option value="Other Automation Tool">Other automation tool</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="skills">Required skills</label>
                  <input id="skills" value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="React, Django, PostgreSQL" className="input" />
                  <p className="field-hint">Separate skills with commas.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="field-label" htmlFor="outcome">Expected outcome (optional)</label>
                  <textarea id="outcome" rows={2} value={projectOutcome} onChange={(e) => setProjectOutcome(e.target.value)} placeholder="e.g. Leads captured from the website land in the CRM with automatic email follow-ups." className="input" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="objective">Campaign objective</label>
                  <input id="objective" value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} placeholder="e.g. Brand awareness among university students" className="input" />
                </div>
                <div>
                  <span className="field-label">Target platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const on = targetPlatforms.includes(p);
                      return (
                        <button key={p} type="button" aria-pressed={on} onClick={() => togglePlatform(p)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${on ? 'border-[#00AEEF] bg-[#00AEEF]/10 text-[#0090C6] font-semibold' : 'border-[rgba(10,23,72,0.15)] bg-white text-[#5B6478] hover:border-[#00AEEF]/50'}`}>
                          {on && <CheckCircle2 size={13} className="inline mr-1 -mt-0.5" />}{p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card p-6 sm:p-8 space-y-4">
            <StepHeading number={3} title="Budget & timeline" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="budget">Budget</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#5B6478]">RM</span>
                  <input id="budget" type="number" required min={100} step="50" value={budget} onChange={(e) => setBudget(e.target.value)} className="input pl-11" />
                </div>
                <p className="field-hint">Minimum RM 100. This is what the student team is paid.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="deadline">Deadline (optional)</label>
                <input id="deadline" type="date" min={today()} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
              </div>
            </div>
          </section>

          <section className="card p-6 sm:p-8">
            <StepHeading number={4} title="Deliverables" description="What should the students hand over when they're done?" />
            <div className="space-y-2">
              {deliverables.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm text-[#5B6478] w-5 text-right">{idx + 1}.</span>
                  <input value={item} onChange={(e) => updateDeliverable(idx, e.target.value)} placeholder="e.g. Deployed demo URL" className="input" aria-label={`Deliverable ${idx + 1}`} />
                  <button type="button" onClick={() => setDeliverables(deliverables.filter((_, i) => i !== idx))} disabled={deliverables.length === 1}
                    className="p-2 rounded-md text-[#5B6478] hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent" aria-label={`Remove deliverable ${idx + 1}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setDeliverables([...deliverables, ''])} className="btn-secondary btn-sm mt-3">
              <Plus size={14} /> Add deliverable
            </button>
          </section>

          <section className="card p-6 sm:p-8">
            <StepHeading number={5} title="Share files (optional)" description="Briefs, brand guidelines or raw footage. You can add more later." />
            <label className="block border-2 border-dashed border-[rgba(10,23,72,0.15)] hover:border-[#00AEEF] rounded-lg p-6 text-center cursor-pointer bg-[#F5F7FC] transition-colors">
              <input type="file" onChange={(e) => setAssetFile(e.target.files?.[0] || null)} className="sr-only" />
              <Upload className="mx-auto text-[#00AEEF] mb-2 w-6 h-6" />
              {assetFile ? (
                <span className="text-sm text-emerald-700 font-medium inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> {assetFile.name}</span>
              ) : (
                <span className="text-sm text-[#5B6478]"><span className="text-[#0090C6] font-semibold">Choose a file</span> to upload</span>
              )}
            </label>
          </section>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
            <Link to="/company/dashboard" className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-3">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Posting…</> : 'Post project for free'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateCampaign;
