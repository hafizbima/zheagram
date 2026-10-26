import React from 'react';
import { TEMPLATES } from '../../stores/templates';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { X, Sparkles, Layout, CheckCircle, ArrowRight } from 'lucide-react';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({ isOpen, onClose }) => {
  const { insertTemplate } = useCanvasStore();

  if (!isOpen) return null;

  const handleSelectTemplate = (key: string) => {
    insertTemplate(key);
    onClose();
  };

  const templateList = Object.values(TEMPLATES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Template Library</h2>
              <p className="text-xs text-slate-400">Choose a pre-built Miro template to kickstart your whiteboard</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          {templateList.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => handleSelectTemplate(tmpl.id)}
              className="group border border-slate-200 hover:border-blue-400 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all duration-150 bg-white hover:bg-blue-50/20 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    {tmpl.category}
                  </span>
                  {tmpl.badge && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {tmpl.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Use this template <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-400 transition-colors">
                  <Layout className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Templates are inserted directly at your current canvas viewport</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
