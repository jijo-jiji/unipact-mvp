import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scroll, Coins, Calendar, Plus, Trash, ArrowLeft, Save } from 'lucide-react';
import api from '../api/client';

const CreateCampaign = () => {
  const navigate = useNavigate();

  // === STATE MANAGEMENT (The Brain) ===
  // React needs to "remember" what the user types.
  const [questType, setQuestType] = useState('bounty'); // 'bounty' or 'ambassador'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState(1000);
  const [deadline, setDeadline] = useState(''); // New State

  // Dynamic List State
  const [deliverables, setDeliverables] = useState(['Final Report (PDF)']);

  // === HELPER FUNCTIONS (The Logic) ===

  // 1. Add a blank line to the list
  const addDeliverable = () => {
    setDeliverables([...deliverables, '']);
  };

  // 2. Remove a specific line (by index)
  const removeDeliverable = (indexToDelete) => {
    const newList = deliverables.filter((_, index) => index !== indexToDelete);
    setDeliverables(newList);
  };

  // 3. Update text when typing in a dynamic line
  const handleDeliverableChange = (index, newValue) => {
    const newList = [...deliverables];
    newList[index] = newValue;
    setDeliverables(newList);
  };

  // 4. Handle Submit (Simulated for now)
  const handleSubmit = async () => {
    // Map to API specific format
    // backend expects 'type' (TALENT_BOUNTY or BRAND_AMBASSADOR)
    const typeMapping = {
      'bounty': 'TALENT_BOUNTY',
      'ambassador': 'BRAND_AMBASSADOR'
    }

    const payload = {
      title,
      description,
      budget: parseFloat(budget),
      type: typeMapping[questType],
      requirements: deliverables.filter(d => d.trim() !== ""), // Remove empty lines
      deadline: deadline ? deadline : null
    };

    console.log("Submitting Quest:", payload);

    try {
      await api.post('/campaigns/', payload);
      alert("Quest Activated Successfully!");
      navigate('/company/dashboard');
    } catch (error) {
      console.error("Failed to create campaign", error);
      alert("System Error: Failed to activate quest.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-6 flex justify-center">

      <div className="w-full max-w-5xl animate-fade-in">

        {/* 1. HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/company/dashboard')}
              className="flex items-center gap-2 text-[var(--text-blue)] hover:text-[var(--text-gold)] mb-2 transition-colors"
            >
              <ArrowLeft size={16} /> Return to Command Center
            </button>
            <h1 className="text-3xl text-white font-display uppercase tracking-wider">
              Initialize New Quest
            </h1>
            <p className="text-[var(--text-blue)] text-sm">Define parameters for Hunter recruitment.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 2. MAIN FORM (LEFT) */}
          <div className="lg:col-span-2 space-y-6">

            {/* PANEL: Quest Details */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6 relative">
              {/* Decorative Corners */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[var(--text-gold)]"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[var(--text-gold)]"></div>

              {/* Type Selection */}
              <div className="mb-6">
                <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-3">Quest Class</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Option A: Bounty */}
                  <div
                    onClick={() => setQuestType('bounty')}
                    className={`cursor-pointer border p-4 flex items-center gap-3 transition-all ${questType === 'bounty' ? 'border-[var(--text-gold)] bg-[var(--text-gold)]/10' : 'border-[var(--border-tech)] hover:border-white'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${questType === 'bounty' ? 'border-[var(--text-gold)]' : 'border-gray-500'}`}>
                      {questType === 'bounty' && <div className="w-2 h-2 bg-[var(--text-gold)] rounded-full" />}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">Mercenary Bounty</div>
                      <div className="text-[var(--text-blue)] text-xs">One-off project task</div>
                    </div>
                  </div>

                  {/* Option B: Ambassador */}
                  <div
                    onClick={() => setQuestType('ambassador')}
                    className={`cursor-pointer border p-4 flex items-center gap-3 transition-all ${questType === 'ambassador' ? 'border-[var(--text-gold)] bg-[var(--text-gold)]/10' : 'border-[var(--border-tech)] hover:border-white'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${questType === 'ambassador' ? 'border-[var(--text-gold)]' : 'border-gray-500'}`}>
                      {questType === 'ambassador' && <div className="w-2 h-2 bg-[var(--text-gold)] rounded-full" />}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">Royal Herald</div>
                      <div className="text-[var(--text-blue)] text-xs">Brand Ambassadorship</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div className="mb-6">
                <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Quest Title</label>
                <div className="relative">
                  <Scroll className="absolute left-3 top-3 text-[var(--text-blue)]" size={18} />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g. Protocol Omega: Mobile App Launch"
                    className="w-full bg-black/30 border border-[var(--border-tech)] text-white pl-10 pr-4 py-3 focus:border-[var(--text-gold)] focus:outline-none transition-colors placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="mb-6">
                <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Mission Briefing</label>
                <textarea
                  rows="6"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the objectives, constraints, and success criteria..."
                  className="w-full bg-black/30 border border-[var(--border-tech)] text-white p-4 focus:border-[var(--text-gold)] focus:outline-none transition-colors placeholder-gray-600"
                ></textarea>
              </div>

              {/* Dynamic Deliverables (The Hard Part made Easy) */}
              <div>
                <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider block mb-2">Clear Conditions (Deliverables)</label>
                <div className="space-y-3">
                  {deliverables.map((item, index) => (
                    <div key={index} className="flex gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleDeliverableChange(index, e.target.value)}
                        className="flex-1 bg-black/30 border border-[var(--border-tech)] text-white px-4 py-2 text-sm focus:border-[var(--text-gold)] focus:outline-none"
                        placeholder="E.g. Final Report PDF"
                      />
                      <button
                        onClick={() => removeDeliverable(index)}
                        className="p-2 border border-red-900 text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addDeliverable}
                    className="w-full py-2 border border-dashed border-[var(--text-blue)] text-[var(--text-blue)] text-sm hover:border-[var(--text-gold)] hover:text-[var(--text-gold)] transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Condition
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* 3. SIDEBAR (RIGHT) */}
          <div className="space-y-6">

            {/* Rewards Panel */}
            <div className="bg-[var(--bg-panel)] border border-[var(--border-tech)] p-6">
              <h3 className="text-white font-display uppercase tracking-wider mb-4 flex items-center gap-2">
                <Coins size={18} className="text-[var(--text-gold)]" /> Rewards
              </h3>

              <div className="mb-4">
                <label className="text-[var(--text-blue)] text-xs uppercase block mb-1">Reward Pool (MYR)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-black/30 border border-[var(--text-gold)] text-[var(--text-gold)] font-display text-xl px-4 py-2 text-right focus:outline-none"
                />
              </div>

              <div className="mb-6">
                <label className="text-[var(--text-blue)] text-xs uppercase block mb-1">Deadline</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-[var(--text-blue)]" size={16} />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-black/30 border border-[var(--border-tech)] text-white pl-10 pr-4 py-2 text-sm focus:border-[var(--text-gold)] focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="border-t border-[var(--border-tech)] pt-4 space-y-3">
                <button
                  onClick={handleSubmit}
                  className="w-full bg-[var(--text-gold)] text-black font-bold py-3 uppercase tracking-widest hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all"
                >
                  Activate Quest
                </button>
                <button className="w-full border border-[var(--text-blue)] text-[var(--text-blue)] font-bold py-3 uppercase tracking-widest hover:bg-[var(--text-blue)] hover:text-black transition-all flex items-center justify-center gap-2">
                  <Save size={16} /> Save Blueprint
                </button>
              </div>
            </div>

            {/* Tips Panel */}
            <div className="bg-[var(--text-blue)]/5 p-4 border border-[var(--text-blue)]/20 text-xs text-[var(--text-blue)]">
              <strong className="block text-[var(--text-gold)] mb-1">System Tip:</strong>
              Clear conditions increase Hunter success rates by 40%. Be specific about file formats (PDF, JPG).
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateCampaign;