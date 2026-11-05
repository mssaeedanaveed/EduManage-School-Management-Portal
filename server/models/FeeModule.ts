import mongoose, { Schema } from 'mongoose';

const model = (name: string, schema: Schema) =>
  mongoose.models[name] || mongoose.model(name, schema);

export const FeeStructureV2Model = model('FeeStructureV2', new Schema({
  _id: { type: String, required: true },
  sessionId: { type: String, required: true },
  classId: { type: String, ref: 'Class', required: true },
  version: { type: Number, default: 1 },
  effectiveFrom: { type: String, required: true },
  heads: [{ name: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }],
  dueDay: { type: Number, min: 1, max: 28, required: true },
  lateFineType: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
  lateFineAmount: { type: Number, default: 0, min: 0 },
}, { timestamps: true }));

export const OpeningBalanceModel = model('OpeningBalance', new Schema({
  _id: { type: String, required: true },
  studentId: { type: String, ref: 'Student', required: true },
  amount: { type: Number, required: true },
  asOfDate: { type: String, required: true },
  note: { type: String, default: '' },
  importedBy: { type: String, ref: 'User', required: true },
}, { timestamps: true }));

export const StudentFeeAdjustmentModel = model('StudentFeeAdjustment', new Schema({
  _id: { type: String, required: true },
  studentId: { type: String, ref: 'Student', required: true },
  type: { type: String, enum: ['discount', 'scholarship', 'waiver', 'sibling'], required: true },
  amount: { type: Number },
  percent: { type: Number, min: 0, max: 100 },
  reason: { type: String, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

export const OneTimeChargeModel = model('OneTimeCharge', new Schema({
  _id: { type: String, required: true },
  studentId: { type: String, ref: 'Student' },
  classId: { type: String, ref: 'Class' },
  name: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
}, { timestamps: true }));

export const FeeVoucherModel = model('FeeVoucher', new Schema({
  _id: { type: String, required: true },
  voucherNo: { type: String, required: true, unique: true },
  studentId: { type: String, ref: 'Student', required: true },
  parentId: { type: String, ref: 'User' },
  classId: { type: String, ref: 'Class', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  items: [{ name: String, amount: Number }],
  arrears: [{ voucherNo: String, month: Number, year: Number, balance: Number }],
  openingBalance: { type: Number, default: 0 },
  fine: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  advanceCredit: { type: Number, default: 0 },
  total: { type: Number, required: true },
  dueDate: { type: String, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Unpaid', 'Partial', 'Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
  cancelReason: { type: String, default: '' },
  carriedForward: { type: Boolean, default: false },
  carriedToVoucherId: { type: String, default: '' },
  adminReviewRequired: { type: Boolean, default: false },
  publishedAt: { type: String },
}, { timestamps: true }));

FeeVoucherModel.schema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });

export const FeePaymentModelV2 = model('FeePaymentV2', new Schema({
  _id: { type: String, required: true },
  voucherId: { type: String, ref: 'FeeVoucher', required: true },
  studentId: { type: String, ref: 'Student', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, required: true },
  date: { type: String, required: true },
  receiptNo: { type: String, required: true, unique: true },
  referenceNo: { type: String, default: '' },
  recordedBy: { type: String, ref: 'User', required: true },
  reversed: { type: Boolean, default: false },
  reversalReason: { type: String, default: '' },
  reversedBy: { type: String, ref: 'User' },
}, { timestamps: true }));

export const PaymentProofModel = model('PaymentProof', new Schema({
  _id: { type: String, required: true },
  voucherId: { type: String, ref: 'FeeVoucher', required: true },
  studentId: { type: String, ref: 'Student', required: true },
  uploadedBy: { type: String, ref: 'User', required: true },
  fileUrl: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, required: true },
  referenceNo: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  rejectReason: { type: String, default: '' },
  reviewedBy: { type: String, ref: 'User' },
}, { timestamps: true }));
PaymentProofModel.schema.index({ referenceNo: 1 }, { unique: true, sparse: true });
PaymentProofModel.schema.index({ voucherId: 1, studentId: 1, status: 1 });

export const FeeAuditLogModel = model('FeeAuditLog', new Schema({
  _id: { type: String, required: true },
  userId: { type: String, ref: 'User', required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  reason: { type: String, default: '' },
}, { timestamps: true }));

export const FeeMonthLockModel = model('FeeMonthLock', new Schema({
  _id: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  reason: { type: String, default: '' },
  lockedBy: { type: String, required: true },
  lockedAt: { type: Date, default: Date.now },
  unlockedAt: { type: Date },
  active: { type: Boolean, default: true },
}, { timestamps: true }));
FeeMonthLockModel.schema.index({ month: 1, year: 1, active: 1 });
