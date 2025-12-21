import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Search, 
  Activity, 
  Database,
  Lock
} from 'lucide-react';

const AdminDashboard = () => {
  // MOCK DATA: Pending Verifications
  const [reviews, setReviews] = useState([
    { id: 1, name: 'Maxis Berhad', regNo: '198601000222', domain: 'maxis.com.my', status: 'pending', risk: 'low' },
    { id: 2, name: 'Tech Scam LLP', regNo: '202501009999', domain: 'hotmail.com', status: 'pending', risk: 'high' },
    { id: 3, name: 'Random Shop', regNo: '---', domain: 'random.net', status: 'pending', risk: 'medium' },
  ]);

  const handleVerdict = (id, verdict) => {
    alert(`System Verdict: ${verdict.toUpperCase()} for ID #${id}`);
    setReviews(reviews.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6">
      
      {/* 1. SYSTEM HEADER (Matrix Style) */}
      <div className="border-b border-green-900 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl text-green-500 font-bold uppercase tracking-widest flex items-center gap-3">
            <Database size={24} /> System Core // Admin
          </h1>
          <p className="text-green-800 text-xs mt-1">
            Uptime: 99.9% | Active Nodes: 1,402 | Threat Level: <span className="text-white">NOMINAL</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase">Administrator</div>
          <div className="text-white font-bold">ROOT_USER</div>
        </div>
      </div>

      {/* 2. STATS ROW */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Reviews', value: '3', color: 'text-yellow-500' },
          { label: 'System Flags', value: '12', color: 'text-red-500' },
          { label: 'Total Users', value: '14.5k', color: 'text-blue-500' },
          { label: 'Revenue Pool', value: 'RM 120k', color: 'text-green-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 p-4">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 3. MAIN INTERFACE: The Judgment Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Verification Queue */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-500" /> Entity Verification Queue
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-gray-800 text-gray-400">Filter: ALL</span>
              <span className="px-2 py-1 bg-gray-800 text-gray-400">Sort: RISK</span>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((company) => (
              <div key={company.id} className="bg-gray-900 border border-gray-800 p-4 hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{company.name}</h3>
                    <div className="text-xs text-gray-500 font-mono mt-1">
                      REG: {company.regNo} | DOMAIN: {company.domain}
                    </div>
                  </div>
                  {company.risk === 'high' && (
                    <div className="bg-red-900/20 text-red-500 border border-red-900 px-2 py-1 text-[10px] uppercase font-bold animate-pulse">
                      High Risk Detect
                    </div>
                  )}
                  {company.risk === 'low' && (
                    <div className="bg-green-900/20 text-green-500 border border-green-900 px-2 py-1 text-[10px] uppercase font-bold">
                      Verified Domain
                    </div>
                  )}
                </div>

                {/* Verdict Actions */}
                <div className="flex gap-3 border-t border-gray-800 pt-4">
                  <button 
                    onClick={() => handleVerdict(company.id, 'approved')}
                    className="flex-1 bg-green-900/20 hover:bg-green-600 hover:text-black border border-green-800 text-green-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle size={14} /> Verify Entity
                  </button>
                  <button 
                    onClick={() => handleVerdict(company.id, 'manual_review')}
                    className="flex-1 bg-yellow-900/20 hover:bg-yellow-600 hover:text-black border border-yellow-800 text-yellow-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Search size={14} /> Request Docs
                  </button>
                  <button 
                    onClick={() => handleVerdict(company.id, 'banned')}
                    className="flex-1 bg-red-900/20 hover:bg-red-600 hover:text-black border border-red-800 text-red-500 py-2 text-xs uppercase font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <XCircle size={14} /> Ban IP
                  </button>
                </div>
              </div>
            ))}
            
            {reviews.length === 0 && (
              <div className="p-8 text-center text-gray-600 border border-dashed border-gray-800">
                <CheckCircle className="mx-auto mb-2 opacity-50" />
                Queue Empty. System Nominal.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: System Logs */}
        <div className="bg-gray-900/30 border border-gray-800 p-4 h-fit">
          <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} /> Live Feed
          </h3>
          <div className="space-y-3 font-mono text-[10px]">
            <div className="text-gray-500">
              <span className="text-blue-500">[14:02:11]</span> New User Registered: student_002
            </div>
            <div className="text-gray-500">
              <span className="text-yellow-500">[14:05:44]</span> Failed Login: admin_root (IP: 192.168.1.1)
            </div>
            <div className="text-gray-500">
              <span className="text-green-500">[14:10:00]</span> Payment Processed: #TXN_99281
            </div>
            <div className="text-gray-500">
              <span className="text-blue-500">[14:12:33]</span> Quest Created: "AI Model Training"
            </div>
            <div className="border-t border-gray-800 pt-2 mt-2">
              <input type="text" placeholder="> Execute Command..." className="w-full bg-black border border-gray-700 text-white px-2 py-1 outline-none focus:border-green-500" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;