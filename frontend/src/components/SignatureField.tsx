import { forwardRef, useImperativeHandle, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser } from 'lucide-react';

interface Props {
  label: string;
  onChange?: () => void;
}

export interface SignatureFieldRef {
  isEmpty: () => boolean;
  getData: () => string | null;
  clear: () => void;
}

export const SignatureField = forwardRef<SignatureFieldRef, Props>(({ label, onChange }, ref) => {
  const sigPad = useRef<SignatureCanvas>(null);

  useImperativeHandle(ref, () => ({
    isEmpty: () => sigPad.current?.isEmpty() ?? true,
    getData: () => {
      if (sigPad.current?.isEmpty()) return null;
      return sigPad.current?.getCanvas().toDataURL('image/png') || null;
    },
    clear: () => sigPad.current?.clear()
  }));

  const clear = () => {
    sigPad.current?.clear();
    if (onChange) onChange();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="block text-xs font-bold text-emerald-800">{label}</label>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors bg-white px-2 py-1 rounded-md border border-slate-200"
        >
          <Eraser size={14} /> Borrar
        </button>
      </div>
      <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white shadow-inner">
        <SignatureCanvas
          ref={sigPad}
          onEnd={() => { if (onChange) onChange(); }}
          penColor="#064e3b" // emerald-900
          canvasProps={{ className: 'w-full h-32 cursor-crosshair touch-none' }}
        />
      </div>
      <span className="text-[10px] text-emerald-600 italic">Dibuja tu firma en el recuadro superior</span>
    </div>
  );
});
