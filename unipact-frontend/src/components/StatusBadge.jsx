import React from 'react';
import { statusClass, statusLabel } from '../utils/format';

const StatusBadge = ({ status, label, className = '' }) => (
  <span className={`badge ${statusClass(status)} ${className}`}>{label || statusLabel(status)}</span>
);

export default StatusBadge;
