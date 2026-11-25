import { AlertCircle, CheckCircle2, Clock, Wrench } from 'lucide-react';

export function StatusText({ status }: { status: string }) {
  switch (status) {
    case 'Operational':
    case 'Resolved':
    case 'Completed':
    case 'Confirmed':
    case 'Reviewed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3DD68C] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Attention Required':
    case 'High':
    case 'Offline':
    case 'Open':
    case 'Failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F5B942] whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Under Maintenance':
    case 'In Progress':
    case 'Inspection Scheduled':
    case 'Scheduled':
    case 'Needs Review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#55C6D9] whitespace-nowrap">
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9AA5B1] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
}
