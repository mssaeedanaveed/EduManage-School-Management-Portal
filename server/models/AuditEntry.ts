import mongoose, { Schema } from 'mongoose';

const AuditEntrySchema = new Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    actorId: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

AuditEntrySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const AuditEntryModel =
  mongoose.models.AuditEntry || mongoose.model('AuditEntry', AuditEntrySchema);
export default AuditEntryModel;
