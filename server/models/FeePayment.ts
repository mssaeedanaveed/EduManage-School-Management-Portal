import mongoose, { Schema } from 'mongoose';

const FeePaymentSchema = new Schema(
  {
    _id: { type: String, required: true },
    voucherNo: { type: String, required: true, unique: true, uppercase: true },
    studentId: { type: String, ref: 'Student', required: true },
    studentName: { type: String, default: '' },
    rollNo: { type: String, default: '' },
    classId: { type: String, ref: 'Class', required: true },
    className: { type: String, default: '' },
    feeStructureId: { type: String, ref: 'FeeStructure' },
    month: { type: String, required: true },
    dueDate: { type: String, required: true },
    totalDue: { type: Number, required: true },
    currentFee: { type: Number, default: 0 },
    previousDues: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: { type: String, enum: ['Paid', 'Partial', 'Unpaid', 'Overdue'], default: 'Unpaid' },
    paymentDate: { type: String },
    paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'Online Card', 'Cheque'] },
    transactionRef: { type: String, default: '' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

export const FeePaymentModel =
  mongoose.models.FeePayment || mongoose.model('FeePayment', FeePaymentSchema);
export default FeePaymentModel;
