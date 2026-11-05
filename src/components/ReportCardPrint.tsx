import React, { useRef } from 'react';
import { Printer, Download, Award, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportCardData {
  reportCardId: string;
  schoolInfo: {
    name?: string;
    affiliation?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  student: {
    id: string;
    name: string;
    rollNo: string;
    admissionNo: string;
    className: string;
    gender?: string;
    dob?: string;
    parentName?: string;
  };
  exam: {
    name: string;
    term?: string;
    session?: string;
  };
  result: {
    marks: Array<{
      subjectName: string;
      marksObtained: number;
      maxMarks: number;
      grade: string;
      remarks?: string;
    }>;
    totalMarksObtained: number;
    totalMaxMarks: number;
    percentage: number;
    grade: string;
    position?: number;
    totalStudentsInClass?: number;
    teacherRemarks?: string;
  };
  attendance?: {
    attendancePercentage: number;
    daysPresent: number;
    totalDays: number;
  };
  generatedAt?: string;
}

interface ReportCardPrintProps {
  data: ReportCardData;
  onClose: () => void;
}

export const ReportCardPrint: React.FC<ReportCardPrintProps> = ({ data, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const schoolName = data.schoolInfo.name?.trim();
    const affiliation = data.schoolInfo.affiliation?.trim();
    const contactLine = [data.schoolInfo.address?.trim(), data.schoolInfo.phone?.trim()]
      .filter(Boolean)
      .join(' | ');

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName || 'REPORT CARD', 105, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (affiliation) doc.text(affiliation, 105, 24, { align: 'center' });
    if (contactLine) doc.text(contactLine, 105, 29, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 33, 196, 33);

    // Title
    doc.setFontSize(13);
    doc.setTextColor(67, 56, 202);
    doc.text(`OFFICIAL REPORT CARD - ${data.exam.name.toUpperCase()}`, 105, 41, { align: 'center' });

    // Student Info
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Student Name: ${data.student.name}`, 14, 50);
    doc.text(`Roll No: ${data.student.rollNo}`, 120, 50);
    doc.text(`Class & Section: ${data.student.className}`, 14, 57);
    doc.text(`Admission No: ${data.student.admissionNo}`, 120, 57);
    doc.text(`Parent/Guardian: ${data.student.parentName || 'N/A'}`, 14, 64);
    doc.text(
      `Attendance: ${data.attendance?.attendancePercentage == null ? 'Not available' : `${data.attendance.attendancePercentage}%`}`,
      120,
      64
    );

    // Table
    const tableBody = data.result.marks.map((m) => [
      m.subjectName,
      m.maxMarks.toString(),
      m.marksObtained.toString(),
      m.grade,
      m.remarks || '—',
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['Subject', 'Max Marks', 'Marks Obtained', 'Grade', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    // Summary below table
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Total Marks: ${data.result.totalMarksObtained} / ${data.result.totalMaxMarks}`, 14, finalY);
    doc.text(`Percentage: ${data.result.percentage}%`, 75, finalY);
    doc.text(`Overall Grade: ${data.result.grade}`, 130, finalY);
    const classRank = data.result.position && data.result.totalStudentsInClass
      ? `${data.result.position} / ${data.result.totalStudentsInClass}`
      : 'Not available';
    doc.text(`Class Rank: ${classRank}`, 170, finalY);

    doc.setFontSize(9);
    doc.text(`Teacher Remarks: "${data.result.teacherRemarks || 'No remarks recorded.'}"`, 14, finalY + 10);

    // Signatures
    const sigY = finalY + 35;
    doc.line(20, sigY, 70, sigY);
    doc.text('Class Teacher Signature', 22, sigY + 5);

    doc.line(140, sigY, 190, sigY);
    doc.text('Principal / Head of School', 142, sigY + 5);

    doc.save(`ReportCard_${data.student.name.replace(/\s+/g, '_')}_${data.exam.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Controls Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm">Academic Report Card Preview</span>
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

        {/* Printable Card Area */}
        <div ref={printRef} className="p-8 sm:p-10 bg-white text-slate-800 print:p-0">
          {/* Letterhead */}
          <div className="text-center pb-6 border-b-2 border-slate-800">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-900 text-amber-400 mb-2">
              <Award className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              {data.schoolInfo.name || 'Academic Report Card'}
            </h1>
            {data.schoolInfo.affiliation && <p className="text-xs text-slate-500 font-medium">{data.schoolInfo.affiliation}</p>}
            {(data.schoolInfo.address || data.schoolInfo.phone) && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {[data.schoolInfo.address, data.schoolInfo.phone].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>

          <div className="text-center py-4">
            <span className="inline-block px-4 py-1 text-xs font-black tracking-widest text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-full uppercase">
              Official Progress Report • {data.exam.name}
            </span>
          </div>

          {/* Student Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-6">
            <div>
              <span className="text-slate-400 block font-medium">Student Name</span>
              <span className="font-bold text-slate-900 text-sm">{data.student.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Roll Number</span>
              <span className="font-bold text-slate-900">{data.student.rollNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Class & Section</span>
              <span className="font-bold text-slate-900">{data.student.className}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Admission No</span>
              <span className="font-bold text-slate-900">{data.student.admissionNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Parent / Guardian</span>
              <span className="font-semibold text-slate-700">{data.student.parentName || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Academic Session</span>
              <span className="font-semibold text-slate-700">{data.exam.session || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Attendance Rate</span>
              <span className="font-bold text-emerald-600">
                {data.attendance?.attendancePercentage == null
                  ? 'Not available'
                  : `${data.attendance.attendancePercentage}%`}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Term</span>
              <span className="font-semibold text-slate-700">{data.exam.term || '—'}</span>
            </div>
          </div>

          {/* Marks Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-3 text-center">Max Marks</th>
                  <th className="py-3 px-3 text-center">Marks Obtained</th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data.result.marks.map((m, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{m.subjectName}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{m.maxMarks}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      {m.marksObtained}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-indigo-700 bg-indigo-50 border border-indigo-200">
                        {m.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 italic">{m.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performance Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-center mb-6">
            <div>
              <div className="text-[11px] font-semibold text-indigo-600 uppercase">Total Marks</div>
              <div className="text-lg font-black text-slate-900">
                {data.result.totalMarksObtained} / {data.result.totalMaxMarks}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-indigo-600 uppercase">Percentage</div>
              <div className="text-lg font-black text-indigo-700">{data.result.percentage}%</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-indigo-600 uppercase">Overall Grade</div>
              <div className="text-lg font-black text-emerald-600">{data.result.grade}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-indigo-600 uppercase">Class Rank</div>
              <div className="text-lg font-black text-amber-600">
                {data.result.position && data.result.totalStudentsInClass
                  ? `#${data.result.position}`
                  : '—'}{' '}
                <span className="text-xs font-normal text-slate-500">
                  {data.result.position && data.result.totalStudentsInClass
                    ? `/ ${data.result.totalStudentsInClass}`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Teacher Remarks */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-10">
            <span className="font-bold text-slate-700">Class Teacher Remarks: </span>
            <span className="text-slate-600 italic">
              "{data.result.teacherRemarks || 'No remarks recorded.'}"
            </span>
          </div>

          {/* Signature Lines */}
          <div className="flex justify-between items-end pt-8 px-4 text-center text-xs text-slate-600">
            <div>
              <div className="w-40 border-b border-slate-400 mb-1" />
              <p className="font-semibold text-slate-700">Class Teacher</p>
            </div>
            <div>
              <div className="w-40 border-b border-slate-400 mb-1" />
              <p className="font-semibold text-slate-700">Examination Controller</p>
            </div>
            <div>
              <div className="w-40 border-b border-slate-400 mb-1" />
              <p className="font-semibold text-slate-700">Principal Signature & Stamp</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardPrint;
