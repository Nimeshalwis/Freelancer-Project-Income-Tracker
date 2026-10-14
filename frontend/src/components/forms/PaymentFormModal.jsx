import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, TextArea, Select } from '../ui/FormControls.jsx';
import { validatePayment, applyServerErrors } from '../../utils/validation.js';
import { paymentsApi, getApiError } from '../../services/api.js';
import { toDateTimeLocal, fromDateTimeLocal } from '../../utils/format.js';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useNotify } from '../../context/NotificationContext.jsx';

const DEFAULT_METHODS = ['Bank Transfer', 'Cash', 'PayPal', 'Wise', 'Stripe', 'Cheque'];
/** Editable combobox: free-text method with quick-pick suggestions (contract allows any string ≤ 80 chars). */
function MethodInput({ id, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const filtered = DEFAULT_METHODS.filter((m) => m.toLowerCase().includes((value || '').toLowerCase()));
  return (
    <div className="relative">
      <TextInput
        id={id}
        value={value}
        onChange={onChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        error={error}
        placeholder="Bank Transfer"
        maxLength={80}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((method) => (
            <li key={method}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange({ target: { value: method } }); setOpen(false); }} className="w-full px-3.5 py-2 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
                {method}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaymentFormModal({ open, onClose, payment, projects = [], preselectedProjectId, onSaved }) {
  const { currency, formatCurrency } = useCurrency();
  const notify = useNotify();
  const [values, setValues] = useState({ project: '', amount: '', paymentMethod: '', paymentDate: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(payment);

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setValues({
        project: typeof payment.project === 'object' ? payment.project?._id ?? '' : payment.project ?? '',
        amount: payment.amount != null ? String(payment.amount) : '',
        paymentMethod: payment.paymentMethod ?? '',
        paymentDate: toDateTimeLocal(payment.paymentDate),
        notes: payment.notes ?? '',
      });
    } else {
      setValues({ project: preselectedProjectId || '', amount: '', paymentMethod: '', paymentDate: toDateTimeLocal(new Date()), notes: '' });
    }
    setErrors({});
  }, [open, payment, preselectedProjectId]);

  const projectOptions = useMemo(
    () =>
      projects.map((p) => {
        const clientName = typeof p.client === 'object' ? p.client?.name : '';
        return { value: p._id, label: clientName ? `${p.projectName} (${clientName})` : p.projectName };
      }),
    [projects],
  );

  const selectedProject = useMemo(() => projects.find((p) => p._id === values.project), [projects, values.project]);

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const input = { ...values, amount: values.amount === '' ? '' : Number(values.amount) };
    const validation = validatePayment(input);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSaving(true);
    try {
      const body = {
        project: values.project,
        amount: Number(values.amount),
        paymentMethod: values.paymentMethod.trim(),
      };
      if (values.paymentDate) body.paymentDate = fromDateTimeLocal(values.paymentDate);
      if (values.notes.trim()) body.notes = values.notes.trim();
      const saved = editing ? await paymentsApi.update(payment._id, body) : await paymentsApi.create(body);
      notify.success(editing ? 'Payment updated.' : 'Payment recorded.');
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      const apiError = getApiError(error);
      setErrors(applyServerErrors(apiError, ['project', 'amount', 'paymentMethod', 'paymentDate', 'notes']));
      notify.error(apiError.message); // e.g. 409 over-payment rejections surface here
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit payment' : 'Record payment'}
      subtitle={editing ? `Update this ${formatCurrency(payment?.amount)} payment` : 'Money received against a project balance'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{editing ? 'Save changes' : 'Record payment'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
        <Field label="Project" htmlFor="payment-project" error={errors.project} required hint={!projectOptions.length ? 'Create a project first on the Projects page.' : undefined}>
          <Select id="payment-project" value={values.project} onChange={set('project')} error={errors.project} options={projectOptions} placeholder="Select a project…" disabled={editing} />
        </Field>
        {selectedProject && (
          <div className="flex items-start gap-2 rounded-xl bg-indigo-50/70 px-3.5 py-2.5 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-100">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Project fee <strong>{formatCurrency(selectedProject.fee)}</strong>. Payments cannot exceed the remaining balance.
            </span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} htmlFor="payment-amount" error={errors.amount} required hint="Must be greater than zero">
            <TextInput id="payment-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={values.amount} onChange={set('amount')} error={errors.amount} placeholder="750.00" />
          </Field>
          <Field label="Payment method" htmlFor="payment-method" error={errors.paymentMethod} required>
            <MethodInput id="payment-method" value={values.paymentMethod} onChange={set('paymentMethod')} error={errors.paymentMethod} />
          </Field>
        </div>
        <Field label="Payment date" htmlFor="payment-date" error={errors.paymentDate} hint={editing ? undefined : 'Defaults to now when left blank.'}>
          <TextInput id="payment-date" type="datetime-local" value={values.paymentDate} onChange={set('paymentDate')} error={errors.paymentDate} />
        </Field>
        <Field label="Notes" htmlFor="payment-notes" error={errors.notes}>
          <TextArea id="payment-notes" value={values.notes} onChange={set('notes')} error={errors.notes} rows={3} maxLength={5000} placeholder="Deposit, milestone 1, invoice #42…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
