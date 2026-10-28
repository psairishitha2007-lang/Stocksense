import { useRef, useState } from 'react'
import { BUSINESS_CATEGORIES } from './businessData.js'
import { createApplicationBackup, validateApplicationBackup } from './applicationStorage.js'

const MAX_BACKUP_BYTES = 10 * 1024 * 1024

function summarize(application) {
  const workspaces = Object.values(application.workspaces)
  return {
    products: workspaces.reduce((total, workspace) => total + workspace.items.length, 0),
    sales: workspaces.reduce((total, workspace) => total + workspace.salesOrders.length, 0),
    purchases: workspaces.reduce((total, workspace) => total + workspace.purchaseOrders.length, 0),
    recipes: workspaces.reduce((total, workspace) => total + Object.keys(workspace.recipes).length, 0),
    scenarios: workspaces.reduce((total, workspace) => total + workspace.plannerScenarios.length, 0),
    activities: workspaces.reduce((total, workspace) => total + (workspace.activityHistory?.length ?? 0), 0),
  }
}

export default function BackupRecovery({ applicationData, currencySettings, onRestore, onExportSuccess }) {
  const fileInput = useRef(null)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isReading, setIsReading] = useState(false)

  function exportBackup() {
    try {
      const backup = createApplicationBackup(applicationData, currencySettings)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      if (blob.size > MAX_BACKUP_BYTES) {
        setError('This workspace exceeds the 10 MB backup limit and was not exported.')
        setMessage('')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kosthagara-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
      setMessage('Backup exported. Keep this business data file private and in a safe location.')
      onExportSuccess?.()
    } catch (exportError) {
      setError(`Backup could not be exported (${exportError.message}).`)
      setMessage('')
    }
  }

  async function selectFile(event) {
    const file = event.target.files?.[0]
    setPreview(null)
    setError('')
    setMessage('')
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setError('This file exceeds the 10 MB backup limit. Choose a smaller Kosthagara backup.')
      event.target.value = ''
      return
    }

    setIsReading(true)
    try {
      const contents = await file.text()
      const backup = JSON.parse(contents)
      const validation = validateApplicationBackup(backup)
      if (!validation.valid) {
        setError(validation.message)
        return
      }
      setPreview({
        fileName: file.name,
        exportedAt: validation.exportedAt,
        backup,
        data: validation.data,
        summary: summarize(validation.data.application),
      })
    } catch (readError) {
      setError(readError instanceof SyntaxError
        ? 'The selected file is not valid JSON. Existing data was not changed.'
        : `The backup file could not be read (${readError.message}). Existing data was not changed.`)
    } finally {
      setIsReading(false)
      event.target.value = ''
    }
  }

  function confirmRestore() {
    if (!preview) return
    const result = onRestore(preview.backup)
    if (result?.saved) {
      setPreview(null)
      setError('')
      setMessage('Backup restored successfully. The current browser workspace and currency settings now match the selected backup.')
    } else {
      setError(result?.message ?? 'Backup was not restored. Existing data was not changed.')
    }
  }

  function cancelRestore() {
    setPreview(null)
    setError('')
    setMessage('Import cancelled. Existing data was not changed.')
  }

  return (
    <article className="panel business-settings-panel backup-panel">
      <div className="management-toolbar">
        <div><h2>Data Backup &amp; Recovery</h2><p>Export or restore the browser-local workspace, including all six business-category workspaces and regional settings.</p></div>
      </div>
      <div className="backup-warning" role="note">
        <strong>Keep backup files private</strong>
        <span>JSON backups contain business and organisation data. Store them securely. These are manual files—not cloud backups. Passwords, authentication secrets, tokens, credentials, and OTP values are not included.</span>
      </div>
      <p className="backup-includes">Included: inventory, stock movements, sales and production orders, suppliers, purchase orders, recipes, expenses, planner scenarios, activity history, organisation profile, and country/currency/locale settings. Numeric amounts and quantities are preserved as recorded; no currency conversion is applied.</p>
      <div className="backup-actions">
        <button className="primary-button" type="button" onClick={exportBackup}>Export Backup</button>
        <label className="secondary-button backup-file-button">
          {isReading ? 'Checking backup…' : 'Choose Backup to Import'}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={selectFile}
            disabled={isReading}
            aria-label="Choose a Kosthagara JSON backup file"
          />
        </label>
      </div>
      {error && <p className="form-error-message backup-message" role="alert">{error}</p>}
      {message && <p className="backup-success backup-message" role="status">{message}</p>}
      {preview && <div className="backup-preview" role="region" aria-label="Backup import preview">
        <h3>Review backup before replacing current data</h3>
        <p><strong>File:</strong> {preview.fileName}</p>
        <p><strong>Exported:</strong> {new Date(preview.exportedAt).toLocaleString()}</p>
        <p><strong>Business category:</strong> {BUSINESS_CATEGORIES.find(({ id }) => id === preview.data.application.businessCategory)?.name}</p>
        <p><strong>Currency:</strong> {preview.data.currencySettings.currency} · {preview.data.currencySettings.locale}</p>
        <ul>
          <li>{preview.summary.products} inventory items across all categories</li>
          <li>{preview.summary.sales} sales orders · {preview.summary.purchases} purchase orders</li>
          <li>{preview.summary.recipes} recipe records · {preview.summary.scenarios} planner scenarios</li>
          <li>{preview.summary.activities} activity history records across all categories</li>
        </ul>
        <p className="backup-replace-warning">Confirming replaces all current local workspace and currency settings with this backup. Unsupported or extra data fields are retained in the imported workspace.</p>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={cancelRestore}>Cancel import</button>
          <button className="primary-button" type="button" onClick={confirmRestore}>Replace data with this backup</button>
        </div>
      </div>}
    </article>
  )
}
