import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, TextArea, Select } from '../ui/FormControls.jsx';
import { validateProject, applyServerErrors, PROJECT_STATUSES } from '../../utils/validation.js';
import { projectsApi, getApiError } from '../../services/api.js';
import { useNotify } from '../../context/NotificationContext.jsx';

const EMPTY = { projectName: '', client: '', fee: '', status: 'Pending', description: '', startDate: '', dueDate: '' };

/** Dates use datetime-local inputs converted to ISO strings (backend expects ISO dates). */
const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromDateInput = (value) => (value ? new Date(value).toISOString() : undefined);

export default function ProjectFormModal({ open, onClose, project, clients = [], onSaved }) {
  const notify = useNotify();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(project);

  useEffect(() => {
    if (!open) return;
    if (project) {
      setValues({
        projectName: project.projectName ?? '',
        client: typeof project.client === 'object' ? project.client?._id ?? '' : project.client ?? '',
        fee: project.fee != null ? String(project.fee) : '',
        status: project.status ?? 'Pending',
        description: project.description ?? '',
        startDate: toDateInput(project.startDate),
        dueDate: toDateInput(project.dueDate),
      });
    } else {
      setValues(EMPTY);
    }
    setErrors({});
  }, [open, project]);

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c._id, label: c.company ? `${c.name} — ${c.company}` : c.name })),
    [clients],
  );

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const input = { ...values, startDate: fromDateInput(values.startDate), dueDate: fromDateInput(values.dueDate), fee: values.fee === '' ? '' : Number(values.fee) };
    const validation = validateProject(input);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSaving(true);
    try {
      const body = {
        projectName: values.projectName.trim(),
        client: values.client,
        fee: Number(values.fee),
        status: values.status,
      };
      // Omit blank optional fields (partial-update semantics keep existing values when editing).
      if (values.description.trim()) body.description = values.description.trim();
      if (values.startDate) body.startDate = fromDateInput(values.startDate);
      if (values.dueDate) body.dueDate = fromDateInput(values.dueDate);
      const saved = editing ? await projectsApi.update(project._id, body) : await projectsApi.create(body);
      notify.success(editing ? 'Project updated.' : 'Project created.');
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
      title={editing ? 'Edit project' : 'New project'}
      subtitle={editing ? project?.projectName : 'Scope, fee, and timeline for a client engagement'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{editing ? 'Save changes' : 'Create project'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
        <Field label="Project name" htmlFor="project-name" error={errors.projectName} required>
          <TextInput id="project-name" value={values.projectName} onChange={set('projectName')} error={errors.projectName} placeholder="Company website redesign" maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Client"
            htmlFor="project-client"
            error={errors.client}
            required
            hint={!clientOptions.length ? 'Add a client first on the Clients page.' : undefined}
          >
            <Select id="project-client" value={values.client} onChange={set('client')} error={errors.client} options={clientOptions} placeholder="Select a client…" />
          </Field>
          <Field label="Status" htmlFor="project-status" error={errors.status} required>
            <Select id="project-status" value={values.status} onChange={set('status')} error={errors.status} options={PROJECT_STATUSES} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fee" htmlFor="project-fee" error={errors.fee} required hint="Up to 2 decimals">
            <TextInput id="project-fee" type="number" min="0" step="0.01" inputMode="decimal" value={values.fee} onChange={set('fee')} error={errors.fee} placeholder="2500.00" />
          </Field>
          <Field label="Start date" htmlFor="project-start" error={errors.startDate}>
            <TextInput id="project-start" type="datetime-local" value={values.startDate} onChange={set('startDate')} error={errors.startDate} />
          </Field>
          <Field label="Due date" htmlFor="project-due" error={errors.dueDate}>
            <TextInput id="project-due" type="datetime-local" value={values.dueDate} onChange={set('dueDate')} error={errors.dueDate} />
          </Field>
        </div>
        <Field label="Description" htmlFor="project-description" error={errors.description}>
          <TextArea id="project-description" value={values.description} onChange={set('description')} error={errors.description} rows={4} maxLength={5000} placeholder="Deliverables, milestones, exclusions…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
