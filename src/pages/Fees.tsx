import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  DollarSign,
  TrendingDown,
  Layers,
  Calendar,
  Search,
  Check,
} from 'lucide-react';
import api from '../api/axios.js';
import Modal from '../components/Modal.js';
import Badge from '../components/Badge.js';
import FeeVoucherPrint from '../components/FeeVoucherPrint.js';
import { IFeePayment, IFeeStructure, IClass } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const Fees: React.FC = () => {
  const { user, profile } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isAccountant = user?.role === 'accountant';
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';

  const [activeTab, setActiveTab] = useState<
    'vouchers' | 'defaulters' | 'structures' | 'openingBalances' | 'proofs' |
    'collection' | 'ledger' | 'reports' | 'audit' | 'settings'
  >('vouchers');
  const [classes, setClasses] = useState<IClass[]>([]);
  const [structures, setStructures] = useState<IFeeStructure[]>([]);
  const [payments, setPayments] = useState<IFeePayment[]>([]);
  const [defaulters, setDefaulters] = useState<IFeePayment[]>([]);
  const [advancedVouchers, setAdvancedVouchers] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [feeReport, setFeeReport] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [openingBalances, setOpeningBalances] = useState<any[]>([]);
  const [ledgerStudentId, setLedgerStudentId] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [proofVoucher, setProofVoucher] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofAmount, setProofAmount] = useState('');
  const [proofReference, setProofReference] = useState('');

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isStructureOpen, setIsStructureOpen] = useState(false);
  const [targetPayment, setTargetPayment] = useState<IFeePayment | null>(null);

  // Generate Voucher Form
  const [generateData, setGenerateData] = useState({
    classId: '',
    month: 'November 2026',
    dueDate: '2026-11-15',
  });

  // Record Payment Form
  const [paymentRecordData, setPaymentRecordData] = useState({
    amountPaid: 0,
    paymentMethod: 'Cash' as 'Cash' | 'Bank Transfer' | 'Online Card' | 'Cheque',
    transactionRef: '',
    remarks: '',
  });

  // Fee Structure Form
  const [structureFormData, setStructureFormData] = useState({
    classId: '',
    title: 'Standard High School Fee Structure 2025-2026',
    tuitionFee: 450,
    transportFee: 80,
    labFee: 50,
    libraryFee: 20,
    examFee: 40,
    otherCharges: 10,
    academicYear: '2025-2026',
  });

  // Print Voucher state
  const [printableVoucher, setPrintableVoucher] = useState<{
    voucher: IFeePayment;
    breakdown?: IFeeStructure;
  } | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isStudent || isParent) {
        const [sRes, vRes] = await Promise.all([
          api.get('/api/fees/structures').catch(() => ({ data: { success: false, data: [] } })),
          api.get('/api/fees/vouchers/my').catch(() => ({ data: { success: false, data: [] } })),
        ]);
        if (sRes.data?.success) setStructures(sRes.data.data);
        if (vRes.data?.success) setPayments(vRes.data.data);
        const advancedRes = await api.get('/api/fees/vouchers')
          .catch(() => ({ data: { success: false, data: [] } }));
        if (advancedRes.data?.success) setAdvancedVouchers(advancedRes.data.data);
        const proofRes = await api.get('/api/fees/proofs')
          .catch(() => ({ data: { success: false, data: [] } }));
        if (proofRes.data?.success) setProofs(proofRes.data.data);
        if (isParent) {
          const childrenRes = await api.get('/api/fees/parent/children')
            .catch(() => ({ data: { success: false, data: [] } }));
          if (childrenRes.data?.success) {
            const children = childrenRes.data.data || [];
            setParentChildren(children);
            if (!selectedChildId && children.length > 0) setSelectedChildId(children[0].student._id);
          }
        }
      } else {
        const [cRes, sRes, pRes] = await Promise.all([
          api.get('/api/classes').catch(() => ({ data: { success: false, data: [] } })),
          api.get('/api/fees/structures').catch(() => ({ data: { success: false, data: [] } })),
          api.get(isAccountant ? '/api/fees/vouchers' : '/api/fees/payments', {
            params: { class: selectedClass || undefined },
          }).catch(() => ({ data: { success: false, data: [] } })),
        ]);
        if (cRes.data?.success) {
          setClasses(cRes.data.data);
          if (!selectedClass && cRes.data.data.length > 0) {
            setSelectedClass(cRes.data.data[0]._id);
          }
        }
        if (sRes.data?.success) setStructures(sRes.data.data);
        if (pRes.data?.success) setPayments(pRes.data.data);

        const [advancedRes, proofsRes, reportsRes, auditRes] = await Promise.all([
          api.get('/api/fees/vouchers').catch(() => ({ data: { success: false, data: [] } })),
          api.get('/api/fees/proofs').catch(() => ({ data: { success: false, data: [] } })),
          api.get('/api/fees/reports').catch(() => ({ data: { success: false, data: null } })),
          isAdmin
            ? api.get('/api/fees/audit-log').catch(() => ({ data: { success: false, data: [] } }))
            : Promise.resolve({ data: { success: false, data: [] } }),
        ]);
        if (advancedRes.data?.success) setAdvancedVouchers(advancedRes.data.data);
        if (proofsRes.data?.success) setProofs(proofsRes.data.data);
        if (reportsRes.data?.success) setFeeReport(reportsRes.data.data);
        if (auditRes.data?.success) setAuditLog(auditRes.data.data);

        // Defaulters is an admin-only endpoint
        if (isAdmin) {
          try {
            const dRes = await api.get('/api/fees/defaulters');
            if (dRes.data?.success) setDefaulters(dRes.data.data);
          } catch (err) {
            console.warn('Could not fetch fee defaulters', err);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [selectedClass, user?.role, user?._id]);

  useEffect(() => {
    if (!isStudent && !isParent) return;
    const refresh = window.setInterval(() => { void fetchData(); }, 15000);
    return () => window.clearInterval(refresh);
  }, [isStudent, isParent, user?._id]);

  const handleGenerateVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/fees/vouchers/generate', generateData);
      if (res.data?.success) {
        setIsGenerateOpen(false);
        fetchData();
        alert(res.data.message);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate fee vouchers');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPayment) return;
    try {
      const res = await api.post('/api/fees/payments/record', {
        voucherNo: targetPayment.voucherNo,
        amountPaid: Number(paymentRecordData.amountPaid),
        paymentMethod: paymentRecordData.paymentMethod,
        transactionRef: paymentRecordData.transactionRef,
        remarks: paymentRecordData.remarks,
      });
      if (res.data?.success) {
        setIsRecordPaymentOpen(false);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/fees/structure', structureFormData);
      if (res.data?.success) {
        setIsStructureOpen(false);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save fee structure');
    }
  };

  const reviewProof = async (proofId: string, approve: boolean, reason = '') => {
    try {
      await api.patch(`/api/fees/proofs/${proofId}/${approve ? 'approve' : 'reject'}`, reason ? { reason } : {});
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to ${approve ? 'approve' : 'reject'} proof`);
    }
  };

  const loadLedger = async () => {
    if (!ledgerStudentId.trim()) return;
    try {
      const res = await api.get(`/api/fees/ledger/${ledgerStudentId.trim()}`);
      if (res.data?.success) setLedger(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load student ledger');
    }
  };

  const downloadVoucherPdf = async (voucherId: string, voucherNo: string) => {
    try {
      const response = await api.get(`/api/fees/vouchers/${voucherId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${voucherNo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download voucher PDF');
    }
  };

  const submitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofVoucher || !proofFile) return;
    const amount = Number(proofAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }
    const form = new FormData();
    form.append('proof', proofFile);
    form.append('voucherId', proofVoucher._id);
    form.append('amount', String(amount));
    form.append('mode', 'bank');
    form.append('referenceNo', proofReference.trim());
    try {
      await api.post('/api/fees/proofs', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProofVoucher(null);
      setProofFile(null);
      setProofAmount('');
      setProofReference('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to upload payment proof');
    }
  };

  const handleOpenPrintVoucher = (p: IFeePayment) => {
    const struct = structures.find((s) => s.classId === p.classId);
    setPrintableVoucher({
      voucher: p,
      breakdown: struct,
    });
  };

  const totalDefaulterAmount = defaulters.reduce((acc, curr) => acc + (curr.balance || 0), 0);

  const filteredPayments = payments.filter(
    (p) =>
      p.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      p.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
      p.rollNo?.toLowerCase().includes(search.toLowerCase())
  );

  // -------------------------------------------------------------
  // DEDICATED STUDENT FEE VOUCHERS VIEW
  // -------------------------------------------------------------
  if (isStudent) {
    const studentAdvanced = advancedVouchers.length > 0 ? advancedVouchers : [];
    const studentBalance = studentAdvanced.reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total || 0) - Number(voucher.paidAmount || 0)), 0);
    const overdueBalance = studentAdvanced
      .filter((voucher) => voucher.status === 'Overdue')
      .reduce((sum, voucher) => sum + Math.max(0, Number(voucher.total || 0) - Number(voucher.paidAmount || 0)), 0);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-cyan-700 via-indigo-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 block mb-1">
              Student Tuition & Billing Hub
            </span>
            <h1 className="text-2xl font-black">{user.name}</h1>
            <p className="text-xs text-cyan-200 mt-0.5">
              Roll No: {profile?.student?.rollNo || '—'} • Class: {profile?.student?.className || '—'}
            </p>
          </div>

          <div className="flex gap-3">
            <div className="px-4 py-3 bg-white/10 rounded-2xl text-center">
              <span className="text-[10px] font-bold uppercase text-cyan-200 block">Total Pending</span>
              <span className="text-xl font-black">${studentBalance.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 bg-white/10 rounded-2xl text-center">
              <span className="text-[10px] font-bold uppercase text-rose-200 block">Overdue</span>
              <span className="text-xl font-black text-rose-300">${overdueBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Vouchers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-xs">Official Fee Challans & Vouchers</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Payable</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentAdvanced.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-500">No fee vouchers yet.</td></tr>
                ) : studentAdvanced.map((voucher) => (
                  <tr key={voucher._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{voucher.voucherNo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{voucher.month}/{voucher.year}</td>
                    <td className="py-3 px-4 text-slate-500">{voucher.dueDate}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">${Number(voucher.total || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">${Number(voucher.paidAmount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">${Math.max(0, Number(voucher.total || 0) - Number(voucher.paidAmount || 0)).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={voucher.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => void downloadVoucherPdf(voucher._id, voucher.voucherNo)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                      {!['Paid', 'Cancelled'].includes(voucher.status) && (
                        <button
                          onClick={() => {
                            setProofVoucher(voucher);
                            setProofAmount(String(Math.max(0, Number(voucher.total || 0) - Number(voucher.paidAmount || 0))));
                          }}
                          className="mt-2 block ml-auto text-[11px] font-bold text-amber-700 cursor-pointer"
                        >
                          Upload payment proof
                          {proofs.find((proof) => proof.voucherId === voucher._id) &&
                            ` (${proofs.find((proof) => proof.voucherId === voucher._id)?.status})`}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {printableVoucher && (
          <FeeVoucherPrint
            voucher={printableVoucher.voucher}
            breakdown={printableVoucher.breakdown}
            onClose={() => setPrintableVoucher(null)}
          />
        )}
        <Modal
          isOpen={Boolean(proofVoucher)}
          onClose={() => setProofVoucher(null)}
          title={`Upload Proof: ${proofVoucher?.voucherNo || ''}`}
          subtitle="JPG, PNG or PDF, maximum 5 MB"
          maxWidth="md"
        >
          <form onSubmit={submitPaymentProof} className="space-y-3 text-xs">
            <input type="number" min="0.01" step="0.01" required value={proofAmount} onChange={(e) => setProofAmount(e.target.value)} placeholder="Amount" className="w-full p-2.5 border rounded-xl" />
            <input required value={proofReference} onChange={(e) => setProofReference(e.target.value)} placeholder="Bank reference number" className="w-full p-2.5 border rounded-xl" />
            <input required type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full" />
            <button type="submit" className="w-full p-2.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">Submit proof</button>
          </form>
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEDICATED PARENT FEE VOUCHERS VIEW
  // -------------------------------------------------------------
  if (isParent) {
    const familyPending = parentChildren.reduce((sum, child) => sum + Number(child.dues || 0), 0);
    const familyOverdue = parentChildren.reduce((sum, child) => sum + Number(child.overdue || 0), 0);
    const selectedChild = parentChildren.find((child) => child.student._id === selectedChildId) || parentChildren[0];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 block mb-1">
              Family Tuition & Fee Vouchers
            </span>
            <h1 className="text-2xl font-black">{user.name}</h1>
            <p className="text-xs text-amber-200 mt-0.5">
              {parentChildren.length} linked child{parentChildren.length === 1 ? '' : 'ren'}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-3 bg-white/10 rounded-2xl text-center">
              <span className="text-[10px] font-bold uppercase text-amber-200 block">Family Pending</span>
              <span className="text-xl font-black">${familyPending.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 bg-white/10 rounded-2xl text-center">
              <span className="text-[10px] font-bold uppercase text-amber-200 block">Family Overdue</span>
              <span className="text-xl font-black text-rose-300">${familyOverdue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {parentChildren.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {parentChildren.map((child) => (
              <button
                key={child.student._id}
                onClick={() => setSelectedChildId(child.student._id)}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedChild?.student._id === child.student._id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className="font-black text-slate-800">{child.student.name}</div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Pending</span><span className="font-bold text-slate-800">${Number(child.dues || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Overdue</span><span className={`font-bold ${Number(child.overdue || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>${Number(child.overdue || 0).toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {parentChildren.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {parentChildren.map((child) => (
              <button
                key={child.student._id}
                onClick={() => setSelectedChildId(child.student._id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                  selectedChild?.student._id === child.student._id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {child.student.name}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-xs">
              {selectedChild ? `${selectedChild.student.name}'s Fee Vouchers` : 'Fee Vouchers'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-3">Class</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Payable</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!selectedChild || selectedChild.vouchers.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">No fee vouchers yet for this child.</td></tr>
                ) : selectedChild.vouchers.map((voucher: any) => (
                    <tr key={voucher._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{voucher.voucherNo}</td>
                      <td className="py-3 px-3 text-slate-600">{String(voucher.classId || '—')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{voucher.month}/{voucher.year}</td>
                      <td className="py-3 px-4 text-slate-500">{voucher.dueDate}</td>
                      <td className="py-3 px-4 text-right font-semibold">${Number(voucher.total || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">${Number(voucher.paidAmount || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-black">${Math.max(0, Number(voucher.total || 0) - Number(voucher.paidAmount || 0)).toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Badge status={voucher.status} />
                          <button
                            onClick={() => void downloadVoucherPdf(voucher._id, voucher.voucherNo)}
                            className="text-indigo-600 font-bold cursor-pointer"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        {selectedChild && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 text-xs mb-3">{selectedChild.student.name}'s Payment History</h3>
            {(selectedChild.payments || []).length === 0 ? (
              <p className="text-xs text-slate-400">No payments recorded for this child.</p>
            ) : (
              <div className="space-y-2">
                {selectedChild.payments.map((payment: any) => (
                  <div key={payment._id} className="flex justify-between border-b border-slate-100 pb-2 text-xs">
                    <span>{payment.receiptNo || payment.mode} · {String(payment.date || '').slice(0, 10)}</span>
                    <span className="font-bold">${Number(payment.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // ADMIN & GENERAL FEE MANAGEMENT
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Fee Management & Billing
          </h1>
          <p className="text-xs text-slate-500">
            Define tuition structures, issue multi-copy bank vouchers, and track outstanding defaulters
          </p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 w-full">
            {[
              ['Collected this month', `$${Number(feeReport?.collectedThisMonth || 0).toFixed(2)}`, 'text-emerald-600'],
              ['Total pending', `$${Number(feeReport?.outstanding || 0).toFixed(2)}`, 'text-amber-600'],
              ['Total overdue', `$${Number(feeReport?.overdue || 0).toFixed(2)}`, 'text-rose-600'],
              ['Collection percentage', `${Number(feeReport?.collectionPercentage || 0)}%`, 'text-indigo-600'],
              ['Defaulters', String(feeReport?.defaulterCount || 0), 'text-slate-800'],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
                <div className={`mt-2 text-xl font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full">
          {([
            ['vouchers', 'Vouchers & Payments'],
            ['collection', 'Fee Collection'],
            ['defaulters', 'Defaulters'],
            ['structures', 'Fee Structures'],
            ['openingBalances', 'Opening Balances'],
            ['proofs', 'Payment Proofs'],
            ['ledger', 'Student Ledger'],
            ['reports', 'Reports'],
            ['audit', 'Audit Log'],
            ['settings', 'Settings'],
          ] as const).filter(([key]) => isAdmin || !['structures', 'openingBalances', 'audit', 'settings'].includes(key)).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeTab === key ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}{key === 'proofs' ? ` (${proofs.filter((proof) => proof.status === 'Pending').length})` : ''}
            </button>
          ))}
          {/* Legacy tabs are intentionally retained below for compatibility. */}
          {/* <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'vouchers'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vouchers & Payments
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('defaulters')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'defaulters'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Defaulters ({defaulters.length})
              </button>
              <button
                onClick={() => setActiveTab('structures')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'structures'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fee Structures
              </button>
            </>
          )} */}
        </div>
      </div>

      {/* TAB 1: VOUCHERS & PAYMENTS */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search voucher # or student..."
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="py-1.5 px-3 text-xs rounded-xl border border-slate-200 font-semibold text-slate-800"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} - Section {c.section}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setGenerateData({ ...generateData, classId: 'all' });
                    setIsGenerateOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate & Publish Vouchers for {generateData.month}</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Class</th>
                  <th className="py-3 px-3">Billing Month</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-right">Total Due</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading fee records...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No vouchers found.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.voucherNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-800">{p.studentName}</div>
                        <div className="text-[10px] text-slate-400">Roll: {p.rollNo}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{p.className}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">{p.month}</td>
                      <td className="py-3 px-3 text-slate-500">{p.dueDate}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">${p.totalDue}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">${p.amountPaid}</td>
                      <td className="py-3 px-3 text-right font-black text-rose-600">${p.balance}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge status={p.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && p.status !== 'Paid' && (
                            <button
                              onClick={() => {
                                setTargetPayment(p);
                                setPaymentRecordData({
                                  amountPaid: p.balance,
                                  paymentMethod: 'Cash',
                                  transactionRef: '',
                                  remarks: '',
                                });
                                setIsRecordPaymentOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenPrintVoucher(p)}
                            title="Print Bank Challan"
                            className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Voucher</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DEFAULTERS LIST */}
      {activeTab === 'defaulters' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-rose-900 text-sm">
                  Fee Defaulter Warning: {defaulters.length} Unpaid / Partial Vouchers
                </h3>
                <p className="text-xs text-rose-700">
                  Total outstanding receivables currently overdue:{' '}
                  <span className="font-black">${totalDefaulterAmount}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Class</th>
                  <th className="py-3 px-3">Billing Month</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-right">Amount Due</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defaulters.map((d) => (
                  <tr key={d._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{d.voucherNo}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{d.studentName}</td>
                    <td className="py-3 px-3 text-slate-600">{d.className}</td>
                    <td className="py-3 px-3 text-slate-700">{d.month}</td>
                    <td className="py-3 px-3 font-semibold text-rose-600">{d.dueDate}</td>
                    <td className="py-3 px-3 text-right font-medium">${d.totalDue}</td>
                    <td className="py-3 px-3 text-right font-black text-rose-600">${d.balance}</td>
                    <td className="py-3 px-3 text-center">
                      <Badge status={d.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setTargetPayment(d);
                          setPaymentRecordData({
                            amountPaid: d.balance,
                            paymentMethod: 'Cash',
                            transactionRef: '',
                            remarks: '',
                          });
                          setIsRecordPaymentOpen(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Settle Dues
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FEE STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Define the itemized fee components applicable to each grade class level
            </p>
            <button
              onClick={() => setIsStructureOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Define New Structure</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {structures.map((s) => (
              <div
                key={s._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-black text-slate-900 text-base">{s.className}</span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    ${s.totalAmount} / Month
                  </span>
                </div>

                <div className="py-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Tuition Fee</span>
                    <span className="font-semibold text-slate-900">${s.tuitionFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Transport Fee</span>
                    <span className="font-semibold text-slate-900">${s.transportFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Laboratory Fee</span>
                    <span className="font-semibold text-slate-900">${s.labFee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Library & Exam</span>
                    <span className="font-semibold text-slate-900">
                      ${(s.libraryFee || 0) + (s.examFee || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Other Charges</span>
                    <span className="font-semibold text-slate-900">${s.otherCharges || 0}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                  Academic Year: {s.academicYear}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'openingBalances' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-slate-800">Opening Balances</h2>
              <p className="text-xs text-slate-500">Previous dues are included in the student's first generated voucher.</p>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById('opening-balance-csv')?.click()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Import CSV
            </button>
            <input id="opening-balance-csv" type="file" accept=".csv,text/csv" className="hidden" />
          </div>
          {openingBalances.length === 0 && (
            <div className="text-sm text-slate-500 py-10 text-center border border-dashed rounded-xl">
              No opening balances have been recorded.
            </div>
          )}
        </div>
      )}

      {activeTab === 'collection' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-black text-slate-800">Fee Collection</h2>
            <p className="text-xs text-slate-500">Record and track payments against individual student vouchers.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                <tr><th className="text-left p-3">Voucher</th><th className="text-left p-3">Student</th><th className="text-left p-3">Status</th><th className="text-right p-3">Balance</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {advancedVouchers.map((voucher) => (
                  <tr key={voucher._id} className="border-t border-slate-100">
                    <td className="p-3 font-bold">{voucher.voucherNo}</td>
                    <td className="p-3">{voucher.studentId?.name || voucher.studentName || voucher.studentId}</td>
                    <td className="p-3">{voucher.status}</td>
                    <td className="p-3 text-right font-bold">{Number(voucher.total || 0) - Number(voucher.paidAmount || 0)}</td>
                    <td className="p-3 text-right"><span className="text-indigo-600 font-bold">Record payment</span></td>
                  </tr>
                ))}
                {advancedVouchers.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">No vouchers available for collection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'proofs' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-black text-slate-800">Payment Proof Verification</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {proofs.map((proof) => (
              <div key={proof._id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">{proof.studentId?.name || 'Student'} · {proof.referenceNo || 'No reference'}</div>
                  <div className="text-xs text-slate-500">{proof.mode} · ${proof.amount} · {proof.status}</div>
                </div>
                <div className="flex gap-2">
                  {proof.fileUrl && <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="px-3 py-2 border rounded-lg text-xs font-bold">View proof</a>}
                  {proof.status === 'Pending' && (
                    <>
                      <button onClick={() => void reviewProof(proof._id, true)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer">Approve</button>
                      <button onClick={() => { const reason = window.prompt('Rejection reason'); if (reason?.trim()) void reviewProof(proof._id, false, reason.trim()); }} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer">Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {proofs.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No payment proofs submitted.</div>}
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-black text-slate-800">Student Fee Ledger</h2>
            <p className="text-xs text-slate-500">Enter a Student ID to view vouchers, payments and running balance.</p>
          </div>
          <div className="flex gap-2">
            <input value={ledgerStudentId} onChange={(e) => setLedgerStudentId(e.target.value)} placeholder="Student ID" className="flex-1 p-2.5 border rounded-xl text-xs" />
            <button onClick={() => void loadLedger()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer">View ledger</button>
          </div>
          {ledger && <pre className="bg-slate-50 rounded-xl p-4 overflow-auto text-xs">{JSON.stringify(ledger, null, 2)}</pre>}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['Monthly collection', feeReport?.monthlyCollection ?? feeReport?.collection ?? 0],
            ['Outstanding balance', feeReport?.pending ?? feeReport?.outstanding ?? 0],
            ['Defaulters', feeReport?.defaulters?.length ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-2xl font-black text-slate-800 mt-2">{String(value)}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'audit' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b"><h2 className="font-black text-slate-800">Fee Audit Log</h2></div>
          <div className="divide-y divide-slate-100">
            {auditLog.map((entry) => (
              <div key={entry._id} className="p-4 text-xs">
                <div className="font-bold">{entry.action} · {entry.entity}</div>
                <div className="text-slate-500">{entry.reason || 'No reason recorded'} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</div>
              </div>
            ))}
            {auditLog.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No audit entries recorded.</div>}
          </div>
        </div>
      )}

      {activeTab === 'settings' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-black text-slate-800">Fee Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Fee reminder timing, voucher numbering, bank details and voucher branding are applied from server fee settings.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs">
            {['Reminder: 3 days before due date', 'Reminder: every 7 days overdue', 'Fine rules', 'Voucher number format', 'School bank details', 'Voucher logo'].map((setting) => (
              <div key={setting} className="border border-slate-200 rounded-xl p-3 font-semibold text-slate-700">{setting}</div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Generate Vouchers */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Batch Generate Fee Vouchers"
        subtitle="Issues standard vouchers to all enrolled students in the selected class"
        maxWidth="md"
      >
        <form onSubmit={handleGenerateVouchers} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Student Scope *</label>
            <select
              required
              value={generateData.classId}
              onChange={(e) => setGenerateData({ ...generateData, classId: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="all">All Classes (Every Active Student)</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Billing Month *</label>
            <input
              type="text"
              required
              value={generateData.month}
              onChange={(e) => setGenerateData({ ...generateData, month: e.target.value })}
              placeholder="e.g. November 2026"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Due Date *</label>
            <input
              type="date"
              required
              value={generateData.dueDate}
              onChange={(e) => setGenerateData({ ...generateData, dueDate: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsGenerateOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Generate Challans
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Fee Payment */}
      <Modal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        title={`Record Payment: ${targetPayment?.voucherNo}`}
        subtitle={`Student: ${targetPayment?.studentName} • Outstanding: $${targetPayment?.balance}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Amount Paid ($) *</label>
            <input
              type="number"
              required
              value={paymentRecordData.amountPaid}
              onChange={(e) =>
                setPaymentRecordData({ ...paymentRecordData, amountPaid: Number(e.target.value) })
              }
              max={targetPayment?.balance}
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentRecordData.paymentMethod}
              onChange={(e) =>
                setPaymentRecordData({
                  ...paymentRecordData,
                  paymentMethod: e.target.value as any,
                })
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="Cash">Cash at Counter</option>
              <option value="Bank Transfer">Bank Transfer / Wire</option>
              <option value="Online Card">Credit / Debit Card</option>
              <option value="Cheque">Banker's Cheque</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Transaction Reference / Slip #
            </label>
            <input
              type="text"
              value={paymentRecordData.transactionRef}
              onChange={(e) =>
                setPaymentRecordData({ ...paymentRecordData, transactionRef: e.target.value })
              }
              placeholder="e.g. TXN-9428-1"
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRecordPaymentOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Confirm Settlement
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Define Fee Structure */}
      <Modal
        isOpen={isStructureOpen}
        onClose={() => setIsStructureOpen(false)}
        title="Define Class Fee Structure"
        maxWidth="md"
      >
        <form onSubmit={handleSaveStructure} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Class *</label>
            <select
              required
              value={structureFormData.classId}
              onChange={(e) =>
                setStructureFormData({ ...structureFormData, classId: e.target.value })
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
            >
              <option value="">Select Class...</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={structureFormData.title}
              onChange={(e) =>
                setStructureFormData({ ...structureFormData, title: e.target.value })
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tuition Fee ($) *</label>
              <input
                type="number"
                required
                value={structureFormData.tuitionFee}
                onChange={(e) =>
                  setStructureFormData({
                    ...structureFormData,
                    tuitionFee: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transport Fee ($)</label>
              <input
                type="number"
                value={structureFormData.transportFee}
                onChange={(e) =>
                  setStructureFormData({
                    ...structureFormData,
                    transportFee: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Lab Fee ($)</label>
              <input
                type="number"
                value={structureFormData.labFee}
                onChange={(e) =>
                  setStructureFormData({
                    ...structureFormData,
                    labFee: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Exam Fee ($)</label>
              <input
                type="number"
                value={structureFormData.examFee}
                onChange={(e) =>
                  setStructureFormData({
                    ...structureFormData,
                    examFee: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStructureOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
            >
              Save Fee Plan
            </button>
          </div>
        </form>
      </Modal>

      {/* 3-Copy Bank Fee Voucher Preview */}
      {printableVoucher && (
        <FeeVoucherPrint
          voucher={printableVoucher.voucher}
          breakdown={printableVoucher.breakdown}
          onClose={() => setPrintableVoucher(null)}
        />
      )}
    </div>
  );
};

export default Fees;
