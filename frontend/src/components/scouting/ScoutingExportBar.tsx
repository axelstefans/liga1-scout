import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { ScoutingTranslations } from '../../i18n/scoutingReport';

export interface ScoutingExportBarProps {
  onDownloadPNG: () => void;
  onDownloadPDF: () => void;
  isExportingPng: boolean;
  isExportingPdf: boolean;
  t: ScoutingTranslations;
}

export const ScoutingExportBar: React.FC<ScoutingExportBarProps> = ({
  onDownloadPNG,
  onDownloadPDF,
  isExportingPng,
  isExportingPdf,
  t,
}) => {
  return (
    <div className="export-ignore w-full max-w-[1520px] mx-auto px-6 pt-4 pb-12 border-t border-slate-200 flex items-center justify-end gap-4">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={onDownloadPNG}
          disabled={isExportingPng || isExportingPdf}
          className="bg-[#1D70B8] hover:bg-[#155b96] disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded font-semibold text-sm inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          {isExportingPng ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.export.generatingPng}
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              {t.export.downloadPng}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDownloadPDF}
          disabled={isExportingPng || isExportingPdf}
          className="bg-[#00823B] hover:bg-[#00682f] disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded font-semibold text-sm inline-flex items-center justify-center transition-colors cursor-pointer"
        >
          {isExportingPdf ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.export.generatingPdf}
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              {t.export.downloadPdf}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ScoutingExportBar;
