'use client';

import React from 'react';
import { RefreshCw, ServerOff } from 'lucide-react';

/**
 * Transient-outage panel for the workspace shell (WorkspaceContext
 * loadFailed). Shown INSTEAD of the zero-room gate: a cold backend or a
 * network blip must never read as "you have no workspaces" and must never
 * sign the user out. The staged retries in the context have already run;
 * this is the manual door back once the connection returns.
 */
export default function ReconnectPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full flex-1 flex items-center justify-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 sm:p-10 text-center shadow-2xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-sidebar border border-border flex items-center justify-center mx-auto">
          <ServerOff className="w-6 h-6 text-text-secondary" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary">Can&apos;t reach Quello</h1>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          The connection dropped (the backend may be waking up). Your session
          and workspaces are safe — retrying keeps everything as it is.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors cursor-pointer inline-flex items-center justify-center gap-2 shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
          Retry now
        </button>
      </div>
    </div>
  );
}
