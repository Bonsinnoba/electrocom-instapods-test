import React from 'react';
import { Loader2 } from 'lucide-react';

export default function PageLoader({ message = 'Loading page...' }) {
  return (
    <div className="page-loader">
      <Loader2 className="page-loader-icon animate-spin" size={36} />
      <div className="page-loader-message">{message}</div>
    </div>
  );
}
