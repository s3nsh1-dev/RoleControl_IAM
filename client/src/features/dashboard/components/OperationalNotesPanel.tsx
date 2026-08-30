import { Panel } from '@/components/ui'

export function OperationalNotesPanel() {
  return (
    <Panel
      title="Operational notes"
      description="The UI mirrors backend capabilities while the backend remains the source of authorization truth."
    >
      <div className="note-grid">
        <p>401 responses trigger a refresh-cookie request and retry.</p>
        <p>429 responses surface as rate-limit toasts with retry timing.</p>
        <p>
          Sensitive mutations ask for confirmation before calling audited
          endpoints.
        </p>
      </div>
    </Panel>
  )
}
