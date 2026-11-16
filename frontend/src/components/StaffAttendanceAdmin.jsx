import { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint, Clock, Calendar, CheckCircle2, AlertTriangle, UserCheck,
  UserX, RefreshCw, Smartphone, Camera, Settings, Plus, Sparkles
} from 'lucide-react';
import { attendanceApi } from '../services/api';

export default function StaffAttendanceAdmin({ activeBranchId, branches = [] }) {
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId || 1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Quick Punch Modal (Simulator / POS Kiosk)
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [punchUser, setPunchUser] = useState('');
  const [punchSource, setPunchSource] = useState('Biometric_Fingerprint');
  const [punchLoading, setPunchLoading] = useState(false);

  // Device Integration Settings Modal
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceApi.daily({
        branchId: selectedBranchId,
        date: selectedDate
      });
      setAttendanceData(data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleRecordPunch = async (e) => {
    e.preventDefault();
    if (!punchUser) {
      alert('অনুগ্রহ করে একজন স্টাফ সিলেক্ট করুন।');
      return;
    }
    setPunchLoading(true);
    try {
      const res = await attendanceApi.punch({
        userId: parseInt(punchUser),
        branchId: selectedBranchId,
        punchSource
      });
      setSuccessMsg(res.message);
      setShowPunchModal(false);
      setPunchUser('');
      loadAttendance();
    } catch (err) {
      alert(err?.response?.data?.message || 'পাঞ্চ ব্যর্থ হয়েছে।');
    } finally {
      setPunchLoading(false);
    }
  };

  const records = attendanceData?.records || [];
  const summary = attendanceData?.summary || { totalStaff: 0, presentCount: 0, lateCount: 0, overtimeCount: 0, absentCount: 0 };

  const getStatusBadge = (rec) => {
    if (rec.status === 'Absent') {
      return { bg: '#fee2e2', text: '#991b1b', label: 'অনুপস্থিত (Absent)' };
    }
    if (rec.lateMinutes > 0) {
      return { bg: '#fef3c7', text: '#b45309', label: `লেট (${rec.lateMinutes}m Late)` };
    }
    if (rec.overtimeHours > 0) {
      return { bg: '#dbeafe', text: '#1d4ed8', label: `ওভারটাইম (+${rec.overtimeHours}h OT)` };
    }
    if (rec.status === 'EarlyLeave') {
      return { bg: '#ffedd5', text: '#c2410c', label: `আগে প্রস্থান (${rec.earlyExitMinutes}m Early)` };
    }
    return { bg: '#dcfce7', text: '#15803d', label: 'উপস্থিত (On-Time)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Bar & Filter Controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', background: '#fff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ fontSize: '0.74rem', color: '#ea580c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Biometric & Shift Time Tracking
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
            অটো হাজিরা ও কর্মঘণ্টা ট্র্যাকিং (Attendance Log)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}
          />

          <button
            onClick={loadAttendance}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={() => setShowDeviceSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <Settings size={15} /> বায়োমেট্রিক মেশিন সেটআপ
          </button>

          <button
            onClick={() => setShowPunchModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ea580c', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <Fingerprint size={16} /> টেস্ট পাঞ্চ / চেক-ইন
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 18px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /> {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>✕</button>
        </div>
      )}

      {error && <div role="alert" style={{ padding: '12px 16px', borderRadius: 8, color: '#b91c1c', background: '#fef2f2' }}>{error}</div>}

      {/* ── KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#f1f5f9', color: '#475569', padding: '12px', borderRadius: '10px' }}><Clock size={22} /></div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>মোট কর্মী (Total Staff)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{summary.totalStaff}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: '10px' }}><UserCheck size={22} /></div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>আজ উপস্থিত (Present)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
              {summary.presentCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>({summary.totalStaff > 0 ? Math.round((summary.presentCount / summary.totalStaff) * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '10px' }}><AlertTriangle size={22} /></div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>দেরি আগমন (Late)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>{summary.lateCount} জন</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#dbeafe', color: '#2563eb', padding: '12px', borderRadius: '10px' }}><Sparkles size={22} /></div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>ওভারটাইম (Overtime)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>{summary.overtimeCount} জন</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '10px' }}><UserX size={22} /></div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>অনুপস্থিত (Absent)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>{summary.absentCount} জন</div>
          </div>
        </div>
      </div>

      {/* ── Attendance Log Table ── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
            তারিখ: {new Date(selectedDate).toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            নির্ধারিত শিফট: <b>09:00 AM - 06:00 PM</b> (গ্রেস পিরিয়ড: ১৫ মিনিট)
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '14px 18px' }}>Staff Name & Role</th>
                <th style={{ padding: '14px 18px' }}>Check-In Time</th>
                <th style={{ padding: '14px 18px' }}>Check-Out Time</th>
                <th style={{ padding: '14px 18px' }}>মোট কর্মঘণ্টা (Work Duration)</th>
                <th style={{ padding: '14px 18px' }}>হাজিরা মাধ্যম (Method)</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    এই ব্রাঞ্চে কোনো রেজিস্টার্ড স্টাফ পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                records.map(rec => {
                  const badge = getStatusBadge(rec);
                  return (
                    <tr key={rec.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{rec.fullName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          <span style={{ fontWeight: 700, color: '#ea580c' }}>{rec.role}</span> • {rec.email}
                        </div>
                      </td>

                      {/* Check-In */}
                      <td style={{ padding: '14px 18px' }}>
                        {rec.checkIn ? (
                          <div>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{rec.checkIn}</span>
                            {rec.lateMinutes > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 700 }}>
                                ⚠️ {rec.lateMinutes} মিনিট লেট
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* Check-Out */}
                      <td style={{ padding: '14px 18px' }}>
                        {rec.checkOut ? (
                          <div>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{rec.checkOut}</span>
                            {rec.overtimeHours > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>
                                🌟 +{rec.overtimeHours} ঘণ্টা ওভারটাইম
                              </div>
                            )}
                            {rec.earlyExitMinutes > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#c2410c', fontWeight: 700 }}>
                                ⏱️ {rec.earlyExitMinutes} মি. আগে প্রস্থান
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            {rec.checkIn ? 'ডিউটিতে আছেন (On Duty)' : '—'}
                          </span>
                        )}
                      </td>

                      {/* Work Hours */}
                      <td style={{ padding: '14px 18px' }}>
                        {rec.totalWorkHours > 0 ? (
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {rec.totalWorkHours} ঘণ্টা
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Punch Source */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {rec.punchSource}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700,
                          background: badge.bg, color: badge.text
                        }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Quick Punch Simulator (Test / POS Kiosk) ── */}
      {showPunchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '480px', maxWidth: '95vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>কুইক ফিঙ্গার/ফেস পাঞ্চ টেস্ট</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>সরাসরি সিস্টেম থেকে পাঞ্চ ইন / পাঞ্চ আউট টেস্ট করুন</div>
              </div>
              <button onClick={() => setShowPunchModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleRecordPunch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>কর্মীর নাম নির্বাচন করুন *</label>
                <select
                  required
                  value={punchUser}
                  onChange={e => setPunchUser(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose Employee --</option>
                  {records.map(r => (
                    <option key={r.userId} value={r.userId}>
                      {r.fullName} ({r.role}) — {r.checkIn ? `Checked-in at ${r.checkIn}` : 'Not checked-in'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>পাঞ্চ মাধ্যম (Device Type)</label>
                <select
                  value={punchSource}
                  onChange={e => setPunchSource(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="Biometric_Fingerprint">Fingerprint Machine (আঙুলের ছাপ)</option>
                  <option value="Biometric_Face">Face Recognition Device (ফেস স্ক্যান)</option>
                  <option value="POS_Terminal">Counter POS Terminal (কাউন্টার পাঞ্চ)</option>
                  <option value="Web_Camera">Web Camera Face Check-In (ওয়েবক্যাম)</option>
                </select>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569' }}>
                💡 <b>নিয়ম:</b> দিনের ১ম পাঞ্চ স্বয়ংক্রিয়ভাবে <b>Check-In</b> হবে। ১৫ মিনিটের বেশি দেরি হলে লেট দেখাবে। দিনের শেষ পাঞ্চ <b>Check-Out</b> হিসেবে মোট কাজের সময় ও ওভারটাইম হিসাব করবে।
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowPunchModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button
                  type="submit"
                  disabled={punchLoading}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {punchLoading ? 'প্রসেস হচ্ছে…' : 'পাঞ্চ কনফার্ম করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Device Integration Settings ── */}
      {showDeviceSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '560px', maxWidth: '95vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>বায়োমেট্রিক ডিভাইস ইন্টিগ্রেশন গাইড</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>ZKTeco, Realtime বা যেকোনো ফিঙ্গারপ্রিন্ট মেশিনের সংযোগ কনফিগারেশন</div>
              </div>
              <button onClick={() => setShowDeviceSettings(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem', color: '#334155' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>১. ZKTeco Cloud ADMS Push Settings:</div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#64748b' }}>
                  আপনার ZKTeco মেশিনের <b>Menu $\rightarrow$ Comm. $\rightarrow$ Cloud Server Settings / ADMS</b>-এ গিয়ে নিচের তথ্যগুলো বসিয়ে দিন:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', fontSize: '0.78rem' }}>
                  <b>Server URL / IP:</b> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>http://your-server-ip:5143/api/attendance/punch</code>
                  <b>Server Port:</b> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>5143</code>
                  <b>Push Method:</b> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>POST (JSON)</code>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>২. সরাসরি API কল (Webhook / Python Agent Payload):</div>
                <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '10px', borderRadius: '6px', fontSize: '0.72rem', overflowX: 'auto', margin: 0 }}>
{`POST /api/attendance/punch
Content-Type: application/json

{
  "userId": 1,
  "branchId": 1,
  "punchSource": "Biometric_Fingerprint",
  "deviceSerialOrIp": "ZK-SN-89211"
}`}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button onClick={() => setShowDeviceSettings(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>ঠিক আছে</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

