import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Check, X as XIcon, Minus, PenTool, CheckCircle, Printer } from 'lucide-react';
import { getChecklistById, updateChecklistRow, submitChecklist, reviewChecklist } from '../api/checklists';
import type { DailyChecklist, ChecklistRow } from '../api/checklists';
import { useAuth } from '../context/AuthContext';
import { parseDateOnly } from '../utils/dateUtils';

export default function ChecklistFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchChecklist(id);
    }
  }, [id]);

  const fetchChecklist = async (checklistId: string) => {
    try {
      setIsLoading(true);
      const data = await getChecklistById(checklistId);
      setChecklist(data);
    } catch (error) {
      console.error('Error fetching checklist', error);
      alert('Error cargando el checklist.');
      navigate('/checklists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (rowId: string, line: string, status: string | null) => {
    if (!checklist || checklist.status !== 'DRAFT') return; // Solo editable en DRAFT
    
    // Update local state for immediate feedback
    const updatedRows = checklist.rows?.map(row => {
      if (row.id === rowId) {
        return { ...row, [line]: status };
      }
      return row;
    });
    setChecklist({ ...checklist, rows: updatedRows });

    // Save to server
    try {
      await updateChecklistRow(rowId, { [line]: status });
    } catch (error) {
      console.error('Error updating row', error);
      // Opcional: Revertir si falla
    }
  };

  const handleObservationChange = async (rowId: string, obs: string) => {
    if (!checklist || checklist.status !== 'DRAFT') return;
    
    const updatedRows = checklist.rows?.map(row => {
      if (row.id === rowId) {
        return { ...row, observations: obs };
      }
      return row;
    });
    setChecklist({ ...checklist, rows: updatedRows });
  };

  const handleObservationBlur = async (rowId: string, obs: string) => {
    if (!checklist || checklist.status !== 'DRAFT') return;
    try {
      await updateChecklistRow(rowId, { observations: obs });
    } catch (error) {
      console.error('Error saving observation', error);
    }
  };

  const handleSubmit = async () => {
    if (!id || !window.confirm('¿Estás seguro de enviar este checklist? Ya no podrás editarlo.')) return;
    
    try {
      setIsSaving(true);
      await submitChecklist(id);
      await fetchChecklist(id); // Reload to get updated status and signatures
    } catch (error) {
      console.error('Error enviando checklist', error);
      alert('Error al enviar el checklist.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async () => {
    if (!id || !window.confirm('¿Aprobar este checklist?')) return;
    
    try {
      setIsSaving(true);
      await reviewChecklist(id);
      await fetchChecklist(id);
    } catch (error) {
      console.error('Error aprobando checklist', error);
      alert('Error al aprobar el checklist.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStatusButton = (row: ChecklistRow, line: string) => {
    const currentValue = (row as any)[line] || '';
    const isEditable = checklist?.status === 'DRAFT';
    const fieldType = (row as any).field_type || 'CHECKBOX';

    if (fieldType === 'NUMBER' || fieldType === 'TEXT') {
      return (
        <input
          type={fieldType === 'NUMBER' ? 'number' : 'text'}
          disabled={!isEditable}
          value={currentValue}
          onChange={(e) => handleStatusChange(row.id, line, e.target.value)}
          placeholder="-"
          className="w-16 h-10 px-2 text-center rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-500"
        />
      );
    }

    const getColors = (val: string) => {
      if (val === 'OK') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      if (val === 'FAIL') return 'bg-rose-100 text-rose-700 border-rose-300';
      if (val === 'NA') return 'bg-slate-100 text-slate-700 border-slate-300';
      return 'bg-white text-slate-300 border-slate-200 hover:border-slate-300';
    };

    const nextStatus = (current: string | null) => {
      if (current === 'OK') return 'FAIL';
      if (current === 'FAIL') return 'NA';
      if (current === 'NA') return null;
      return 'OK';
    };

    return (
      <button
        disabled={!isEditable}
        onClick={() => handleStatusChange(row.id, line, nextStatus(currentValue))}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${getColors(currentValue)} ${!isEditable && 'opacity-80 cursor-not-allowed'}`}
      >
        {currentValue === 'OK' && <Check size={18} strokeWidth={3} />}
        {currentValue === 'FAIL' && <XIcon size={18} strokeWidth={3} />}
        {currentValue === 'NA' && <Minus size={18} strokeWidth={3} />}
      </button>
    );
  };

  if (isLoading || !checklist) {
    return <div className="p-8 text-center text-slate-500">Cargando formato...</div>;
  }

  const isDraft = checklist.status === 'DRAFT';
  const isPendingReview = checklist.status === 'COMPLETED';
  const canReview = isPendingReview && hasPermission('APPROVE_CHECKLIST');

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in zoom-in-95 duration-300 print:p-0 print:m-0 print:w-full print:max-w-none">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:flex-row print:mb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/checklists')}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors print:hidden"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 print:text-xl">Check List Diario de Mantenimiento</h1>
            <p className="text-slate-500 font-medium mt-1 print:text-sm">
              {format(parseDateOnly(checklist.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-medium shadow-sm"
          >
            <Printer size={20} />
            <span className="hidden md:inline">Imprimir / PDF</span>
          </button>

          {isDraft && (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm"
            >
              <Save size={20} />
              {isSaving ? 'Guardando...' : 'Firmar y Enviar'}
            </button>
          )}
          
          {canReview && (
            <button
              onClick={handleReview}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm"
            >
              <PenTool size={20} />
              {isSaving ? 'Aprobando...' : 'Aprobar Checklist'}
            </button>
          )}
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 flex gap-3 text-sm print:hidden">
        <CheckCircle className="shrink-0 mt-0.5" size={18} />
        <div>
          <strong>Instrucciones:</strong> Toca los recuadros para alternar entre los estados: 
          <span className="inline-flex items-center mx-2 text-emerald-700"><Check size={14} className="mr-1"/> Bien</span>
          <span className="inline-flex items-center mx-2 text-rose-700"><XIcon size={14} className="mr-1"/> Anomalía</span>
          <span className="inline-flex items-center mx-2 text-slate-600"><Minus size={14} className="mr-1"/> N/A</span>
        </div>
      </div>

      {/* Matriz de Actividades */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse print:text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white text-sm font-semibold print:bg-slate-200 print:text-black">
                <th className="px-4 py-4 w-12 text-center print:py-2 print:px-2 border print:border-slate-800">#</th>
                <th className="px-4 py-4 min-w-[300px] print:min-w-0 print:w-auto print:py-2 print:px-2 border print:border-slate-800">ACTIVIDAD</th>
                <th className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">L1</th>
                <th className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">L2</th>
                <th className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">L3</th>
                <th className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">L4</th>
                <th className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">L5</th>
                <th className="px-4 py-4 min-w-[250px] print:min-w-0 print:w-auto print:py-2 print:px-2 border print:border-slate-800">OBSERVACIONES (Falla detectada)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-800">
              {checklist.rows?.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors group print:break-inside-avoid">
                  <td className="px-4 py-3 text-center text-slate-400 font-medium print:py-1 print:px-2 border print:border-slate-800 print:text-black">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 leading-snug print:py-1 print:px-2 border print:border-slate-800">
                    {row.activity_name}
                  </td>
                  <td className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                    {renderStatusButton(row, 'L1_status')}
                  </td>
                  <td className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                    {renderStatusButton(row, 'L2_status')}
                  </td>
                  <td className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                    {renderStatusButton(row, 'L3_status')}
                  </td>
                  <td className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                    {renderStatusButton(row, 'L4_status')}
                  </td>
                  <td className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                    {renderStatusButton(row, 'L5_status')}
                  </td>
                  <td className="px-4 py-3 print:py-1 print:px-2 border print:border-slate-800">
                    <input
                      type="text"
                      className="w-full text-sm p-2 border-0 bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-lg transition-colors placeholder:text-slate-300 print:p-0 print:bg-transparent print:text-black"
                      placeholder="Sin observaciones..."
                      value={row.observations || ''}
                      onChange={(e) => handleObservationChange(row.id, e.target.value)}
                      onBlur={(e) => handleObservationBlur(row.id, e.target.value)}
                      disabled={!isDraft}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firmas */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 print:mt-12 print:break-inside-avoid">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center print:border-none print:p-2">
          <div className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider print:text-black">Nombre y Firma del Técnico</div>
          {checklist.technician ? (
            <div className="text-xl font-bold text-slate-900 border-b-2 border-slate-800 pb-2 px-8 inline-block print:text-lg">
              {checklist.technician.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center print:border-none print:p-2">
          <div className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider print:text-black">Nombre y Firma Líder Mantenimiento</div>
          {checklist.leader ? (
            <div className="text-xl font-bold text-slate-900 border-b-2 border-slate-800 pb-2 px-8 inline-block print:text-lg">
              {checklist.leader.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>
      </div>
    </div>
  );
}
