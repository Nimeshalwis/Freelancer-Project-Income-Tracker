import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, TextArea } from '../ui/FormControls.jsx';
import { validateClient, applyServerErrors } from '../../utils/validation.js';
import { clientsApi, getApiError } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

const EMPTY = { name: '', email: '', phone: '', company: '', notes: '' };

export default function ClientFormModal({ open, onClose, client, onSaved }) {
  const notify = useNotify();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(client);

  useEffect(() => {
    if (open) {
      setValues(client ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, client[k] ?? ''])) } : EMPTY);
      setErrors({});
    }
  }, [open, client]);

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const validation = validateClient(values);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSaving(true);
    try {
      // Only send trimmed supplied fields; PUT/PATCH is partial but we send the full editable shape.
      const body = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v !== ''),
      );
      if (!body.name) body.name = values.name.trim(); // name is always required
      const saved = editing ? await clientsApi.update(client._id, body) : await clientsApi.create(body);
      notify.success(editing ? 'Client updated.' : 'Client added.');
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      const apiError = getApiError(error);
      setErrors(applyServerErrors(apiError, Object.keys(EMPTY)));
      notify.error(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit client' : 'Add client'}
      subtitle={editing ? `Update details for ${client?.name}` : 'Create a new client record'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{editing ? 'Save changes' : 'Add client'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="client-name" error={errors.name} required>
          <TextInput id="client-name" value={values.name} onChange={set('name')} error={errors.name} placeholder="Ada Lovelace" maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="client-email" error={errors.email}>
            <TextInput id="client-email" type="email" value={values.email} onChange={set('email')} error={errors.email} placeholder="ada@example.com" maxLength={254} />
          </Field>
          <Field label="Phone" htmlFor="client-phone" error={errors.phone}>
            <TextInput id="client-phone" value={values.phone} onChange={set('phone')} error={errors.phone} placeholder="+1 555 0100" maxLength={40} />
          </Field>
        </div>
        <Field label="Company" htmlFor="client-company" error={errors.company}>
          <TextInput id="client-company" value={values.company} onChange={set('company')} error={errors.company} placeholder="Analytical Studio" maxLength={160} />
        </Field>
        <Field label="Notes" htmlFor="client-notes" error={errors.notes} hint="Optional context, preferences, or contract terms.">
          <TextArea id="client-notes" value={values.notes} onChange={set('notes')} error={errors.notes} rows={4} maxLength={5000} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
