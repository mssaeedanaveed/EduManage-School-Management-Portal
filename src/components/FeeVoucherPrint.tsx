import React, { useRef } from 'react';
import { Printer, Download, CreditCard, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IFeePayment, IFeeStructure } from '../types/index.js';

interface FeeVoucherPrintProps {
  voucher: IFeePayment;
  breakdown?: IFeeStructure;
  onClose: () => void;
}

export const FeeVoucherPrint: React.FC<FeeVoucherPrintProps> = ({ voucher, breakdown, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('landscape');

    // Generate 3 copies on 1 landscape page
    const copyTitles = ['STUDENT COPY', 'SCHOOL COPY', 'BANK COPY'];
    const copyWidth = 85;

    copyTitles.forEach((copyTitle, i) => {
      const startX = 14 + i * 92;

      // Header
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('St. Augustine Academy', startX + 42, 14, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('City National Bank • A/C: 4481-9023-8812', startX + 42, 19, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(67, 56, 202);
      doc.text(`[ ${copyTitle} ]`, startX + 42, 25, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(`Voucher No: ${voucher.voucherNo}`, startX, 32);
      doc.text(`Billing Month: ${voucher.month}`, startX, 37);
      doc.text(`Due Date: ${voucher.dueDate}`, startX, 42);

      doc.text(`Student: ${voucher.studentName}`, startX, 49);
      doc.text(`Roll No: ${voucher.rollNo} | Class: ${voucher.className || '10-A'}`, startX, 54);

      // Fee Breakdown Table
      const items = [
        ['Tuition Fee', `$${breakdown?.tuitionFee || 450}`],
        ['Transport Fee', `$${breakdown?.transportFee || 80}`],
        ['Laboratory Fee', `$${breakdown?.labFee || 50}`],
        ['Library & Exam', `$${(breakdown?.libraryFee || 20) + (breakdown?.examFee || 40)}`],
        ['Total Payable', `$${voucher.totalDue}`],
        ['Amount Paid', `$${voucher.amountPaid || 0}`],
        ['Net Balance', `$${voucher.balance}`],
      ];

      autoTable(doc, {
        startY: 59,
        head: [['Particulars', 'Amount']],
        body: items,
        margin: { left: startX },
        tableWidth: 80,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [67, 56, 202], textColor: 255 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(7);
      doc.text(`Status: ${voucher.status.toUpperCase()}`, startX, finalY);

      doc.setDrawColor(148, 163, 184);
      doc.line(startX, finalY + 18, startX + 35, finalY + 18);
      doc.text('Cashier Signature', startX, finalY + 22);

      doc.line(startX + 45, finalY + 18, startX + 80, finalY + 18);
      doc.text('Officer Stamp', startX + 45, finalY + 22);

      // Dividing vertical dashed line between copies
      if (i < 2) {
        doc.setDrawColor(203, 213, 225);
        doc.line(startX + 88, 10, startX + 88, 195);
      }
    });

    doc.save(`FeeVoucher_${voucher.voucherNo}_${voucher.studentName?.replace(/\s+/g, '_')}.pdf`);
  };

  const renderVoucherCopy = (title: string) => (
    <div className="flex-1 p-5 border border-slate-300 rounded-xl bg-white shadow-2xs text-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="text-center pb-3 border-b border-slate-200">
          <h4 className="font-extrabold text-slate-900 text-sm uppercase">St. Augustine Academy</h4>
          <p className="text-[10px] text-slate-500">Authorized Fee Challan</p>
          <div className="mt-1 inline-block px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-[10px] font-bold text-indigo-700 uppercase">
            {title}
          </div>
        </div>

        {/* Bank & Voucher Meta */}
        <div className="my-3 space-y-1 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex justify-between">
            <span className="text-slate-500">Challan No:</span>
            <span className="font-bold text-slate-800">{voucher.voucherNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Billing Month:</span>
            <span className="font-semibold text-slate-800">{voucher.month}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Due Date:</span>
            <span className="font-bold text-rose-600">{voucher.dueDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bank & A/C:</span>
            <span className="font-medium text-slate-700">City National (4481-9023)</span>
          </div>
        </div>

        {/* Student Meta */}
        <div className="mb-3 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Student:</span>
            <span className="font-bold text-slate-900">{voucher.studentName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Class & Roll:</span>
            <span className="font-semibold text-slate-700">
              {voucher.className} • {voucher.rollNo}
            </span>
          </div>
        </div>

        {/* Particulars Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-1 px-2 text-left">Description</th>
                <th className="py-1 px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-1 px-2 text-slate-600">Tuition Fee</td>
                <td className="py-1 px-2 text-right">${breakdown?.tuitionFee || 450}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-slate-600">Transport Fee</td>
                <td className="py-1 px-2 text-right">${breakdown?.transportFee || 80}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-slate-600">Laboratory Fee</td>
                <td className="py-1 px-2 text-right">${breakdown?.labFee || 50}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-slate-600">Library & Exam</td>
                <td className="py-1 px-2 text-right">
                  ${(breakdown?.libraryFee || 20) + (breakdown?.examFee || 40)}
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-200">
                <td className="py-1.5 px-2 text-slate-900">Total Payable</td>
                <td className="py-1.5 px-2 text-right text-slate-900">${voucher.totalDue}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-emerald-600 font-semibold">Amount Paid</td>
                <td className="py-1 px-2 text-right text-emerald-600 font-semibold">
                  ${voucher.amountPaid}
                </td>
              </tr>
              <tr className="bg-rose-50/50 font-black">
                <td className="py-1 px-2 text-rose-700">Balance Due</td>
                <td className="py-1 px-2 text-right text-rose-700">${voucher.balance}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between text-[11px] mb-4">
          <span className="text-slate-500">Status:</span>
          <span
            className={`font-black px-2 py-0.5 rounded text-[10px] uppercase ${
              voucher.status === 'Paid'
                ? 'bg-emerald-100 text-emerald-800'
                : voucher.status === 'Partial'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {voucher.status}
          </span>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-6 flex justify-between text-[9px] text-slate-500">
        <div className="text-center">
          <div className="w-20 border-b border-slate-400 mb-1" />
          <span>Cashier</span>
        </div>
        <div className="text-center">
          <div className="w-20 border-b border-slate-400 mb-1" />
          <span>Bank Stamp</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Controls Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">Official Bank Fee Voucher Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-Part Voucher Container */}
        <div ref={printRef} className="p-6 bg-slate-100/60 print:p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderVoucherCopy('Student Copy')}
            {renderVoucherCopy('School Copy')}
            {renderVoucherCopy('Bank Copy')}
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-4 print:hidden">
            Note: All fees must be deposited before due date. A late surcharge of $15 applies thereafter.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeeVoucherPrint;
